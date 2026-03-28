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

async function fetchText(url: string): Promise<string | null> {
  const res = await fetchWithTimeout(url)
  if (!res || !res.ok) return null
  const text = await res.text()
  // Reject HTML error pages
  if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) return null
  return text.length > 0 ? text : null
}

function getOrigin(url: string): string {
  const parsed = new URL(url)
  return parsed.origin
}

export async function fetchPageData(url: string): Promise<FetchedData> {
  const origin = getOrigin(url)

  // Fetch all discovery files in parallel
  const [pageRes, robotsTxt, sitemapText, llmsTxt, llmsFullTxt, aiPluginText, securityTxt] =
    await Promise.all([
      fetchWithTimeout(url),
      fetchText(`${origin}/robots.txt`),
      fetchText(`${origin}/sitemap.xml`),
      fetchText(`${origin}/llms.txt`),
      fetchText(`${origin}/llms-full.txt`),
      fetchText(`${origin}/.well-known/ai-plugin.json`),
      fetchText(`${origin}/.well-known/security.txt`),
    ])

  const html = pageRes ? await pageRes.text() : ""
  const resolvedUrl = pageRes?.url || url

  // Validate sitemap XML
  let sitemapXml: string | null = null
  if (sitemapText && (sitemapText.includes("<urlset") || sitemapText.includes("<sitemapindex"))) {
    sitemapXml = sitemapText
  }

  // If no sitemap at /sitemap.xml, check robots.txt for Sitemap directive
  if (!sitemapXml && robotsTxt) {
    const sitemapMatch = robotsTxt.match(/^Sitemap:\s*(.+)$/im)
    if (sitemapMatch) {
      const altText = await fetchText(sitemapMatch[1].trim())
      if (altText && (altText.includes("<urlset") || altText.includes("<sitemapindex"))) {
        sitemapXml = altText
      }
    }
  }

  // Parse ai-plugin.json
  let aiPluginJson: Record<string, unknown> | null = null
  if (aiPluginText) {
    try {
      aiPluginJson = JSON.parse(aiPluginText)
    } catch { /* not valid JSON */ }
  }

  return {
    html,
    robotsTxt,
    sitemapXml,
    llmsTxt,
    llmsFullTxt,
    aiPluginJson,
    securityTxt,
    url,
    resolvedUrl,
  }
}
