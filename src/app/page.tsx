import Link from "next/link";
import { ArenaShell, ArtistArcadeCrest, GoldRule } from "./components/ArenaShell";

const artistActions = [
  {
    step: "01",
    title: "Artist Access",
    copy: "Create your profile, load your wallet, and enter the platform clean.",
    href: "/artist",
    label: "Open artist hub",
  },
  {
    step: "02",
    title: "Challenge Types",
    copy: "Study the battle formats and understand what kind of event you want to enter.",
    href: "/challenges",
    label: "View challenge types",
  },
  {
    step: "03",
    title: "Protocol Lore",
    copy: "Read the world, the mission, and the reason the arena is built this way.",
    href: "/about",
    label: "Read the brief",
  },
];

const journey = [
  ["Create profile", "Open your artist profile and load funds into your account."],
  ["Choose portal", "Pick your event type, then inspect the available prize tiles."],
  ["Join the queue", "Lock into one live event and wait for the room to open."],
  ["Submit and judge", "Upload your work, complete your judging duty, and survive the rounds."],
];

export default function Home() {
  return (
    <ArenaShell className="hub-page">
      <section className="hub-shell">
        <header className="hub-header">
          <ArtistArcadeCrest />
          <nav className="hub-nav" aria-label="Platform navigation">
            <Link href="/artist">Artist Access</Link>
            <Link href="/challenges">Challenges</Link>
            <Link href="/about">About</Link>
            <Link href="/host">Host</Link>
          </nav>
        </header>

        <section className="hub-hero">
          <div className="hub-hero-copy">
            <span className="hub-kicker">Artist Arcade Platform Hub</span>
            <h1>Enter the arena. Pick your portal. Begin the run.</h1>
            <GoldRule />
            <p>
              The MVP is live now. Artists create a profile, choose an event type, join a live queue, receive the
              challenge when the room opens, submit, judge, and wait for the final reveal.
            </p>
            <div className="hub-hero-actions">
              <Link className="hub-primary" href="/artist">
                Open artist hub
              </Link>
              <Link className="hub-secondary" href="/host">
                Open host control room
              </Link>
            </div>
          </div>

          <aside className="hub-status-board" aria-label="Platform status">
            <div>
              <span>Mode</span>
              <strong>MVP Pilot</strong>
            </div>
            <div>
              <span>Entry</span>
              <strong>$1</strong>
            </div>
            <div>
              <span>Prize</span>
              <strong>$5</strong>
            </div>
            <div>
              <span>Flow</span>
              <strong>1 in 5</strong>
            </div>
          </aside>
        </section>

        <section className="hub-actions" aria-label="Hub pathways">
          {artistActions.map((action) => (
            <article className="hub-action-card" key={action.title}>
              <span>{action.step}</span>
              <strong>{action.title}</strong>
              <p>{action.copy}</p>
              <Link href={action.href}>{action.label}</Link>
            </article>
          ))}
        </section>

        <section className="hub-journey">
          <div className="hub-journey-copy">
            <span className="hub-kicker">How it works</span>
            <h2>The artist journey is simple on purpose.</h2>
            <p>
              For the MVP, the platform should feel straightforward on the front end while the protocol handles the
              hidden bracket, judging waves, and payout logic underneath.
            </p>
          </div>

          <div className="hub-journey-steps">
            {journey.map(([title, copy], index) => (
              <article className="hub-step" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{title}</strong>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </ArenaShell>
  );
}
