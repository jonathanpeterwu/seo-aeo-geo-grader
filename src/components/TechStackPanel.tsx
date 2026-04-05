"use client"

import { useState } from "react"
import { AnalysisReport } from "@/types"
import { CATEGORY_LABELS, TechCategory } from "@/lib/parsers/tech-stack"

const CATEGORY_ICONS: Record<string, string> = {
  framework: "\u2699",
  auth: "\uD83D\uDD12",
  analytics: "\uD83D\uDCCA",
  "cdn-hosting": "\u2601",
  "css-framework": "\uD83C\uDFA8",
  cms: "\uD83D\uDCDD",
  "chat-support": "\uD83D\uDCAC",
  payment: "\uD83D\uDCB3",
  font: "\uD83D\uDD24",
  "tag-manager": "\uD83C\uDFF7",
  monitoring: "\uD83D\uDEA8",
  search: "\uD83D\uDD0D",
  video: "\uD83C\uDFAC",
  social: "\uD83D\uDC65",
  security: "\uD83D\uDEE1",
  server: "\uD83D\uDDA5",
  misc: "\uD83D\uDD27",
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const IMPACT_ICON: Record<string, string> = {
  positive: "\u2713",
  neutral: "\u2014",
  warning: "\u26A0",
  negative: "\u2717",
}

const IMPACT_COLOR: Record<string, string> = {
  positive: "text-green-600 dark:text-green-400",
  neutral: "text-gray-400 dark:text-gray-500",
  warning: "text-amber-500 dark:text-amber-400",
  negative: "text-red-500 dark:text-red-400",
}

export default function TechStackPanel({
  report,
}: {
  report: AnalysisReport
}) {
  const [expanded, setExpanded] = useState(true)

  const techStack = report.techStack
  if (!techStack || techStack.totalDetected === 0) return null

  const hasInsights = (techStack.seoWarnings?.length ?? 0) > 0 || (techStack.seoPositives?.length ?? 0) > 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-5"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Tech Stack Detection
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            {techStack.totalDetected} technolog{techStack.totalDetected === 1 ? "y" : "ies"} detected
          </span>
        </h3>
        <span className="text-gray-400">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 dark:border-gray-800">
          {/* SEO Insights */}
          {hasInsights && (
            <div className="mt-4 space-y-2">
              {techStack.seoPositives?.map((msg, i) => (
                <div
                  key={`pos-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                >
                  <span className="mt-0.5 font-bold">{"\u2713"}</span>
                  <span>{msg}</span>
                </div>
              ))}
              {techStack.seoWarnings?.map((msg, i) => (
                <div
                  key={`warn-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                >
                  <span className="mt-0.5 font-bold">{"\u26A0"}</span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Category groups */}
          <div className="mt-4 space-y-4">
            {techStack.categoryBreakdown.map((cat) => (
              <div key={cat.category}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-base">
                    {CATEGORY_ICONS[cat.category] || "\u2699"}
                  </span>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[cat.category as TechCategory] || cat.category}
                  </h4>
                  <span className="text-xs text-gray-400">({cat.count})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {techStack.technologies
                    .filter((t) => t.category === cat.category)
                    .map((tech) => (
                      <div
                        key={tech.name}
                        className="group relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                      >
                        {/* SEO impact indicator dot */}
                        {tech.seoImpact && (
                          <span
                            className={`text-xs font-bold ${IMPACT_COLOR[tech.seoImpact.effect]}`}
                            title={tech.seoImpact.summary}
                          >
                            {IMPACT_ICON[tech.seoImpact.effect]}
                          </span>
                        )}
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {tech.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CONFIDENCE_STYLES[tech.confidence]}`}
                        >
                          {tech.confidence}
                        </span>
                        {/* Tooltip with evidence + SEO impact */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700" style={{ minWidth: "200px", whiteSpace: "normal" }}>
                          <div className="font-medium">{tech.evidence}</div>
                          {tech.seoImpact && (
                            <div className="mt-1 border-t border-gray-700 pt-1 text-gray-300 dark:text-gray-400">
                              {tech.seoImpact.summary}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Detected via HTML source + HTTP response headers (script tags, meta
            tags, DOM patterns, server headers). Confidence: high = 3+ signals,
            medium = 2, low = 1.
          </div>
        </div>
      )}
    </div>
  )
}
