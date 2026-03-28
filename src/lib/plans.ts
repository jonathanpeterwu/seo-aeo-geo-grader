export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: null,
    description: "Grade any home page instantly",
    features: [
      "Home page analysis",
      "100pt weighted scoring rubric",
      "PDF report download",
      "Email report delivery",
    ],
    limits: {
      pagesPerMonth: 1,
      fullSiteScan: false,
      suggestedFixes: false,
      integrations: [],
      autoFixes: false,
    },
  },
  site_pass: {
    id: "site_pass",
    name: "Full Site Pass",
    price: 99,
    interval: "one-time" as const,
    description: "One-time deep scan of your entire site with actionable fixes",
    features: [
      "Crawl & grade every page",
      "Prioritized fix suggestions",
      "Export full-site PDF report",
      "Page-by-page breakdown",
      "Unlimited re-scans for 30 days",
    ],
    limits: {
      pagesPerMonth: 500,
      fullSiteScan: true,
      suggestedFixes: true,
      integrations: [],
      autoFixes: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 49,
    interval: "month" as const,
    description: "Scheduled scans with GSC integration",
    features: [
      "Everything in Full Site Pass",
      "Weekly automated scans",
      "Google Search Console integration",
      "Perplexity citation tracking",
      "Score trend dashboard",
      "Slack/email alerts on score drops",
    ],
    limits: {
      pagesPerMonth: 1000,
      fullSiteScan: true,
      suggestedFixes: true,
      integrations: ["gsc", "perplexity"],
      autoFixes: false,
    },
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 149,
    interval: "month" as const,
    description: "Auto-fix via GitHub/CMS + full integrations",
    features: [
      "Everything in Pro",
      "GitHub PR auto-fixes",
      "CMS integration (WordPress, Webflow, Sanity)",
      "Ahrefs backlink & keyword data",
      "Multi-site management",
      "White-label PDF reports",
      "Priority support",
    ],
    limits: {
      pagesPerMonth: 5000,
      fullSiteScan: true,
      suggestedFixes: true,
      integrations: ["gsc", "perplexity", "ahrefs", "github", "cms"],
      autoFixes: true,
    },
  },
} as const

export type PlanId = keyof typeof PLANS
export type Plan = (typeof PLANS)[PlanId]

export interface UserPlan {
  planId: PlanId
  purchasedAt: string
  expiresAt: string | null // null = no expiry (free), date for site_pass (30 days), null for subscriptions (recurring)
  pagesUsed: number
  sites: string[] // domains registered under this plan
}
