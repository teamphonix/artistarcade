import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getStripe } from "@/app/lib/stripe";
import { verifiedDeposit } from "@/app/lib/stripeDeposit";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  let event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret); }
  catch { return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 }); }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return NextResponse.json({ received: true });
  }
  let deposit;
  try { deposit = verifiedDeposit(event.data.object); }
  catch { return NextResponse.json({ error: "Invalid paid Artist Arcade USD session." }, { status: 400 }); }
  if (!deposit) return NextResponse.json({ received: true });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Deposit persistence is unavailable. Retry this webhook." }, { status: 503 });
  try {
    const { error } = await supabase.rpc("protocol_credit_stripe", {
      p_stripe_event_id: event.id, p_session_id: deposit.sessionId,
      p_email: deposit.email, p_name: deposit.name,
      p_amount_cents: deposit.amountCents, p_customer_id: deposit.customerId,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ received: true });
  } catch {
    // Non-2xx tells Stripe to retry. Never acknowledge a payment before it is persisted.
    return NextResponse.json({ error: "Deposit could not be persisted. Retry this webhook." }, { status: 500 });
  }
}
