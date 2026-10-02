"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ArtistSignIn() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: sent ? "verify" : "send", email, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign-in failed.");
      if (!sent) { setSent(true); setMessage("Check your email for your verification code."); return; }
      const profile = await fetch("/api/pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upsertArtist", email, name }) });
      const saved = await profile.json();
      if (!profile.ok) throw new Error(saved.error || "Could not open your profile.");
      const artist = saved.artists.find((a: { email: string; id: string }) => a.email === email.trim().toLowerCase());
      if (!artist) throw new Error("Could not load your profile.");
      router.push(`/artist/${artist.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  return <form className="artist-entry-form" onSubmit={submit}>
    <label>Stage name<input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" /></label>
    <label>Email<input required type="email" disabled={sent} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
    {sent && <label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" value={code} onChange={e => setCode(e.target.value)} /></label>}
    <button disabled={busy} type="submit">{busy ? "Please wait…" : sent ? "Verify and open profile" : "Send sign-in code"}</button>
    {sent && <button disabled={busy} type="button" onClick={() => { setSent(false); setCode(""); setMessage(""); }}>Use another email or request a new code</button>}
    {message && <p role="status">{message}</p>}
  </form>;
}
