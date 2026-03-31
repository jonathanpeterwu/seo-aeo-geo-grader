import { MetaTags } from "@/types"
import { CheerioDoc } from "./parse-html"

export function extractMetaTags($: CheerioDoc): MetaTags {
  const title = $("title").first().text().trim() || null

  const description =
    $('meta[name="description"]').attr("content")?.trim() || null

  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null

  const viewport = $('meta[name="viewport"]').attr("content")?.trim() || null

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null
  const ogDescription =
    $('meta[property="og:description"]').attr("content")?.trim() || null
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null

  return { title, description, canonical, viewport, ogTitle, ogDescription, ogImage }
}
