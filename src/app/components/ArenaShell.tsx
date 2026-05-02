import Link from "next/link";
import { ReactNode } from "react";

type ArenaShellProps = {
  children: ReactNode;
  className?: string;
};

export function ArenaShell({ children, className = "" }: ArenaShellProps) {
  return (
    <main className={`arena-shell ${className}`}>
      <div className="arena-bg" aria-hidden="true">
        <span className="spotlight spotlight-left" />
        <span className="spotlight spotlight-right" />
        <span className="arena-ring ring-one" />
        <span className="arena-ring ring-two" />
        <span className="dust dust-one" />
        <span className="dust dust-two" />
      </div>
      {children}
    </main>
  );
}

export function ArtistArcadeCrest({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`aa-crest aa-brand-crest ${compact ? "is-compact" : ""}`} aria-label="The Artist Arcade">
      <span>AA</span>
      <strong>Artist Arcade</strong>
    </div>
  );
}

export function ArenaBanner({
  side,
  title,
  subtitle,
}: {
  side: "left" | "right";
  title: string;
  subtitle: string;
}) {
  return (
    <aside className={`arena-banner banner-${side}`}>
      <span>{side === "left" ? "A" : "B"}</span>
      <strong>{title}</strong>
      <em>{subtitle}</em>
    </aside>
  );
}

export function Warrior({
  side,
  defeated = false,
}: {
  side: "left" | "right";
  defeated?: boolean;
}) {
  return (
    <div className={`warrior warrior-${side} ${defeated ? "is-defeated" : ""}`} aria-hidden="true">
      <span className="warrior-hood" />
      <span className="warrior-body" />
      <span className="warrior-arm arm-front" />
      <span className="warrior-arm arm-back" />
      <span className="weapon" />
      <span className="energy-ribbon" />
      <span className="breakup" />
    </div>
  );
}

export function PortalButton({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "purple" | "gold";
}) {
  return (
    <Link className={`portal-button portal-${tone}`} href={href} aria-label={label}>
      <span className="portal-core" />
      <span className="portal-orbit orbit-one" />
      <span className="portal-orbit orbit-two" />
      <strong>{label}</strong>
    </Link>
  );
}

export function ReturnToArena({ side }: { side: "left" | "right" }) {
  return (
    <Link className={`return-link return-${side}`} href="/" aria-label="Return to Arena">
      <span>{side === "left" ? "‹" : "›"}</span>
      <strong>RETURN TO ARENA</strong>
    </Link>
  );
}

export function GoldRule() {
  return <span className="gold-rule" aria-hidden="true" />;
}
