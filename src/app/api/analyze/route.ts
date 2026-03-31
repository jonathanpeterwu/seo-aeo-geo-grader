import { NextRequest, NextResponse } from "next/server"
import { fetchPageData } from "@/lib/fetcher"
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
import { gradeUrl } from "@/lib/grader"
import {
  canAnalyze,
  consumeCredit,
  getRemaining,
  isHomePageUrl,
  canViewSuggestions,
  getPlan,
} from "@/lib/credits"
import { generateSuggestions } from "@/lib/suggestions"
import { indexReport } from "@/lib/site-index"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, sessionId } = body as { url: string; sessionId: string }

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

    // Check credits
    if (!canAnalyze(sessionId, url)) {
      const plan = getPlan(sessionId)
      return NextResponse.json(
        {
          error:
            "No credits remaining. Upgrade to Full Site Pass ($99) to scan unlimited pages.",
          creditsRemaining: getRemaining(sessionId),
          currentPlan: plan.planId,
        },
        { status: 403 }
      )
    }

    // Fetch page data
    const data = await fetchPageData(parsedUrl.toString())

    if (!data.html) {
      return NextResponse.json(
        {
          error:
            "Could not fetch the page. Please check the URL and try again.",
        },
        { status: 422 }
      )
    }

    // Parse HTML once — share $ across all parsers
    const $ = parseHtml(data.html)

    // Run all parsers on shared $ (no redundant cheerio.load calls)
    const meta = extractMetaTags($)
    const schema = extractSchemaData($)
    const content = analyzeContent($, data.resolvedUrl)
    const aiSignals = analyzeAIEngineSignals($, data.robotsTxt)
    const aiDiagnostics = diagnoseAIEngines(aiSignals)

    // These don't need HTML parsing
    const robots = analyzeRobotsTxt(data.robotsTxt)
    const sitemap = analyzeSitemap(data.sitemapXml)
    const aiDiscovery = analyzeAIDiscovery(
      data.robotsTxt,
      data.sitemapXml,
      data.llmsTxt,
      data.llmsFullTxt,
      data.aiPluginJson
    )

    // Grade (100pt rubric — includes AI signals + discovery data)
    const report = gradeUrl(
      data.resolvedUrl,
      meta,
      schema,
      content,
      robots,
      sitemap,
      aiSignals,
      aiDiscovery,
      data.securityTxt
    )

    // Attach AI diagnostics + discovery
    report.aiEngineDiagnostics = aiDiagnostics
    report.aiDiscovery = aiDiscovery

    // Persist to site index (long-term domain storage)
    indexReport(report)

    // Consume credit
    consumeCredit(sessionId, url)

    // Generate suggestions once — reuse for both count and full data
    const allChecks = report.categories.flatMap((c) => c.checks)
    const allSuggestions = generateSuggestions(allChecks)
    const hasSuggestions = canViewSuggestions(sessionId)

    const plan = getPlan(sessionId)

    return NextResponse.json({
      report,
      suggestions: hasSuggestions ? allSuggestions : null,
      suggestionCount: allSuggestions.length,
      creditsRemaining: getRemaining(sessionId),
      isHomePage: isHomePageUrl(url),
      currentPlan: plan.planId,
    })
  } catch (err) {
    console.error("Analysis error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
