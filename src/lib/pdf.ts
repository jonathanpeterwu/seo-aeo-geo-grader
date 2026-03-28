import { jsPDF } from "jspdf"
import { AnalysisReport } from "@/types"

type RGB = [number, number, number]

const COLORS: Record<string, RGB> = {
  A: [34, 197, 94],
  B: [59, 130, 246],
  C: [245, 158, 11],
  D: [239, 68, 68],
  pass: [34, 197, 94],
  partial: [245, 158, 11],
  fail: [239, 68, 68],
  text: [31, 41, 55],
  muted: [107, 114, 128],
  heading: [17, 24, 39],
}

function setColor(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2])
}

export function generatePdf(report: AnalysisReport): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  function checkPageBreak(needed: number) {
    if (y + needed > 270) {
      doc.addPage()
      y = 20
    }
  }

  // Header
  doc.setFontSize(22)
  setColor(doc, COLORS.heading)
  doc.text("SEO / AEO / GEO Grader Report", margin, y)
  y += 10

  doc.setFontSize(10)
  setColor(doc, COLORS.muted)
  doc.text(`URL: ${report.url}`, margin, y)
  y += 5
  doc.text(
    `Analyzed: ${new Date(report.analyzedAt).toLocaleString()}`,
    margin,
    y
  )
  y += 10

  // Overall grade
  const gradeColor = COLORS[report.overallGrade]
  doc.setFontSize(48)
  setColor(doc, gradeColor)
  doc.text(report.overallGrade, pageWidth / 2 - 10, y + 15)
  doc.setFontSize(16)
  doc.text(`${report.overallPercentage}%`, pageWidth / 2 + 5, y + 15)
  y += 25

  doc.setFontSize(11)
  setColor(doc, COLORS.text)
  doc.text(
    `${report.overallScore} / ${report.overallMaxScore} points`,
    margin,
    y
  )
  y += 5

  // Grade thresholds legend
  doc.setFontSize(8)
  setColor(doc, COLORS.muted)
  doc.text(
    "A \u2265 90% | B \u2265 75% | C \u2265 58% | D < 58%",
    margin,
    y
  )
  y += 10

  // Divider
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Categories
  for (const cat of report.categories) {
    checkPageBreak(40)

    const catGradeColor = COLORS[cat.grade]

    doc.setFontSize(14)
    setColor(doc, COLORS.heading)
    doc.text(`${cat.category} (${cat.score}/${cat.maxScore})`, margin, y)

    setColor(doc, catGradeColor)
    doc.text(
      `${cat.grade} (${cat.percentage}%)`,
      pageWidth - margin - 30,
      y
    )
    y += 7

    for (const check of cat.checks) {
      checkPageBreak(12)
      const isFull = check.score === check.maxScore
      const isPartial = check.score > 0 && check.score < check.maxScore
      const icon = isFull ? "\u2713" : isPartial ? "\u25CB" : "\u2717"
      const color = isFull ? COLORS.pass : isPartial ? COLORS.partial : COLORS.fail

      doc.setFontSize(10)
      setColor(doc, color)
      doc.text(icon, margin + 2, y)

      setColor(doc, COLORS.text)
      doc.text(`${check.name} (${check.score}/${check.maxScore})`, margin + 8, y)

      doc.setFontSize(8)
      setColor(doc, COLORS.muted)
      const detailsWidth = pageWidth - margin * 2 - 8
      const lines = doc.splitTextToSize(check.details, detailsWidth)
      doc.text(lines, margin + 8, y + 4)
      y += 5 + lines.length * 3.5
    }

    y += 5
  }

  // AI Engine Diagnostics section
  if (report.aiEngineDiagnostics && report.aiEngineDiagnostics.length > 0) {
    checkPageBreak(50)
    y += 5
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    doc.setFontSize(14)
    setColor(doc, COLORS.heading)
    doc.text("AI Engine Readiness (not scored)", margin, y)
    y += 7

    for (const diag of report.aiEngineDiagnostics) {
      checkPageBreak(25)
      const readinessColor =
        diag.readiness === "strong"
          ? COLORS.A
          : diag.readiness === "moderate"
            ? COLORS.C
            : COLORS.D

      doc.setFontSize(11)
      setColor(doc, COLORS.text)
      doc.text(`${diag.engine}`, margin, y)
      setColor(doc, readinessColor)
      doc.text(
        `${diag.readiness} (${diag.score}%)`,
        pageWidth - margin - 35,
        y
      )
      y += 5

      doc.setFontSize(8)
      for (const signal of diag.signals) {
        checkPageBreak(5)
        setColor(doc, COLORS.pass)
        doc.text("\u2713", margin + 2, y)
        setColor(doc, COLORS.muted)
        doc.text(signal, margin + 8, y)
        y += 3.5
      }
      for (const gap of diag.gaps) {
        checkPageBreak(5)
        setColor(doc, COLORS.fail)
        doc.text("\u2717", margin + 2, y)
        setColor(doc, COLORS.muted)
        const gapLines = doc.splitTextToSize(gap, pageWidth - margin * 2 - 8)
        doc.text(gapLines, margin + 8, y)
        y += gapLines.length * 3.5
      }
      y += 4
    }
  }

  // Rubric section
  checkPageBreak(80)
  y += 5
  doc.setDrawColor(229, 231, 235)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFontSize(14)
  setColor(doc, COLORS.heading)
  doc.text("Scoring Rubric \u2014 100pt Weighted", margin, y)
  y += 7

  const rubricLines = [
    "SEO  (25pt): Title 5, Meta desc 5, Canonical 3, robots.txt 5, Sitemap 4, Freshness 3",
    "AEO  (25pt): JSON-LD 5, OG 3, FAQ/Speakable 5, Schema stack 5, Freshness 4, Citations 3",
    "CTA   (5pt): Call-to-action present 5",
    "GEO  (25pt): Links 7, Clean copy 5, Depth 5, Stats 4, H2s 4",
    "AI   (20pt): Bot access 6, llms.txt 5, llms-full.txt 4, security.txt 2, Blocks 3",
    "",
    "Grade = (points / 100) \u00D7 100%",
    "A \u2265 90%  |  B \u2265 75%  |  C \u2265 58%  |  D < 58%",
  ]

  doc.setFontSize(9)
  setColor(doc, COLORS.text)
  for (const line of rubricLines) {
    checkPageBreak(6)
    doc.text(line, margin, y)
    y += 4.5
  }

  // Footer
  checkPageBreak(15)
  y += 10
  doc.setFontSize(8)
  setColor(doc, COLORS.muted)
  doc.text("Generated by SEO/AEO/GEO Grader", margin, y)

  return Buffer.from(doc.output("arraybuffer"))
}
