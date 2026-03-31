import { NextRequest, NextResponse } from "next/server"
import { listSites, getSiteCount, getDb } from "@/lib/site-index"

export async function GET(req: NextRequest) {
  const db = getDb()
  const params = req.nextUrl.searchParams

  const sortBy = (params.get("sortBy") || "lastSeen") as
    | "lastSeen"
    | "score"
    | "domain"
    | "analyzeCount"
  const order = (params.get("order") || "desc") as "asc" | "desc"
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 200)
  const offset = parseInt(params.get("offset") || "0", 10)
  const search = params.get("search") || undefined

  const { sites, total } = await listSites(db, {
    sortBy,
    order,
    limit,
    offset,
    search,
  })

  return NextResponse.json({
    sites,
    total,
    limit,
    offset,
    totalIndexed: await getSiteCount(db),
  })
}
