const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { seedPilotState } = require('../src/app/lib/pilotStore.ts');
const { toDatabaseRows } = require('../src/app/lib/databaseState.ts');

test('background endpoint and PostgreSQL complete a cohort without any artist API reads', async t => {
  const db = new PGlite();
  const originalLoad = Module._load, originalNow = Date.now, originalFetch = global.fetch;
  const originalSecret = process.env.CRON_SECRET;
  let conflicts = 0, outage = false;
  const admin = { rpc: async (name, args = {}) => {
    if (outage && name === 'protocol_read_snapshot') return { error: { code: '08006', message: 'private database detail' } };
    if (name === 'protocol_commit' && conflicts > 0) { conflicts--; return { error: { code: '40001' } }; }
    try {
      let result;
      if (name === 'protocol_read_snapshot') result = await db.query('select protocol_read_snapshot() as value');
      else if (name === 'protocol_commit') result = await db.query('select protocol_commit($1,$2::jsonb) as value', [args.p_expected_revision, JSON.stringify(args.p_patch)]);
      else if (name === 'protocol_record_worker') result = await db.query('select protocol_record_worker($1,$2,$3) as value', [args.p_started_at, args.p_success, args.p_revision]);
      else throw new Error(name);
      return { data: result.rows[0].value, error: null };
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  } };
  Module._load = function(id, parent, main) {
    if (id.endsWith('/supabaseAdmin') || id === './supabaseAdmin') return { getSupabaseAdmin: () => admin };
    if (id.startsWith('@/')) id = path.resolve('src', id.slice(2)) + '.ts';
    return originalLoad.call(this, id, parent, main);
  };
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));
    for (const migration of ['20261002_judgment_timeline.sql','20261003_atomic_protocol.sql','20261004_private_protocol.sql','20261005_worker_health.sql','20261005_worker_health.sql']) await db.exec(fs.readFileSync('supabase/migrations/' + migration, 'utf8'));
    const START = originalNow();
    let now = START;
    Date.now = () => now;
    const state = structuredClone(seedPilotState);
    state.artists.forEach((artist, i) => {
      artist.walletCents = 0; artist.rewardCents = 0;
      const event = state.events[Math.floor(i / 16)];
      state.entries.push({ id: randomUUID(), artistId: artist.id, eventId: event.id, seed: i % 16 + 1, paidCents: 100, status: 'active', joinedAt: new Date(START).toISOString() });
      state.submissions.push({ id: randomUUID(), artistId: artist.id, eventId: event.id, round: 1, title: 'Original track', audioUrl: '/track.mp3', durationSeconds: 180, submittedAt: new Date(START).toISOString() });
    });
    state.events.forEach(event => { event.phase = 'submission'; event.queueClosedAt = new Date(START).toISOString(); });
    await db.query('select protocol_commit($1,$2::jsonb)', [0, JSON.stringify(toDatabaseRows(state))]);
    const { GET } = require('../src/app/api/protocol/tick/route.ts');
    const { workerIsHealthy } = require('../src/app/lib/protocolWorker.ts');
    const tick = () => GET(new Request('https://example.com/api/protocol/tick', { headers: { authorization: 'Bearer test-worker-secret' } }));
    const snapshot = async () => (await db.query('select protocol_read_snapshot() as value')).rows[0].value;
    global.fetch = async () => { throw new Error('Worker must not call another HTTP endpoint'); };

    await t.test('missing or incorrect credentials fail closed', async () => {
      delete process.env.CRON_SECRET;
      assert.equal((await tick()).status, 401);
      process.env.CRON_SECRET = 'test-worker-secret';
      assert.equal((await GET(new Request('https://example.com/api/protocol/tick'))).status, 401);
      assert.equal((await snapshot()).revision, 1);
    });
    await t.test('conflicts reload and retry, and duplicate runs do not advance revision', async () => {
      conflicts = 2;
      const response = await tick();
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.changed, true);
      assert.equal(JSON.stringify(result).includes('artists'), false);
      assert.equal((await snapshot()).tables.protocol_assignments.length, 32);
      const duplicate = await tick();
      assert.equal((await duplicate.json()).changed, false);
      assert.equal((await snapshot()).revision, result.revision);
    });
    await t.test('all four waves reveal once and issue four prizes without browser progression', async () => {
      for (let round = 1; round <= 4; round++) {
        const before = await snapshot(), tables = before.tables;
        const assignments = tables.protocol_assignments.filter(a => a.status === 'assigned');
        const judgedAt = new Date(START + (round - 1) * 16 * 60_000 + 60_000).toISOString();
        await db.query('select protocol_commit($1,$2::jsonb)', [before.revision, JSON.stringify({
          protocol_assignments: assignments.map(a => ({ ...a, status: 'completed', completed_at: judgedAt })),
          protocol_judgments: assignments.map(a => ({ id: randomUUID(), assignment_id: a.id, battle_id: a.battle_id, judge_artist_id: a.judge_artist_id, lyrics: 8, delivery: 8, originality: 8, flow: 8, impact: 8, selected_winner_artist_id: tables.protocol_battles.find(b => b.id === a.battle_id).artist_a_id, created_at: judgedAt })),
        })]);
        now = START + round * 16 * 60_000;
        const responses = round === 2 ? await Promise.all([tick(), tick(), tick()]) : [await tick()];
        assert.equal(responses.every(response => response.status === 200), true);
      }
      const final = await snapshot();
      assert.equal(final.tables.protocol_battles.length, 60);
      assert.equal(final.tables.protocol_battles.every(b => b.status === 'complete'), true);
      assert.equal(final.tables.protocol_events.filter(e => e.winner_artist_id).length, 4);
      assert.equal(final.tables.protocol_wallet_ledger.filter(l => l.type === 'prize').length, 4);
      assert.equal(final.tables.protocol_audit_log.filter(a => a.action === 'pilot_revealed').length, 1);
      await tick(); await tick();
      assert.equal((await snapshot()).revision, final.revision);
    });
    await t.test('a missed hour catches up original deadlines without reassignment or a second reveal', async () => {
      await db.exec('truncate protocol_artists cascade');
      const empty = await snapshot();
      await db.query('select protocol_commit($1,$2::jsonb)', [empty.revision, JSON.stringify(toDatabaseRows(state))]);
      now = START;
      assert.equal((await tick()).status, 200);
      now = START + 70 * 60_000;
      assert.equal((await tick()).status, 200);
      const recovered = await snapshot();
      assert.equal(recovered.tables.protocol_battles.length, 60);
      assert.equal(recovered.tables.protocol_battles.every(b => b.status === 'complete'), true);
      const reveal = recovered.tables.protocol_audit_log.filter(a => a.action === 'pilot_revealed');
      assert.equal(reveal.length, 1);
      assert.equal(Date.parse(reveal[0].created_at), START + 64 * 60_000);
      assert.equal(recovered.tables.protocol_assignments.every(a => a.status === 'expired'), true);
      const perBattle = recovered.tables.protocol_assignments.map(a => a.battle_id);
      assert.equal(new Set(perBattle).size, perBattle.length);
      const revision = recovered.revision;
      await tick();
      assert.equal((await snapshot()).revision, revision);
    });
    await t.test('database failure returns failure, records telemetry, and can recover', async () => {
      outage = true;
      const failed = await tick();
      assert.equal(failed.status, 500);
      assert.equal(JSON.stringify(await failed.json()).includes('private database detail'), false);
      const health = (await db.query('select * from protocol_worker_health')).rows[0];
      assert.ok(health.last_failure_at);
      outage = false;
      assert.equal((await tick()).status, 200);
    });
    await t.test('health requires a fresh success and cannot be forged by public database roles', async () => {
      assert.equal(workerIsHealthy(null), false);
      assert.equal(workerIsHealthy({ last_success_at: new Date(START).toISOString(), last_failure_at: null }, START + 121_000), false);
      assert.equal(workerIsHealthy({ last_success_at: new Date(START).toISOString(), last_failure_at: null }, START + 60_000), true);
      assert.equal(workerIsHealthy({ last_success_at: new Date(START).toISOString(), last_failure_at: new Date(START + 1).toISOString() }, START + 60_000), false);
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from protocol_worker_health'));
      await assert.rejects(db.query('select protocol_record_worker(now(),true,1)'));
      await db.exec('reset role; set role service_role');
      await assert.rejects(db.query('update protocol_worker_health set last_success_at=now()'));
      await db.exec('reset role');
    });
  } finally {
    Date.now = originalNow; global.fetch = originalFetch; Module._load = originalLoad;
    if (originalSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalSecret;
    await db.close();
  }
});
