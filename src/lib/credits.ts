import { PlanId, PLANS } from "./plans"

interface CreditEntry {
  planId: PlanId
  purchasedAt: string
  expiresAt: string | null
  pagesUsed: number
  analyzedUrls: string[]
}

const store = new Map<string, CreditEntry>()

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.origin + parsed.pathname.replace(/\/+$/, "")
  } catch {
    return url
  }
}

function isHomePage(url: string): boolean {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, "")
    return path === "" || path === "/"
  } catch {
    return false
  }
}

function getEntry(sessionId: string): CreditEntry {
  if (!store.has(sessionId)) {
    store.set(sessionId, {
      planId: "free",
      purchasedAt: new Date().toISOString(),
      expiresAt: null,
      pagesUsed: 0,
      analyzedUrls: [],
    })
  }
  return store.get(sessionId)!
}

function isExpired(entry: CreditEntry): boolean {
  if (!entry.expiresAt) return false
  return new Date(entry.expiresAt) < new Date()
}

export function getPlan(sessionId: string): CreditEntry {
  return getEntry(sessionId)
}

export function upgradePlan(sessionId: string, planId: PlanId): void {
  const entry = getEntry(sessionId)
  entry.planId = planId
  entry.purchasedAt = new Date().toISOString()
  entry.pagesUsed = 0

  if (planId === "site_pass") {
    // 30-day access
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    entry.expiresAt = expires.toISOString()
  } else {
    entry.expiresAt = null
  }
}

export function canAnalyze(sessionId: string, url: string): boolean {
  // Home pages are always free
  if (isHomePage(url)) return true

  const entry = getEntry(sessionId)

  // Check expiry for site_pass
  if (entry.planId === "site_pass" && isExpired(entry)) {
    entry.planId = "free"
  }

  const plan = PLANS[entry.planId]
  const normalized = normalizeUrl(url)

  // Already analyzed this URL — allow re-run
  if (entry.analyzedUrls.includes(normalized)) return true

  return entry.pagesUsed < plan.limits.pagesPerMonth
}

export function consumeCredit(sessionId: string, url: string): void {
  if (isHomePage(url)) return

  const entry = getEntry(sessionId)
  const normalized = normalizeUrl(url)

  if (!entry.analyzedUrls.includes(normalized)) {
    entry.pagesUsed++
    entry.analyzedUrls.push(normalized)
  }
}

export function getRemaining(sessionId: string): number {
  const entry = getEntry(sessionId)
  if (entry.planId === "site_pass" && isExpired(entry)) {
    entry.planId = "free"
  }
  const plan = PLANS[entry.planId]
  return Math.max(0, plan.limits.pagesPerMonth - entry.pagesUsed)
}

export function canViewSuggestions(sessionId: string): boolean {
  const entry = getEntry(sessionId)
  if (entry.planId === "site_pass" && isExpired(entry)) return false
  return PLANS[entry.planId].limits.suggestedFixes
}

export function canUseIntegration(
  sessionId: string,
  integration: string
): boolean {
  const entry = getEntry(sessionId)
  const plan = PLANS[entry.planId]
  return (plan.limits.integrations as readonly string[]).includes(integration)
}

export function isHomePageUrl(url: string): boolean {
  return isHomePage(url)
}
