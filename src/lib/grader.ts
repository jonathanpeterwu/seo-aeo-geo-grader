import {
  AnalysisReport,
  CategoryGrade,
  CheckResult,
  MetaTags,
  SchemaData,
  ContentAnalysis,
  RobotsAnalysis,
  SitemapAnalysis,
} from "@/types"
import { AIEngineSignals } from "@/lib/parsers/ai-engines"
import { AIDiscoverySignals } from "@/lib/parsers/ai-discovery"

/**
 * 100pt weighted rubric — publicly gradeable signals only
 *
 * SEO          (25pt): title 5, description 5, canonical 3, robots.txt 5, sitemap 4, sitemap freshness 3
 * AEO          (25pt): JSON-LD 5, Open Graph 3, FAQ/Speakable 5, schema stack 5, freshness 4, citations 3
 * CTA           (5pt): CTA present 5
 * GEO          (25pt): links 7, clean copy 5, depth 5, stats 4, h2s 4
 * AI Discovery (20pt): AI bot access 6, llms.txt 5, llms-full.txt 4, security.txt 2, extractable blocks 3
 *
 * Grades: A ≥90% | B ≥75% | C ≥58% | D <58%
 */

const MAX_SCORE = 100

function letterGrade(percentage: number): "A" | "B" | "C" | "D" {
  if (percentage >= 90) return "A"
  if (percentage >= 75) return "B"
  if (percentage >= 58) return "C"
  return "D"
}

function makeCategoryGrade(
  category: CategoryGrade["category"],
  checks: CheckResult[]
): CategoryGrade {
  const score = checks.reduce((sum, c) => sum + c.score, 0)
  const maxScore = checks.reduce((sum, c) => sum + c.maxScore, 0)
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return { category, checks, score, maxScore, percentage, grade: letterGrade(percentage) }
}

