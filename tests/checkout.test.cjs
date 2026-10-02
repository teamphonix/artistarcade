const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

test('checkout belongs to the verified wallet and cannot silently change an invalid amount', async () => {
  const original = Module._load;
  const calls = [];
  let unavailable = false, profileMissing = false;
  const admin = {
    auth: { getUser: async token => ({ data: { user: token === 'valid' ? { email: 'owner@example.com', email_confirmed_at: 'now' } : null }, error: null }) },
    from: table => {
      assert.equal(table, 'protocol_artists');
      return { select: () => ({ eq: (field, email) => {
        assert.equal(field, 'email'); assert.equal(email, 'owner@example.com');
        return { single: async () => ({ data: profileMissing ? null : { id: 'owner', name: 'Verified name' }, error: null }) };
      } }) };
    },
  };
  Module._load = function(id, parent, main) {
    if (id.endsWith('/supabaseAdmin') || id === './supabaseAdmin') return { getSupabaseAdmin: () => admin };
    if (id.endsWith('/stripe')) return { getAppUrl: () => 'https://artistarcade.example', getStripe: () => ({ checkout: { sessions: { create: async body => { if (unavailable) throw new Error('private provider detail'); calls.push(body); return { url: 'https://checkout.stripe.com/c/pay_test' }; } } } }) };
    if (id.startsWith('@/')) id = path.resolve('src', id.slice(2)) + '.ts';
    return original.call(this, id, parent, main);
  };
  try {
    const { POST } = require('../src/app/api/checkout/route.ts');
    const request = (body, headers = {}) => new Request('https://artistarcade.example/api/checkout', { method: 'POST', headers: { origin: 'https://artistarcade.example', cookie: 'aa-session=valid', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    assert.equal((await POST(request({ amountCents: 100 }, { cookie: '' }))).status, 401);
    assert.equal((await POST(request({ amountCents: 100 }, { origin: 'https://attacker.example' }))).status, 403);
    for (const amountCents of [-1, 0, 99, 100.5, 'nonsense', 2_000_000_001]) assert.equal((await POST(request({ amountCents }))).status, 400);
    assert.equal((await POST(request({ artistId: 'other', amountCents: 100 }))).status, 403);
    assert.equal(calls.length, 0);
    const response = await POST(request({ artistId: 'owner', email: 'attacker@example.com', name: 'Forged name', amountCents: 500 }));
    assert.equal(response.status, 200);
    assert.equal(calls[0].customer_email, 'owner@example.com');
    assert.equal(calls[0].metadata.name, 'Verified name');
    assert.equal(calls[0].line_items[0].price_data.unit_amount, 500);
    assert.equal(calls[0].success_url, 'https://artistarcade.example/artist/owner?payment=success');
    assert.equal(calls[0].cancel_url, 'https://artistarcade.example/artist/owner?payment=cancelled');
    profileMissing = true;
    assert.equal((await POST(request({ amountCents: 100 }))).status, 409);
    profileMissing = false; unavailable = true;
    const failure = await POST(request({ amountCents: 100 }));
    assert.equal(failure.status, 503);
    assert.equal(JSON.stringify(await failure.json()).includes('private provider detail'), false);
  } finally { Module._load = original; }
});
