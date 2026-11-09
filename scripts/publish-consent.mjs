import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { consentConfigSchema } from '@verjson/consent';

export async function publishConsentConfig(value, query) {
  const config = consentConfigSchema.parse(value);
  if (config.siteId !== 'agile-ai-manifesto') throw new Error('Configuration site mismatch');
  const result = await query({
    sql: 'INSERT INTO consent_config_versions (site_id, revision, config_json) SELECT ?, ?, ? WHERE ? > COALESCE((SELECT MAX(revision) FROM consent_config_versions WHERE site_id = ?), 0)',
    params: [config.siteId, config.revision, JSON.stringify(config), config.revision, config.siteId],
  });
  if (!result.success || !result.result?.[0]?.success || result.result[0].meta?.changes !== 1) {
    throw new Error('Configuration was not published; use a revision greater than the current database revision');
  }
  return config.revision;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run consent:publish -- path/to/config.json');
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN with D1 write access is required');
  const config = JSON.parse(await readFile(file, 'utf8'));
  const revision = await publishConsentConfig(config, async (body) => {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts/530e6463bf124047787278c97269c32e/d1/database/7c5e7c3d-70f8-484d-a854-28c6ac6c026a/query', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Configuration publish request failed with HTTP ${response.status}`);
    return response.json();
  });
  console.log(`Published consent configuration revision ${revision}; no Worker deployment performed.`);
}
