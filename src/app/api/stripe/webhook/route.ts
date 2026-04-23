import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getStripe } from "@/app/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const name = session.metadata?.name || session.customer_details?.name || "Artist";
      const email = session.metadata?.email || session.customer_details?.email;

      if (email) {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { error } = await supabase.from("pilot_artists").upsert(
            {
              name,
              email: email.toLowerCase(),
              stripe_customer_id:
                typeof session.customer === "string" ? session.customer : session.customer?.id || null,
              payment_status: "paid",
              wallet_cents: 0,
              reward_cents: 0,
              status: "entered",
            },
            { onConflict: "email" },
          );

          if (error) {
            throw error;
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook verification failed." },
      { status: 400 },
    );
  }
}
