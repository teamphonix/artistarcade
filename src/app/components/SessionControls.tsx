"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SessionControls() {
  const path = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const active = path.startsWith("/artist/") || path === "/host";
  useEffect(() => {
    if (!active) return;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) }); }
      finally { pending = false; }
    }
    const timer = setInterval(() => { void refresh().catch(() => {}); }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!active) return null;
  async function signOut() {
    try {
      const response = await fetch("/api/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out. Try again.");
      router.replace("/artist"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not sign out."); }
  }
  return <nav aria-label="Account" className="artist-room-links">
    <Link href="/artist">Sign in again</Link>
    <button type="button" onClick={() => void signOut()}>Sign out</button>
    {message && <span role="status">{message}</span>}
  </nav>;
}
