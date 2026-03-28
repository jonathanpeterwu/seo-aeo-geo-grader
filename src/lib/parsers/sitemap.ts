import { SitemapAnalysis } from "@/types"

export function analyzeSitemap(content: string | null): SitemapAnalysis {
  if (!content) return { exists: false, urlCount: 0 }

  const urlMatches = content.match(/<loc>/gi)
  const urlCount = urlMatches ? urlMatches.length : 0

  return { exists: true, urlCount }
}

/** Extract all <loc> URLs from a sitemap XML string. */
export function extractSitemapUrls(content: string | null): string[] {
  if (!content) return []
  const matches = [...content.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
  return matches.map((m) => m[1].trim()).filter((u) => u.startsWith("http"))
}
