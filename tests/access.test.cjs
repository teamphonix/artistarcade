const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { seedPilotState } = require('../src/app/lib/pilotStore.ts');
const { authorizeAction, artistState } = require('../src/app/lib/access.ts');
const { toDatabaseRows } = require('../src/app/lib/databaseState.ts');
const state = structuredClone(seedPilotState);
const me = state.artists[0], other = state.artists[1];
state.entries.push({ id: 'entry', artistId: me.id, eventId: state.events[0].id, seed: 1, paidCents: 100, status: 'eliminated', joinedAt: new Date().toISOString() });
state.artists[0].status = 'eliminated';
state.battles.push({ id: 'secret-battle', eventId: state.events[0].id, round: 2, slot: 1, artistAId: me.id, artistBId: other.id, status: 'complete', winnerArtistId: other.id, createdAt: '', completedAt: '' });
state.auditLog.push({ id: 'start', action: 'pilot_started', note: 'secret', metadata: {}, eventId: null, artistId: null, createdAt: new Date().toISOString() });

test('artists cannot impersonate another email, profile, FateKeeper, or host', () => {
  const principal = { email: me.email, host: false };
  for (const action of ['updateEvent','closeQueue','generateJudgeAssignments','finalizeRound','reset','deposit','withdraw','unknown']) assert.throws(() => authorizeAction(state, principal, action, {}));
  assert.throws(() => authorizeAction(state, principal, 'upsertArtist', { email: other.email }));
  assert.throws(() => authorizeAction(state, principal, 'submit', { artistId: other.id }));
  state.assignments.push({ id: 'foreign', judgeArtistId: other.id, battleId: 'secret-battle', status: 'assigned' });
  assert.throws(() => authorizeAction(state, principal, 'judge', { assignmentId: 'foreign' }));
  assert.doesNotThrow(() => authorizeAction(state, principal, 'submit', { artistId: me.id }));
  assert.doesNotThrow(() => authorizeAction(state, { ...principal, host: true }, 'updateEvent', {}));
});

test('sealed state excludes elimination, later brackets, other wallets and audit', () => {
  const view = artistState(state, me.email);
  assert.equal(view.artists.find(a => a.id === me.id).status, 'registered');
  assert.equal(view.entries[0].status, 'active');
  assert.equal(view.battles.length, 0);
  assert.equal(view.judgments.length, 0);
  assert.equal(view.auditLog.length, 0);
  assert.equal(view.artists.some(a => a.email === other.email), false);
  assert.equal(state.artists[0].status, 'eliminated');
});

test('only assigned card audio is accessible; completed card vanishes until reveal', () => {
  const copy = structuredClone(state);
  copy.assignments.push({ id: 'own', judgeArtistId: me.id, battleId: 'duty', status: 'assigned' });
  copy.battles.push({ ...copy.battles[0], id: 'duty', eventId: copy.events[1].id, artistAId: other.id, artistBId: copy.artists[2].id });
  copy.submissions.push({ id: 'audio', artistId: other.id, eventId: copy.events[1].id, round: 1, audioUrl: '/track', title: 'Track', durationSeconds: 180, submittedAt: '' });
  const view = artistState(copy, me.email);
  assert.equal(view.battles.length, 1);
  assert.equal(view.battles[0].winnerArtistId, null);
  assert.equal(view.submissions.length, 1);
  assert.equal(view.artists.find(a => a.id === other.id).walletCents, 0);
  copy.assignments.at(-1).status = 'completed';
  assert.equal(artistState(copy, me.email).submissions.length, 0);
  copy.auditLog.push({ ...copy.auditLog[0], id: 'reveal', action: 'pilot_revealed' });
  assert.equal(artistState(copy, me.email).battles[0].winnerArtistId, other.id);
});

