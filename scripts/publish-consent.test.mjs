import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publishConsentConfig } from './publish-consent.mjs';

const config = JSON.parse(readFileSync(new URL('../config/consent.json', import.meta.url), 'utf8'));

test('publishing validated configuration uses a monotonic, parameterized database write', async () => {
  const query = mock.fn(async () => ({ success: true, result: [{ success: true, meta: { changes: 1 } }] }));
  assert.equal(await publishConsentConfig(config, query), config.revision);
  const [statement] = query.mock.calls[0].arguments;
  assert.match(statement.sql, /WHERE \? > COALESCE/);
  assert.deepEqual(statement.params, [config.siteId, config.revision, JSON.stringify(config), config.revision, config.siteId]);
});

test('publishing rejects unsafe configuration before contacting the database', async () => {
  const query = mock.fn(async () => ({ success: true, result: [{ success: true, meta: { changes: 1 } }] }));
  await assert.rejects(publishConsentConfig({ ...config, privacyUrl: 'javascript:alert(1)' }, query), /Privacy URL|privacyUrl|HTTPS|safe/i);
  assert.equal(query.mock.callCount(), 0);
});

test('publishing refuses a stale revision instead of reporting success', async () => {
  await assert.rejects(publishConsentConfig(config, async () => ({ success: true, result: [{ success: true, meta: { changes: 0 } }] })), /revision greater/);
});
