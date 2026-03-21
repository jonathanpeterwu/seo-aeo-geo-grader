import * as cheerio from "cheerio"
import { ContentAnalysis } from "@/types"

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
  html: string,
  pageUrl: string
): ContentAnalysis {
  const $ = cheerio.load(html)

  // Count h2s before removing elements
  const h2Count = $("h2").length

  // Remove non-content elements
  $("script, style, nav, header, footer, noscript, svg, iframe").remove()

  const bodyText = $("body").text()
  const words = bodyText.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length

  // Count links
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
    try {
      const linkUrl = new URL(href, pageUrl)
      if (linkUrl.origin === pageOrigin) {
        internalLinks++
      } else {
        externalLinks++
      }
    } catch {
      if (
        href.startsWith("/") ||
        href.startsWith("#") ||
        href.startsWith(".")
      ) {
        internalLinks++
      }
    }
  })

  // CTA detection
  const fullHtml = $.html() || ""
  let ctaFound = false
  for (const pattern of CTA_PATTERNS) {
    if (pattern.test(fullHtml)) {
      ctaFound = true
      break
    }
  }

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
