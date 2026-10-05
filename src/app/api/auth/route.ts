import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { AccessError } from "@/app/lib/access";
import { checkOrigin, requestCookie, REFRESH_COOKIE, SESSION_COOKIE } from "@/app/lib/requestAuth";
import type { Session } from "@supabase/supabase-js";
import { isValidEmail } from "@/app/lib/protocol";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json().catch(() => null);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new AccessError("Sign-in is not configured.", 503);
    if (body?.action === "refresh") {
      const refresh_token = requestCookie(request, REFRESH_COOKIE);
      if (!refresh_token) throw new AccessError("Sign in to continue.", 401);
      const { data, error } = await supabase.auth.refreshSession({ refresh_token });
      if (error || !data.session || !data.user?.email_confirmed_at) throw new AccessError("Your session expired. Sign in again.", 401);
      return sessionResponse(data.session);
    }
    const email = String(body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) throw new AccessError("Enter a valid email.", 400);
    if (body?.action === "send") {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw new AccessError("Could not send a code. Wait a moment and try again.", 429);
      return NextResponse.json({ sent: true });
    }
    if (body?.action !== "verify" || !/^\d{6,10}$/.test(String(body?.code || ""))) throw new AccessError("Enter your email verification code.", 400);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: String(body.code), type: "email" });
    if (error || !data.session || !data.user?.email_confirmed_at) throw new AccessError("Invalid or expired code.", 401);
    return sessionResponse(data.session);
  } catch (error) {
    return NextResponse.json({ error: error instanceof AccessError ? error.message : "Sign-in failed." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

function sessionResponse(session: Session) {
  const response = NextResponse.json({ verified: true });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  response.cookies.set(SESSION_COOKIE, session.access_token, { ...options, maxAge: session.expires_in });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...options, maxAge: 7 * 24 * 60 * 60 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function DELETE(request: Request) {
  try { checkOrigin(request); }
  catch { return NextResponse.json({ error: "Same-origin request required." }, { status: 403 }); }
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
