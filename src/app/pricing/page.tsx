"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    interval: "",
    description: "Grade any home page instantly",
    features: [
      "Home page analysis",
      "100pt weighted scoring rubric",
      "AI engine readiness diagnostics",
      "PDF report download",
      "Email report delivery",
    ],
    cta: "Current Plan",
    ctaDisabled: true,
    highlight: false,
  },
  {
    id: "site_pass",
    name: "Full Site Pass",
    price: "$99",
    interval: "one-time",
    description: "Deep scan your entire site with actionable fixes",
    features: [
      "Crawl & grade every page (up to 500)",
      "Prioritized fix suggestions per page",
      "Full-site PDF report",
      "Page-by-page score breakdown",
      "Unlimited re-scans for 30 days",
    ],
    cta: "Get Site Pass — $99",
    ctaDisabled: false,
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    interval: "/month",
    description: "Scheduled scans + search integrations",
    features: [
      "Everything in Full Site Pass",
      "Weekly automated scans",
      "Google Search Console integration",
      "Perplexity citation tracking",
      "Score trend dashboard",
      "Slack/email alerts on score drops",
      "Up to 1,000 pages/month",
    ],
    cta: "Start Pro — $49/mo",
    ctaDisabled: false,
    highlight: false,
  },
  {
    id: "agency",
    name: "Agency",
    price: "$149",
    interval: "/month",
    description: "Auto-fix via GitHub/CMS + full integrations",
    features: [
      "Everything in Pro",
      "GitHub PR auto-fixes",
      "CMS integration (WordPress, Webflow, Sanity)",
      "Ahrefs backlink & keyword data",
      "Multi-site management",
      "White-label PDF reports",
      "Up to 5,000 pages/month",
      "Priority support",
    ],
    cta: "Start Agency — $149/mo",
    ctaDisabled: false,
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}

function PricingContent() {
  const [sessionId, setSessionId] = useState("")
  const [currentPlan, setCurrentPlan] = useState("free")
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let id = localStorage.getItem("grader-session-id")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("grader-session-id", id)
    }
    setSessionId(id)

    if (searchParams.get("cancelled") === "true") {
      setMessage("Payment cancelled. You can try again anytime.")
    }
  }, [searchParams])

  async function handleUpgrade(planId: string) {
    if (!sessionId || planId === "free") return
    setLoading(planId)
    setMessage(null)

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, sessionId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || "Something went wrong")
        return
      }

      // Stripe mode: redirect to Checkout
      if (data.url) {
        window.location.href = data.url
        return
      }

      // Dev mode: instant upgrade
      if (data.upgraded) {
        setCurrentPlan(planId)
        setMessage(data.message)
      }
    } catch {
      setMessage("Network error. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Back to Grader
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Pricing</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Free home page analysis. Upgrade for full-site scans, actionable
          fixes, and integrations.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan
          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border-2 p-6 ${
                plan.highlight
                  ? "border-blue-500 shadow-lg dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {plan.name}
                </h3>
                <div className="mt-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                    {plan.price}
                  </span>
                  {plan.interval && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {" "}
                      {plan.interval}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {plan.description}
                </p>
              </div>

              <ul className="mb-6 space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-green-500">&#10003;</span>
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={plan.ctaDisabled || isCurrent || loading === plan.id}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  plan.highlight && !isCurrent
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : isCurrent
                      ? "bg-gray-100 text-gray-500 cursor-default dark:bg-gray-800 dark:text-gray-500"
                      : "bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
                } disabled:opacity-50`}
              >
                {loading === plan.id
                  ? "Redirecting to checkout..."
                  : isCurrent
                    ? "Current Plan"
                    : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        Payments processed securely by Stripe. Cancel subscriptions anytime.
      </div>

      <div className="mt-10 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Integration Details
        </h2>
        <div className="grid gap-4 text-sm text-gray-700 sm:grid-cols-2 dark:text-gray-300">
          <div>
            <h3 className="font-semibold">Google Search Console</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Pro+ — Clicks, impressions, CTR, position data per graded
              page. See which search queries drive traffic.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Perplexity Citation Tracking</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Pro+ — Track when your pages get cited in Perplexity AI
              answers. Monitor citation position and snippets.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Ahrefs Backlinks & Keywords</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Agency — Domain rating, backlink count, keyword rankings, and
              organic traffic data per page.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">GitHub / CMS Auto-Fixes</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Agency — One-click PRs with SEO fixes applied to your code.
              CMS support for WordPress, Webflow, and Sanity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
