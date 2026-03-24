import * as cheerio from "cheerio"

/**
 * AI engine-specific signal detection.
 * Not scored in the 21pt rubric, but flagged in reports.
 * Based on cross-platform citation research (2026).
 */

export interface AIEngineSignals {
  // Freshness
  dateModified: string | null
  datePublished: string | null
  freshnessAgeDays: number | null // days since last dateModified

  // Schema stack (Gemini: 2-3x citation boost with full stack)
  schemaTypes: string[]
  hasArticle: boolean
  hasBreadcrumb: boolean
  hasOrganization: boolean
  hasFaq: boolean
  hasSpeakable: boolean
  schemaStackScore: number // 0-5: count of Article+FAQ+Breadcrumb+Organization+Speakable

  // Extractable blocks
  extractableBlocks40to60: number // 40-60 word self-contained paragraphs (ChatGPT/Perplexity)
  extractableBlocks100to300: number // 100-300 word passages (Gemini)

  // AI crawler access
  allowsGPTBot: boolean | null // null = no robots.txt
  allowsPerplexityBot: boolean | null
  allowsClaudeBot: boolean | null
  allowsGoogleBot: boolean | null

  // Outbound citations (Perplexity: 3+ external = trust signal)
  outboundCitationCount: number // external links to authoritative domains
  hasSourceAttributions: boolean // links contain "source", "study", DOI, etc.

  // UGC signals (ChatGPT: high signal, Reddit-like)
  hasTestimonials: boolean
  hasCustomerQuotes: boolean

  // Content format signals
  hasTableData: boolean // tables preferred by AI engines
  hasDefinitionBlocks: boolean // definition-first paragraphs
  hasNumberedLists: boolean // structured lists
}

export interface AIEngineDiagnostic {
  engine: "ChatGPT" | "Gemini" | "Perplexity" | "Bing"
  readiness: "strong" | "moderate" | "weak"
  score: number // 0-100 informal score
  signals: string[]
  gaps: string[]
}

