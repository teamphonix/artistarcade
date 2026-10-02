const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { seedPilotState } = require('../src/app/lib/pilotStore.ts');
const { toDatabaseRows, rememberSnapshot, buildStatePatch } = require('../src/app/lib/databaseState.ts');
const { verifiedDeposit } = require('../src/app/lib/stripeDeposit.ts');

test('PostgreSQL transaction and payment integrity', async t => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));
    await db.exec(fs.readFileSync('supabase/migrations/20261002_judgment_timeline.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261003_atomic_protocol.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261003_atomic_protocol.sql','utf8'));
    const snapshot = async () => (await db.query('select protocol_read_snapshot() as state')).rows[0].state;
    const commit = async (revision, patch) => (await db.query('select protocol_commit($1,$2::jsonb) as revision', [revision, JSON.stringify(patch)])).rows[0].revision;
    const seed = structuredClone(seedPilotState);
    seed.artists.forEach(artist => { artist.walletCents = 0; artist.rewardCents = 0; });
    await commit(0, toDatabaseRows(seed));
    const artist = seed.artists[0];
    const row = toDatabaseRows(seed).protocol_artists[0];
    const credit = async (event, session, amount = 100, email = artist.email) => (await db.query(
      'select protocol_credit_stripe($1,$2,$3,$4,$5,$6) as result', [event,session,email,'Artist',amount,'cus_test'])).rows[0].result;

    await t.test('stale snapshots cannot overwrite a newer committed change', async () => {
      const before = await snapshot();
      await commit(before.revision,{protocol_artists:[{...row,name:'Saved name'}]});
      await assert.rejects(commit(before.revision,{protocol_artists:[{...row,name:'Stale name'}]}),error => error.code === '40001');
      const after = await snapshot();
      assert.equal(after.tables.protocol_artists.find(item => item.id === artist.id).name,'Saved name');
    });

    await t.test('an invalid child write rolls back the entire commit and its revision', async () => {
      const before = await snapshot();
      const saved = before.tables.protocol_artists.find(item => item.id === artist.id);
      await assert.rejects(commit(before.revision,{protocol_artists:[{...saved,name:'Must roll back'}],protocol_entries:[{
        id:randomUUID(),event_id:randomUUID(),artist_id:artist.id,seed:1,paid_cents:100,status:'active',joined_at:new Date().toISOString(),
      }]}));
      const after = await snapshot();
      assert.equal(after.revision,before.revision);
      assert.deepEqual(after.tables.protocol_artists,before.tables.protocol_artists);
    });

    await t.test('same session is credited once across duplicate and distinct webhook events', async () => {
      assert.equal((await credit('evt_first','cs_first')).duplicate,false);
      assert.equal((await credit('evt_first','cs_first')).duplicate,true);
      assert.equal((await credit('evt_second_event','cs_first')).duplicate,true);
      const after = await snapshot();
      assert.equal(after.tables.protocol_artists.find(item => item.id === artist.id).wallet_cents,100);
      assert.equal(after.tables.protocol_wallet_ledger.filter(item => item.type === 'deposit').length,1);
      await assert.rejects(credit('evt_first','cs_first',200));
    });

    await t.test('64 queued deposits accumulate without lost updates', async () => {
      await Promise.all(Array.from({length:64},(_,i)=>credit(`evt_parallel_${i}`,`cs_parallel_${i}`)));
      const after = await snapshot();
      assert.equal(after.tables.protocol_artists.find(item => item.id === artist.id).wallet_cents,6500);
      assert.equal(after.tables.protocol_wallet_ledger.filter(item => item.type === 'deposit').length,65);
    });

    await t.test('a deposit invalidates an older tournament snapshot', async () => {
      const before = await snapshot();
      const saved = before.tables.protocol_artists.find(item => item.id === artist.id);
      await credit('evt_new_credit','cs_new_credit');
      await assert.rejects(commit(before.revision,{protocol_artists:[{...saved,name:'Stale post-deposit name'}]}),error=>error.code==='40001');
      assert.equal((await snapshot()).tables.protocol_artists.find(item=>item.id===artist.id).wallet_cents,6600);
    });

    await t.test('row updates preserve Stripe customer identity and unrelated records', async () => {
      const before = await snapshot();
      const saved = before.tables.protocol_artists.find(item=>item.id===artist.id);
      const { stripe_customer_id, ...withoutStripe } = saved;
      assert.equal(stripe_customer_id,'cus_test');
      await commit(before.revision,{protocol_artists:[{...withoutStripe,name:'Updated safely'}]});
      const after = await snapshot();
      assert.equal(after.tables.protocol_artists.length,64);
      assert.equal(after.tables.protocol_artists.find(item=>item.id===artist.id).stripe_customer_id,'cus_test');
      assert.equal(after.tables.protocol_wallet_ledger.length,65+1);
    });

    await t.test('unbacked balance increases and duplicate event prizes are rejected', async () => {
      const before = await snapshot();
      const saved = before.tables.protocol_artists.find(item=>item.id===artist.id);
      await assert.rejects(commit(before.revision,{protocol_artists:[{...saved,wallet_cents:saved.wallet_cents+100}]}),error=>error.code==='23514');
      const eventId=seed.events[0].id;
      const prize={id:randomUUID(),artist_id:artist.id,event_id:eventId,amount_cents:500,type:'prize',note:'Test prize',created_at:new Date().toISOString()};
      await commit(before.revision,{protocol_artists:[{...saved,wallet_cents:saved.wallet_cents+500,reward_cents:500}],protocol_wallet_ledger:[prize]});
      const current=await snapshot();
      const winner=current.tables.protocol_artists.find(item=>item.id===artist.id);
      await assert.rejects(commit(current.revision,{protocol_artists:[{...winner,wallet_cents:winner.wallet_cents+500,reward_cents:1000}],protocol_wallet_ledger:[{...prize,id:randomUUID()}]}),error=>error.code==='23505');
      assert.equal((await snapshot()).tables.protocol_artists.find(item=>item.id===artist.id).wallet_cents,winner.wallet_cents);
    });

    await t.test('64 stale writers get conflicts instead of losing previously saved records', async () => {
      const before=await snapshot();
      const writers=before.tables.protocol_artists.map((item,i)=>({ ...item, name:`Concurrent artist ${i}` }));
      const results=await Promise.allSettled(writers.map(item=>commit(before.revision,{protocol_artists:[item]})));
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
      assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.code==='40001').length,63);
      for(const item of writers){ const fresh=await snapshot(); await commit(fresh.revision,{protocol_artists:[item]}); }
      assert.ok((await snapshot()).tables.protocol_artists.every(item=>item.name.startsWith('Concurrent artist')));
    });

    await t.test('anonymous RPCs and direct service-role balance writes are denied', async () => {
      await db.exec('set role anon');
      await assert.rejects(snapshot(),error=>error.code==='42501');
      await db.exec('reset role; set role service_role');
      await snapshot();
      await assert.rejects(db.query('update protocol_artists set wallet_cents=999 where id=$1',[artist.id]),error=>error.code==='42501');
      await assert.rejects(db.query('update protocol_revision set revision=999'),error=>error.code==='42501');
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});

