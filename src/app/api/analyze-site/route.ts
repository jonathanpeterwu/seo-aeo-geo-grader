import { NextRequest, NextResponse } from "next/server"
import { parseHtml } from "@/lib/parsers/parse-html"
import { extractMetaTags } from "@/lib/parsers/meta"
import { extractSchemaData } from "@/lib/parsers/schema"
import { analyzeRobotsTxt } from "@/lib/parsers/robots"
import { analyzeSitemap } from "@/lib/parsers/sitemap"
import { analyzeContent } from "@/lib/parsers/content"
import {
  analyzeAIEngineSignals,
  diagnoseAIEngines,
} from "@/lib/parsers/ai-engines"
import { analyzeAIDiscovery } from "@/lib/parsers/ai-discovery"
import {
  discoverUrls,
  extractRobotsSitemapUrls,
  DiscoveredUrl,
} from "@/lib/parsers/url-discovery"
import { gradeUrl } from "@/lib/grader"
import { canAnalyze, consumeCredit, getRemaining, getPlan } from "@/lib/credits"
import { AnalysisReport } from "@/types"

/** Max pages to grade in a single batch request */
const BATCH_LIMIT = 50

/** Concurrency: grade N pages at a time */
const CONCURRENCY = 5

interface PageResult {
  url: string
  sources: string[]
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

interface SiteHealthIssue {
  type: "thin_content" | "duplicate_title" | "orphaned_page" | "deep_url" | "missing_viewport" | "no_canonical"
  severity: "high" | "medium" | "low"
  url: string
  details: string
}

interface SiteHealth {
  issues: SiteHealthIssue[]
  thinPages: number
  duplicateTitles: number
  deepUrls: number
  missingViewport: number
  missingCanonical: number
  urlPatterns: { pattern: string; count: number }[]
  maxDepth: number
  averageDepth: number
}

function analyzeSiteHealth(results: PageResult[], allDiscoveredUrls: string[]): SiteHealth {
  const issues: SiteHealthIssue[] = []
  const successful = results.filter((r) => r.report)
  let thinPages = 0
  let duplicateTitles = 0
  let deepUrls = 0
  let missingViewport = 0
  let missingCanonical = 0

  // ── Thin content detection (<300 words) ─────────────────────
  for (const r of successful) {
    const depthCheck = r.report!.categories
      .flatMap((c) => c.checks)
      .find((ch) => ch.id === "depth")
    if (depthCheck) {
      const wordMatch = depthCheck.details.match(/([\d,]+)\s*words/)
      if (wordMatch) {
        const wordCount = parseInt(wordMatch[1].replace(/,/g, ""), 10)
        if (wordCount < 300) {
          thinPages++
          issues.push({
            type: "thin_content",
            severity: "high",
            url: r.url,
            details: `Only ${wordCount} words — thin content risk, may be ignored by search engines`,
          })
        }
      }
    }
  }

  // ── Duplicate title detection ───────────────────────────────
  const titleMap = new Map<string, string[]>()
  for (const r of successful) {
    const titleCheck = r.report!.categories
      .flatMap((c) => c.checks)
      .find((ch) => ch.id === "title")
    if (titleCheck && titleCheck.passed) {
      // Extract title from details: "Title text" (N chars)
      const titleMatch = titleCheck.details.match(/^"(.+?)"\s*\(/)
      if (titleMatch) {
        const title = titleMatch[1].toLowerCase()
        if (!titleMap.has(title)) titleMap.set(title, [])
        titleMap.get(title)!.push(r.url)
      }
    }
  }
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      duplicateTitles += urls.length
      for (const url of urls) {
        issues.push({
          type: "duplicate_title",
          severity: "medium",
          url,
          details: `Duplicate title "${title}" shared with ${urls.length - 1} other page(s)`,
        })
      }
    }
  }

  // ── URL depth analysis ──────────────────────────────────────
  const depths: number[] = []
  const pathPrefixes = new Map<string, number>()

  for (const r of successful) {
    try {
      const parsed = new URL(r.url)
      const segments = parsed.pathname.split("/").filter(Boolean)
      const depth = segments.length
      depths.push(depth)

      if (depth > 4) {
        deepUrls++
        issues.push({
          type: "deep_url",
          severity: "low",
          url: r.url,
          details: `URL depth ${depth} — pages >4 levels deep get less crawl equity`,
        })
      }

      // Track URL patterns (first 2 segments)
      const prefix = "/" + segments.slice(0, Math.min(2, segments.length)).join("/")
      pathPrefixes.set(prefix, (pathPrefixes.get(prefix) ?? 0) + 1)
    } catch { /* skip */ }
  }

  // ── Missing viewport ────────────────────────────────────────
  for (const r of successful) {
    const vpCheck = r.report!.categories
      .flatMap((c) => c.checks)
      .find((ch) => ch.id === "viewport")
    if (vpCheck && !vpCheck.passed) {
      missingViewport++
      issues.push({
        type: "missing_viewport",
        severity: "high",
        url: r.url,
        details: "No viewport meta tag — page not mobile-friendly",
      })
    }
  }

  // ── Missing canonical ───────────────────────────────────────
  for (const r of successful) {
    const canCheck = r.report!.categories
      .flatMap((c) => c.checks)
      .find((ch) => ch.id === "canonical")
    if (canCheck && !canCheck.passed) {
      missingCanonical++
      issues.push({
        type: "no_canonical",
        severity: "medium",
        url: r.url,
        details: "No canonical URL — risk of duplicate content in search index",
      })
    }
  }

