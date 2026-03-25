import { NextRequest, NextResponse } from "next/server"
import { upgradePlan, getPlan } from "@/lib/credits"
import { PlanId, PLANS } from "@/lib/plans"
import { getStripe, isStripeConfigured, getPriceId, STRIPE_PRICES } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planId, sessionId } = body as {
      planId: string
      sessionId: string
    }

    if (!planId || !sessionId) {
      return NextResponse.json(
        { error: "planId and sessionId are required" },
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
