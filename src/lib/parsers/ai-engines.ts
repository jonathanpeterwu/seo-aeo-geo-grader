import { CheerioDoc } from "./parse-html"

/**
 * AI engine-specific signal detection.
 * AI engine signal detection — some signals feed into the 100pt rubric, all flagged in reports.
 */

export interface AIEngineSignals {
  dateModified: string | null
  datePublished: string | null
  freshnessAgeDays: number | null
  schemaTypes: string[]
  hasArticle: boolean
  hasBreadcrumb: boolean
  hasOrganization: boolean
  hasFaq: boolean
  hasSpeakable: boolean
  schemaStackScore: number
  extractableBlocks40to60: number
  extractableBlocks100to300: number
  allowsGPTBot: boolean | null
  allowsPerplexityBot: boolean | null
  allowsClaudeBot: boolean | null
  allowsGoogleBot: boolean | null
  outboundCitationCount: number
  hasSourceAttributions: boolean
  hasTestimonials: boolean
  hasCustomerQuotes: boolean
  hasTableData: boolean
  hasDefinitionBlocks: boolean
  hasNumberedLists: boolean
}

export interface AIEngineDiagnostic {
  engine: "ChatGPT" | "Gemini" | "Perplexity" | "Bing"
  readiness: "strong" | "moderate" | "weak"
  score: number
  signals: string[]
  gaps: string[]
}

// ── Robots.txt: parse once, query many ─────────────────────

interface RobotsBotRules {
  allow: boolean | null // null = no specific rule
}

function parseRobotsBotAccess(
  robotsTxt: string | null
): Map<string, boolean | null> {
  const results = new Map<string, boolean | null>()
  const bots = ["gptbot", "perplexitybot", "claudebot", "googlebot"]
  for (const bot of bots) results.set(bot, null)

  if (!robotsTxt) return results

  const lines = robotsTxt.split("\n")
  let currentAgent = ""
  let wildcardDisallowAll = false

  // Single pass: collect rules per agent
  const agentRules = new Map<string, RobotsBotRules>()

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()
    if (trimmed.startsWith("user-agent:")) {
      currentAgent = trimmed.replace("user-agent:", "").trim()
    } else if (currentAgent && trimmed === "disallow: /") {
      if (currentAgent === "*") {
        wildcardDisallowAll = true
      } else {
        agentRules.set(currentAgent, { allow: false })
      }
    } else if (currentAgent && trimmed === "allow: /") {
      if (currentAgent !== "*") {
        agentRules.set(currentAgent, { allow: true })
      } else {
        wildcardDisallowAll = false
      }
    }
  }

  for (const bot of bots) {
    const specific = agentRules.get(bot)
    if (specific) {
      results.set(bot, specific.allow)
    } else {
      results.set(bot, wildcardDisallowAll ? false : true)
    }
  }

  return results
}

// ── Main analysis ──────────────────────────────────────────

const AUTHORITATIVE_DOMAINS = [
  "doi.org", "pubmed", "ncbi.nlm.nih.gov", "scholar.google",
  "arxiv.org", "wikipedia.org", "github.com", ".gov", ".edu",
  "apa.org", "nature.com", "springer.com", "sciencedirect.com",
]

