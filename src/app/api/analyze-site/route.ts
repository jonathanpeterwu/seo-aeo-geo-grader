import { NextRequest, NextResponse } from "next/server"
import { fetchPageData } from "@/lib/fetcher"
import { parseHtml } from "@/lib/parsers/parse-html"
import { extractMetaTags } from "@/lib/parsers/meta"
import { extractSchemaData } from "@/lib/parsers/schema"
import { analyzeRobotsTxt } from "@/lib/parsers/robots"
import { analyzeSitemap, extractSitemapUrls } from "@/lib/parsers/sitemap"
import { analyzeContent } from "@/lib/parsers/content"
import {
  analyzeAIEngineSignals,
  diagnoseAIEngines,
} from "@/lib/parsers/ai-engines"
import { analyzeAIDiscovery } from "@/lib/parsers/ai-discovery"
import { gradeUrl } from "@/lib/grader"
import { canAnalyze, consumeCredit, getRemaining, getPlan } from "@/lib/credits"
import { AnalysisReport } from "@/types"

/** Max pages to grade in a single batch request */
const BATCH_LIMIT = 50

/** Concurrency: grade N pages at a time */
const CONCURRENCY = 5

interface PageResult {
  url: string
  report: AnalysisReport | null
  error: string | null
}

interface SiteSummary {
  pagesAnalyzed: number
  averageScore: number
  averagePercentage: number
  gradeDistribution: Record<string, number>
  lowestPages: { url: string; percentage: number; grade: string }[]
  categoryAverages: Record<string, number>
}

async function gradeOnePage(
  pageUrl: string,
  sharedRobotsTxt: string | null,
  sharedSitemapXml: string | null,
  sharedLlmsTxt: string | null,
  sharedLlmsFullTxt: string | null,
  sharedAiPluginJson: Record<string, unknown> | null,
  sharedSecurityTxt: string | null
): Promise<PageResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    let html: string
    let resolvedUrl: string
    try {
      const res = await fetch(pageUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SEOGraderBot/1.0; +https://seo-grader.example.com)",
        },
        redirect: "follow",
      })
      html = await res.text()
      resolvedUrl = res.url
    } catch {
      return { url: pageUrl, report: null, error: "Fetch failed or timed out" }
    } finally {
      clearTimeout(timer)
    }

    if (!html) {
      return { url: pageUrl, report: null, error: "Empty response" }
    }

    const $ = parseHtml(html)
    const meta = extractMetaTags($)
    const schema = extractSchemaData($)
    const content = analyzeContent($, resolvedUrl)
    const aiSignals = analyzeAIEngineSignals($, sharedRobotsTxt)
    const aiDiagnostics = diagnoseAIEngines(aiSignals)
    const robots = analyzeRobotsTxt(sharedRobotsTxt)
    const sitemap = analyzeSitemap(sharedSitemapXml)
    const aiDiscovery = analyzeAIDiscovery(
      sharedRobotsTxt,
      sharedSitemapXml,
      sharedLlmsTxt,
      sharedLlmsFullTxt,
      sharedAiPluginJson
    )

    const report = gradeUrl(
      resolvedUrl,
      meta,
      schema,
      content,
      robots,
      sitemap,
      aiSignals,
      aiDiscovery,
      sharedSecurityTxt
    )
    report.aiEngineDiagnostics = aiDiagnostics
    report.aiDiscovery = aiDiscovery

    return { url: resolvedUrl, report, error: null }
  } catch {
    return { url: pageUrl, report: null, error: "Unexpected error" }
  }
}

function summarize(results: PageResult[]): SiteSummary {
  const successful = results.filter((r) => r.report)
  const reports = successful.map((r) => r.report!)

  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  const categoryTotals: Record<string, number[]> = {}

  for (const r of reports) {
    gradeDistribution[r.overallGrade] = (gradeDistribution[r.overallGrade] || 0) + 1
    for (const cat of r.categories) {
      if (!categoryTotals[cat.category]) categoryTotals[cat.category] = []
      categoryTotals[cat.category].push(cat.percentage)
    }
  }

  const categoryAverages: Record<string, number> = {}
  for (const [cat, vals] of Object.entries(categoryTotals)) {
    categoryAverages[cat] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.overallScore, 0) / reports.length)
    : 0
  const avgPct = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.overallPercentage, 0) / reports.length)
    : 0

  const lowestPages = [...successful]
    .sort((a, b) => a.report!.overallPercentage - b.report!.overallPercentage)
    .slice(0, 10)
    .map((r) => ({
      url: r.url,
      percentage: r.report!.overallPercentage,
      grade: r.report!.overallGrade,
    }))

  return {
    pagesAnalyzed: reports.length,
    averageScore: avgScore,
    averagePercentage: avgPct,
    gradeDistribution,
    lowestPages,
    categoryAverages,
  }
}