export function analyzeAIEngineSignals(
  html: string,
  robotsTxt: string | null
): AIEngineSignals {
  const $ = cheerio.load(html)

  // ── Freshness ──────────────────────────────────────────────
  let dateModified: string | null = null
  let datePublished: string | null = null

  // Check meta tags
  dateModified =
    $('meta[property="article:modified_time"]').attr("content") ||
    $('meta[name="last-modified"]').attr("content") ||
    null
  datePublished =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    null

  // Check JSON-LD for dates
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text())
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item.dateModified && !dateModified)
          dateModified = item.dateModified
        if (item.datePublished && !datePublished)
          datePublished = item.datePublished
        // Check @graph
        if (Array.isArray(item["@graph"])) {
          for (const node of item["@graph"]) {
            if (node.dateModified && !dateModified)
              dateModified = node.dateModified
            if (node.datePublished && !datePublished)
              datePublished = node.datePublished
          }
        }
      }
    } catch {
      /* skip */
    }
  })

  const latestDate = dateModified || datePublished
  let freshnessAgeDays: number | null = null
  if (latestDate) {
    try {
      const d = new Date(latestDate)
      freshnessAgeDays = Math.floor(
        (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
      )
    } catch {
      /* skip */
    }
  }

  // ── Schema stack ───────────────────────────────────────────
  const schemaTypes: string[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text())
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item["@type"]) {
          const types = Array.isArray(item["@type"])
            ? item["@type"]
            : [item["@type"]]
          schemaTypes.push(...types)
        }
        if (Array.isArray(item["@graph"])) {
          for (const node of item["@graph"]) {
            if (node["@type"]) {
              const types = Array.isArray(node["@type"])
                ? node["@type"]
                : [node["@type"]]
              schemaTypes.push(...types)
            }
          }
        }
      }
    } catch {
      /* skip */
    }
  })

  const uniqueTypes = [...new Set(schemaTypes)]
  const hasArticle = uniqueTypes.some((t) =>
    ["Article", "BlogPosting", "NewsArticle", "TechArticle"].includes(t)
  )
  const hasBreadcrumb = uniqueTypes.includes("BreadcrumbList")
  const hasOrganization =
    uniqueTypes.includes("Organization") || uniqueTypes.includes("Corporation")
  const hasFaq = uniqueTypes.includes("FAQPage")
  const hasSpeakable = uniqueTypes.some(
    (t) => t === "Speakable" || t === "SpeakableSpecification"
  )

  // Also check for speakable property
  let hasSpeakableProp = false
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text()
      if (text.includes('"speakable"')) hasSpeakableProp = true
    } catch {
      /* skip */
    }
  })

  const schemaStackScore =
    (hasArticle ? 1 : 0) +
    (hasFaq ? 1 : 0) +
    (hasBreadcrumb ? 1 : 0) +
    (hasOrganization ? 1 : 0) +
    (hasSpeakable || hasSpeakableProp ? 1 : 0)

  // ── Extractable blocks ─────────────────────────────────────
  const paragraphs: string[] = []
  $("p, li, blockquote, dd").each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 30) paragraphs.push(text)
  })

  let extractableBlocks40to60 = 0
  let extractableBlocks100to300 = 0
  for (const p of paragraphs) {
    const wc = p.split(/\s+/).length
    if (wc >= 40 && wc <= 60) extractableBlocks40to60++
    if (wc >= 100 && wc <= 300) extractableBlocks100to300++
  }

  // ── AI crawler access ──────────────────────────────────────
  function checkBotAccess(
    robotsContent: string | null,
    botName: string
  ): boolean | null {
    if (!robotsContent) return null
    const lines = robotsContent.split("\n")
    let inBotBlock = false
    let inWildcard = false

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim()
        inBotBlock = agent === botName.toLowerCase()
        inWildcard = agent === "*"
      }
      if (inBotBlock) {
        if (trimmed === "disallow: /") return false
        if (trimmed === "allow: /") return true
      }
    }

    // Check wildcard
    let wildcardAllows = true
    inWildcard = false
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()
      if (trimmed.startsWith("user-agent:")) {
        inWildcard = trimmed.replace("user-agent:", "").trim() === "*"
      }
      if (inWildcard && trimmed === "disallow: /") {
        wildcardAllows = false
      }
    }

    return wildcardAllows
  }

  const allowsGPTBot = checkBotAccess(robotsTxt, "GPTBot")
  const allowsPerplexityBot = checkBotAccess(robotsTxt, "PerplexityBot")
  const allowsClaudeBot = checkBotAccess(robotsTxt, "ClaudeBot")
  const allowsGoogleBot = checkBotAccess(robotsTxt, "Googlebot")

  // ── Outbound citations ─────────────────────────────────────
  const authoritiveDomains = [
    "doi.org",
    "pubmed",
    "ncbi.nlm.nih.gov",
    "scholar.google",
    "arxiv.org",
    "wikipedia.org",
    "github.com",
    ".gov",
    ".edu",
    "apa.org",
    "nature.com",
    "springer.com",
    "sciencedirect.com",
  ]

  let outboundCitationCount = 0
  let hasSourceAttributions = false

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    const text = $(el).text().toLowerCase()
    if (
      href.startsWith("http") &&
      authoritiveDomains.some((d) => href.includes(d))
    ) {
      outboundCitationCount++
    }
    if (
      text.includes("source") ||
      text.includes("study") ||
      text.includes("research") ||
      href.includes("doi.org")
    ) {
      hasSourceAttributions = true
    }
  })

  // ── UGC signals ────────────────────────────────────────────
  const bodyHtml = $.html() || ""
  const bodyLower = bodyHtml.toLowerCase()
  const hasTestimonials =
    bodyLower.includes("testimonial") ||
    bodyLower.includes("customer review") ||
    bodyLower.includes("what our customers say") ||
    bodyLower.includes("what people say") ||
    $("blockquote").length > 0
  const hasCustomerQuotes =
    bodyLower.includes("— ") || // em-dash attribution
    bodyLower.includes("&mdash;") ||
    !!bodyLower.match(
      /[""][^""]{20,}[""][\s\S]{0,30}(ceo|founder|manager|director|engineer|developer)/i
    )

  // ── Content format signals ─────────────────────────────────
  const hasTableData = $("table").length > 0
  const hasDefinitionBlocks = $("dl, dt, dd").length > 0
  const hasNumberedLists = $("ol").length > 0

  return {
    dateModified,
    datePublished,
    freshnessAgeDays,
    schemaTypes: uniqueTypes,
    hasArticle,
    hasBreadcrumb,
    hasOrganization,
    hasFaq,
    hasSpeakable: hasSpeakable || hasSpeakableProp,
    schemaStackScore,
    extractableBlocks40to60,
    extractableBlocks100to300,
    allowsGPTBot,
    allowsPerplexityBot,
    allowsClaudeBot,
    allowsGoogleBot,
    outboundCitationCount,
    hasSourceAttributions,
    hasTestimonials,
    hasCustomerQuotes,
    hasTableData,
    hasDefinitionBlocks,
    hasNumberedLists,
  }
}

