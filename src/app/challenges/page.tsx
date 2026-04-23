import {
  ArenaBanner,
  ArenaShell,
  ArtistArcadeCrest,
  ReturnToArena,
} from "../components/ArenaShell";
import { WaitlistForm } from "../components/WaitlistForm";

const challenges = [
  { title: "LYRICAL ONSLAUGHT", tone: "duel" },
  { title: "STORY MODE", tone: "story" },
  { title: "BEAT TALK", tone: "beat" },
  { title: "PERSONA PEN", tone: "persona" },
];

export default function ChallengesPage() {
  return (
    <ArenaShell className="challenges-rebuild">
      <ArenaBanner side="left" title="ARTIST A" subtitle="VICTORIOUS" />
      <ArenaBanner side="right" title="ARTIST B" subtitle="ELIMINATED" />

      <header className="challenge-header">
        <ArtistArcadeCrest compact />
        <h1>CHALLENGES</h1>
        <p>PROVE YOU HAVE WHAT IT TAKES.</p>
      </header>

      <section className="native-challenge-grid" aria-label="Challenge types">
        {challenges.map((challenge) => (
          <article className={`challenge-card card-${challenge.tone}`} key={challenge.title}>
            <div className="card-scene" aria-hidden="true">
              <span className="card-warrior left" />
              <span className="card-warrior right" />
              <span className="card-energy" />
            </div>
            <h2>{challenge.title}</h2>
          </article>
        ))}
      </section>

      <section className="challenge-tagline">
        <strong>PUT YOUR TALENTS TO THE ULTIMATE TEST.</strong>
        <span>THE NUMBERS DON&apos;T COUNT HERE.</span>
        <span>ONLY IMPACT. ONLY GREATNESS. ONLY LEGENDS.</span>
      </section>

      <section className="bottom-cta challenge-cta" aria-label="Join The Artist Arcade">
        <span>JOIN THE ARENA</span>
        <strong>BECOME A LEGEND</strong>
        <WaitlistForm className="native-waitlist horizontal" />
      </section>

      <ReturnToArena side="left" />
    </ArenaShell>
  );
}
