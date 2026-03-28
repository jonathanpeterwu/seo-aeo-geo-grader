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
  }
}
