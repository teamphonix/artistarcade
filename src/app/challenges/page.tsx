import { PortalStage, ReturnToArena } from "../components/PortalStage";
import { WaitlistForm } from "../components/WaitlistForm";

const challenges = ["Lyrical Onslaught", "Story Mode", "Beat Talk", "Persona Pen"];

export default function ChallengesPage() {
  return (
    <PortalStage
      className="challenges-page"
      image="/brand-assets/landing-challenges.png"
      alt="The Artist Arcade challenge portal"
    >
      <div className="challenge-card-hotspots" aria-label="Challenge types">
        {challenges.map((challenge) => (
          <button key={challenge} type="button" aria-label={challenge}>
            <span>{challenge}</span>
          </button>
        ))}
      </div>

      <WaitlistForm className="challenges-waitlist" buttonLabel="BECOME A LEGEND" />

      <ReturnToArena side="left" />
    </PortalStage>
  );
}