export function analyzeAIEngineSignals(
  $: CheerioDoc,
  robotsTxt: string | null
): AIEngineSignals {
  // ── Single-pass JSON-LD extraction (dates + types + speakable) ─
  let dateModified: string | null = null
  let datePublished: string | null = null
  const schemaTypes: string[] = []
  let hasSpeakableProp = false

  // Meta tag dates
  dateModified =
    $('meta[property="article:modified_time"]').attr("content") ||
    $('meta[name="last-modified"]').attr("content") ||
    null
  datePublished =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    null

  // Single JSON-LD pass: extract dates, types, and speakable
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text()
      if (!text) return
      if (text.includes('"speakable"')) hasSpeakableProp = true

      const data = JSON.parse(text)
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        // Dates
        if (item.dateModified && !dateModified) dateModified = item.dateModified
        if (item.datePublished && !datePublished) datePublished = item.datePublished
        // Types
        if (item["@type"]) {
          const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]]
          schemaTypes.push(...types)
        }
        // @graph
        if (Array.isArray(item["@graph"])) {
          for (const node of item["@graph"]) {
            if (node.dateModified && !dateModified) dateModified = node.dateModified
            if (node.datePublished && !datePublished) datePublished = node.datePublished
            if (node["@type"]) {
              const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]
              schemaTypes.push(...types)
            }
          }
        }
      }
    } catch { /* skip malformed */ }
  })

  // Freshness
  const latestDate = dateModified || datePublished
  let freshnessAgeDays: number | null = null
  if (latestDate) {
    try {
      freshnessAgeDays = Math.floor(
        (Date.now() - new Date(latestDate).getTime()) / 86_400_000
      )
    } catch { /* skip */ }
  }

  // Schema stack
  const uniqueTypes = [...new Set(schemaTypes)]
  const hasArticle = uniqueTypes.some((t) =>
    ["Article", "BlogPosting", "NewsArticle", "TechArticle"].includes(t)
  )
  const hasBreadcrumb = uniqueTypes.includes("BreadcrumbList")
  const hasOrganization =
    uniqueTypes.includes("Organization") || uniqueTypes.includes("Corporation")
  const hasFaq = uniqueTypes.includes("FAQPage")
  const hasSpeakable =
    uniqueTypes.some((t) => t === "Speakable" || t === "SpeakableSpecification") ||
    hasSpeakableProp

  const schemaStackScore =
    (hasArticle ? 1 : 0) + (hasFaq ? 1 : 0) + (hasBreadcrumb ? 1 : 0) +
    (hasOrganization ? 1 : 0) + (hasSpeakable ? 1 : 0)

  // ── Extractable blocks ─────────────────────────────────────
  let extractableBlocks40to60 = 0
  let extractableBlocks100to300 = 0
  $("p, li, blockquote, dd").each((_, el) => {
    const text = $(el).text().trim()
    if (text.length < 30) return
    const wc = text.split(/\s+/).length
    if (wc >= 40 && wc <= 60) extractableBlocks40to60++
    if (wc >= 100 && wc <= 300) extractableBlocks100to300++
  })

  // ── AI crawler access (single-pass robots.txt) ─────────────
  const botAccess = parseRobotsBotAccess(robotsTxt)
  const allowsGPTBot = botAccess.get("gptbot") ?? null
  const allowsPerplexityBot = botAccess.get("perplexitybot") ?? null
  const allowsClaudeBot = botAccess.get("claudebot") ?? null
  const allowsGoogleBot = botAccess.get("googlebot") ?? null

  // ── Outbound citations ─────────────────────────────────────
  let outboundCitationCount = 0
  let hasSourceAttributions = false

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    const text = $(el).text().toLowerCase()
    if (
      href.startsWith("http") &&
      AUTHORITATIVE_DOMAINS.some((d) => href.includes(d))
    ) {
      outboundCitationCount++
    }
    if (
      text.includes("source") || text.includes("study") ||
      text.includes("research") || href.includes("doi.org")
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
    bodyLower.includes("\u2014 ") ||
    bodyLower.includes("&mdash;") ||
    !!bodyLower.match(
      /[""\u201C][^""\u201D]{20,}[""\u201D][\s\S]{0,30}(ceo|founder|manager|director|engineer|developer)/i
    )

  // ── Content format signals ─────────────────────────────────
  const hasTableData = $("table").length > 0
  const hasDefinitionBlocks = $("dl, dt, dd").length > 0
  const hasNumberedLists = $("ol").length > 0

  return {
    dateModified, datePublished, freshnessAgeDays,
    schemaTypes: uniqueTypes, hasArticle, hasBreadcrumb, hasOrganization,
    hasFaq, hasSpeakable, schemaStackScore,
    extractableBlocks40to60, extractableBlocks100to300,
    allowsGPTBot, allowsPerplexityBot, allowsClaudeBot, allowsGoogleBot,
    outboundCitationCount, hasSourceAttributions,
    hasTestimonials, hasCustomerQuotes,
    hasTableData, hasDefinitionBlocks, hasNumberedLists,
  }
}

