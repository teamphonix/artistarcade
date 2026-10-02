import { NextResponse } from "next/server";
import { AccessError } from "@/app/lib/access";
import { checkOrigin, requirePrincipal } from "@/app/lib/requestAuth";
import { DEFAULT_WALLET_DEPOSIT_USD, centsFromUsd, isValidEmail } from "@/app/lib/protocol";
import { getAppUrl, getStripe } from "@/app/lib/stripe";

export async function POST(request: Request) {
  let verifiedEmail: string;
  try { checkOrigin(request); verifiedEmail = (await requirePrincipal(request)).email; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in required." }, { status: error instanceof AccessError ? error.status : 500 }); }
  const body = await request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const email = verifiedEmail;
  const amountCents = Math.max(100, Math.round(Number(body?.amountCents || centsFromUsd(DEFAULT_WALLET_DEPOSIT_USD))));
  if (!Number.isSafeInteger(amountCents) || amountCents > 2_000_000_000) {
    return NextResponse.json({ error: "Invalid USD deposit amount." }, { status: 400 });
  }

  if (name.length < 2 || !isValidEmail(email)) {
    return NextResponse.json({ error: "Artist name and valid email are required." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  const appUrl = getAppUrl();

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
      name,
      email,
      amountCents: String(amountCents),
      protocol: "artist-arcade-wallet",
    },
    success_url: `${appUrl}/arena?payment=success`,
    cancel_url: `${appUrl}/arena?payment=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
