"use client";

import { useState } from "react";
import {
  ArenaBanner,
  ArenaShell,
  ArtistArcadeCrest,
  ReturnToArena,
  Warrior,
} from "../components/ArenaShell";
import { WaitlistForm } from "../components/WaitlistForm";

const aboutScript = `Calling All Artists

A portal is opening.

Beyond the noise.
Beyond the numbers.
Beyond the shallow weight of followers and fleeting attention...

A new world is rising.

A world where true talent is the key to victory.
Where artistic expression is not measured by popularity,
but by power, discipline, creativity,
and the ability to move the arena.

Welcome to The Artist Arcade.

This is more than a platform.
It is a gateway into a new realm of competition, creation, and artistic evolution.

Here, your worth is not decided by clout.
It is revealed by what you bring forth.

What you create.
How you adapt.
How you sharpen your craft.
How you step into the ring and let your expression speak for itself.

The first portal now opens to the realm of Rhythm and Poetry.

This is where rappers enter the arena.
Where bars become weapons.
Where delivery becomes force.
Where style, imagination, and presence shape the outcome.

This is the beginning of the journey.
The first dimension.
The first proving ground.

But this is only the beginning.

As more portals open, new dimensions of artistic expression will rise with them.
New paths.
New forms.
New arenas for creators bold enough to enter.

The Artist Arcade is being built as a world where art itself becomes the battleground,
and those with vision, discipline, and originality will have the chance to prove who they are
through the work they create.

This is your invitation.

If you are an artist with something real inside you...
If you are ready to develop your gifts...
If you are ready to test your expression and step into a future where your craft carries weight...

Then your time is now.

Sign up today and register for The Artist Arcade.`;

export default function AboutPage() {
  const [showIntro, setShowIntro] = useState(false);

  return (
    <ArenaShell className="about-rebuild">
      <ArenaBanner side="left" title="ARTIST A" subtitle="VICTORIOUS" />
      <ArenaBanner side="right" title="ARTIST B" subtitle="WATCHING" />
      <Warrior side="left" />
      <Warrior side="right" />

      <div className="fatekeeper-throne" aria-hidden="true">
        <span className="throne-hood" />
        <span className="throne-hands" />
        <ArtistArcadeCrest compact />
      </div>

      <section className="native-scroll-panel" aria-label="About The Artist Arcade">
        {aboutScript.split("\n\n").map((paragraph) => (
          <p
            key={paragraph}
            className={
              paragraph === "A new world is rising." ||
              paragraph === "Welcome to The Artist Arcade." ||
              paragraph === "This is your invitation."
                ? "pulse-line"
                : ""
            }
          >
            {paragraph}
          </p>
        ))}
      </section>

      <section className="bottom-cta about-cta" aria-label="Join The Artist Arcade">
        <span>JOIN THE ARENA</span>
        <strong>BECOME A LEGEND</strong>
        <WaitlistForm className="native-waitlist horizontal" />
      </section>

      <button className="watch-intro-native" type="button" onClick={() => setShowIntro(true)}>
        <span>▶</span>
        <strong>WATCH THE INTRO</strong>
      </button>

      <ReturnToArena side="right" />

      {showIntro && (
        <div className="intro-modal" role="dialog" aria-modal="true" aria-label="Intro video">
          <div className="intro-card">
            <button type="button" onClick={() => setShowIntro(false)} aria-label="Close intro">
              ×
            </button>
            <p>Intro video slot ready.</p>
            <span>Add the final video asset here when it is cut.</span>
          </div>
        </div>
      )}
    </ArenaShell>
  );
}
