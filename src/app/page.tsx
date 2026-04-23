import {
  ArenaBanner,
  ArenaShell,
  ArtistArcadeCrest,
  GoldRule,
  PortalButton,
  Warrior,
} from "./components/ArenaShell";
import { WaitlistForm } from "./components/WaitlistForm";
import Link from "next/link";

const pillars = [
  ["⚖", "FAIR JUDGMENT", "One judge. One fate."],
  ["🎤", "REAL COMPETITION", "No politics. Just skill."],
  ["♛", "EARN YOUR LEGACY", "Victory means everything."],
  ["♨", "THE ARENA NEVER SLEEPS", "Battles. 24/7. Legends. Forever."],
];

export default function Home() {
  return (
    <ArenaShell className="landing-rebuild">
      <ArenaBanner side="left" title="ARTIST A" subtitle="VICTORIOUS" />
      <ArenaBanner side="right" title="ARTIST B" subtitle="ELIMINATED" />
      <Warrior side="left" />
      <Warrior side="right" defeated />

      <section className="landing-hero" aria-label="The Artist Arcade signup portal">
        <ArtistArcadeCrest />
        <div className="hero-panel">
          <span className="eyebrow">A NEW WORLD IS APPROACHING</span>
          <h1>CALLING ALL ARTISTS</h1>
          <GoldRule />
          <p>JOIN THE ARENA</p>
          <strong>SIGN UP TODAY</strong>
          <WaitlistForm className="native-waitlist" />
          <Link className="pilot-entry-link" href="/arena">
            OPEN MVP PILOT
          </Link>
        </div>
      </section>

      <PortalButton href="/about" label="ABOUT" tone="purple" />
      <PortalButton href="/challenges" label="CHALLENGES" tone="gold" />

      <section className="landing-pillars" aria-label="Artist Arcade principles">
        {pillars.map(([icon, title, copy]) => (
          <article key={title}>
            <span>{icon}</span>
            <strong>{title}</strong>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <footer className="arena-footer">
        <span>THIS ISN&apos;T A GAME. THIS IS YOUR FUTURE.</span>
        <strong>ARE YOU READY?</strong>
      </footer>
    </ArenaShell>
  );
}
