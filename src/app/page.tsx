import { PortalLink, PortalStage } from "./components/PortalStage";
import { WaitlistForm } from "./components/WaitlistForm";

export default function Home() {
  return (
    <PortalStage image="/brand-assets/landing-main.png" alt="The Artist Arcade main portal landing page">
      <WaitlistForm className="main-waitlist" />
      <PortalLink className="about-portal-position" href="/about" label="About" variant="about" />
      <PortalLink className="challenges-portal-position" href="/challenges" label="Challenges" variant="challenges" />
      <div className="mobile-direct-links" aria-label="Portal navigation">
        <a href="/about">About</a>
        <a href="/challenges">Challenges</a>
      </div>
    </PortalStage>
  );
}
