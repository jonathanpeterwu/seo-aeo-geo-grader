import * as cheerio from "cheerio"
import { ContentAnalysis } from "@/types"
import { CheerioDoc } from "./parse-html"

// Matches score-seo.mjs banned word list
const BANNED_WORDS = [
  "seamlessly",
  "robust",
  "leverage",
  "delve",
  "journey",
  "navigate",
  "landscape",
  "foster",
  "tapestry",
  "elevate",
  "unlock",
  "empower",
  "paramount",
  "vibrant",
  "multifaceted",
  "comprehensive",
  "pivotal",
  "testament",
  "beacon",
  "orchestrate",
  "reimagine",
  "bespoke",
  "meticulous",
  "bustling",
  "whimsical",
  "enigma",
  "indelible",
  "supercharge",
  "profound",
  "furthermore",
  "indeed",
  "certainly",
  "firstly",
  "synergy",
]

const BANNED_RE = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\b`, "gi")

const CTA_PATTERNS = [
  /sign\s*up/i,
  /get\s*started/i,
  /try\s*(it\s*)?(free|now|today)/i,
  /start\s*(your\s*)?(free\s*)?trial/i,
  /download/i,
  /subscribe/i,
  /buy\s*now/i,
  /contact\s*us/i,
  /learn\s*more/i,
  /book\s*a?\s*(demo|call|meeting)/i,
  /schedule\s*a?\s*(demo|call|meeting)/i,
  /request\s*a?\s*(demo|quote)/i,
  /join\s*(now|free|today|us)/i,
  /create\s*(an?\s*)?account/i,
]

export function analyzeContent(
  $: CheerioDoc,
  pageUrl: string
): ContentAnalysis {
  // Count h2s and detect CTA BEFORE removing elements
  const h2Count = $("h2").length

  const fullHtml = $.html() || ""
  let ctaFound = false
  for (const pattern of CTA_PATTERNS) {
    if (pattern.test(fullHtml)) {
      ctaFound = true
      break
    }
  }

  // Count links before removing nav/header/footer
  let internalLinks = 0
  let externalLinks = 0
  let pageOrigin: string
  try {
    pageOrigin = new URL(pageUrl).origin
  } catch {
    pageOrigin = ""
  }

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    if (href.startsWith("#")) {
      internalLinks++
      return
    }
    if (href.startsWith("/") || href.startsWith(".")) {
      internalLinks++
      return
    }
    try {
      const linkUrl = new URL(href, pageUrl)
      if (linkUrl.origin === pageOrigin) {
        internalLinks++
      } else {
        externalLinks++
      }
    } catch {
      internalLinks++
    }
  })

  // Clone body for text analysis — do NOT mutate the shared $
  // (other parsers like ai-engines.ts still need <script> tags)
  const $clone = cheerio.load($.html())
  $clone("script, style, nav, header, footer, noscript, svg, iframe").remove()

  const bodyText = $clone("body").text()
  const words = bodyText.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length

  // Banned word detection (unique matches, like score-seo.mjs)
  const matches = bodyText.match(BANNED_RE) || []
  const foundBanned = [...new Set(matches.map((w) => w.toLowerCase()))]

  // Stats detection: percentages, dollar amounts, multipliers
  const statsMatches = bodyText.match(/\d+%|\$[\d,]+k?\b|\d+x\b/g) || []
  const statsCount = statsMatches.length

  // ── E-E-A-T signals ─────────────────────────────────────────
  // Author meta tag
  const hasAuthorMeta = !!$('meta[name="author"]').attr("content")

  // Author in JSON-LD schema
  let hasAuthorSchema = false
  let authorName: string | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text()
      if (!text) return
      const data = JSON.parse(text)
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item.author) {
          hasAuthorSchema = true
          if (typeof item.author === "string") authorName = item.author
          else if (item.author.name) authorName = item.author.name
        }
        if (Array.isArray(item["@graph"])) {
          for (const node of item["@graph"]) {
            if (node.author) {
              hasAuthorSchema = true
              if (typeof node.author === "string") authorName = node.author
              else if (node.author.name) authorName = node.author.name
            }
          }
        }
      }
    } catch { /* skip */ }
  })

  // Trust page links: about, privacy, terms
  let hasAboutLink = false
  let hasPrivacyLink = false
  let hasTermsLink = false

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").toLowerCase()
    const text = ($(el).text() || "").toLowerCase()
    if (href.includes("/about") || href.includes("/team") || text.includes("about us")) hasAboutLink = true
    if (href.includes("/privacy") || text.includes("privacy policy")) hasPrivacyLink = true
    if (href.includes("/terms") || href.includes("/tos") || text.includes("terms of service") || text.includes("terms of use")) hasTermsLink = true
  })

  // Physical address element
  const hasAddressElement = $("address").length > 0

  // Count trust pages found
  const trustPageCount = [hasAboutLink, hasPrivacyLink, hasTermsLink, hasAddressElement].filter(Boolean).length

  return {
    wordCount,
    linkCount: internalLinks + externalLinks,
    internalLinks,
    externalLinks,
    ctaFound,
    bannedWords: foundBanned,
    bannedWordCount: foundBanned.length,
    h2Count,
    statsCount,
    hasAuthorMeta,
    hasAuthorSchema,
    authorName,
    hasAboutLink,
    hasPrivacyLink,
    hasTermsLink,
    hasAddressElement,
    trustPageCount,
  }
}
