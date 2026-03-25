import Stripe from "stripe"

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

// Stripe Price IDs — create these in your Stripe Dashboard
// or use the Stripe CLI: stripe prices create ...
//
// Set these in .env.local after creating products in Stripe:
//   STRIPE_PRICE_SITE_PASS=price_xxx   (one-time $99)
//   STRIPE_PRICE_PRO=price_xxx         (recurring $49/mo)
//   STRIPE_PRICE_AGENCY=price_xxx      (recurring $149/mo)

export const STRIPE_PRICES: Record<string, { envKey: string; mode: "payment" | "subscription" }> = {
  site_pass: { envKey: "STRIPE_PRICE_SITE_PASS", mode: "payment" },
  pro: { envKey: "STRIPE_PRICE_PRO", mode: "subscription" },
  agency: { envKey: "STRIPE_PRICE_AGENCY", mode: "subscription" },
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getPriceId(planId: string): string | null {
  const config = STRIPE_PRICES[planId]
  if (!config) return null
  return process.env[config.envKey] || null
}

export { getStripe }
