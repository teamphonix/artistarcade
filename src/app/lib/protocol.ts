export const PILOT_CAPACITY = 64;
export const DEFAULT_WALLET_DEPOSIT_USD = 100;

export const CHALLENGES = ["Lyrical Onslaught", "Story Mode", "Beat Talk", "Persona Pen"] as const;

export type ChallengeTitle = (typeof CHALLENGES)[number];

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 1;
  }

  return Math.min(5, Math.max(1, Math.round(score)));
}

export function centsFromUsd(amount: number) {
  return Math.round(amount * 100);
}
