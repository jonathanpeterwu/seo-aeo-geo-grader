import { NextRequest, NextResponse } from "next/server"
import { generatePdf } from "@/lib/pdf"
import { AnalysisReport } from "@/types"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const report = body.report as AnalysisReport

    if (!report || !report.url) {
      return NextResponse.json(
        { error: "Report data is required" },
        { status: 400 }
      )
    }

    const pdfBuffer = generatePdf(report)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="seo-aeo-geo-report.pdf"`,
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}
