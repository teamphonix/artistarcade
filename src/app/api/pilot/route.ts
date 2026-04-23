import { NextResponse } from "next/server";
import {
  makeId,
  rankedSubmissions,
  readPilotState,
  resetPilotState,
  writePilotState,
  type PilotJudgment,
  type PilotJudgingAssignment,
  type PilotSubmission,
} from "@/app/lib/pilotStore";
import { CHALLENGES, PILOT_CAPACITY, clampScore, isValidEmail } from "@/app/lib/protocol";
import {
  getSupabaseAdmin,
  type DbArtist,
  type DbJudgingAssignment,
  type DbJudgment,
  type DbSubmission,
} from "@/app/lib/supabaseAdmin";

type PilotAction = "enter" | "submit" | "judge" | "reset" | "advancePhase" | "markWinner" | "generateAssignments";

function mapSupabaseState(
  artists: DbArtist[],
  submissions: DbSubmission[],
  judgments: DbJudgment[],
  assignments: DbJudgingAssignment[],
) {
  const ranked = submissions
    .map((submission) => {
      const submissionJudgments = judgments.filter((judgment) => judgment.submission_id === submission.id);
      const total = submissionJudgments.reduce((sum, judgment) => {
        return sum + judgment.lyrics + judgment.delivery + judgment.originality + judgment.impact;
      }, 0);
      const score = submissionJudgments.length === 0 ? 0 : Math.round((total / (submissionJudgments.length * 20)) * 100);

      return {
        id: submission.id,
        artistId: submission.artist_id,
        title: submission.title,
        audioUrl: submission.audio_url,
        challenge: submission.challenge,
        createdAt: submission.created_at,
        artist: artists.find((artist) => artist.id === submission.artist_id),
        score,
        judgmentCount: submissionJudgments.length,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    state: {
      event: {
        id: "pilot-001",
        name: "Pilot Ring A",
        entryFee: 1,
        prize: 5,
        submissionWindow: "48 hours",
        judgingWindow: "3 anonymous submissions",
        challenge: "Original vocal performance using the provided beat and concept",
        phase: "submission",
        capacity: PILOT_CAPACITY,
      },
      artists: artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        email: artist.email,
        walletUsd: artist.wallet_cents / 100,
        rewardUsd: artist.reward_cents / 100,
        paymentStatus: artist.payment_status,
        credits: 0,
        status: artist.status,
      })),
      submissions: submissions.map((submission) => ({
        id: submission.id,
        artistId: submission.artist_id,
        title: submission.title,
        audioUrl: submission.audio_url,
        challenge: submission.challenge,
        createdAt: submission.created_at,
      })),
      judgingAssignments: assignments.map((assignment) => ({
        id: assignment.id,
        judgeArtistId: assignment.judge_artist_id,
        submissionId: assignment.submission_id,
        round: assignment.round,
        status: assignment.status,
        assignedAt: assignment.assigned_at,
        completedAt: assignment.completed_at,
      })),
      judgments: judgments.map((judgment) => ({
        id: judgment.id,
        judgeArtistId: judgment.judge_artist_id,
        submissionId: judgment.submission_id,
        lyrics: judgment.lyrics,
        delivery: judgment.delivery,
        originality: judgment.originality,
        impact: judgment.impact,
        createdAt: judgment.created_at,
      })),
    },
    ranked,
    backend: "supabase",
  };
}

