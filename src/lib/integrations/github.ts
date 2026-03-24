/**
 * GitHub auto-fix integration
 * Agency plan only
 *
 * Creates PRs with suggested SEO/AEO/GEO fixes applied directly to code.
 * Supports Next.js, Gatsby, Hugo, Jekyll, and plain HTML repos.
 */

import { Suggestion } from "@/lib/suggestions"

export interface GitHubConfig {
  accessToken: string
  owner: string
  repo: string
  baseBranch?: string // default: "main"
}

export interface GitHubFixResult {
  prUrl: string | null
  branchName: string
  filesChanged: string[]
  suggestions: Suggestion[]
  error: string | null
}

export async function createFixPR(
  _config: GitHubConfig,
  _pageUrl: string,
  suggestions: Suggestion[]
): Promise<GitHubFixResult> {
  // TODO: Implement GitHub PR creation with auto-fixes
  //
  // Flow:
  // 1. Fetch repo contents via GitHub API
  // 2. Identify the source file for the target page URL
  //    - Next.js: app/**/page.tsx or pages/**/*.tsx
  //    - HTML: matching .html file
  //    - CMS: identify content source
  // 3. For each suggestion, generate a code diff:
  //    - title: update <title> or metadata export
  //    - description: update meta description tag or metadata export
  //    - jsonld: inject JSON-LD <script> block
  //    - opengraph: add/update OG meta tags
  //    - robots: create/update public/robots.txt
  //    - sitemap: create sitemap generation config
  //    - faq-speakable: inject FAQPage or Speakable schema
  // 4. Create a new branch: fix/seo-aeo-geo-{slug}-{date}
  // 5. Commit changes
  // 6. Open PR with summary of what was fixed and remaining manual items
  //
  // API: https://docs.github.com/en/rest
  // Auth: Personal access token or GitHub App installation token

  console.log(
    `[GitHub] Would create PR with ${suggestions.length} fixes`
  )
  return {
    prUrl: null,
    branchName: `fix/seo-aeo-geo-${Date.now()}`,
    filesChanged: [],
    suggestions,
    error: "GitHub integration not yet configured",
  }
}

export async function listRepos(
  _config: Pick<GitHubConfig, "accessToken">
): Promise<{ owner: string; repo: string; defaultBranch: string }[]> {
  // TODO: List accessible repos for the user
  return []
}
