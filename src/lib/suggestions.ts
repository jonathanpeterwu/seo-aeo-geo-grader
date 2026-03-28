import { CheckResult } from "@/types"

export interface Suggestion {
  checkId: string
  priority: "high" | "medium" | "low"
  title: string
  description: string
  effort: "quick" | "moderate" | "significant"
  impact: string
}

/**
 * Generate actionable fix suggestions based on failed/partial checks.
 * Gated behind the $99 site pass and above.
 */
export function generateSuggestions(checks: CheckResult[]): Suggestion[] {
  const suggestions: Suggestion[] = []

  for (const check of checks) {
    if (check.score === check.maxScore) continue

    switch (check.id) {
      case "title":
        suggestions.push({
          checkId: "title",
          priority: "high",
          title: "Add or fix the <title> tag",
          description:
            check.details.includes("Missing")
              ? "Add a <title> tag to the <head>. Keep it 10–70 characters with your primary keyword near the front."
              : `Current title is ${check.details}. Aim for 10–70 characters. Front-load the primary keyword and include a brand suffix (e.g. "| YourBrand").`,
          effort: "quick",
          impact: "+5pt SEO — title feeds <title>, OG, and JSON-LD headline",
        })
        break

      case "description":
        suggestions.push({
          checkId: "description",
          priority: "high",
          title: "Add or improve the meta description",
          description:
            check.details.includes("Missing")
              ? 'Add <meta name="description" content="..."> to the <head>. Write a compelling 50–160 character summary with a CTA.'
              : `Current description is ${check.details}. Aim for 50–160 characters. Include primary keyword + a clear value proposition.`,
          effort: "quick",
          impact: "+5pt SEO — feeds meta description, OG description, and AI engine context",
        })
        break

      case "canonical":
        suggestions.push({
          checkId: "canonical",
          priority: "medium",
          title: "Add a canonical URL tag",
          description:
            'Add <link rel="canonical" href="https://yourdomain.com/page"> to the <head>. This prevents duplicate content issues and tells search engines which URL is authoritative.',
          effort: "quick",
          impact: "+3pt SEO — prevents duplicate content penalties",
        })
        break

      case "robots":
        suggestions.push({
          checkId: "robots",
          priority: "high",
          title: "Create a robots.txt file",
          description:
            "Add a robots.txt at your domain root. Minimum viable:\n\nUser-agent: *\nAllow: /\nSitemap: https://yourdomain.com/sitemap.xml\n\nThis tells search engines and AI crawlers what to index.",
          effort: "quick",
          impact: "+5pt SEO — critical for crawl discovery and AI engine access",
        })
        break

      case "sitemap":
        suggestions.push({
          checkId: "sitemap",
          priority: "medium",
          title: "Add an XML sitemap",
          description:
            "Generate a sitemap.xml listing all indexable pages. Reference it in robots.txt with a Sitemap: directive. Most frameworks (Next.js, WordPress, etc.) have plugins/built-in support.",
          effort: "moderate",
          impact: "+4pt SEO — improves crawl efficiency and page discovery",
        })
        break

      case "sitemap-freshness":
        suggestions.push({
          checkId: "sitemap-freshness",
          priority: "medium",
          title: "Add <lastmod> dates to sitemap entries",
          description:
            "Include accurate <lastmod> dates in your sitemap.xml. Keep >50% of pages updated within the last 90 days for full marks. Stale sitemaps signal abandoned content to AI engines.",
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt SEO — freshness signals boost AI engine citation priority`,
        })
        break

      case "jsonld":
        suggestions.push({
          checkId: "jsonld",
          priority: "high",
          title: "Add JSON-LD structured data",
          description:
            'Add a <script type="application/ld+json"> block. Start with Organization or WebSite schema for your home page. For product pages, use SoftwareApplication or Product schema. For articles, use Article/BlogPosting.\n\nSoftwareApplication schema enables product rich results (35% higher CTR in SERPs).',
          effort: "moderate",
          impact: "+5pt AEO — enables rich results and AI engine extraction",
        })
        break

      case "opengraph":
        suggestions.push({
          checkId: "opengraph",
          priority: "medium",
          title: "Complete your Open Graph tags",
          description:
            `Missing: ${check.details}. Add these meta tags to <head>:\n\n<meta property="og:title" content="..." />\n<meta property="og:description" content="..." />\n<meta property="og:image" content="https://..." />\n\nUse a 1200x630px image for best rendering on social and AI platforms.`,
          effort: "quick",
          impact: "+3pt AEO — controls social previews and AI engine card rendering",
        })
        break

      case "faq-speakable":
        suggestions.push({
          checkId: "faq-speakable",
          priority: "high",
          title: "Add FAQPage or Speakable schema",
          description:
            check.score === 0
              ? "Add FAQPage JSON-LD with ≥3 question/answer pairs. These render as FAQ rich results in Google and are direct answer sources for AI engines (ChatGPT, Perplexity, Gemini).\n\nAlso consider adding Speakable schema with data-speakable attributes on hero descriptions — this increases AI citation likelihood for voice and answer engines."
              : "You have FAQ schema but need ≥3 Q&A pairs or Speakable for full marks. Add more relevant questions. Each answer should be 2–3 sentences and self-contained.",
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt AEO — FAQ schema is the #1 signal for AI answer engine citations`,
        })
        break

      case "schema-stack":
        suggestions.push({
          checkId: "schema-stack",
          priority: "medium",
          title: "Deepen your schema stack",
          description:
            `Currently ${check.details}. Add missing schema types for a complete stack:\n\n• Article/BlogPosting — E-E-A-T signals\n• FAQPage — AI answer engine citation\n• BreadcrumbList — navigation context\n• Organization — brand authority\n• Speakable — voice/AI extraction\n\nGemini gives 2-3x citation boost for deep schema stacks.`,
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt AEO — schema depth is a Gemini citation multiplier`,
        })
        break

      case "freshness":
        suggestions.push({
          checkId: "freshness",
          priority: "high",
          title: "Update content freshness signals",
          description:
            "Add or update dateModified in your JSON-LD schema and article:modified_time meta tag. AI engines (especially ChatGPT and Perplexity) heavily penalize stale content. Refresh within 90 days for full marks.",
          effort: "quick",
          impact: `+${check.maxScore - check.score}pt AEO — freshness is the #1 signal for Perplexity and top-3 for ChatGPT`,
        })
        break

      case "citations":
        suggestions.push({
          checkId: "citations",
          priority: "medium",
          title: "Add outbound citations to authoritative sources",
          description:
            "Link to ≥5 authoritative sources (academic papers, .gov/.edu sites, Wikipedia, DOI links). Outbound citations increase trust signals for Perplexity and ChatGPT citation selection.",
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt AEO — citations boost Perplexity trust scoring`,
        })
        break

      case "cta":
        suggestions.push({
          checkId: "cta",
          priority: "medium",
          title: "Add a clear call-to-action",
          description:
            'Add at least one prominent CTA (button or link) with action text: "Get Started", "Try Free", "Book a Demo", "Sign Up", etc. Best practice: one above the fold + one after key content sections.',
          effort: "quick",
          impact: "+5pt CTA — conversion path for both users and AI-referred traffic",
        })
        break

      case "links": {
        suggestions.push({
          checkId: "links",
          priority: "high",
          title: `Add more links (need ≥10 for full marks)`,
          description:
            `Current: ${check.details}. Add internal links to related pages and external links to authoritative sources. Cross-references and citations increase trust signals for generative engines.\n\nAim for: ≥5 internal links (site structure) + ≥5 external links (citations/sources).`,
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt GEO — links are the highest-weighted GEO signal (7pt)`,
        })
        break
      }

      case "cleancopy":
        suggestions.push({
          checkId: "cleancopy",
          priority: "medium",
          title: "Remove banned AI-sounding words",
          description:
            `Found: ${check.details.replace("Found: ", "")}.\n\nThese words signal AI-generated content, reducing trust for both readers and AI engines. Replace with specific, concrete language.\n\nExamples: "seamlessly" → "without switching tabs", "robust" → "handles 10k requests/sec", "leverage" → "use".`,
          effort: "moderate",
          impact: "+5pt GEO — clean copy builds trust with AI engines and readers",
        })
        break

      case "depth":
        suggestions.push({
          checkId: "depth",
          priority: "low",
          title: "Add more substantive content",
          description:
            `Currently ${check.details}. AI engines favor pages with ≥2,000 words for citation. Expand with: detailed explanations, use cases, comparisons, how-to steps, or FAQ sections. Don't pad — add genuine value.`,
          effort: "significant",
          impact: `+${check.maxScore - check.score}pt GEO — substantive content gets cited more by AI engines`,
        })
        break

      case "stats":
        suggestions.push({
          checkId: "stats",
          priority: "low",
          title: "Add statistics and data points",
          description:
            'Include ≥5 data points: percentages (e.g. "35% higher CTR"), dollar amounts, multipliers (e.g. "3x faster"), or specific metrics. Data-backed claims get cited more frequently by AI engines.',
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt GEO — statistics increase citation likelihood in AI answers`,
        })
        break

      case "h2s":
        suggestions.push({
          checkId: "h2s",
          priority: "low",
          title: "Improve heading structure",
          description:
            `Currently ${check.details}. Add ≥5 H2 headings to structure your content. Each H2 should be a scannable section title. This helps both SEO (crawl structure) and AI engines (content chunking for citations).`,
          effort: "quick",
          impact: `+${check.maxScore - check.score}pt GEO — heading structure improves AI content extraction`,
        })
        break

      case "ai-bot-access":
        suggestions.push({
          checkId: "ai-bot-access",
          priority: "high",
          title: "Allow AI bots in robots.txt",
          description:
            "Add explicit Allow directives for AI crawlers in robots.txt:\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nBlocking AI bots removes your content from AI answers entirely.",
          effort: "quick",
          impact: `+${check.maxScore - check.score}pt AI Discovery — AI bot access is required for citation in AI engines`,
        })
        break

      case "llms-txt":
        suggestions.push({
          checkId: "llms-txt",
          priority: "medium",
          title: "Add /llms.txt for AI discovery",
          description:
            "Create a /llms.txt file that describes your site for LLMs. Include ≥3 sections: product overview, key features, use cases, pricing, etc. This emerging standard helps AI engines understand and cite your content accurately.",
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt AI Discovery — llms.txt is the emerging standard for AI-first content`,
        })
        break

      case "llms-full-txt":
        suggestions.push({
          checkId: "llms-full-txt",
          priority: "low",
          title: "Add /llms-full.txt with comprehensive content",
          description:
            "Create a /llms-full.txt with >5,000 characters of structured content — product descriptions, feature details, FAQs, key facts. This gives AI engines a single file to ingest your entire value proposition.",
          effort: "significant",
          impact: `+${check.maxScore - check.score}pt AI Discovery — comprehensive AI content dump for citation`,
        })
        break

      case "security-txt":
        suggestions.push({
          checkId: "security-txt",
          priority: "low",
          title: "Add /.well-known/security.txt",
          description:
            "Create a /.well-known/security.txt per RFC 9116. Include Contact:, Expires:, and optional Preferred-Languages: fields. This trust signal indicates a well-maintained site to AI crawlers.",
          effort: "quick",
          impact: "+2pt AI Discovery — RFC 9116 trust signal for AI crawlers",
        })
        break

      case "extractable-blocks":
        suggestions.push({
          checkId: "extractable-blocks",
          priority: "medium",
          title: "Add self-contained 40-60 word paragraphs",
          description:
            "Write ≥5 paragraphs of 40-60 words that each make a complete claim with supporting data. These are the ideal extraction unit for ChatGPT citations and AI answer snippets. Each should stand alone without context.",
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt AI Discovery — extractable blocks are ChatGPT's primary citation unit`,
        })
        break
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return suggestions
}
