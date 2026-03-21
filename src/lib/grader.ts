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

/**
 * 21pt weighted rubric (matches score-seo.mjs GHA workflow)
 *
 * SEO  (7pt): title 2, description 2, robots.txt 2, sitemap 1
 * AEO  (5pt): JSON-LD 2, Open Graph 1, FAQ/Speakable 2 (partial 1)
 * CTA  (1pt): CTA present 1
 * GEO  (8pt): links 3 (tiered), clean copy 2, depth 1, stats 1, h2s 1
 *
 * Grades: A ≥90% | B ≥75% | C ≥58% | D <58%
 */

const MAX_SCORE = 21

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
  sitemap: SitemapAnalysis
): AnalysisReport {
  // ── SEO (7pt) ──────────────────────────────────────────────
  const titleOk = !!meta.title && meta.title.length >= 5 && meta.title.length <= 80
  const descOk = !!meta.description && meta.description.length >= 30 && meta.description.length <= 200

  const seoChecks: CheckResult[] = [
    {
      id: "title",
      name: "Title Tag",
      category: "SEO",
      maxScore: 2,
      score: titleOk ? 2 : 0,
      passed: titleOk,
      details: meta.title
        ? `"${meta.title}" (${meta.title.length} chars)`
        : "Missing title tag",
    },
    {
      id: "description",
      name: "Meta Description",
      category: "SEO",
      maxScore: 2,
      score: descOk ? 2 : 0,
      passed: descOk,
      details: meta.description
        ? `${meta.description.length} chars`
        : "Missing meta description",
    },
    {
      id: "robots",
      name: "robots.txt",
      category: "SEO",
      maxScore: 2,
      score: robots.exists ? 2 : 0,
      passed: robots.exists,
      details: robots.exists
        ? `Found. ${robots.sitemapUrls.length} sitemap reference(s).`
        : "Missing or inaccessible",
    },
    {
      id: "sitemap",
      name: "XML Sitemap",
      category: "SEO",
      maxScore: 1,
      score: sitemap.exists ? 1 : 0,
      passed: sitemap.exists,
      details: sitemap.exists
        ? `Found. ${sitemap.urlCount} URL(s) indexed.`
        : "Missing or inaccessible",
    },
  ]

  // ── AEO (5pt) ──────────────────────────────────────────────
  const hasJsonLd = schema.jsonLdBlocks.length > 0
  const ogComplete = !!(meta.ogTitle && meta.ogDescription && meta.ogImage)
  const ogPartial = !!(meta.ogTitle || meta.ogDescription || meta.ogImage)

  // FAQ/Speakable: 2pt if ≥3 FAQs or speakable, 1pt if partial
  const faqFull = schema.faqCount >= 3 || schema.hasSpeakable
  const faqPartial = schema.hasFaq || schema.faqCount > 0
  const faqScore = faqFull ? 2 : faqPartial ? 1 : 0

  const aeoChecks: CheckResult[] = [
    {
      id: "jsonld",
      name: "JSON-LD Structured Data",
      category: "AEO",
      maxScore: 2,
      score: hasJsonLd ? 2 : 0,
      passed: hasJsonLd,
      details: hasJsonLd
        ? `${schema.jsonLdBlocks.length} block(s): ${schema.hasSoftwareApp ? "SoftwareApplication " : ""}${schema.hasFaq ? "FAQPage " : ""}${schema.hasSpeakable ? "Speakable" : ""}`.trim() || `${schema.jsonLdBlocks.length} block(s) found`
        : "No JSON-LD structured data",
    },
    {
      id: "opengraph",
      name: "Open Graph Tags",
      category: "AEO",
      maxScore: 1,
      score: ogComplete ? 1 : 0,
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
      maxScore: 2,
      score: faqScore,
      passed: faqScore === 2,
      details: faqFull
        ? `${schema.faqCount} FAQ(s)${schema.hasSpeakable ? " + Speakable" : ""}`
        : faqPartial
          ? `${schema.faqCount} FAQ(s) — need ≥3 for full marks`
          : "No FAQ or Speakable schema found",
    },
  ]

  // ── CTA (1pt) ──────────────────────────────────────────────
  const ctaChecks: CheckResult[] = [
    {
      id: "cta",
      name: "Call-to-Action",
      category: "CTA",
      maxScore: 1,
      score: content.ctaFound ? 1 : 0,
      passed: content.ctaFound,
      details: content.ctaFound
        ? "CTA detected on page"
        : "No clear call-to-action found",
    },
  ]

  // ── GEO (8pt) ──────────────────────────────────────────────
  // Links: ≥5 = 3pt, ≥3 = 2pt, >0 = 1pt, 0 = 0pt
  const linkScore =
    content.linkCount >= 5
      ? 3
      : content.linkCount >= 3
        ? 2
        : content.linkCount > 0
          ? 1
          : 0

  const cleanOk = content.bannedWordCount === 0
  const depthOk = content.wordCount >= 1200
  const statsOk = content.statsCount >= 3
  const h2sOk = content.h2Count >= 3

  const geoChecks: CheckResult[] = [
    {
      id: "links",
      name: "Links (≥5 for full marks)",
      category: "GEO",
      maxScore: 3,
      score: linkScore,
      passed: linkScore === 3,
      details: `${content.linkCount} total (${content.internalLinks} internal, ${content.externalLinks} external)${linkScore < 3 ? ` — need ≥5 for 3/3` : ""}`,
    },
    {
      id: "cleancopy",
      name: "Clean Copy (no banned AI words)",
      category: "GEO",
      maxScore: 2,
      score: cleanOk ? 2 : 0,
      passed: cleanOk,
      details: cleanOk
        ? "No banned words detected"
        : `Found: ${content.bannedWords.join(", ")}`,
    },
    {
      id: "depth",
      name: "Content Depth (≥1,200 words)",
      category: "GEO",
      maxScore: 1,
      score: depthOk ? 1 : 0,
      passed: depthOk,
      details: `${content.wordCount.toLocaleString()} words`,
    },
    {
      id: "stats",
      name: "Statistics & Data (≥3 data points)",
      category: "GEO",
      maxScore: 1,
      score: statsOk ? 1 : 0,
      passed: statsOk,
      details: `${content.statsCount} data point(s) found (%, $, Nx)`,
    },
    {
      id: "h2s",
      name: "Heading Structure (≥3 H2s)",
      category: "GEO",
      maxScore: 1,
      score: h2sOk ? 1 : 0,
      passed: h2sOk,
      details: `${content.h2Count} H2 heading(s)`,
    },
  ]

  // ── Assemble ───────────────────────────────────────────────
  const categories: CategoryGrade[] = [
    makeCategoryGrade("SEO", seoChecks),
    makeCategoryGrade("AEO", aeoChecks),
    makeCategoryGrade("CTA", ctaChecks),
    makeCategoryGrade("GEO", geoChecks),
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