  // Sort issues: high first
  const severityOrder = { high: 0, medium: 1, low: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // URL patterns sorted by count
  const urlPatterns = [...pathPrefixes.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const maxDepth = depths.length > 0 ? Math.max(...depths) : 0
  const averageDepth = depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0

  return {
    issues,
    thinPages,
    duplicateTitles,
    deepUrls,
    missingViewport,
    missingCanonical,
    urlPatterns,
    maxDepth,
    averageDepth,
  }
}

async function fetchText(fetchUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOGraderBot/1.0)" },
      redirect: "follow",
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

async function gradeOnePage(
  discovered: DiscoveredUrl,
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
      const res = await fetch(discovered.url, {
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
      return { url: discovered.url, sources: discovered.sources, report: null, error: "Fetch failed or timed out" }
    } finally {
      clearTimeout(timer)
    }

    if (!html) {
      return { url: discovered.url, sources: discovered.sources, report: null, error: "Empty response" }
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

    return { url: resolvedUrl, sources: discovered.sources, report, error: null }
  } catch {
    return { url: discovered.url, sources: discovered.sources, report: null, error: "Unexpected error" }
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
          error: "Site-wide scan requires Full Site Pass ($99) or higher. Use coupon 'zeus' for free access.",
          currentPlan: plan.planId,
        },
        { status: 403 }
      )
    }

    const origin = parsedUrl.origin

    // ── Phase 1: Fetch all discovery files in parallel ────────
    const [robotsTxt, sitemapRaw, llmsTxt, llmsFullTxt, aiPluginText, securityTxt] =
      await Promise.all([
        fetchText(`${origin}/robots.txt`),
        fetchText(`${origin}/sitemap.xml`),
        fetchText(`${origin}/llms.txt`),
        fetchText(`${origin}/llms-full.txt`),
        fetchText(`${origin}/.well-known/ai-plugin.json`),
        fetchText(`${origin}/.well-known/security.txt`),
      ])

    // Validate primary sitemap
    let sitemapXml: string | null = null
    if (sitemapRaw && (sitemapRaw.includes("<urlset") || sitemapRaw.includes("<sitemapindex"))) {
      sitemapXml = sitemapRaw
    }

    // ── Phase 2: Follow all Sitemap: directives in robots.txt ─
    const robotsSitemapUrls = extractRobotsSitemapUrls(robotsTxt)
    const additionalSitemaps: string[] = []

    // Fetch any sitemaps referenced in robots.txt that aren't the default /sitemap.xml
    const defaultSitemapUrl = `${origin}/sitemap.xml`
    const extraSitemapUrls = robotsSitemapUrls.filter(
      (u) => u !== defaultSitemapUrl && u !== `${origin}/sitemap.xml/`
    )

    if (extraSitemapUrls.length > 0) {
      const extraResults = await Promise.all(extraSitemapUrls.map((u) => fetchText(u)))
      for (const text of extraResults) {
        if (text && (text.includes("<urlset") || text.includes("<sitemapindex"))) {
          additionalSitemaps.push(text)
          // Also use first valid one as fallback if no primary sitemap
          if (!sitemapXml) sitemapXml = text
        }
      }
    }

    // Fallback: if no sitemap yet, try the first robots.txt Sitemap: directive
    if (!sitemapXml && robotsSitemapUrls.length > 0) {
      const fallback = await fetchText(robotsSitemapUrls[0])
      if (fallback && (fallback.includes("<urlset") || fallback.includes("<sitemapindex"))) {
        sitemapXml = fallback
      }
    }

    // ── Phase 3: Multi-source URL discovery ───────────────────
    const discovery = discoverUrls({
      origin,
      sitemapXml,
      robotsTxt,
      llmsTxt,
      llmsFullTxt,
      additionalSitemaps,
    })

    if (discovery.totalUnique === 0) {
      return NextResponse.json(
        {
          error: "No URLs found across sitemap.xml, llms.txt, or robots.txt. Cannot perform site-wide scan.",
          discoveryAttempted: {
            robotsTxt: !!robotsTxt,
            sitemapXml: !!sitemapXml,
            llmsTxt: !!llmsTxt,
            llmsFullTxt: !!llmsFullTxt,
            robotsSitemapDirectives: robotsSitemapUrls.length,
          },
        },
        { status: 422 }
      )
    }

    // Apply path filter
    let filtered = discovery.urls
    if (filter) {
      filtered = filtered.filter((d) => {
        try {
          return new URL(d.url).pathname.startsWith(filter)
        } catch {
          return false
        }
      })
    }

    const totalFound = filtered.length
    const toGrade = filtered.slice(0, BATCH_LIMIT)

    // Parse ai-plugin.json
    let aiPluginJson: Record<string, unknown> | null = null
    if (aiPluginText) {
      try {
        aiPluginJson = JSON.parse(aiPluginText)
      } catch { /* skip */ }
    }

    // ── Phase 4: Grade all pages with bounded concurrency ─────
    const tasks = toGrade.map(
      (discovered) => () =>
        gradeOnePage(
          discovered,
          robotsTxt,
          sitemapXml,
          llmsTxt,
          llmsFullTxt,
          aiPluginJson,
          securityTxt
        )
    )

    const results = await pool(tasks, CONCURRENCY)

    // Consume credits
    for (const r of results) {
      if (r.report && canAnalyze(sessionId, r.url)) {
        consumeCredit(sessionId, r.url)
      }
    }

    const summary = summarize(results)
    const siteHealth = analyzeSiteHealth(results, toGrade.map((d) => d.url))

    return NextResponse.json({
      summary,
      siteHealth,
      pages: results,
      discovery: {
        totalUnique: discovery.totalUnique,
        sources: discovery.sources,
      },
      totalMatchingFilter: totalFound,
      pagesScanned: toGrade.length,
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