export function diagnoseAIEngines(
  signals: AIEngineSignals
): AIEngineDiagnostic[] {
  const diagnostics: AIEngineDiagnostic[] = []

  // ── ChatGPT ────────────────────────────────────────────────
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.hasFaq) s.push("FAQPage schema present")
    else g.push("Add FAQPage schema — primary ChatGPT citation signal")
    if (signals.extractableBlocks40to60 >= 3)
      s.push(`${signals.extractableBlocks40to60} extractable 40-60w blocks`)
    else
      g.push("Add 40-60 word self-contained paragraphs (claim + supporting data)")
    if (signals.allowsGPTBot !== false) s.push("GPTBot not blocked")
    else g.push("GPTBot is blocked in robots.txt — unblock for ChatGPT Search indexing")
    if (signals.freshnessAgeDays !== null && signals.freshnessAgeDays <= 90)
      s.push(`Content fresh (${signals.freshnessAgeDays}d old)`)
    else if (signals.freshnessAgeDays !== null)
      g.push(`dateModified is ${signals.freshnessAgeDays}d old — update within 90 days`)
    else g.push("No dateModified — add for ChatGPT recency signal")
    if (signals.hasTestimonials || signals.hasCustomerQuotes)
      s.push("UGC/testimonial content detected")
    else g.push("Add customer quotes — ChatGPT favors UGC-like content (Reddit-style trust)")

    const score = Math.round((s.length / (s.length + g.length)) * 100)
    diagnostics.push({
      engine: "ChatGPT",
      readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak",
      score,
      signals: s,
      gaps: g,
    })
  }

  // ── Gemini ─────────────────────────────────────────────────
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.schemaStackScore >= 4)
      s.push(`Schema stack: ${signals.schemaStackScore}/5 (2-3x citation boost)`)
    else
      g.push(
        `Schema stack ${signals.schemaStackScore}/5 — add ${[
          !signals.hasArticle && "Article",
          !signals.hasFaq && "FAQPage",
          !signals.hasBreadcrumb && "BreadcrumbList",
          !signals.hasOrganization && "Organization",
          !signals.hasSpeakable && "Speakable",
        ]
          .filter(Boolean)
          .join(", ")}`
      )
    if (signals.extractableBlocks100to300 >= 2)
      s.push(`${signals.extractableBlocks100to300} passage-length blocks (100-300w)`)
    else g.push("Add 100-300 word passage blocks for Gemini extraction")
    if (signals.hasArticle) s.push("Article/BlogPosting schema")
    else g.push("Add Article schema for E-E-A-T signals")
    if (signals.allowsGoogleBot !== false) s.push("Googlebot allowed")
    else g.push("Googlebot blocked — critical for AI Overviews")

    const score = Math.round((s.length / (s.length + g.length)) * 100)
    diagnostics.push({
      engine: "Gemini",
      readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak",
      score,
      signals: s,
      gaps: g,
    })
  }

  // ── Perplexity ─────────────────────────────────────────────
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.hasFaq) s.push("FAQPage schema — primary Perplexity signal")
    else g.push("Add FAQPage schema (primary Perplexity citation signal)")
    if (signals.allowsPerplexityBot !== false) s.push("PerplexityBot allowed")
    else g.push("PerplexityBot blocked — unblock for indexing")
    if (signals.outboundCitationCount >= 3)
      s.push(`${signals.outboundCitationCount} outbound citations to authoritative sources`)
    else
      g.push(
        `Only ${signals.outboundCitationCount} outbound citations — need ≥3 to authoritative sources`
      )
    if (signals.freshnessAgeDays !== null && signals.freshnessAgeDays <= 365)
      s.push(`Content age: ${signals.freshnessAgeDays}d (within 12mo)`)
    else if (signals.freshnessAgeDays !== null)
      g.push(
        `Content is ${signals.freshnessAgeDays}d old — Perplexity deprioritizes content >12 months`
      )
    else g.push("No date signal — Perplexity has most aggressive freshness penalty")
    if (signals.hasSourceAttributions)
      s.push("Source attributions detected in links")
    else g.push("Add explicit source attributions (DOI, study links)")

    const score = Math.round((s.length / (s.length + g.length)) * 100)
    diagnostics.push({
      engine: "Perplexity",
      readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak",
      score,
      signals: s,
      gaps: g,
    })
  }

  // ── Bing Copilot ───────────────────────────────────────────
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.hasArticle || signals.hasFaq)
      s.push("Structured data present")
    else g.push("Add Article/FAQ schema for Bing citation")
    if (signals.freshnessAgeDays !== null && signals.freshnessAgeDays <= 180)
      s.push("Recent content")
    else g.push("Freshen content — Bing favors recent + authoritative")
    if (signals.hasTableData) s.push("Table data detected")
    else g.push("Add data tables — structured format Bing can extract")
    if (signals.hasNumberedLists) s.push("Numbered lists present")

    const score = Math.round((s.length / Math.max(s.length + g.length, 1)) * 100)
    diagnostics.push({
      engine: "Bing",
      readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak",
      score,
      signals: s,
      gaps: g,
    })
  }

  return diagnostics
}