export function diagnoseAIEngines(
  signals: AIEngineSignals
): AIEngineDiagnostic[] {
  const diagnostics: AIEngineDiagnostic[] = []

  // ── ChatGPT ──
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.hasFaq) s.push("FAQPage schema present")
    else g.push("Add FAQPage schema \u2014 primary ChatGPT citation signal")
    if (signals.extractableBlocks40to60 >= 3)
      s.push(`${signals.extractableBlocks40to60} extractable 40-60w blocks`)
    else g.push("Add 40-60 word self-contained paragraphs (claim + supporting data)")
    if (signals.allowsGPTBot !== false) s.push("GPTBot not blocked")
    else g.push("GPTBot is blocked in robots.txt \u2014 unblock for ChatGPT Search indexing")
    if (signals.freshnessAgeDays !== null && signals.freshnessAgeDays <= 90)
      s.push(`Content fresh (${signals.freshnessAgeDays}d old)`)
    else if (signals.freshnessAgeDays !== null)
      g.push(`dateModified is ${signals.freshnessAgeDays}d old \u2014 update within 90 days`)
    else g.push("No dateModified \u2014 add for ChatGPT recency signal")
    if (signals.hasTestimonials || signals.hasCustomerQuotes)
      s.push("UGC/testimonial content detected")
    else g.push("Add customer quotes \u2014 ChatGPT favors UGC-like content (Reddit-style trust)")
    const score = Math.round((s.length / (s.length + g.length)) * 100)
    diagnostics.push({ engine: "ChatGPT", readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak", score, signals: s, gaps: g })
  }

  // ── Gemini ──
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.schemaStackScore >= 4)
      s.push(`Schema stack: ${signals.schemaStackScore}/5 (2-3x citation boost)`)
    else
      g.push(`Schema stack ${signals.schemaStackScore}/5 \u2014 add ${[!signals.hasArticle && "Article", !signals.hasFaq && "FAQPage", !signals.hasBreadcrumb && "BreadcrumbList", !signals.hasOrganization && "Organization", !signals.hasSpeakable && "Speakable"].filter(Boolean).join(", ")}`)
    if (signals.extractableBlocks100to300 >= 2)
      s.push(`${signals.extractableBlocks100to300} passage-length blocks (100-300w)`)
    else g.push("Add 100-300 word passage blocks for Gemini extraction")
    if (signals.hasArticle) s.push("Article/BlogPosting schema")
    else g.push("Add Article schema for E-E-A-T signals")
    if (signals.allowsGoogleBot !== false) s.push("Googlebot allowed")
    else g.push("Googlebot blocked \u2014 critical for AI Overviews")
    const score = Math.round((s.length / (s.length + g.length)) * 100)
    diagnostics.push({ engine: "Gemini", readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak", score, signals: s, gaps: g })
  }

  // ── Perplexity ──
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.hasFaq) s.push("FAQPage schema \u2014 primary Perplexity signal")
    else g.push("Add FAQPage schema (primary Perplexity citation signal)")
    if (signals.allowsPerplexityBot !== false) s.push("PerplexityBot allowed")
    else g.push("PerplexityBot blocked \u2014 unblock for indexing")
    if (signals.outboundCitationCount >= 3)
      s.push(`${signals.outboundCitationCount} outbound citations to authoritative sources`)
    else g.push(`Only ${signals.outboundCitationCount} outbound citations \u2014 need \u22653 to authoritative sources`)
    if (signals.freshnessAgeDays !== null && signals.freshnessAgeDays <= 365)
      s.push(`Content age: ${signals.freshnessAgeDays}d (within 12mo)`)
    else if (signals.freshnessAgeDays !== null)
      g.push(`Content is ${signals.freshnessAgeDays}d old \u2014 Perplexity deprioritizes content >12 months`)
    else g.push("No date signal \u2014 Perplexity has most aggressive freshness penalty")
    if (signals.hasSourceAttributions) s.push("Source attributions detected in links")
    else g.push("Add explicit source attributions (DOI, study links)")
    const score = Math.round((s.length / (s.length + g.length)) * 100)
    diagnostics.push({ engine: "Perplexity", readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak", score, signals: s, gaps: g })
  }

  // ── Bing Copilot ──
  {
    const s: string[] = []
    const g: string[] = []
    if (signals.hasArticle || signals.hasFaq) s.push("Structured data present")
    else g.push("Add Article/FAQ schema for Bing citation")
    if (signals.freshnessAgeDays !== null && signals.freshnessAgeDays <= 180) s.push("Recent content")
    else g.push("Freshen content \u2014 Bing favors recent + authoritative")
    if (signals.hasTableData) s.push("Table data detected")
    else g.push("Add data tables \u2014 structured format Bing can extract")
    if (signals.hasNumberedLists) s.push("Numbered lists present")
    const score = Math.round((s.length / Math.max(s.length + g.length, 1)) * 100)
    diagnostics.push({ engine: "Bing", readiness: score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak", score, signals: s, gaps: g })
  }

  return diagnostics
}
