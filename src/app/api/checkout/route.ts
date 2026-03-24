import { NextRequest, NextResponse } from "next/server"
import { upgradePlan, getPlan } from "@/lib/credits"
import { PlanId, PLANS } from "@/lib/plans"

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

    // TODO: Integrate Stripe for actual payment processing
    //
    // Stripe flow:
    // 1. Create a Stripe Checkout Session with the plan price
    //    - site_pass: mode "payment" (one-time $99)
    //    - pro/agency: mode "subscription" ($49/$149 per month)
    // 2. Redirect user to Stripe Checkout
    // 3. On success webhook, call upgradePlan()
    // 4. Return the checkout URL to the client
    //
    // For now, we simulate an instant upgrade for development.
    // In production, replace this with Stripe integration.

    upgradePlan(sessionId, planId as PlanId)

    const plan = getPlan(sessionId)

    return NextResponse.json({
      success: true,
      plan: plan.planId,
      message: `Upgraded to ${PLANS[planId as PlanId].name}. In production, this would redirect to Stripe Checkout.`,
    })
  } catch (err) {
    console.error("Checkout error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
