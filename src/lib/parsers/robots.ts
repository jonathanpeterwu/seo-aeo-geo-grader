import { RobotsAnalysis } from "@/types"

export function analyzeRobotsTxt(content: string | null): RobotsAnalysis {
  if (!content) return { exists: false, sitemapUrls: [] }

  const sitemapUrls: string[] = []
  const lines = content.split("\n")
  for (const line of lines) {
    const match = line.match(/^Sitemap:\s*(.+)$/i)
    if (match) {
      sitemapUrls.push(match[1].trim())
    }
  }

  return { exists: true, sitemapUrls }
}
