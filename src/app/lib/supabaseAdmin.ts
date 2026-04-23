import { createClient } from "@supabase/supabase-js";

export type DbArtist = {
  id: string;
  name: string;
  email: string;
  stripe_customer_id: string | null;
  payment_status: "pending" | "paid" | "comped";
  wallet_cents: number;
  reward_cents: number;
  status: "entered" | "submitted" | "judging" | "advanced" | "eliminated" | "winner";
  created_at: string;
};

export type DbSubmission = {
  id: string;
  artist_id: string;
  title: string;
  audio_url: string;
  challenge: string;
  created_at: string;
};

export type DbJudgment = {
  id: string;
  judge_artist_id: string;
  submission_id: string;
  lyrics: number;
  delivery: number;
  originality: number;
  impact: number;
  created_at: string;
};

export type DbJudgingAssignment = {
  id: string;
  judge_artist_id: string;
  submission_id: string;
  round: number;
  status: "assigned" | "completed";
  assigned_at: string;
  completed_at: string | null;
};

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
