/**
 * Multi-source URL discovery.
 *
 * Merges URLs from all publicly-available discovery files:
 * - sitemap.xml (and all Sitemap: directives from robots.txt)
 * - llms.txt (URLs the site explicitly wants AI to index)
 * - llms-full.txt (embedded URLs)
 * - robots.txt Allow: paths (expanded to full URLs)
 *
 * Each URL is tagged with its source(s) for transparency.
 */

export interface DiscoveredUrl {
  url: string
  sources: UrlSource[]
}

export type UrlSource =
  | "sitemap"
  | "robots-sitemap"    // Sitemap: directive in robots.txt (non-default path)
  | "llms-txt"
  | "llms-full-txt"
  | "robots-allow"      // Allow: path in robots.txt

interface DiscoveryResult {
  urls: DiscoveredUrl[]
  sources: {
    sitemap: number
    robotsSitemap: number
    llmsTxt: number
    llmsFullTxt: number
    robotsAllow: number
  }
  totalUnique: number
}

/** Extract all <loc> URLs from sitemap XML */
function extractSitemapLocs(xml: string | null): string[] {
  if (!xml) return []
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith("http"))
}

/** Extract all Sitemap: directives from robots.txt */
function extractRobotsSitemapUrls(robotsTxt: string | null): string[] {
  if (!robotsTxt) return []
  return [...robotsTxt.matchAll(/^Sitemap:\s*(.+)$/gim)]
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith("http"))
}

/** Extract Allow: paths from robots.txt and expand to full URLs */
function extractRobotsAllowPaths(robotsTxt: string | null, origin: string): string[] {
  if (!robotsTxt) return []
  const urls: string[] = []
  const lines = robotsTxt.split("\n")
  let currentAgent = ""

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()
    if (trimmed.startsWith("user-agent:")) {
      currentAgent = trimmed.replace("user-agent:", "").trim()
    } else if (trimmed.startsWith("allow:")) {
      const path = line.trim().replace(/^allow:\s*/i, "").split("#")[0].trim()
      // Only include specific paths (not just "/"), skip wildcards
      if (path && path !== "/" && !path.includes("*") && path.startsWith("/")) {
        urls.push(`${origin}${path}`)
      }
    }
  }

  return urls
}

/** Extract URLs from llms.txt content (markdown links + bare URLs) */
function extractLlmsTxtUrls(content: string | null): string[] {
  if (!content) return []
  const urls: string[] = []

  // Markdown links: [text](url)
  for (const m of content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    const url = m[2].trim()
    if (url.startsWith("http")) urls.push(url)
  }

  // Bare URLs on their own line or after "- "
  for (const m of content.matchAll(/(?:^|\s)(https?:\/\/[^\s<>)"']+)/gm)) {
    const url = m[1].trim()
    if (!urls.includes(url)) urls.push(url)
  }

  return urls
}

/** Normalize URL for deduplication */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove trailing slash, lowercase host
    return parsed.origin.toLowerCase() + parsed.pathname.replace(/\/+$/, "") + parsed.search
  } catch {
    return url
  }
}

/** Check if URL belongs to the target origin */
function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin.toLowerCase() === origin.toLowerCase()
  } catch {
    return false
  }
}

export interface DiscoverUrlsOptions {
  origin: string
  sitemapXml: string | null
  robotsTxt: string | null
  llmsTxt: string | null
  llmsFullTxt: string | null
  /** Additional sitemap XMLs fetched from robots.txt Sitemap: directives */
  additionalSitemaps?: string[]
}

/**
 * Discover all gradeable URLs from a site's public discovery files.
 * Merges and deduplicates across all sources, tagging each URL with its source(s).
 */
export function discoverUrls(opts: DiscoverUrlsOptions): DiscoveryResult {
  const urlMap = new Map<string, Set<UrlSource>>()
  const origin = opts.origin.toLowerCase()

  function addUrl(raw: string, source: UrlSource) {
    if (!isSameOrigin(raw, origin)) return
    const key = normalizeUrl(raw)
    if (!urlMap.has(key)) urlMap.set(key, new Set())
    urlMap.get(key)!.add(source)
  }

  // 1. Primary sitemap.xml
  for (const url of extractSitemapLocs(opts.sitemapXml)) {
    addUrl(url, "sitemap")
  }

  // 2. Additional sitemaps from robots.txt Sitemap: directives
  if (opts.additionalSitemaps) {
    for (const xml of opts.additionalSitemaps) {
      for (const url of extractSitemapLocs(xml)) {
        addUrl(url, "robots-sitemap")
      }
    }
  }

  // 3. llms.txt URLs
  for (const url of extractLlmsTxtUrls(opts.llmsTxt)) {
    addUrl(url, "llms-txt")
  }

  // 4. llms-full.txt URLs
  for (const url of extractLlmsTxtUrls(opts.llmsFullTxt)) {
    addUrl(url, "llms-full-txt")
  }

  // 5. robots.txt Allow: paths
  for (const url of extractRobotsAllowPaths(opts.robotsTxt, origin)) {
    addUrl(url, "robots-allow")
  }

  // Build result, sorting URLs with most sources first (higher priority)
  const urls: DiscoveredUrl[] = []
  const sources = { sitemap: 0, robotsSitemap: 0, llmsTxt: 0, llmsFullTxt: 0, robotsAllow: 0 }

  for (const [normalized, srcSet] of urlMap) {
    urls.push({ url: normalized, sources: [...srcSet] })
    if (srcSet.has("sitemap")) sources.sitemap++
    if (srcSet.has("robots-sitemap")) sources.robotsSitemap++
    if (srcSet.has("llms-txt")) sources.llmsTxt++
    if (srcSet.has("llms-full-txt")) sources.llmsFullTxt++
    if (srcSet.has("robots-allow")) sources.robotsAllow++
  }

  // Sort: URLs found in more sources first, then llms-txt prioritized (site's AI priority)
  urls.sort((a, b) => {
    const aHasLlms = a.sources.includes("llms-txt") ? 1 : 0
    const bHasLlms = b.sources.includes("llms-txt") ? 1 : 0
    if (bHasLlms !== aHasLlms) return bHasLlms - aHasLlms
    return b.sources.length - a.sources.length
  })

  return { urls, sources, totalUnique: urls.length }
}

/** Helper: extract Sitemap: URLs from robots.txt for fetching */
export { extractRobotsSitemapUrls }
