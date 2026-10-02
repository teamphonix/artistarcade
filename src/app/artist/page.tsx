"use client";

import Link from "next/link";
import ArtistSignIn from "@/app/components/ArtistSignIn";

export default function ArtistEntryPage() {

  return (
    <main className="artist-entry-page">
      <section className="artist-entry-panel">
        <span className="artist-entry-kicker">Artist Arcade beta</span>
        <h1>Sign in or create profile</h1>
        <p>Use your stage name and email. Your profile opens the wallet, arena, submissions, judging, and results.</p>

        <ArtistSignIn />

        <Link className="artist-entry-back" href="/arena">
          Back to landing
        </Link>
      </section>
    </main>
  );
}
