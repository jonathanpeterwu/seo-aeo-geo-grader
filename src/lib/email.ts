import nodemailer from "nodemailer"
import { AnalysisReport } from "@/types"

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendReport(
  to: string,
  pdfBuffer: Buffer,
  report: AnalysisReport
): Promise<void> {
  const transport = createTransport()

  const gradeEmoji =
    report.overallGrade === "A"
      ? "🟢"
      : report.overallGrade === "B"
        ? "🔵"
        : report.overallGrade === "C"
          ? "🟡"
          : "🔴"

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "grader@example.com",
    to,
    subject: `${gradeEmoji} SEO/AEO/GEO Report: Grade ${report.overallGrade} (${report.overallPercentage}%) — ${report.url}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #111827;">SEO/AEO/GEO Grader Report</h1>
        <p style="color: #6b7280;">URL: <a href="${report.url}">${report.url}</a></p>
        <div style="text-align: center; padding: 20px;">
          <span style="font-size: 48px; font-weight: bold;">
            ${report.overallGrade}
          </span>
          <br/>
          <span style="font-size: 18px; color: #6b7280;">
            ${report.overallPercentage}% — ${report.overallScore}/${report.overallMaxScore} points
          </span>
        </div>
        ${report.categories
          .map(
            (c) => `
          <div style="margin: 10px 0; padding: 10px; background: #f9fafb; border-radius: 8px;">
            <strong>${c.category}</strong>: ${c.grade} (${c.percentage}%) — ${c.score}/${c.maxScore} pts
          </div>
        `
          )
          .join("")}
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          Full detailed report attached as PDF.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `seo-aeo-geo-report-${new URL(report.url).hostname}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  })
}
