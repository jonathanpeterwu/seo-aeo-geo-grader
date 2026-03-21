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
  const passed = checks.filter((c) => c.passed).length
  const total = checks.length
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0
  return { category, checks, passed, total, percentage, grade: letterGrade(percentage) }
}

export function gradeUrl(
  url: string,
  meta: MetaTags,
  schema: SchemaData,
  content: ContentAnalysis,
  robots: RobotsAnalysis,
  sitemap: SitemapAnalysis
): AnalysisReport {
  // SEO checks (4)
  const seoChecks: CheckResult[] = [
    {
      id: "title",
      name: "Title Tag",
      category: "SEO",
      passed: !!meta.title && meta.title.length >= 5 && meta.title.length <= 80,
      details: meta.title
        ? `"${meta.title}" (${meta.title.length} chars)`
        : "Missing title tag",
    },
    {
      id: "description",
      name: "Meta Description",
      category: "SEO",
      passed: !!meta.description && meta.description.length >= 30 && meta.description.length <= 200,
      details: meta.description
        ? `${meta.description.length} chars`
        : "Missing meta description",
    },
    {
      id: "robots",
      name: "robots.txt",
      category: "SEO",
      passed: robots.exists,
      details: robots.exists
        ? `Found. ${robots.sitemapUrls.length} sitemap reference(s).`
        : "Missing or inaccessible",
    },
    {
      id: "sitemap",
      name: "XML Sitemap",
      category: "SEO",
      passed: sitemap.exists,
      details: sitemap.exists
        ? `Found. ${sitemap.urlCount} URL(s) indexed.`
        : "Missing or inaccessible",
    },
  ]

  // AEO checks (4)
  const aeoChecks: CheckResult[] = [
    {
      id: "jsonld",
      name: "JSON-LD Structured Data",
      category: "AEO",
      passed: schema.jsonLdBlocks.length > 0,
      details:
        schema.jsonLdBlocks.length > 0
          ? `${schema.jsonLdBlocks.length} JSON-LD block(s) found`
          : "No JSON-LD structured data",
    },
    {
      id: "opengraph",
      name: "Open Graph Tags",
      category: "AEO",
      passed: !!(meta.ogTitle && meta.ogDescription && meta.ogImage),
      details: [
        meta.ogTitle ? "og:title" : null,
        meta.ogDescription ? "og:description" : null,
        meta.ogImage ? "og:image" : null,
      ]
        .filter(Boolean)
        .join(", ") || "No OG tags found",
    },
    {
      id: "canonical",
      name: "Canonical URL",
      category: "AEO",
      passed: !!meta.canonical,
      details: meta.canonical
        ? `Canonical: ${meta.canonical}`
        : "No canonical URL set",
    },
    {
      id: "faq-speakable",
      name: "FAQ / Speakable Schema",
      category: "AEO",
      passed: schema.hasFaq || schema.hasSpeakable,
      details: [
        schema.hasFaq ? "FAQPage" : null,
        schema.hasSpeakable ? "Speakable" : null,
      ]
        .filter(Boolean)
        .join(" + ") || "No FAQ or Speakable schema found",
    },
  ]

  // CTA check (1)
  const ctaChecks: CheckResult[] = [
    {
      id: "cta",
      name: "Call-to-Action",
      category: "CTA",
      passed: content.ctaFound,
      details: content.ctaFound
        ? "CTA detected on page"
        : "No clear call-to-action found",
    },
  ]

  // GEO checks (3)
  const geoChecks: CheckResult[] = [
    {
      id: "wordcount",
      name: "Content Depth (≥1200 words)",
      category: "GEO",
      passed: content.wordCount >= 1200,
      details: `${content.wordCount.toLocaleString()} words`,
    },
    {
      id: "links",
      name: "Links (≥3)",
      category: "GEO",
      passed: content.linkCount >= 3,
      details: `${content.linkCount} total (${content.internalLinks} internal, ${content.externalLinks} external)`,
    },
    {
      id: "cleancopy",
      name: "Clean Copy (no banned AI words)",
      category: "GEO",
      passed: content.bannedWordCount === 0,
      details:
        content.bannedWordCount === 0
          ? "No banned words detected"
          : `Found: ${content.bannedWords.join(", ")}`,
    },
  ]

  const categories: CategoryGrade[] = [
    makeCategoryGrade("SEO", seoChecks),
    makeCategoryGrade("AEO", aeoChecks),
    makeCategoryGrade("CTA", ctaChecks),
    makeCategoryGrade("GEO", geoChecks),
  ]

  const overallPassed = categories.reduce((sum, c) => sum + c.passed, 0)
  const overallTotal = categories.reduce((sum, c) => sum + c.total, 0)
  const overallPercentage = Math.round((overallPassed / overallTotal) * 100)

  return {
    url,
    analyzedAt: new Date().toISOString(),
    categories,
    overallPassed,
    overallTotal,
    overallPercentage,
    overallGrade: letterGrade(overallPercentage),
  }
}
