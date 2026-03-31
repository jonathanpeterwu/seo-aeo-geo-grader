import { NextRequest, NextResponse } from "next/server"
import { listSites, getSiteCount } from "@/lib/site-index"

export async function GET(req: NextRequest) {
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

  const { sites, total } = listSites({ sortBy, order, limit, offset, search })

  return NextResponse.json({
    sites,
    total,
    limit,
    offset,
    totalIndexed: getSiteCount(),
  })
}
