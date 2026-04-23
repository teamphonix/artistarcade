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
      const amountCents = Math.max(0, Number(session.metadata?.amountCents || session.amount_total || 0));

      if (email) {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { data: artist, error } = await supabase.from("protocol_artists").upsert(
            {
              name,
              email: email.toLowerCase(),
              stripe_customer_id:
                typeof session.customer === "string" ? session.customer : session.customer?.id || null,
              reward_cents: 0,
              status: "registered",
            },
            { onConflict: "email" },
          ).select("id,wallet_cents").single();

          if (error) {
            throw error;
          }

          if (artist && amountCents > 0) {
            const { error: walletError } = await supabase
              .from("protocol_artists")
              .update({ wallet_cents: Number(artist.wallet_cents || 0) + amountCents })
              .eq("id", artist.id);

            if (walletError) {
              throw walletError;
            }

            const { error: ledgerError } = await supabase.from("protocol_wallet_ledger").insert({
              artist_id: artist.id,
              event_id: null,
              amount_cents: amountCents,
              type: "deposit",
              note: "Stripe wallet deposit",
            });

            if (ledgerError) {
              throw ledgerError;
            }
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
