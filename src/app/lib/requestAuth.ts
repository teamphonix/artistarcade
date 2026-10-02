import { getSupabaseAdmin } from "./supabaseAdmin";
import { AccessError, type Principal } from "./access";

export const SESSION_COOKIE = "aa-session";
export const REFRESH_COOKIE = "aa-refresh";
export function requestCookie(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new AccessError("Same-origin request required.");
}
export async function requirePrincipal(request: Request): Promise<Principal> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new AccessError("Sign-in is not configured.", 503);
  const bearer = request.headers.get("authorization");
  const cookie = requestCookie(request, SESSION_COOKIE);
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : cookie;
  if (!token) throw new AccessError("Sign in to continue.", 401);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at) throw new AccessError("Your session expired. Sign in again.", 401);
  // Only the server-controlled allowlist grants host privileges, never user metadata.
  const email = data.user.email.toLowerCase();
  const hosts = (process.env.ARTIST_ARCADE_HOST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return { email, host: hosts.includes(email) };
}
