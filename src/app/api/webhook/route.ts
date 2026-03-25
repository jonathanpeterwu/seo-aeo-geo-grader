import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { upgradePlan } from "@/lib/credits"
import { PlanId } from "@/lib/plans"

// Disable Next.js body parsing — Stripe needs the raw body for signature verification
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    )
  }

  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`Webhook signature verification failed: ${message}`)
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    )
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const sessionId = session.metadata?.sessionId
      const planId = session.metadata?.planId

      if (sessionId && planId) {
        console.log(`[Stripe] Checkout completed: ${planId} for session ${sessionId}`)
        upgradePlan(sessionId, planId as PlanId)
      } else {
        console.warn("[Stripe] Checkout completed but missing metadata", session.id)
      }
      break
    }

    case "customer.subscription.deleted": {
      // Subscription cancelled — downgrade to free
      const subscription = event.data.object
      const sessionId = subscription.metadata?.sessionId

      if (sessionId) {
        console.log(`[Stripe] Subscription cancelled for session ${sessionId}`)
        upgradePlan(sessionId, "free")
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object
      const subMeta = (invoice as unknown as Record<string, unknown>).subscription_details as
        | { metadata?: { sessionId?: string } }
        | undefined
      const failedSessionId = subMeta?.metadata?.sessionId
      if (failedSessionId) {
        console.warn(`[Stripe] Payment failed for session ${failedSessionId}`)
        // Don't downgrade immediately — Stripe retries failed payments.
        // After all retries fail, customer.subscription.deleted fires.
      }
      break
    }

    default:
      // Unhandled event type — that's fine
      break
  }

  return NextResponse.json({ received: true })
}
