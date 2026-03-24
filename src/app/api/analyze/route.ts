import { NextRequest, NextResponse } from "next/server"
import { fetchPageData } from "@/lib/fetcher"
import { extractMetaTags } from "@/lib/parsers/meta"
import { extractSchemaData } from "@/lib/parsers/schema"
import { analyzeRobotsTxt } from "@/lib/parsers/robots"
import { analyzeSitemap } from "@/lib/parsers/sitemap"
import { analyzeContent } from "@/lib/parsers/content"
import {
  analyzeAIEngineSignals,
  diagnoseAIEngines,
} from "@/lib/parsers/ai-engines"
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

    // Parse
    const meta = extractMetaTags(data.html)
    const schema = extractSchemaData(data.html)
    const robots = analyzeRobotsTxt(data.robotsTxt)
    const sitemap = analyzeSitemap(data.sitemapXml)
    const content = analyzeContent(data.html, data.resolvedUrl)

    // AI engine signals (not scored, diagnostic only)
    const aiSignals = analyzeAIEngineSignals(data.html, data.robotsTxt)
    const aiDiagnostics = diagnoseAIEngines(aiSignals)

    // Grade
    const report = gradeUrl(
      data.resolvedUrl,
      meta,
      schema,
      content,
      robots,
      sitemap
    )

    // Attach AI diagnostics to report
    report.aiEngineDiagnostics = aiDiagnostics

    // Consume credit
    consumeCredit(sessionId, url)

    // Generate suggestions (gated by plan)
    const allChecks = report.categories.flatMap((c) => c.checks)
    const hasSuggestions = canViewSuggestions(sessionId)
    const suggestions = hasSuggestions
      ? generateSuggestions(allChecks)
      : null

    // For free users, show suggestion count as a teaser
    const suggestionCount = generateSuggestions(allChecks).length

    const plan = getPlan(sessionId)

    return NextResponse.json({
      report,
      suggestions,
      suggestionCount,
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