/** Run promises with bounded concurrency */
async function pool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
  return results
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, sessionId, filter } = body as {
      url: string
      sessionId: string
      filter?: string // e.g. "/blog" to only grade blog posts
    }

    if (!url || !sessionId) {
      return NextResponse.json(
        { error: "url and sessionId are required" },
        { status: 400 }
      )
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol")
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    // Check plan allows full site scan
    const plan = getPlan(sessionId)
    if (!["site_pass", "pro", "agency"].includes(plan.planId)) {
      return NextResponse.json(
        {
          error: "Site-wide scan requires Full Site Pass ($99) or higher.",
          currentPlan: plan.planId,
        },
        { status: 403 }
      )
    }

    const origin = parsedUrl.origin

    // Fetch shared discovery files once
    const fetchText = async (fetchUrl: string): Promise<string | null> => {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        const res = await fetch(fetchUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOGraderBot/1.0)" },
        })
        clearTimeout(timer)
        if (!res.ok) return null
        const text = await res.text()
        if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) return null
        return text || null
      } catch {
        return null
      }
    }

    const [robotsTxt, sitemapRaw, llmsTxt, llmsFullTxt, aiPluginText, securityTxt] =
      await Promise.all([
        fetchText(`${origin}/robots.txt`),
        fetchText(`${origin}/sitemap.xml`),
        fetchText(`${origin}/llms.txt`),
        fetchText(`${origin}/llms-full.txt`),
        fetchText(`${origin}/.well-known/ai-plugin.json`),
        fetchText(`${origin}/.well-known/security.txt`),
      ])

    // Resolve sitemap (may be at alternate location via robots.txt)
    let sitemapXml = sitemapRaw
    if (!sitemapXml && robotsTxt) {
      const match = robotsTxt.match(/^Sitemap:\s*(.+)$/im)
      if (match) {
        const alt = await fetchText(match[1].trim())
        if (alt && (alt.includes("<urlset") || alt.includes("<sitemapindex"))) {
          sitemapXml = alt
        }
      }
    }

    // Extract URLs from sitemap
    let pageUrls = extractSitemapUrls(sitemapXml)

    if (pageUrls.length === 0) {
      return NextResponse.json(
        { error: "No URLs found in sitemap.xml. Cannot perform site-wide scan." },
        { status: 422 }
      )
    }

    // Apply path filter (e.g. "/blog" to only grade blog posts)
    if (filter) {
      pageUrls = pageUrls.filter((u) => {
        try {
          return new URL(u).pathname.startsWith(filter)
        } catch {
          return false
        }
      })
    }

    // Cap at BATCH_LIMIT
    const totalFound = pageUrls.length
    pageUrls = pageUrls.slice(0, BATCH_LIMIT)

    // Parse ai-plugin.json
    let aiPluginJson: Record<string, unknown> | null = null
    if (aiPluginText) {
      try {
        aiPluginJson = JSON.parse(aiPluginText)
      } catch { /* skip */ }
    }

    // Grade all pages with bounded concurrency
    const tasks = pageUrls.map(
      (pageUrl) => () =>
        gradeOnePage(
          pageUrl,
          robotsTxt,
          sitemapXml,
          llmsTxt,
          llmsFullTxt,
          aiPluginJson,
          securityTxt
        )
    )

    const results = await pool(tasks, CONCURRENCY)

    // Consume credits for each graded page
    for (const r of results) {
      if (r.report && canAnalyze(sessionId, r.url)) {
        consumeCredit(sessionId, r.url)
      }
    }

    const summary = summarize(results)

    return NextResponse.json({
      summary,
      pages: results,
      totalSitemapUrls: totalFound,
      pagesScanned: pageUrls.length,
      filter: filter || null,
      creditsRemaining: getRemaining(sessionId),
    })
  } catch (err) {
    console.error("Site analysis error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
