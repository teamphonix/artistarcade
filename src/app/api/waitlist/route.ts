import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WaitlistEntry = {
  email: string;
  createdAt: string;
  source: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const dataDirectory = path.join(process.cwd(), "data");
  const waitlistPath = path.join(dataDirectory, "waitlist.json");

  try {
    await fs.mkdir(dataDirectory, { recursive: true });

    let entries: WaitlistEntry[] = [];
    try {
      const existing = await fs.readFile(waitlistPath, "utf8");
      entries = JSON.parse(existing) as WaitlistEntry[];
    } catch {
      entries = [];
    }

    if (!entries.some((entry) => entry.email === email)) {
      entries.push({
        email,
        createdAt: new Date().toISOString(),
        source: "onboarding-site",
      });
      await fs.writeFile(waitlistPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "The arena heard you, but could not save the email yet." },
      { status: 500 },
    );
  }
}
