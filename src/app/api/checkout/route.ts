import { NextRequest, NextResponse } from "next/server"
import { upgradePlan, getPlan, redeemCoupon } from "@/lib/credits"
import { PlanId, PLANS } from "@/lib/plans"
import { getStripe, isStripeConfigured, getPriceId, STRIPE_PRICES } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planId, sessionId, coupon } = body as {
      planId: string
      sessionId: string
      coupon?: string
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      )
    }

    // ── Coupon redemption ───────────────────────────────────────
    if (coupon) {
      const result = redeemCoupon(sessionId, coupon)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }
      const plan = getPlan(sessionId)
      return NextResponse.json({
        url: null,
        upgraded: true,
        plan: plan.planId,
        message: `Coupon applied! Upgraded to ${PLANS[result.plan!].name}.`,
      })
    }

    if (!planId) {
      return NextResponse.json(
        { error: "planId or coupon is required" },
        { status: 400 }
      )
    }

    if (!(planId in PLANS) || planId === "free") {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      )
    }

    // ── Stripe mode: create a real Checkout Session ──────────
    if (isStripeConfigured()) {
      const stripe = getStripe()!
      const priceId = getPriceId(planId)

      if (!priceId) {
        return NextResponse.json(
          { error: `Stripe price not configured for plan "${planId}". Set ${STRIPE_PRICES[planId]?.envKey} in .env.local.` },
          { status: 500 }
        )
      }

      const mode = STRIPE_PRICES[planId].mode
      const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/?upgraded=${planId}`,
        cancel_url: `${origin}/pricing?cancelled=true`,
        metadata: {
          sessionId,
          planId,
        },
        ...(mode === "subscription" && {
          subscription_data: {
            metadata: { sessionId, planId },
          },
        }),
      })

      return NextResponse.json({ url: session.url })
    }

    // ── Dev mode: instant upgrade (no Stripe keys set) ───────
    upgradePlan(sessionId, planId as PlanId)
    const plan = getPlan(sessionId)

    return NextResponse.json({
      url: null,
      upgraded: true,
      plan: plan.planId,
      message: `Upgraded to ${PLANS[planId as PlanId].name} (dev mode — no Stripe keys configured).`,
    })
  } catch (err) {
    console.error("Checkout error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
