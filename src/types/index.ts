export interface AnalysisRequest {
  url: string
  email?: string
  sessionId: string
}

export interface CheckResult {
  id: string
  name: string
  category: "SEO" | "AEO" | "CTA" | "GEO" | "AI_DISCOVERY"
  score: number
  maxScore: number
  passed: boolean
  details: string
}

export interface CategoryGrade {
  category: "SEO" | "AEO" | "CTA" | "GEO" | "AI_DISCOVERY"
  checks: CheckResult[]
  score: number
  maxScore: number
  percentage: number
  grade: "A" | "B" | "C" | "D"
}

export interface AIEngineDiagnosticResult {
  engine: "ChatGPT" | "Gemini" | "Perplexity" | "Bing"
  readiness: "strong" | "moderate" | "weak"
  score: number
  signals: string[]
  gaps: string[]
}

export interface AnalysisReport {
  url: string
  analyzedAt: string
  categories: CategoryGrade[]
  overallScore: number
  overallMaxScore: number
  overallPercentage: number
  overallGrade: "A" | "B" | "C" | "D"
  aiEngineDiagnostics?: AIEngineDiagnosticResult[]
  aiDiscovery?: {
    hasLlmsTxt: boolean
    llmsTxtLength: number
    llmsTxtSections: string[]
    hasLlmsFullTxt: boolean
    llmsFullTxtLength: number
    hasAiPlugin: boolean
    aiPluginName: string | null
    aiPluginDescription: string | null
    aiBotRules: { bot: string; allowed: boolean }[]
    blockedBots: string[]
    allowedBots: string[]
    sitemapUrlCount: number
    sitemapFreshPages: number
    sitemapStalePages: number
    oldestLastmod: string | null
    newestLastmod: string | null
  }
}

export interface FetchedData {
  html: string
  robotsTxt: string | null
  sitemapXml: string | null
  llmsTxt: string | null
  llmsFullTxt: string | null
  aiPluginJson: Record<string, unknown> | null
  securityTxt: string | null
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
  faqCount: number
}

export interface ContentAnalysis {
  wordCount: number
  linkCount: number
  internalLinks: number
  externalLinks: number
  ctaFound: boolean
  bannedWords: string[]
  bannedWordCount: number
  h2Count: number
  statsCount: number
}

export interface RobotsAnalysis {
  exists: boolean
  sitemapUrls: string[]
}

export interface SitemapAnalysis {
  exists: boolean
  urlCount: number
}
