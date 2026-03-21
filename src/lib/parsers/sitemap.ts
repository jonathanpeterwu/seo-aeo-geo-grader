import { SitemapAnalysis } from "@/types"

export function analyzeSitemap(content: string | null): SitemapAnalysis {
  if (!content) return { exists: false, urlCount: 0 }

  const urlMatches = content.match(/<loc>/gi)
  const urlCount = urlMatches ? urlMatches.length : 0

  return { exists: true, urlCount }
}
