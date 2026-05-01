import Image from "next/image";
import Link from "next/link";
import { ArtistArcadeCrest } from "./components/ArenaShell";

const tournamentStats = [
  ["Entry", "$1"],
  ["Prize", "$5"],
  ["Format", "1 in 5"],
  ["Window", "24h"],
];

const liveEvents = [
  {
    title: "Rap Arena",
    status: "Queue open",
    prize: "$5",
    seats: "12/16",
    detail: "Bars, delivery, impact.",
  },
  {
    title: "Hook Room",
    status: "Opening next",
    prize: "$5",
    seats: "08/16",
    detail: "Catch, melody, replay value.",
  },
  {
    title: "Beat Trial",
    status: "Host setup",
    prize: "$5",
    seats: "04/16",
    detail: "Flip the prompt clean.",
  },
];

const platformFlow = [
  ["Profile", "Create artist identity and wallet."],
  ["Queue", "Pick one event and lock in."],
  ["Submit", "Beat unlocks when the room opens."],
  ["Judge", "Listen fully. Vote once. Results reveal."],
];

export default function Home() {
  return (
    <main className="aa-platform-page">
      <div className="aa-platform-bg" aria-hidden="true" />

      <header className="aa-topbar">
        <Link className="aa-wordmark" href="/">
          <Image alt="" height={96} src="/brand/artist-arcade-shield.jpg" width={96} />
          <span>
            <strong>Artist Arcade</strong>
            <em>Online music tournaments</em>
          </span>
        </Link>
        <nav className="aa-nav" aria-label="Platform navigation">
          <Link href="/artist">Play</Link>
          <Link href="/challenges">Challenges</Link>
          <Link href="/about">About</Link>
          <Link href="/host">Host</Link>
        </nav>
      </header>

      <section className="aa-hero">
        <div className="aa-hero-copy">
          <span className="aa-kicker">Skill-based online arenas</span>
          <h1>Win the room. Advance the run.</h1>
          <p>
            Artist Arcade is a tournament platform for music battles. Join a queue, unlock the challenge, submit your
            track, judge the matchup, and let the arena settle the result.
          </p>
          <div className="aa-hero-actions">
            <Link className="aa-button aa-button-primary" href="/artist">
              Enter as artist
            </Link>
            <Link className="aa-button aa-button-secondary" href="/host">
              Host console
            </Link>
          </div>
        </div>

        <aside className="aa-hero-card" aria-label="Featured tournament">
          <div className="aa-hero-logo">
            <ArtistArcadeCrest />
          </div>
          <div className="aa-live-strip">
            <span>Live MVP</span>
            <strong>1 in 5 wins the prize</strong>
          </div>
          <div className="aa-stat-row">
            {tournamentStats.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="aa-section aa-tournament-section">
        <div className="aa-section-head">
          <span className="aa-kicker">Open events</span>
          <h2>Choose a tournament lane.</h2>
        </div>
        <div className="aa-tournament-grid">
          {liveEvents.map((event) => (
            <article className="aa-tournament-card" key={event.title}>
              <span>{event.status}</span>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
              <div>
                <em>{event.prize} prize</em>
                <em>{event.seats} seats</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="aa-section aa-flow-section">
        <div className="aa-section-head">
          <span className="aa-kicker">How it moves</span>
          <h2>Simple up front. Serious underneath.</h2>
        </div>
        <div className="aa-flow-grid">
          {platformFlow.map(([title, copy], index) => (
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
