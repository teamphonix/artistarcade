import { NextResponse } from "next/server";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized protocol tick." }, { status: 401 });
  }

  const protocolUrl = new URL("/api/pilot", request.url);
  const response = await fetch(protocolUrl, { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error || "Protocol tick failed." },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    tickedAt: new Date().toISOString(),
    backend: payload.backend,
    totals: payload.totals,
    events: payload.events.map(
      (event: {
        id: string;
        title: string;
        phase: string;
        queuedCount: number;
        currentRound: number;
        submissionDeadline: string | null;
        judgingDeadline: string | null;
        winnerArtistId: string | null;
      }) => ({
        id: event.id,
        title: event.title,
        phase: event.phase,
        queuedCount: event.queuedCount,
        currentRound: event.currentRound,
        submissionDeadline: event.submissionDeadline,
        judgingDeadline: event.judgingDeadline,
        winnerArtistId: event.winnerArtistId,
      }),
    ),
  });
}
