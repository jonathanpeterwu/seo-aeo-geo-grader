export interface AnalysisRequest {
  url: string
  email?: string
  sessionId: string
}

export interface CheckResult {
  id: string
  name: string
  category: "SEO" | "AEO" | "CTA" | "GEO"
  passed: boolean
  details: string
}

export interface CategoryGrade {
  category: "SEO" | "AEO" | "CTA" | "GEO"
  checks: CheckResult[]
  passed: number
  total: number
  percentage: number
  grade: "A" | "B" | "C" | "D"
}

export interface AnalysisReport {
  url: string
  analyzedAt: string
  categories: CategoryGrade[]
  overallPassed: number
  overallTotal: number
  overallPercentage: number
  overallGrade: "A" | "B" | "C" | "D"
}

export interface FetchedData {
  html: string
  robotsTxt: string | null
  sitemapXml: string | null
  url: string
  resolvedUrl: string
}

export interface MetaTags {
  title: string | null
  description: string | null
  canonical: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
}

export interface SchemaData {
  jsonLdBlocks: Record<string, unknown>[]
  hasFaq: boolean
  hasSpeakable: boolean
  hasSoftwareApp: boolean
}

export interface ContentAnalysis {
  wordCount: number
  linkCount: number
  internalLinks: number
  externalLinks: number
  ctaFound: boolean
  bannedWords: string[]
  bannedWordCount: number
}

export interface RobotsAnalysis {
  exists: boolean
  sitemapUrls: string[]
}

export interface SitemapAnalysis {
  exists: boolean
  urlCount: number
}