export function gradeUrl(
  url: string,
  meta: MetaTags,
  schema: SchemaData,
  content: ContentAnalysis,
  robots: RobotsAnalysis,
  sitemap: SitemapAnalysis,
  aiSignals?: AIEngineSignals,
  aiDiscovery?: AIDiscoverySignals,
  securityTxt?: string | null
): AnalysisReport {
  // ── SEO (25pt) ─────────────────────────────────────────────
  const titleOk = !!meta.title && meta.title.length >= 5 && meta.title.length <= 80
  const descOk = !!meta.description && meta.description.length >= 30 && meta.description.length <= 200
  const canonicalOk = !!meta.canonical

  // Sitemap freshness: 3pt if >50% fresh, 2pt if >25%, 1pt if any lastmod
  let sitemapFreshnessScore = 0
  let sitemapFreshnessDetails = "No sitemap or lastmod data"
  if (aiDiscovery && aiDiscovery.sitemapUrlCount > 0) {
    const freshRatio = aiDiscovery.sitemapUrlCount > 0
      ? aiDiscovery.sitemapFreshPages / aiDiscovery.sitemapUrlCount
      : 0
    if (freshRatio > 0.5) {
      sitemapFreshnessScore = 3
      sitemapFreshnessDetails = `${Math.round(freshRatio * 100)}% pages fresh (${aiDiscovery.sitemapFreshPages}/${aiDiscovery.sitemapUrlCount})`
    } else if (freshRatio > 0.25) {
      sitemapFreshnessScore = 2
      sitemapFreshnessDetails = `${Math.round(freshRatio * 100)}% pages fresh — need >50% for full marks`
    } else if (aiDiscovery.newestLastmod) {
      sitemapFreshnessScore = 1
      sitemapFreshnessDetails = `Only ${Math.round(freshRatio * 100)}% pages fresh — need >50% for full marks`
    }
  }

  const seoChecks: CheckResult[] = [
    {
      id: "title",
      name: "Title Tag",
      category: "SEO",
      maxScore: 5,
      score: titleOk ? 5 : 0,
      passed: titleOk,
      details: meta.title
        ? `"${meta.title}" (${meta.title.length} chars)`
        : "Missing title tag",
    },
    {
      id: "description",
      name: "Meta Description",
      category: "SEO",
      maxScore: 5,
      score: descOk ? 5 : 0,
      passed: descOk,
      details: meta.description
        ? `${meta.description.length} chars`
        : "Missing meta description",
    },
    {
      id: "canonical",
      name: "Canonical URL",
      category: "SEO",
      maxScore: 3,
      score: canonicalOk ? 3 : 0,
      passed: canonicalOk,
      details: canonicalOk
        ? `${meta.canonical}`
        : "No canonical link tag found",
    },
    {
      id: "robots",
      name: "robots.txt",
      category: "SEO",
      maxScore: 5,
      score: robots.exists ? 5 : 0,
      passed: robots.exists,
      details: robots.exists
        ? `Found. ${robots.sitemapUrls.length} sitemap reference(s).`
        : "Missing or inaccessible",
    },
    {
      id: "sitemap",
      name: "XML Sitemap",
      category: "SEO",
      maxScore: 4,
      score: sitemap.exists ? 4 : 0,
      passed: sitemap.exists,
      details: sitemap.exists
        ? `Found. ${sitemap.urlCount} URL(s) indexed.`
        : "Missing or inaccessible",
    },
    {
      id: "sitemap-freshness",
      name: "Sitemap Freshness",
      category: "SEO",
      maxScore: 3,
      score: sitemapFreshnessScore,
      passed: sitemapFreshnessScore === 3,
      details: sitemapFreshnessDetails,
    },
  ]

  // ── AEO (25pt) ─────────────────────────────────────────────
  const hasJsonLd = schema.jsonLdBlocks.length > 0
  const ogComplete = !!(meta.ogTitle && meta.ogDescription && meta.ogImage)
  const ogPartial = !!(meta.ogTitle || meta.ogDescription || meta.ogImage)

  // FAQ/Speakable: 5pt if ≥3 FAQs or speakable, 3pt if partial, 0pt if none
  const faqFull = schema.faqCount >= 3 || schema.hasSpeakable
  const faqPartial = schema.hasFaq || schema.faqCount > 0
  const faqScore = faqFull ? 5 : faqPartial ? 3 : 0

  // Schema stack depth: 1pt each for Article, FAQ, Breadcrumb, Organization, Speakable (5pt max)
  const schemaStackScore = aiSignals
    ? aiSignals.schemaStackScore
    : (schema.hasFaq ? 1 : 0) + (schema.hasSpeakable ? 1 : 0) + (schema.hasSoftwareApp ? 1 : 0)

  // Content freshness: 4pt if <90d, 2pt if <365d, 0pt otherwise
  let freshnessScore = 0
  let freshnessDetails = "No dateModified or datePublished found"
  if (aiSignals?.freshnessAgeDays !== null && aiSignals?.freshnessAgeDays !== undefined) {
    const days = aiSignals.freshnessAgeDays
    if (days <= 90) {
      freshnessScore = 4
      freshnessDetails = `${days}d old — fresh`
    } else if (days <= 365) {
      freshnessScore = 2
      freshnessDetails = `${days}d old — update within 90 days for full marks`
    } else {
      freshnessDetails = `${days}d old — stale (>1 year)`
    }
  }

  // Outbound citations: 3pt if ≥5, 2pt if ≥3, 1pt if ≥1
  const citationCount = aiSignals?.outboundCitationCount ?? 0
  const citationScore = citationCount >= 5 ? 3 : citationCount >= 3 ? 2 : citationCount >= 1 ? 1 : 0

  const aeoChecks: CheckResult[] = [
    {
      id: "jsonld",
      name: "JSON-LD Structured Data",
      category: "AEO",
      maxScore: 5,
      score: hasJsonLd ? 5 : 0,
      passed: hasJsonLd,
      details: hasJsonLd
        ? `${schema.jsonLdBlocks.length} block(s): ${schema.hasSoftwareApp ? "SoftwareApplication " : ""}${schema.hasFaq ? "FAQPage " : ""}${schema.hasSpeakable ? "Speakable" : ""}`.trim() || `${schema.jsonLdBlocks.length} block(s) found`
        : "No JSON-LD structured data",
    },
    {
      id: "opengraph",
      name: "Open Graph Tags",
      category: "AEO",
      maxScore: 3,
      score: ogComplete ? 3 : 0,
      passed: ogComplete,
      details: ogComplete
        ? "og:title, og:description, og:image"
        : ogPartial
          ? `Partial: ${[meta.ogTitle ? "og:title" : null, meta.ogDescription ? "og:description" : null, meta.ogImage ? "og:image" : null].filter(Boolean).join(", ")}`
          : "No OG tags found",
    },
    {
      id: "faq-speakable",
      name: "FAQ / Speakable Schema",
      category: "AEO",
      maxScore: 5,
      score: faqScore,
      passed: faqScore === 5,
      details: faqFull
        ? `${schema.faqCount} FAQ(s)${schema.hasSpeakable ? " + Speakable" : ""}`
        : faqPartial
          ? `${schema.faqCount} FAQ(s) — need ≥3 or Speakable for full marks`
          : "No FAQ or Speakable schema found",
    },
    {
      id: "schema-stack",
      name: "Schema Stack Depth",
      category: "AEO",
      maxScore: 5,
      score: schemaStackScore,
      passed: schemaStackScore >= 4,
      details: aiSignals
        ? `${schemaStackScore}/5 types: ${[aiSignals.hasArticle && "Article", aiSignals.hasFaq && "FAQ", aiSignals.hasBreadcrumb && "Breadcrumb", aiSignals.hasOrganization && "Organization", aiSignals.hasSpeakable && "Speakable"].filter(Boolean).join(", ") || "none detected"}`
        : `${schemaStackScore}/5 types detected`,
    },
    {
      id: "freshness",
      name: "Content Freshness",
      category: "AEO",
      maxScore: 4,
      score: freshnessScore,
      passed: freshnessScore === 4,
      details: freshnessDetails,
    },
    {
      id: "citations",
      name: "Outbound Citations",
      category: "AEO",
      maxScore: 3,
      score: citationScore,
      passed: citationScore === 3,
      details: `${citationCount} authoritative citation(s)${citationScore < 3 ? ` — need ≥5 for full marks` : ""}`,
    },
  ]

  // ── CTA (5pt) ──────────────────────────────────────────────
  const ctaChecks: CheckResult[] = [
    {
      id: "cta",
      name: "Call-to-Action",
      category: "CTA",
      maxScore: 5,
      score: content.ctaFound ? 5 : 0,
      passed: content.ctaFound,
      details: content.ctaFound
        ? "CTA detected on page"
        : "No clear call-to-action found",
    },
  ]

  // ── GEO (25pt) ─────────────────────────────────────────────
  // Links: ≥10 = 7pt, ≥5 = 5pt, ≥3 = 3pt, >0 = 1pt, 0 = 0pt
  const linkScore =
    content.linkCount >= 10
      ? 7
      : content.linkCount >= 5
        ? 5
        : content.linkCount >= 3
          ? 3
          : content.linkCount > 0
            ? 1
            : 0

  const cleanOk = content.bannedWordCount === 0
  // Depth: ≥2000w = 5pt, ≥1200w = 3pt, ≥500w = 1pt
  const depthScore =
    content.wordCount >= 2000
      ? 5
      : content.wordCount >= 1200
        ? 3
        : content.wordCount >= 500
          ? 1
          : 0
  // Stats: ≥5 = 4pt, ≥3 = 2pt, ≥1 = 1pt
  const statsScore =
    content.statsCount >= 5
      ? 4
      : content.statsCount >= 3
        ? 2
        : content.statsCount >= 1
          ? 1
          : 0
  // H2s: ≥5 = 4pt, ≥3 = 2pt, ≥1 = 1pt
  const h2Score =
    content.h2Count >= 5
      ? 4
      : content.h2Count >= 3
        ? 2
        : content.h2Count >= 1
          ? 1
          : 0

  const geoChecks: CheckResult[] = [
    {
      id: "links",
      name: "Links (≥10 for full marks)",
      category: "GEO",
      maxScore: 7,
      score: linkScore,
      passed: linkScore === 7,
      details: `${content.linkCount} total (${content.internalLinks} internal, ${content.externalLinks} external)${linkScore < 7 ? ` — need ≥10 for 7/7` : ""}`,
    },
    {
      id: "cleancopy",
      name: "Clean Copy (no banned AI words)",
      category: "GEO",
      maxScore: 5,
      score: cleanOk ? 5 : 0,
      passed: cleanOk,
      details: cleanOk
        ? "No banned words detected"
        : `Found: ${content.bannedWords.join(", ")}`,
    },
    {
      id: "depth",
      name: "Content Depth (≥2,000 words for full marks)",
      category: "GEO",
      maxScore: 5,
      score: depthScore,
      passed: depthScore === 5,
      details: `${content.wordCount.toLocaleString()} words${depthScore < 5 ? ` — need ≥2,000 for 5/5` : ""}`,
    },
    {
      id: "stats",
      name: "Statistics & Data (≥5 data points)",
      category: "GEO",
      maxScore: 4,
      score: statsScore,
      passed: statsScore === 4,
      details: `${content.statsCount} data point(s) found (%, $, Nx)${statsScore < 4 ? ` — need ≥5 for 4/4` : ""}`,
    },
    {
      id: "h2s",
      name: "Heading Structure (≥5 H2s)",
      category: "GEO",
      maxScore: 4,
      score: h2Score,
      passed: h2Score === 4,
      details: `${content.h2Count} H2 heading(s)${h2Score < 4 ? ` — need ≥5 for 4/4` : ""}`,
    },
  ]

  // ── AI Discovery (20pt) ────────────────────────────────────
  // AI bot access: count of 4 major bots allowed (GPTBot, ClaudeBot, PerplexityBot, GoogleBot)
  let aiBotScore = 0
  let aiBotDetails = "No robots.txt data"
  if (aiSignals) {
    const botsAllowed = [
      aiSignals.allowsGPTBot,
      aiSignals.allowsClaudeBot,
      aiSignals.allowsPerplexityBot,
      aiSignals.allowsGoogleBot,
    ].filter((b) => b === true).length
    // 6pt if all 4, 4pt if 3, 3pt if 2, 1pt if 1, 0pt if none
    aiBotScore = botsAllowed >= 4 ? 6 : botsAllowed === 3 ? 4 : botsAllowed === 2 ? 3 : botsAllowed === 1 ? 1 : 0
    const botNames = [
      aiSignals.allowsGPTBot && "GPTBot",
      aiSignals.allowsClaudeBot && "ClaudeBot",
      aiSignals.allowsPerplexityBot && "PerplexityBot",
      aiSignals.allowsGoogleBot && "GoogleBot",
    ].filter(Boolean)
    aiBotDetails = `${botsAllowed}/4 AI bots allowed: ${botNames.join(", ") || "none"}`
  }

  // llms.txt: 5pt if exists + ≥3 sections, 3pt if exists, 0pt if missing
  const hasLlmsTxt = aiDiscovery?.hasLlmsTxt ?? false
  const llmsSections = aiDiscovery?.llmsTxtSections?.length ?? 0
  const llmsScore = hasLlmsTxt ? (llmsSections >= 3 ? 5 : 3) : 0

  // llms-full.txt: 4pt if >5000 chars, 2pt if exists, 0pt if missing
  const hasLlmsFullTxt = aiDiscovery?.hasLlmsFullTxt ?? false
  const llmsFullLen = aiDiscovery?.llmsFullTxtLength ?? 0
  const llmsFullScore = hasLlmsFullTxt ? (llmsFullLen > 5000 ? 4 : 2) : 0

  // security.txt: 2pt if exists
  const hasSecurityTxt = !!securityTxt
  const securityScore = hasSecurityTxt ? 2 : 0

  // Extractable blocks: 3pt if ≥5 blocks (40-60w), 2pt if ≥3, 1pt if ≥1
  const blocks = aiSignals?.extractableBlocks40to60 ?? 0
  const blocksScore = blocks >= 5 ? 3 : blocks >= 3 ? 2 : blocks >= 1 ? 1 : 0

  const aiDiscoveryChecks: CheckResult[] = [
    {
      id: "ai-bot-access",
      name: "AI Bot Access",
      category: "AI_DISCOVERY",
      maxScore: 6,
      score: aiBotScore,
      passed: aiBotScore === 6,
      details: aiBotDetails,
    },
    {
      id: "llms-txt",
      name: "llms.txt",
      category: "AI_DISCOVERY",
      maxScore: 5,
      score: llmsScore,
      passed: llmsScore === 5,
      details: hasLlmsTxt
        ? `Found (${aiDiscovery?.llmsTxtLength ?? 0} chars, ${llmsSections} section(s))${llmsScore < 5 ? " — need ≥3 sections for full marks" : ""}`
        : "No /llms.txt found — add to help LLMs understand your site",
    },
    {
      id: "llms-full-txt",
      name: "llms-full.txt",
      category: "AI_DISCOVERY",
      maxScore: 4,
      score: llmsFullScore,
      passed: llmsFullScore === 4,
      details: hasLlmsFullTxt
        ? `Found (${llmsFullLen.toLocaleString()} chars)${llmsFullScore < 4 ? " — need >5,000 chars for full marks" : ""}`
        : "No /llms-full.txt found",
    },
    {
      id: "security-txt",
      name: "security.txt (RFC 9116)",
      category: "AI_DISCOVERY",
      maxScore: 2,
      score: securityScore,
      passed: hasSecurityTxt,
      details: hasSecurityTxt
        ? "Found at /.well-known/security.txt — trust signal for AI crawlers"
        : "No security.txt — add for RFC 9116 compliance and AI trust signals",
    },
    {
      id: "extractable-blocks",
      name: "Extractable Blocks (40-60 words)",
      category: "AI_DISCOVERY",
      maxScore: 3,
      score: blocksScore,
      passed: blocksScore === 3,
      details: `${blocks} self-contained paragraph(s)${blocksScore < 3 ? " — need ≥5 for full marks" : ""}`,
    },
  ]

  // ── Assemble ───────────────────────────────────────────────
  const categories: CategoryGrade[] = [
    makeCategoryGrade("SEO", seoChecks),
    makeCategoryGrade("AEO", aeoChecks),
    makeCategoryGrade("CTA", ctaChecks),
    makeCategoryGrade("GEO", geoChecks),
    makeCategoryGrade("AI_DISCOVERY", aiDiscoveryChecks),
  ]

  const overallScore = categories.reduce((sum, c) => sum + c.score, 0)
  const overallPercentage = Math.round((overallScore / MAX_SCORE) * 100)

  return {
    url,
    analyzedAt: new Date().toISOString(),
    categories,
    overallScore,
    overallMaxScore: MAX_SCORE,
    overallPercentage,
    overallGrade: letterGrade(overallPercentage),
  }
}
