const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { seedPilotState } = require('../src/app/lib/pilotStore.ts');
const { advancePilot, pilotClock, WAVE_MS, JUDGING_MS, PILOT_MS, missedDuty } = require('../src/app/lib/tournament.ts');
const { recordSliderJudgment } = require('../src/app/lib/recordJudgment.ts');
const START = Date.parse('2026-10-02T12:00:00Z');
const pick = () => 0;

function fixture() {
  const state = structuredClone(seedPilotState);
  state.artists.forEach((artist, i) => {
    artist.status = 'submitted';
    const event = state.events[Math.floor(i / 16)];
    state.entries.push({ id: `entry-${i}`, artistId: artist.id, eventId: event.id, seed: i % 16 + 1, paidCents: 100, status: 'active', joinedAt: new Date(START).toISOString() });
    state.submissions.push({ id: `track-${i}`, artistId: artist.id, eventId: event.id, round: 1, title: `Track ${i}`, audioUrl: `/audio/${i}.mp3`, durationSeconds: 180, submittedAt: new Date(START).toISOString() });
  });
  state.events.forEach((event) => { event.phase = 'submission'; event.queueClosedAt = new Date(START).toISOString(); });
  return state;
}

function judgeWave(state, round, except = null) {
  const at = START + (round - 1) * WAVE_MS + 60_000;
  for (const assignment of state.assignments.filter((entry) => entry.status === 'assigned' && entry.judgeArtistId !== except)) {
    const battle = state.battles.find((entry) => entry.id === assignment.battleId);
    assignment.status = 'completed';
    assignment.completedAt = new Date(at).toISOString();
    state.judgments.push({ id: `judgment-${assignment.id}`, assignmentId: assignment.id, battleId: battle.id, judgeArtistId: assignment.judgeArtistId,
      scores: { lyrics: 8, delivery: 8, originality: 8, flow: 8, impact: 8 }, selectedWinnerArtistId: battle.artistAId, createdAt: new Date(at).toISOString() });
  }
}

test('64 artists produce 60 battles and four winners at exactly 64 minutes', () => {
  const state = fixture();
  const tracks = structuredClone(state.submissions);
  assert.equal(advancePilot(state, START, pick), true);
  for (let round = 1; round <= 4; round++) {
    const cards = state.battles.filter((entry) => entry.round === round);
    assert.equal(cards.length, 4 * 16 / 2 ** round);
    const duties = state.assignments.filter((entry) => cards.some((card) => card.id === entry.battleId));
    assert.equal(duties.length, cards.length);
    assert.equal(new Set(duties.map((entry) => entry.judgeArtistId)).size, duties.length);
    for (const duty of duties) {
      const card = cards.find((entry) => entry.id === duty.battleId);
      assert.ok(!state.entries.some((entry) => entry.artistId === duty.judgeArtistId && entry.eventId === card.eventId));
      assert.equal(Date.parse(duty.dueAt) - Date.parse(duty.assignedAt), JUDGING_MS);
    }
    judgeWave(state, round);
    advancePilot(state, START + (round - 1) * WAVE_MS + JUDGING_MS - 1, pick);
    assert.ok(cards.every((entry) => entry.status === 'judging'));
    advancePilot(state, START + (round - 1) * WAVE_MS + JUDGING_MS, pick);
    assert.ok(cards.every((entry) => entry.status === 'complete'));
    assert.ok(state.events.every((entry) => !entry.winnerArtistId));
    assert.equal(state.walletLedger.length, 0);
    advancePilot(state, START + round * WAVE_MS, pick);
  }
  assert.equal(state.battles.length, 60);
  assert.equal(state.events.filter((entry) => entry.winnerArtistId).length, 4);
  assert.equal(state.walletLedger.filter((entry) => entry.type === 'prize').length, 4);
  assert.deepEqual(state.submissions, tracks);
  assert.equal(pilotClock(state).revealAt, START + PILOT_MS);
  const final = structuredClone(state);
  assert.equal(advancePilot(state, START + PILOT_MS + 1, pick), false);
  assert.deepEqual(state, final);
});

test('missing judgments expire once, never reassign, and use a recorded random fallback', () => {
  const state = fixture();
  advancePilot(state, START, pick);
  const count = state.assignments.length;
  advancePilot(state, START + JUDGING_MS, pick);
  assert.equal(state.assignments.length, count);
  assert.ok(state.assignments.every((entry) => entry.status === 'expired'));
  assert.ok(state.auditLog.filter((entry) => entry.action === 'battle_resolved').some((entry) => entry.metadata.method === 'random_no_judgment'));
  const final = structuredClone(state);
  assert.equal(advancePilot(state, START + JUDGING_MS + 1, pick), false);
  assert.deepEqual(state, final);
});

test('late processing catches up every wave without extending the reveal clock', () => {
  const state = fixture();
  advancePilot(state, START, pick);
  advancePilot(state, START + PILOT_MS + 600_000, pick);
  assert.equal(state.battles.length, 60);
  assert.ok(state.battles.every((entry) => entry.status === 'complete'));
  assert.equal(state.auditLog.filter((entry) => entry.action === 'pilot_wave_distributed').length, 4);
  assert.equal(state.auditLog.find((entry) => entry.action === 'pilot_revealed').createdAt, new Date(START + PILOT_MS).toISOString());
});

