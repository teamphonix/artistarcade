import { NextResponse } from "next/server";
import { runProtocolWorker } from "@/app/lib/protocolWorker";
import { StateConflictError } from "@/app/lib/databaseState";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized protocol tick." }, { status: 401 });
  }

  try {
    return NextResponse.json(await runProtocolWorker(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Protocol worker failed", { conflict: error instanceof StateConflictError });
    return NextResponse.json({ error: "Protocol tick failed. The next scheduled run can retry." },
      { status: error instanceof StateConflictError ? 409 : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