async function readSupabasePilot() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const [artistsResult, submissionsResult, judgmentsResult, assignmentsResult] = await Promise.all([
    supabase.from("pilot_artists").select("*").order("created_at", { ascending: true }),
    supabase.from("pilot_submissions").select("*").order("created_at", { ascending: true }),
    supabase.from("pilot_judgments").select("*").order("created_at", { ascending: true }),
    supabase.from("pilot_judging_assignments").select("*").order("assigned_at", { ascending: true }),
  ]);

  if (artistsResult.error || submissionsResult.error || judgmentsResult.error || assignmentsResult.error) {
    const error = artistsResult.error || submissionsResult.error || judgmentsResult.error || assignmentsResult.error;
    throw new Error(error?.message || "Supabase pilot read failed.");
  }

  return mapSupabaseState(
    (artistsResult.data || []) as DbArtist[],
    (submissionsResult.data || []) as DbSubmission[],
    (judgmentsResult.data || []) as DbJudgment[],
    (assignmentsResult.data || []) as DbJudgingAssignment[],
  );
}

function buildAssignments(
  artists: { id: string }[],
  submissions: { id: string; artistId: string }[],
  existingAssignments: { judgeArtistId: string; submissionId: string }[],
  round = 1,
) {
  const now = new Date().toISOString();
  const createdAssignments: PilotJudgingAssignment[] = [];

  submissions.forEach((submission, submissionIndex) => {
    const eligibleJudges = artists.filter((artist) => artist.id !== submission.artistId);
    const neededJudges = eligibleJudges.slice(submissionIndex).concat(eligibleJudges.slice(0, submissionIndex)).slice(0, 3);

    neededJudges.forEach((judge) => {
      const exists = existingAssignments.some(
        (assignment) => assignment.judgeArtistId === judge.id && assignment.submissionId === submission.id,
      );

      if (!exists) {
        createdAssignments.push({
          id: makeId("assign"),
          judgeArtistId: judge.id,
          submissionId: submission.id,
          round,
          status: "assigned",
          assignedAt: now,
          completedAt: null,
        });
      }
    });
  });

  return createdAssignments;
}

async function readPilotPayload() {
  const supabasePayload = await readSupabasePilot();
  if (supabasePayload) {
    return supabasePayload;
  }

  const state = await readPilotState();
  return {
    state: {
      ...state,
      event: {
        ...state.event,
        capacity: PILOT_CAPACITY,
      },
    },
    ranked: rankedSubmissions(state),
    backend: "local",
  };
}

