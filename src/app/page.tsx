"use client";

import Link from "next/link";
import ArtistSignIn from "@/app/components/ArtistSignIn";

const protocolSteps = [
  ["Create profile", "Use a stage name and email to open your beta account."],
  ["Fund wallet", "Add funds, withdraw available balance, and pay entry fees from one place."],
  ["Enter arena", "Join one open event. When 16 artists enter, the queue locks automatically."],
  ["Submit and judge", "Artists get 24 hours from event start to submit, then judging assignments open."],
];

export default function Home() {

  return (
    <main className="protocol-page">
      <header className="protocol-topbar">
        <Link className="protocol-mark" href="/">
          <span>AA</span>
          <strong>Artist Arcade</strong>
        </Link>
        <nav aria-label="Protocol navigation">
          <Link href="/artist">Sign in</Link>
          <Link href="/test-run">Test run</Link>
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

        <ArtistSignIn />
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
