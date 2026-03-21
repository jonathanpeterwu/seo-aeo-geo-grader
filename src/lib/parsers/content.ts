import * as cheerio from "cheerio"
import { ContentAnalysis } from "@/types"

const BANNED_WORDS = [
  "seamlessly",
  "robust",
  "leverage",
  "synergy",
  "delve",
  "tapestry",
  "landscape",
  "unleash",
  "empower",
  "holistic",
  "paradigm",
  "revolutionize",
  "cutting-edge",
  "game-changer",
  "best-in-class",
  "next-generation",
  "world-class",
  "state-of-the-art",
  "in today's digital age",
  "in today's fast-paced world",
  "it's important to note",
  "at the end of the day",
  "dive into",
  "navigate the complexities",
]

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

  // Remove non-content elements
  $("script, style, nav, header, footer, noscript, svg, iframe").remove()

  const bodyText = $("body").text()
  const words = bodyText
    .split(/\s+/)
    .filter((w) => w.length > 0)
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
      // relative links count as internal
      if (href.startsWith("/") || href.startsWith("#") || href.startsWith(".")) {
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

  // Banned word detection
  const lowerText = bodyText.toLowerCase()
  const foundBanned: string[] = []
  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      foundBanned.push(word)
    }
  }

  return {
    wordCount,
    linkCount: internalLinks + externalLinks,
    internalLinks,
    externalLinks,
    ctaFound,
    bannedWords: foundBanned,
    bannedWordCount: foundBanned.length,
  }
}