export async function GET() {
  try {
    return NextResponse.json(await readPilotPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pilot read failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action as PilotAction | undefined;

  if (!action) {
    return NextResponse.json({ error: "Missing pilot action." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    if (supabase) {
      if (action === "enter") {
        const name = String(body?.name || "").trim();
        const email = String(body?.email || "").trim().toLowerCase();

        if (name.length < 2 || !isValidEmail(email)) {
          return NextResponse.json({ error: "Artist name and valid email are required." }, { status: 400 });
        }

        const { count, error: countError } = await supabase
          .from("pilot_artists")
          .select("*", { count: "exact", head: true });

        if (countError) {
          throw countError;
        }

        if ((count || 0) >= PILOT_CAPACITY) {
          return NextResponse.json({ error: "Pilot Ring A is full at 48 artists." }, { status: 409 });
        }

        const { error } = await supabase.from("pilot_artists").upsert(
          {
            name,
            email,
            payment_status: body?.paymentStatus === "paid" ? "paid" : "pending",
            wallet_cents: 0,
            reward_cents: 0,
            status: "entered",
          },
          { onConflict: "email" },
        );

        if (error) {
          throw error;
        }
      }

      if (action === "submit") {
        const artistId = String(body?.artistId || "");
        const title = String(body?.title || "").trim();
        const audioUrl = String(body?.audioUrl || "").trim();
        const challenge = CHALLENGES.includes(body?.challenge) ? body.challenge : CHALLENGES[0];

        if (!artistId || title.length < 2 || !audioUrl) {
          return NextResponse.json({ error: "Artist, title, and audio link are required." }, { status: 400 });
        }

        const { error: submissionError } = await supabase.from("pilot_submissions").upsert(
          {
            artist_id: artistId,
            title,
            audio_url: audioUrl,
            challenge,
          },
          { onConflict: "artist_id" },
        );

        if (submissionError) {
          throw submissionError;
        }

        const { error: artistError } = await supabase
          .from("pilot_artists")
          .update({ status: "submitted" })
          .eq("id", artistId);

        if (artistError) {
          throw artistError;
        }
      }

      if (action === "judge") {
        const judgeArtistId = String(body?.judgeArtistId || "");
        const submissionId = String(body?.submissionId || "");

        if (!judgeArtistId || !submissionId) {
          return NextResponse.json({ error: "Judge and submission are required." }, { status: 400 });
        }

        const { data: submission, error: submissionError } = await supabase
          .from("pilot_submissions")
          .select("artist_id")
          .eq("id", submissionId)
          .single();

        if (submissionError) {
          throw submissionError;
        }

        if (submission?.artist_id === judgeArtistId) {
          return NextResponse.json({ error: "Artists cannot judge their own submission." }, { status: 409 });
        }

        const { data: assignment, error: assignmentError } = await supabase
          .from("pilot_judging_assignments")
          .select("id")
          .eq("judge_artist_id", judgeArtistId)
          .eq("submission_id", submissionId)
          .maybeSingle();

        if (assignmentError) {
          throw assignmentError;
        }

        if (!assignment) {
          return NextResponse.json({ error: "That judging assignment does not exist yet." }, { status: 409 });
        }

        const { error } = await supabase.from("pilot_judgments").upsert(
          {
            judge_artist_id: judgeArtistId,
            submission_id: submissionId,
            lyrics: clampScore(body?.lyrics),
            delivery: clampScore(body?.delivery),
            originality: clampScore(body?.originality),
            impact: clampScore(body?.impact),
          },
          { onConflict: "judge_artist_id,submission_id" },
        );

        if (error) {
          throw error;
        }

        const { error: updateAssignmentError } = await supabase
          .from("pilot_judging_assignments")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", assignment.id);

        if (updateAssignmentError) {
          throw updateAssignmentError;
        }
      }

      if (action === "generateAssignments") {
        const payload = await readSupabasePilot();
        if (!payload) {
          return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
        }

        const assignments = buildAssignments(
          payload.state.artists,
          payload.state.submissions,
          payload.state.judgingAssignments,
        );

        if (assignments.length > 0) {
          const { error } = await supabase.from("pilot_judging_assignments").insert(
            assignments.map((assignment) => ({
              judge_artist_id: assignment.judgeArtistId,
              submission_id: assignment.submissionId,
              round: assignment.round,
              status: assignment.status,
              assigned_at: assignment.assignedAt,
              completed_at: assignment.completedAt,
            })),
          );

          if (error) {
            throw error;
          }
        }
      }

      if (action === "markWinner") {
        const artistId = String(body?.artistId || "");
        if (!artistId) {
          return NextResponse.json({ error: "Winner artist id is required." }, { status: 400 });
        }

        const { error: resetError } = await supabase
          .from("pilot_artists")
          .update({ status: "eliminated", reward_cents: 0 })
          .neq("id", artistId);

        if (resetError) {
          throw resetError;
        }

        const { error: winnerError } = await supabase
          .from("pilot_artists")
          .update({ status: "winner", reward_cents: 500 })
          .eq("id", artistId);

        if (winnerError) {
          throw winnerError;
        }
      }

      return NextResponse.json(await readPilotPayload());
    }

    if (action === "reset") {
      await resetPilotState();
      return NextResponse.json(await readPilotPayload());
    }

    const state = await readPilotState();

    if (action === "enter") {
      const name = String(body?.name || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();

      if (name.length < 2 || !isValidEmail(email)) {
        return NextResponse.json({ error: "Artist name and valid email are required." }, { status: 400 });
      }

      if (state.artists.length >= PILOT_CAPACITY && !state.artists.some((artist) => artist.email === email)) {
        return NextResponse.json({ error: "Pilot Ring A is full at 48 artists." }, { status: 409 });
      }

      const existingArtist = state.artists.find((artist) => artist.email === email);
      if (existingArtist) {
        existingArtist.name = name;
      } else {
        state.artists.push({
          id: makeId("artist"),
          name,
          email,
          walletUsd: 0,
          credits: 0,
          status: "entered",
        });
      }
    }

    if (action === "submit") {
      const artistId = String(body?.artistId || "");
      const title = String(body?.title || "").trim();
      const audioUrl = String(body?.audioUrl || "").trim();
      const challenge = CHALLENGES.includes(body?.challenge) ? body.challenge : CHALLENGES[0];

      if (!artistId || title.length < 2 || !audioUrl) {
        return NextResponse.json({ error: "Artist, title, and audio link are required." }, { status: 400 });
      }

      const artist = state.artists.find((entry) => entry.id === artistId);
      if (!artist) {
        return NextResponse.json({ error: "Artist not found." }, { status: 404 });
      }

      const existingSubmission = state.submissions.find((submission) => submission.artistId === artistId);
      const nextSubmission: PilotSubmission = {
        id: existingSubmission?.id || makeId("sub"),
        artistId,
        title,
        audioUrl,
        challenge,
        createdAt: existingSubmission?.createdAt || new Date().toISOString(),
      };

      state.submissions = [
        ...state.submissions.filter((submission) => submission.artistId !== artistId),
        nextSubmission,
      ];
      artist.status = "submitted";
    }

    if (action === "judge") {
      const judgeArtistId = String(body?.judgeArtistId || "");
      const submissionId = String(body?.submissionId || "");
      const submission = state.submissions.find((entry) => entry.id === submissionId);

      if (!judgeArtistId || !submission) {
        return NextResponse.json({ error: "Judge and submission are required." }, { status: 400 });
      }

      if (submission.artistId === judgeArtistId) {
        return NextResponse.json({ error: "Artists cannot judge their own submission." }, { status: 409 });
      }

      const assignment = state.judgingAssignments.find(
        (entry) => entry.judgeArtistId === judgeArtistId && entry.submissionId === submissionId,
      );

      if (!assignment) {
        return NextResponse.json({ error: "That judging assignment does not exist yet." }, { status: 409 });
      }

      const nextJudgment: PilotJudgment = {
        id: makeId("judgment"),
        judgeArtistId,
        submissionId,
        lyrics: clampScore(body?.lyrics),
        delivery: clampScore(body?.delivery),
        originality: clampScore(body?.originality),
        impact: clampScore(body?.impact),
        createdAt: new Date().toISOString(),
      };

      state.judgments = [
        ...state.judgments.filter(
          (judgment) => !(judgment.judgeArtistId === judgeArtistId && judgment.submissionId === submissionId),
        ),
        nextJudgment,
      ];
      const judge = state.artists.find((artist) => artist.id === judgeArtistId);
      if (judge) {
        judge.status = "judging";
      }
      assignment.status = "completed";
      assignment.completedAt = new Date().toISOString();
    }

    if (action === "generateAssignments") {
      const createdAssignments = buildAssignments(state.artists, state.submissions, state.judgingAssignments);
      state.judgingAssignments.push(...createdAssignments);
      state.event.phase = "judging";
    }

    if (action === "advancePhase") {
      const phase = body?.phase;
      if (phase === "entry" || phase === "submission" || phase === "judging" || phase === "results") {
        state.event.phase = phase;
      }
    }

    if (action === "markWinner") {
      const artistId = String(body?.artistId || "");
      state.artists = state.artists.map((artist) => ({
        ...artist,
        status: artist.id === artistId ? "winner" : "eliminated",
        walletUsd: artist.id === artistId ? artist.walletUsd + 5 : artist.walletUsd,
      }));
      state.event.phase = "results";
    }

    await writePilotState(state);
    return NextResponse.json(await readPilotPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pilot action failed." }, { status: 500 });
  }
}
