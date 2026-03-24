/**
 * Ahrefs integration
 * Agency plan only
 *
 * Provides: backlink data, keyword rankings, domain rating, referring domains
 */

export interface AhrefsPageData {
  url: string
  domainRating: number
  urlRating: number
  backlinks: number
  referringDomains: number
  organicKeywords: number
  organicTraffic: number
  topKeywords: { keyword: string; position: number; volume: number }[]
}

export interface AhrefsConfig {
  apiToken: string
}

export async function fetchAhrefsData(
  _config: AhrefsConfig,
  url: string
): Promise<AhrefsPageData | null> {
  // TODO: Implement Ahrefs API integration
  //
  // API v3: https://docs.ahrefs.com/docs/api/
  //
  // Endpoints:
  // - GET /v3/site-explorer/overview        (DR, backlinks, organic keywords)
  // - GET /v3/site-explorer/backlinks        (backlink details)
  // - GET /v3/site-explorer/organic-keywords (keyword rankings)
  //
  // Auth: Bearer token in Authorization header
  //
  // Rate limits vary by plan — cache results aggressively (1h minimum)

  console.log(`[Ahrefs] Would fetch data for ${url}`)
  return null
}

export async function fetchAhrefsDomainOverview(
  _config: AhrefsConfig,
  _domain: string
): Promise<AhrefsPageData | null> {
  // TODO: Fetch domain-level overview
  return null
}
