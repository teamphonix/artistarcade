import { NextResponse } from "next/server";
import { AccessError } from "@/app/lib/access";
import { checkOrigin, requirePrincipal } from "@/app/lib/requestAuth";
import { DEFAULT_WALLET_DEPOSIT_USD, centsFromUsd } from "@/app/lib/protocol";
import { getAppUrl, getStripe } from "@/app/lib/stripe";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function POST(request: Request) {
  let verifiedEmail: string;
  try { checkOrigin(request); verifiedEmail = (await requirePrincipal(request)).email; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in required." }, { status: error instanceof AccessError ? error.status : 500 }); }
  const body = await request.json().catch(() => null);
  const email = verifiedEmail;
  const amountCents = Number(body?.amountCents ?? centsFromUsd(DEFAULT_WALLET_DEPOSIT_USD));
  if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 2_000_000_000) {
    return NextResponse.json({ error: "Invalid USD deposit amount." }, { status: 400 });
  }

  const { data: artist, error } = await getSupabaseAdmin()!.from("protocol_artists").select("id,name").eq("email", email).single();
  if (error || !artist) {
    return NextResponse.json({ error: "Open your verified artist profile before adding funds." }, { status: 409 });
  }
  if (body?.artistId && body.artistId !== artist.id) {
    return NextResponse.json({ error: "Fund only your own artist wallet." }, { status: 403 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  const appUrl = getAppUrl();
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: "Checkout return URL is not configured." }, { status: 503 });
  }

  try {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Artist Arcade Wallet Deposit",
            description: "Funds for Artist Arcade event entry",
          },
        },
      },
    ],
    metadata: {
      name: artist.name,
      email,
      amountCents: String(amountCents),
      protocol: "artist-arcade-wallet",
    },
    success_url: `${appUrl}/artist/${artist.id}?payment=success`,
    cancel_url: `${appUrl}/artist/${artist.id}?payment=cancelled`,
  });

  return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Checkout is unavailable. Try again shortly." }, { status: 503 });
  }
}
