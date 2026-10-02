import { isValidEmail } from "./protocol";

/** Only call after Stripe signature verification. Metadata never determines credited USD. */
export function verifiedDeposit(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const session = raw as { id?: string; currency?: string; payment_status?: string; amount_total?: number; mode?: string;
    metadata?: Record<string, string>; customer_details?: { name?: string; email?: string }; customer?: string | { id?: string } | null };
  if (session.metadata?.protocol !== "artist-arcade-wallet") return null;
  if (session.payment_status !== "paid") return null;
  const email = (session.metadata?.email || session.customer_details?.email || "").trim().toLowerCase();
  if (session.mode !== "payment" || session.currency !== "usd" || !session.id || !isValidEmail(email)
    || !Number.isSafeInteger(session.amount_total) || session.amount_total! <= 0 || session.amount_total! > 2_000_000_000) {
    throw new Error("Invalid paid Artist Arcade USD session.");
  }
  return { sessionId: session.id, email, name: session.metadata?.name || session.customer_details?.name || "Artist",
    amountCents: session.amount_total!, customerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null };
}
