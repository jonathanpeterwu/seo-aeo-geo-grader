import { NextRequest, NextResponse } from "next/server"
import { getSiteRecord, getDb } from "@/lib/site-index"

export async function GET(
  _req: NextRequest,
  { params }: { params: { domain: string } }
) {
  const db = getDb()
  const record = await getSiteRecord(params.domain, db)

  if (!record) {
    return NextResponse.json(
      { error: "Domain not found in index" },
      { status: 404 }
    )
  }

  return NextResponse.json({ site: record })
}
