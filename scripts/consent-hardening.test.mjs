import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { consentConfigSchema } from '@verjson/consent';
import { createWorker } from './worker.mjs';
import { publishConsentConfig } from './publish-consent.mjs';

const config = JSON.parse(readFileSync(new URL('../config/consent.json', import.meta.url), 'utf8'));
const worker = createWorker({ pages: { '/': '<p>Manifesto</p>' }, assets: {}, parseConfig: (value) => consentConfigSchema.parse(value) });
const request = (method = 'GET') => new Request('https://agileaimanifesto.org/api/consent-config', { method });

function database(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../migrations/0001_consent_config.sql', import.meta.url), 'utf8'));
  return {
    insert(value) {
      db.prepare('INSERT INTO consent_config_versions (site_id, revision, config_json) VALUES (?, ?, ?)').run(value.siteId, value.revision, JSON.stringify(value));
    },
    env: { CONSENT_DB: { prepare(sql) { return { bind(...params) { return { async first() { return db.prepare(sql).get(...params) ?? null; } }; } }; } } },
  };
}

test('the Worker selects the newest revision for its own site from the real schema', async (t) => {
  const storage = database(t);
  storage.insert(config);
  storage.insert({ ...config, siteId: 'another-site', revision: 99 });
  const updated = { ...config, revision: 2, clarity: { ...config.clarity, enabled: false } };
  storage.insert(updated);

  const response = await worker.fetch(request(), storage.env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), updated);
});

test('an invalid latest database revision fails closed instead of reviving older tracking settings', async (t) => {
  const storage = database(t);
  storage.insert(config);
  storage.insert({ ...config, revision: 2, clarity: { enabled: true, projectId: '<script>' } });

  const response = await worker.fetch(request(), storage.env);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Consent configuration unavailable' });
});

test('an initialized but empty database returns the unavailable response', async (t) => {
  const storage = database(t);

  const response = await worker.fetch(request(), storage.env);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Consent configuration unavailable' });
});

test('database read rejection does not expose its error or interfere with page delivery', async () => {
  const first = mock.fn(async () => { throw new Error('private database account detail'); });
  const env = { CONSENT_DB: { prepare() { return { bind() { return { first }; } }; } } };

  const response = await worker.fetch(request(), env);
  const page = await worker.fetch(new Request('https://agileaimanifesto.org/'), env);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Consent configuration unavailable' });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), '<p>Manifesto</p>');
  assert.equal(first.mock.callCount(), 1);
});

for (const available of [true, false]) {
  test(`HEAD configuration responses have no body when storage is ${available ? 'available' : 'unavailable'}`, async (t) => {
    const storage = database(t);
    if (available) storage.insert(config);

    const response = await worker.fetch(request('HEAD'), storage.env);

    assert.equal(response.status, available ? 200 : 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), '');
  });
}

test('the publisher rejects another site before issuing a database write', async () => {
  const query = mock.fn();

  await assert.rejects(publishConsentConfig({ ...config, siteId: 'another-site' }, query), /Configuration site mismatch/);

  assert.equal(query.mock.callCount(), 0);
});

for (const [name, acknowledgement] of [
  ['failed API envelope', { success: false, result: [{ success: true, meta: { changes: 1 } }] }],
  ['failed statement', { success: true, result: [{ success: false, meta: { changes: 1 } }] }],
]) {
  test(`the publisher never reports success for a ${name}`, async () => {
    await assert.rejects(publishConsentConfig(config, async () => acknowledgement), /Configuration was not published/);
  });
}
