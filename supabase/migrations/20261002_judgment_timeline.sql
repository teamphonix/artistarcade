-- Apply before previewing the new protocol route against Supabase.
-- Original numeric score columns remain 1–10 for compatibility.
-- contestant_scores preserves independent scores, including zero and fractional values.
alter table public.protocol_judgments
  add column if not exists sliders jsonb,
  add column if not exists timeline jsonb not null default '[]'::jsonb;