test('missing submissions, duplicate artists, and future starts do not begin the pilot', () => {
  for (const mutate of [s => s.submissions.pop(), s => s.entries[63].artistId = s.entries[0].artistId, s => s.events[0].queueClosedAt = new Date(START + 1).toISOString()]) {
    const state = fixture(); mutate(state);
    assert.equal(advancePilot(state, START, pick), false);
    assert.equal(pilotClock(state), null);
  }
});

test('eliminated artists stay eligible and a contender never gets the same judge twice', () => {
  const state = fixture();
  state.artists.forEach((entry) => entry.status = 'eliminated');
  advancePilot(state, START, pick);
  assert.equal(state.assignments.length, 32);
  judgeWave(state, 1);
  advancePilot(state, START + WAVE_MS, pick);
  for (const assignment of state.assignments.filter((entry) => Date.parse(entry.assignedAt) > START)) {
    const battle = state.battles.find((entry) => entry.id === assignment.battleId);
    for (const previous of state.assignments.filter((entry) => entry.judgeArtistId === assignment.judgeArtistId && Date.parse(entry.assignedAt) === START)) {
      const prior = state.battles.find((entry) => entry.id === previous.battleId);
      assert.ok(![prior.artistAId, prior.artistBId].some((id) => [battle.artistAId, battle.artistBId].includes(id)));
    }
  }
});

test('a missed duty disqualifies only the assigned judge and an empty judge pool still resolves', () => {
  const state = fixture(); advancePilot(state, START, pick);
  const judge = state.assignments[0].judgeArtistId;
  judgeWave(state, 1, judge);
  advancePilot(state, START + JUDGING_MS, pick);
  assert.equal(missedDuty(state, judge), true);
  assert.equal(state.assignments.filter((entry) => entry.status === 'expired').length, 1);
  assert.equal(missedDuty(state, state.artists.find((artist) => !state.assignments.some((entry) => entry.judgeArtistId === artist.id)).id), false);
  advancePilot(state, START + WAVE_MS, pick);
  assert.ok(!state.assignments.some((entry) => entry.status === 'assigned' && entry.judgeArtistId === judge));
});

test('independent A/B scores stay numeric and ties cannot lock', () => {
  const state = fixture(); advancePilot(state, START, pick);
  const assignment = state.assignments[0];
  const battle = state.battles.find((entry) => entry.id === assignment.battleId);
  const sliders = Object.fromEntries(['lyrics', 'delivery', 'originality', 'flow', 'impact'].map(key => [key, { a: 80, b: 30 }]));
  const result = recordSliderJudgment(state, assignment, battle, sliders, []);
  assert.equal(result.selectedWinnerArtistId, battle.artistAId);
  assert.equal(result.judgment.contestantScores[battle.artistAId].lyrics, 8);
  assert.equal(result.judgment.contestantScores[battle.artistBId].lyrics, 3);
  assert.equal(recordSliderJudgment(state, assignment, battle, {}, []).status, 409);
});

test('a late judgment is not accepted as a completed duty', () => {
  const state = fixture(); advancePilot(state, START, pick); judgeWave(state, 1);
  const judgment = state.judgments[0];
  judgment.createdAt = new Date(START + JUDGING_MS).toISOString();
  advancePilot(state, START + JUDGING_MS, pick);
  assert.equal(state.assignments.find((entry) => entry.id === judgment.assignmentId).status, 'expired');
});

test('insufficient prize funding holds settlement instead of crediting unbacked USD', () => {
  const state = fixture(); state.events[0].desiredPrizeCents = 100_000;
  advancePilot(state, START, pick);
  for (let round = 1; round <= 4; round++) { judgeWave(state, round); advancePilot(state, START + round * WAVE_MS, pick); }
  assert.ok(state.auditLog.some((entry) => entry.action === 'settlement_hold'));
  assert.ok(!state.walletLedger.some((entry) => entry.eventId === state.events[0].id && entry.type === 'prize'));
});

test('an unassigned card can randomly advance either contender without inventing a judgment', () => {
  for (const randomChoice of [0, 1]) {
    const state = fixture(); advancePilot(state, START, pick);
    const battle = state.battles[0];
    state.assignments = state.assignments.filter((entry) => entry.battleId !== battle.id);
    judgeWave(state, 1);
    advancePilot(state, START + JUDGING_MS, () => randomChoice);
    assert.equal(battle.winnerArtistId, randomChoice === 0 ? battle.artistAId : battle.artistBId);
    assert.ok(!state.judgments.some((entry) => entry.battleId === battle.id));
    assert.equal(state.auditLog.find((entry) => entry.action === 'battle_resolved' && entry.metadata.battleId === battle.id).metadata.method, 'random_no_judgment');
  }
});

test('no eligible finalist means no winner prize, and no available judge cannot stall a wave', () => {
  const state = fixture(); advancePilot(state, START, pick);
  state.artists.forEach((artist, i) => state.assignments.push({ id: `expired-${i}`, battleId: state.battles[0].id,
    judgeArtistId: artist.id, status: 'expired', assignedAt: new Date(START).toISOString(), openedAt: null, dueAt: new Date(START).toISOString(), completedAt: null }));
  advancePilot(state, START + PILOT_MS, pick);
  assert.ok(state.events.every((entry) => entry.phase === 'complete' && entry.winnerArtistId === null));
  assert.equal(state.walletLedger.length, 0);
  assert.equal(state.auditLog.filter((entry) => entry.action === 'event_no_eligible_winner').length, 4);
  assert.equal(state.battles.length, 60);
});
