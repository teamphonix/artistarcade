"use client";

import Link from "next/link";
import ArtistSignIn from "@/app/components/ArtistSignIn";
import TournamentRules from "@/app/components/TournamentRules";

const protocolSteps = [
  ["Claim your identity", "Verify your email and choose your stage name."],
  ["Enter the arena", "Join one of four events in the 64-artist pilot. Entry opens your challenge and submission deadline."],
  ["One track. One journey.", "Submit your original track once. That same track competes all the way to the final."],
  ["Keep their fate", "Complete each FateKeeper card assigned to you, then stay available until the shared reveal."],
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
          <h1>64 artists. Four events. One track to victory.</h1>
          <p>
            Bring your track into the arena. While it competes, you may be chosen as a FateKeeper for other battles.
            Their fate is in your hands. Your own result stays sealed until the final reveal.
          </p>
        </div>

        <div className="protocol-entry-card"><h2>Enter the Artist Arcade beta</h2><ArtistSignIn /></div>
      </section>
      <section className="protocol-section">
        <div className="protocol-section-head"><h2>Your path to the reveal</h2></div>
        <TournamentRules />
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
