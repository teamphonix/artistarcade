"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const protocolSteps = [
  ["Create profile", "Use a stage name and email to open your beta account."],
  ["Fund wallet", "Add funds, withdraw available balance, and pay entry fees from one place."],
  ["Enter arena", "Join one open event. When 16 artists enter, the queue locks automatically."],
  ["Submit and judge", "Artists get 24 hours from event start to submit, then judging assignments open."],
];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertArtist",
          name,
          email,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not open profile.");
      }

      const artist = (data.artists || []).find((entry: { email: string; id: string }) => entry.email === email.toLowerCase());
      if (!artist) {
        throw new Error("Profile was saved, but could not be loaded.");
      }

      router.push(`/artist/${artist.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open profile.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="protocol-page">
      <header className="protocol-topbar">
        <Link className="protocol-mark" href="/">
          <span>AA</span>
          <strong>Artist Arcade</strong>
        </Link>
        <nav aria-label="Protocol navigation">
          <Link href="/artist">Sign in</Link>
          <Link href="/host">Host beta</Link>
          <Link href="/arena">Protocol admin</Link>
        </nav>
      </header>

      <section className="protocol-hero">
        <div className="protocol-copy">
          <span className="protocol-kicker">Beta protocol</span>
          <h1>Music tournaments with clear rules and automatic flow.</h1>
          <p>
            Artist Arcade is being built as a simple competition protocol: profiles, wallets, event queues, submissions,
            judging assignments, and results. The product should stay clean until the system is solid.
          </p>
        </div>

        <form className="protocol-entry-card" onSubmit={handleSubmit}>
          <span className="protocol-kicker">Start here</span>
          <h2>Sign in or create profile</h2>
          <label>
            Stage name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button disabled={isBusy} type="submit">
            {isBusy ? "Opening profile..." : "Continue to wallet"}
          </button>
          {message ? <p className="protocol-message">{message}</p> : null}
        </form>
      </section>

      <section className="protocol-section">
        <div className="protocol-section-head">
          <span className="protocol-kicker">How the beta works</span>
          <h2>One clean path from profile to results.</h2>
        </div>
        <div className="protocol-step-grid">
          {protocolSteps.map(([title, copy], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