test('patches only contain changed rows and never delete omitted records', () => {
  const state=structuredClone(seedPilotState); rememberSnapshot(state,7);
  assert.deepEqual(buildStatePatch(state),{});
  state.artists[0].name='Changed';
  state.artists.pop();
  const patch=buildStatePatch(state);
  assert.equal(patch.protocol_artists.length,1);
  assert.equal(patch.protocol_artists[0].name,'Changed');
  assert.ok(!('stripe_customer_id' in patch.protocol_artists[0]));
});

test('empty-database seeding produces inserts and never invents USD credits', () => {
  const empty=structuredClone(seedPilotState); empty.artists=[]; empty.events=[];
  rememberSnapshot(empty,0);
  Object.assign(empty,structuredClone(seedPilotState),{revision:0});
  empty.artists.forEach(artist=>{artist.walletCents=0;artist.rewardCents=0;});
  const patch=buildStatePatch(empty);
  assert.equal(patch.protocol_artists.length,64);
  assert.equal(patch.protocol_events.length,4);
  assert.ok(patch.protocol_artists.every(artist=>artist.wallet_cents===0));
});

test('Stripe uses the signed paid USD total, never metadata amounts', () => {
  const session={id:'cs_test',mode:'payment',payment_status:'paid',currency:'usd',amount_total:100,
    metadata:{protocol:'artist-arcade-wallet',email:'ARTIST@example.com',amountCents:'999999'}};
  assert.equal(verifiedDeposit(session).amountCents,100);
  assert.equal(verifiedDeposit({...session,payment_status:'unpaid'}),null);
  assert.equal(verifiedDeposit({...session,metadata:{protocol:'other'}}),null);
  assert.throws(()=>verifiedDeposit({...session,currency:'eur'}));
  assert.throws(()=>verifiedDeposit({...session,amount_total:NaN}));
});
