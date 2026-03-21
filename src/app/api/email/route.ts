import { NextRequest, NextResponse } from "next/server"
import { generatePdf } from "@/lib/pdf"
import { sendReport } from "@/lib/email"
import { AnalysisReport } from "@/types"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { report, email } = body as {
      report: AnalysisReport
      email: string
    }

    if (!report || !email) {
      return NextResponse.json(
        { error: "Report and email are required" },
        { status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    const pdfBuffer = generatePdf(report)
    await sendReport(email, pdfBuffer, report)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Email error:", err)
    return NextResponse.json(
      { error: "Failed to send email. Check SMTP configuration." },
      { status: 500 }
    )
  }
}
