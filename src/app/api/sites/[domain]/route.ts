import { NextRequest, NextResponse } from "next/server"
import { getSiteRecord } from "@/lib/site-index"

export async function GET(
  _req: NextRequest,
  { params }: { params: { domain: string } }
) {
  const record = getSiteRecord(params.domain)

  if (!record) {
    return NextResponse.json(
      { error: "Domain not found in index" },
      { status: 404 }
    )
  }

  return NextResponse.json({ site: record })
}
