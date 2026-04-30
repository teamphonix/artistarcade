"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ArtistEntryPage() {
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
        throw new Error(data.error || "Could not create artist profile.");
      }

      const artist = (data.artists || []).find((entry: { email: string; id: string }) => entry.email === email.toLowerCase());
      if (!artist) {
        throw new Error("Artist profile was created, but could not be loaded.");
      }

      router.push(`/artist/${artist.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create artist profile.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="artist-entry-page">
      <section className="artist-entry-panel">
        <span className="artist-entry-kicker">Artist Arcade MVP</span>
        <h1>Artist Access</h1>
        <p>Create your basic profile, enter your event, and move into the arena when your challenge room opens.</p>

        <form className="artist-entry-form" onSubmit={handleSubmit}>
          <label>
            Artist name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button disabled={isBusy} type="submit">
            {isBusy ? "Opening profile..." : "Open artist profile"}
          </button>
        </form>

        {message ? <p className="artist-entry-message">{message}</p> : null}

        <Link className="artist-entry-back" href="/arena">
          Return to protocol
        </Link>
      </section>
    </main>
  );
}
