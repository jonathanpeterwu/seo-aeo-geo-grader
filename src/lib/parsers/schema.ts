import * as cheerio from "cheerio"
import { SchemaData } from "@/types"

function findTypes(obj: unknown, target: string): boolean {
  if (!obj || typeof obj !== "object") return false
  if (Array.isArray(obj)) return obj.some((item) => findTypes(item, target))
  const record = obj as Record<string, unknown>
  if (record["@type"] === target) return true
  if (
    Array.isArray(record["@type"]) &&
    (record["@type"] as string[]).includes(target)
  )
    return true
  if (record["@graph"] && Array.isArray(record["@graph"])) {
    return (record["@graph"] as unknown[]).some((item) =>
      findTypes(item, target)
    )
  }
  return false
}

export function extractSchemaData(html: string): SchemaData {
  const $ = cheerio.load(html)
  const jsonLdBlocks: Record<string, unknown>[] = []
  let hasFaq = false
  let hasSpeakable = false
  let hasSoftwareApp = false

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text().trim()
    if (!text) return
    try {
      const parsed = JSON.parse(text)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        jsonLdBlocks.push(item)
        if (findTypes(item, "FAQPage")) hasFaq = true
        if (findTypes(item, "Speakable")) hasSpeakable = true
        if (item.speakable) hasSpeakable = true
        if (findTypes(item, "SoftwareApplication")) hasSoftwareApp = true
      }
    } catch {
      // malformed JSON-LD, skip
    }
  })

  return { jsonLdBlocks, hasFaq, hasSpeakable, hasSoftwareApp }
}
