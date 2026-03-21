import { FetchedData } from "@/types"

const TIMEOUT_MS = 10_000
const USER_AGENT =
  "Mozilla/5.0 (compatible; SEOGraderBot/1.0; +https://seo-grader.example.com)"

async function fetchWithTimeout(
  url: string,
  timeoutMs = TIMEOUT_MS
): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    })
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function getOrigin(url: string): string {
  const parsed = new URL(url)
  return parsed.origin
}

export async function fetchPageData(url: string): Promise<FetchedData> {
  const origin = getOrigin(url)

  const [pageRes, robotsRes, sitemapRes] = await Promise.all([
    fetchWithTimeout(url),
    fetchWithTimeout(`${origin}/robots.txt`),
    fetchWithTimeout(`${origin}/sitemap.xml`),
  ])

  const html = pageRes ? await pageRes.text() : ""
  const resolvedUrl = pageRes?.url || url

  let robotsTxt: string | null = null
  if (robotsRes && robotsRes.ok) {
    const text = await robotsRes.text()
    if (
      text.length > 0 &&
      !text.trim().startsWith("<!") &&
      !text.trim().startsWith("<html")
    ) {
      robotsTxt = text
    }
  }

  let sitemapXml: string | null = null
  if (sitemapRes && sitemapRes.ok) {
    const text = await sitemapRes.text()
    if (text.includes("<urlset") || text.includes("<sitemapindex")) {
      sitemapXml = text
    }
  }

  // If no sitemap at /sitemap.xml, check robots.txt for Sitemap directive
  if (!sitemapXml && robotsTxt) {
    const sitemapMatch = robotsTxt.match(/^Sitemap:\s*(.+)$/im)
    if (sitemapMatch) {
      const sitemapUrl = sitemapMatch[1].trim()
      const altRes = await fetchWithTimeout(sitemapUrl)
      if (altRes && altRes.ok) {
        const text = await altRes.text()
        if (text.includes("<urlset") || text.includes("<sitemapindex")) {
          sitemapXml = text
        }
      }
    }
  }

  return { html, robotsTxt, sitemapXml, url, resolvedUrl }
}
