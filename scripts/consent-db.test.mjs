import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { publishConsentConfig } from './publish-consent.mjs';

// Integration check: exercise the exact migration and parameterized query on SQLite.
test('the configuration database preserves revisions and refuses stale publication', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(new URL('../migrations/0001_consent_config.sql', import.meta.url), 'utf8'));
    const config = JSON.parse(readFileSync(new URL('../config/consent.json', import.meta.url), 'utf8'));
    const query = async ({ sql, params }) => {
      const result = db.prepare(sql).run(...params);
      return { success: true, result: [{ success: true, meta: { changes: Number(result.changes) } }] };
    };
    await publishConsentConfig(config, query);
    const disabled = { ...config, revision: 2, clarity: { ...config.clarity, enabled: false } };
    await publishConsentConfig(disabled, query);
    await assert.rejects(publishConsentConfig(config, query), /revision greater/);
    const rows = db.prepare('SELECT config_json FROM consent_config_versions WHERE site_id = ? ORDER BY revision DESC').all(config.siteId);
    assert.deepEqual(rows.map(({ config_json }) => JSON.parse(config_json)), [disabled, config]);
  } finally {
    db.close();
  }
});
