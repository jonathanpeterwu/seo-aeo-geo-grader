/**
 * Google Search Console integration
 * Pro plan and above
 *
 * Provides: impressions, clicks, CTR, position data per URL
 * Auth: OAuth2 with Google APIs
 */

export interface GSCPageData {
  url: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  queries: { query: string; clicks: number; impressions: number }[]
}

export interface GSCConfig {
  accessToken: string
  refreshToken: string
  siteUrl: string // e.g. "sc-domain:example.com"
}

export async function fetchGSCData(
  config: GSCConfig,
  url: string,
  _days = 28
): Promise<GSCPageData | null> {
  // TODO: Implement Google Search Console API integration
  // Uses: https://developers.google.com/webmaster-tools/v1/api_reference_index
  //
  // 1. POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
  // 2. Filter by page URL
  // 3. Return clicks, impressions, CTR, position
  // 4. Group by query to show top search terms
  //
  // Requires OAuth2 scopes: https://www.googleapis.com/auth/webmasters.readonly

  console.log(`[GSC] Would fetch data for ${url} from ${config.siteUrl}`)
  return null
}

export async function fetchGSCSiteOverview(
  _config: GSCConfig,
  _days = 28
): Promise<GSCPageData[]> {
  // TODO: Fetch site-wide performance data
  return []
}