test('authenticated API denies anonymous reads and forged actions and seals the actual JSON', async () => {
  const original = Module._load;
  let commits = 0;
  const admin = {
    auth: {
      getUser: async token => ({ data: { user: token === 'valid' ? { email: me.email, email_confirmed_at: 'now', user_metadata: { host: true } } : null }, error: null }),
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async ({ token }) => token === '123456' ? { data: { user: { email_confirmed_at: 'now' }, session: { access_token: 'secret-access', refresh_token: 'secret-refresh', expires_in: 3600 } }, error: null } : { data: {}, error: true },
      refreshSession: async ({ refresh_token }) => refresh_token === 'secret-refresh' ? { data: { user: { email_confirmed_at: 'now' }, session: { access_token: 'rotated', refresh_token: 'rotated-refresh', expires_in: 3600 } }, error: null } : { data: {}, error: true },
    },
    rpc: async name => { if (name === 'protocol_commit') commits++; return { data: name === 'protocol_read_snapshot' ? { revision: 1, tables: toDatabaseRows(state) } : 2, error: null }; },
  };
  Module._load = function(id, parent, main) {
    if (id.endsWith('/supabaseAdmin') || id === './supabaseAdmin') return { getSupabaseAdmin: () => admin };
    if (id.startsWith('@/')) id = path.resolve('src', id.slice(2)) + '.ts';
    return original.call(this, id, parent, main);
  };
  try {
    const route = require('../src/app/api/pilot/route.ts');
    const anonymous = await route.GET(new Request('https://example.com/api/pilot'));
    assert.equal(anonymous.status, 401);
    assert.equal(commits, 0);
    const request = new Request('https://example.com/api/pilot', { headers: { cookie: 'aa-session=valid' } });
    const response = await route.GET(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const payload = await response.json();
    assert.equal(payload.tournament.revealed, false);
    assert.deepEqual(payload.battles, []);
    assert.deepEqual(payload.scoredBattles, []);
    assert.deepEqual(payload.events[0].standings, []);
    assert.equal(JSON.stringify(payload).includes(other.email), false);
    const afterRead = commits;
    for (const body of [{ action: 'judge', assignmentId: 'foreign' }, { action: 'submit', artistId: other.id }, { action: 'updateEvent' }]) {
      const denied = await route.POST(new Request('https://example.com/api/pilot', { method: 'POST', headers: { cookie: 'aa-session=valid', origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      assert.equal(denied.status, 403);
    }
    const csrf = await route.POST(new Request('https://example.com/api/pilot', { method: 'POST', headers: { cookie: 'aa-session=valid', origin: 'https://attacker.com' } }));
    assert.equal(csrf.status, 403);
    assert.equal(commits, afterRead);
    const auth = require('../src/app/api/auth/route.ts');
    const postAuth = (body, cookie = '') => auth.POST(new Request('https://example.com/api/auth', { method: 'POST', headers: { origin: 'https://example.com', cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    assert.equal((await postAuth({ action: 'send', email: me.email })).status, 200);
    assert.equal((await postAuth({ action: 'verify', email: me.email, code: '999999' })).status, 401);
    const verified = await postAuth({ action: 'verify', email: me.email, code: '123456' });
    assert.equal(verified.status, 200);
    assert.match(verified.headers.get('set-cookie'), /HttpOnly/);
    assert.match(verified.headers.get('set-cookie'), /SameSite=lax/i);
    assert.equal(JSON.stringify(await verified.json()).includes('secret'), false);
    assert.equal((await postAuth({ action: 'refresh' })).status, 401);
    const refreshed = await postAuth({ action: 'refresh' }, 'aa-refresh=secret-refresh');
    assert.equal(refreshed.status, 200);
    assert.match(refreshed.headers.get('set-cookie'), /rotated-refresh/);
    const signedOut = await auth.DELETE(new Request('https://example.com/api/auth', { method: 'DELETE', headers: { origin: 'https://example.com' } }));
    assert.match(signedOut.headers.get('set-cookie'), /aa-refresh=;.*Max-Age=0/);
  } finally { Module._load = original; }
});
