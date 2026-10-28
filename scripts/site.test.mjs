import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build.mjs']);
const { default: worker } = await import('../.build/worker.mjs');

test('homepage serves the manifesto and versioned-contracts context', async () => {
  const response = await worker.fetch(new Request('https://agileaimanifesto.org/'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const html = await response.text();
  assert.match(html, /Verified customer outcomes/);
  assert.match(html, /Give agents meaningful autonomy/);
  assert.match(html, /Versioned JSON schemas/);
  assert.match(html, /an evolving direction/);
  assert.equal((html.match(/<article><span>\d\d \/ 12<\/span>/g) || []).length, 12);
  assert.doesNotMatch(html, /\/\* SITE_STYLES \*\//);
});

test('unknown paths and unsupported methods do not serve the page', async () => {
  assert.equal((await worker.fetch(new Request('https://agileaimanifesto.org/missing'))).status, 404);
  const response = await worker.fetch(new Request('https://agileaimanifesto.org/', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  const head = await worker.fetch(new Request('https://agileaimanifesto.org/', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
