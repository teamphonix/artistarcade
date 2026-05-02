"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Artist = {
  id: string;
  name: string;
  eventId: string;
  eventTitle: string;
  wins: number;
  losses: number;
  status: "winner" | "eliminated";
};

type Battle = {
  id: string;
  eventId: string;
  eventTitle: string;
  round: number;
  artistA: Artist;
  artistB: Artist;
  winner: Artist;
  loser: Artist;
  reason: string;
};

type SimulatedEvent = {
  id: string;
  title: string;
  artists: Artist[];
  battles: Battle[];
  winner: Artist;
  potCents: number;
  prizeCents: number;
};

const firstNames = [
  "Nova",
  "Cipher",
  "Lyric",
  "Kairo",
  "Maven",
  "Saint",
  "Echo",
  "Rook",
  "Vega",
  "Reign",
  "Sable",
  "Quest",
  "Indigo",
  "Bronx",
  "Halo",
  "Noble",
];

const secondNames = [
  "King",
  "Verse",
  "Theory",
  "Flame",
  "Stacks",
  "Wave",
  "North",
  "Prime",
  "Oracle",
  "Knox",
  "Rhyme",
  "Ledger",
  "Stone",
  "Pilot",
  "Truth",
  "Signal",
];

const eventTitles = ["Lyrical Onslaught", "Story Mode", "Beat Talk", "Persona Pen"];
const roundLabels: Record<number, string> = {
  1: "Round of 16",
  2: "Quarterfinals",
  3: "Semifinals",
  4: "Final",
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function mulberry32(seed: number) {
  return function nextRandom() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildArtists(): Artist[] {
  return Array.from({ length: 64 }, (_, index) => {
    const eventIndex = Math.floor(index / 16);
    return {
      id: `artist-${index + 1}`,
      name: `${firstNames[index % firstNames.length]} ${secondNames[Math.floor(index / firstNames.length)]}`,
      eventId: `event-${eventIndex + 1}`,
      eventTitle: eventTitles[eventIndex],
      wins: 0,
      losses: 0,
      status: "eliminated",
    };
  });
}

function simulateEvent(eventId: string, title: string, artists: Artist[], random: () => number): SimulatedEvent {
  let round = 1;
  let contenders = [...artists];
  const battles: Battle[] = [];

  while (contenders.length > 1) {
    const nextRound: Artist[] = [];
    for (let index = 0; index < contenders.length; index += 2) {
      const artistA = contenders[index];
      const artistB = contenders[index + 1];
      const winner = random() >= 0.5 ? artistA : artistB;
      const loser = winner.id === artistA.id ? artistB : artistA;

      winner.wins += 1;
      loser.losses += 1;
      battles.push({
        id: `${eventId}-round-${round}-battle-${index / 2 + 1}`,
        eventId,
        eventTitle: title,
        round,
        artistA,
        artistB,
        winner,
        loser,
        reason: "No vote submitted. Protocol random selection resolved the battle.",
      });
      nextRound.push(winner);
    }
    contenders = nextRound;
    round += 1;
  }

  const winner = contenders[0];
  winner.status = "winner";

  return {
    id: eventId,
    title,
    artists,
    battles,
    winner,
    potCents: artists.length * 100,
    prizeCents: 500,
  };
}

function runSimulation(seed: number) {
  const random = mulberry32(seed);
  const artists = buildArtists();
  const events = eventTitles.map((title, index) => {
    const eventId = `event-${index + 1}`;
    return simulateEvent(
      eventId,
      title,
      artists.filter((artist) => artist.eventId === eventId),
      random,
    );
  });

  return {
    seed,
    artists,
    events,
    battles: events.flatMap((event) => event.battles),
  };
}

export default function TestRunPage() {
  const [seed, setSeed] = useState(20260502);
  const simulation = useMemo(() => runSimulation(seed), [seed]);

  return (
    <main className="protocol-page test-run-page">
      <header className="protocol-topbar">
        <Link className="protocol-mark" href="/">
          <span>AA</span>
          <strong>Artist Arcade</strong>
        </Link>
        <nav aria-label="Test navigation">
          <Link href="/">Landing</Link>
          <Link href="/artist">Artist flow</Link>
          <Link href="/api/protocol/tick">Tick JSON</Link>
        </nav>
      </header>

      <section className="test-hero">
        <div>
          <span className="protocol-kicker">Isolated protocol clone</span>
          <h1>64 artists. Four arenas. Instant random resolution.</h1>
          <p>
            This test run bypasses uploads and waiting. Every artist enters with $1, every placeholder submission is named
            after the artist, no votes are submitted, and the protocol resolves each battle by random selection.
          </p>
        </div>
        <aside className="test-control-card">
          <span className="protocol-kicker">Simulation seed</span>
          <strong>{seed}</strong>
          <button type="button" onClick={() => setSeed(Date.now())}>
            Run fresh simulation
          </button>
          <button type="button" onClick={() => setSeed(20260502)}>
            Reset demo seed
          </button>
        </aside>
      </section>

      <section className="test-summary-grid" aria-label="Simulation summary">
        <article>
          <span>Artists</span>
          <strong>64</strong>
        </article>
        <article>
          <span>Entry fee</span>
          <strong>$1</strong>
        </article>
        <article>
          <span>Total pot</span>
          <strong>{money(simulation.events.reduce((sum, event) => sum + event.potCents, 0))}</strong>
        </article>
        <article>
          <span>Winners</span>
          <strong>4</strong>
        </article>
      </section>

      <section className="test-section">
        <div className="protocol-section-head">
          <span className="protocol-kicker">Final winners</span>
          <h2>Four event winners came out of the run.</h2>
        </div>
        <div className="test-winner-grid">
          {simulation.events.map((event) => (
            <article key={event.id}>
              <span>{event.title}</span>
              <strong>{event.winner.name}</strong>
              <p>{event.winner.name} Song</p>
              <em>
                Record {event.winner.wins}-{event.winner.losses} | Prize {money(event.prizeCents)} | Pot{" "}
                {money(event.potCents)}
              </em>
            </article>
          ))}
        </div>
      </section>

      <section className="test-section">
        <div className="protocol-section-head">
          <span className="protocol-kicker">Tournament maps</span>
          <h2>Each arena path from 16 artists to the winner.</h2>
        </div>
        <div className="test-bracket-stack">
          {simulation.events.map((event) => (
            <article className="test-bracket-card" key={event.id}>
              <header>
                <div>
                  <span>{event.title}</span>
                  <strong>{event.winner.name} wins</strong>
                </div>
                <em>{event.battles.length} battles resolved</em>
              </header>
              <div className="test-bracket-map" aria-label={`${event.title} bracket`}>
                {[1, 2, 3, 4].map((round) => {
                  const roundBattles = event.battles.filter((battle) => battle.round === round);
                  return (
                    <section className="test-bracket-round" key={`${event.id}-${round}`}>
                      <h3>{roundLabels[round]}</h3>
                      <div>
                        {roundBattles.map((battle) => (
                          <article className="test-bracket-match" key={battle.id}>
                            <span className={battle.winner.id === battle.artistA.id ? "is-advance" : ""}>
                              {battle.artistA.name}
                            </span>
                            <span className={battle.winner.id === battle.artistB.id ? "is-advance" : ""}>
                              {battle.artistB.name}
                            </span>
                            <strong>Winner: {battle.winner.name}</strong>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="test-section">
        <div className="protocol-section-head">
          <span className="protocol-kicker">Battle ledger</span>
          <h2>Every matchup resolved by the protocol.</h2>
        </div>
        <div className="test-battle-list">
          {simulation.battles.map((battle) => (
            <article key={battle.id}>
              <div>
                <span>
                  {battle.eventTitle} | Round {battle.round}
                </span>
                <strong>
                  {battle.artistA.name} Song vs {battle.artistB.name} Song
                </strong>
                <p>{battle.reason}</p>
              </div>
              <aside>
                <span>Winner</span>
                <strong>{battle.winner.name}</strong>
                <em>{battle.loser.name} eliminated</em>
              </aside>
            </article>
          ))}
        </div>
      </section>

      <section className="test-section">
        <div className="protocol-section-head">
          <span className="protocol-kicker">Contender records</span>
          <h2>All 64 artist track records.</h2>
        </div>
        <div className="test-record-grid">
          {simulation.artists.map((artist) => (
            <article className={artist.status === "winner" ? "is-winner" : ""} key={artist.id}>
              <span>{artist.eventTitle}</span>
              <strong>{artist.name}</strong>
              <p>{artist.name} Song</p>
              <em>
                {artist.wins}-{artist.losses} | {artist.status}
              </em>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
