import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

type PortalStageProps = {
  image: string;
  alt: string;
  children?: ReactNode;
  className?: string;
};

export function PortalStage({ image, alt, children, className = "" }: PortalStageProps) {
  return (
    <main className={`portal-page ${className}`}>
      <section className="portal-stage" aria-label={alt}>
        <Image className="stage-art" src={image} alt={alt} fill priority sizes="100vw" />
        <div className="stage-vignette" />
        {children}
      </section>
    </main>
  );
}

type PortalLinkProps = {
  href: string;
  label: string;
  variant: "about" | "challenges";
  className?: string;
};

export function PortalLink({ href, label, variant, className = "" }: PortalLinkProps) {
  return (
    <Link className={`portal-hotspot portal-${variant} ${className}`} href={href} aria-label={label}>
      <span className="portal-ring" />
      <span className="portal-label">{label}</span>
    </Link>
  );
}

type ReturnToArenaProps = {
  side: "left" | "right";
};

export function ReturnToArena({ side }: ReturnToArenaProps) {
  return (
    <Link className={`return-arena return-${side}`} href="/" aria-label="Return to Arena">
      <span className="return-arrow" aria-hidden="true">
        {side === "left" ? "‹" : "›"}
      </span>
      <span>RETURN TO ARENA</span>
    </Link>
  );
}
