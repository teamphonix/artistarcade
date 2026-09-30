import Link from "next/link";
import { DEMO_EVENTS } from "@/app/lib/demoJudging";

export default function MockEventsPage() {
  return (
    <main className="artist-room-page">
      <section className="artist-room-shell">
        <header className="artist-room-header">
          <div>
            <span className="artist-entry-kicker">FateKeeper test lab</span>
            <h1>Mock Events</h1>
            <p>Play both placeholder MP3s, seek through them, score each artist, and lock fate. Repeat with a fresh card whenever you want.</p>
          </div>
        </header>
        <p className="artist-entry-message">Simulation only. No entry fees, real prizes, database writes, or production bracket changes.</p>
        <section className="artist-room-grid">
          {DEMO_EVENTS.map((event) => (
            <article className="artist-room-panel" key={event.slug}>
              <h2>{event.title}</h2>
              <p>Preloaded tracks · 15-minute duty clock · 6-minute listen windows · independent A/B scoring.</p>
              <Link className="artist-room-link" href={`/artist/demo-${event.slug}/event`}>Open test judging card</Link>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
