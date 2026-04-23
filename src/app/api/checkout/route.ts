import { NextResponse } from "next/server";
import { centsFromUsd, isValidEmail, PILOT_ENTRY_FEE_USD } from "@/app/lib/protocol";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getAppUrl, getStripe } from "@/app/lib/stripe";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();

  if (name.length < 2 || !isValidEmail(email)) {
    return NextResponse.json({ error: "Artist name and valid email are required." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  const appUrl = getAppUrl();
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { error } = await supabase.from("pilot_artists").upsert(
      {
        name,
        email,
        payment_status: "pending",
        wallet_cents: 0,
        reward_cents: 0,
        status: "entered",
      },
      { onConflict: "email" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: centsFromUsd(PILOT_ENTRY_FEE_USD),
          product_data: {
            name: "Artist Arcade Pilot Entry",
            description: "Entry into Pilot Ring A",
          },
        },
      },
    ],
    metadata: {
      name,
      email,
      protocol: "artist-arcade-pilot",
    },
    success_url: `${appUrl}/arena?payment=success`,
    cancel_url: `${appUrl}/arena?payment=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
