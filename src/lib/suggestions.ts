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
          impact: "+2pt SEO — title feeds <title>, OG, and JSON-LD headline",
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
          impact: "+2pt SEO — feeds meta description, OG description, and AI engine context",
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
          impact: "+2pt SEO — critical for crawl discovery and AI engine access",
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
          impact: "+1pt SEO — improves crawl efficiency and page discovery",
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
          impact: "+2pt AEO — enables rich results and AI engine extraction",
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
          impact: "+1pt AEO — controls social previews and AI engine card rendering",
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
              : "You have FAQ schema but need ≥3 Q&A pairs for full marks. Add more relevant questions. Each answer should be 2–3 sentences and self-contained.",
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt AEO — FAQ schema is the #1 signal for AI answer engine citations`,
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
          impact: "+1pt CTA — conversion path for both users and AI-referred traffic",
        })
        break

      case "links": {
        const needed = check.score < 2 ? "≥5" : "≥5 (currently have 3–4)"
        suggestions.push({
          checkId: "links",
          priority: "high",
          title: `Add more links (need ${needed} for full marks)`,
          description:
            `Current: ${check.details}. Add internal links to related pages and external links to authoritative sources. Cross-references and citations increase trust signals for generative engines.\n\nAim for: ≥3 internal links (site structure) + ≥2 external links (citations/sources).`,
          effort: "moderate",
          impact: `+${check.maxScore - check.score}pt GEO — links are the highest-weighted GEO signal (3pt)`,
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
          impact: "+2pt GEO — clean copy builds trust with AI engines and readers",
        })
        break

      case "depth":
        suggestions.push({
          checkId: "depth",
          priority: "low",
          title: "Add more substantive content",
          description:
            `Currently ${check.details}. AI engines favor pages with ≥1,200 words for citation. Expand with: detailed explanations, use cases, comparisons, how-to steps, or FAQ sections. Don't pad — add genuine value.`,
          effort: "significant",
          impact: "+1pt GEO — substantive content gets cited more by AI engines",
        })
        break

      case "stats":
        suggestions.push({
          checkId: "stats",
          priority: "low",
          title: "Add statistics and data points",
          description:
            "Include ≥3 data points: percentages (e.g. \"35% higher CTR\"), dollar amounts, multipliers (e.g. \"3x faster\"), or specific metrics. Data-backed claims get cited more frequently by AI engines.",
          effort: "moderate",
          impact: "+1pt GEO — statistics increase citation likelihood in AI answers",
        })
        break

      case "h2s":
        suggestions.push({
          checkId: "h2s",
          priority: "low",
          title: "Improve heading structure",
          description:
            `Currently ${check.details}. Add ≥3 H2 headings to structure your content. Each H2 should be a scannable section title. This helps both SEO (crawl structure) and AI engines (content chunking for citations).`,
          effort: "quick",
          impact: "+1pt GEO — heading structure improves AI content extraction",
        })
        break
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return suggestions
}
