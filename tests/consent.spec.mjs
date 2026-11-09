import { test, expect } from '@playwright/test';

function watchClarity(page) {
  const requests = [];
  page.on('request', (request) => {
    if (/^https:\/\/([\w-]+\.)?clarity\.ms\//.test(request.url())) requests.push(request.url());
  });
  return requests;
}

test('rejecting analytics keeps Clarity unloaded across reloads and edition navigation', async ({ page, context }) => {
  const requests = watchClarity(page);
  await page.goto('/');
  await page.getByRole('button', { name: /reject/i }).click();
  await expect(page.getByRole('button', { name: /reject/i })).toBeHidden();
  await page.reload();
  await page.goto('/editions/01/');
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
  expect(requests).toEqual([]);
  expect((await context.cookies()).filter(({ name }) => /^_cl(ck|sk)$/.test(name))).toEqual([]);
});

test('acceptance loads Clarity and withdrawal terminates the loaded runtime', async ({ page }) => {
  const requests = watchClarity(page);
  // Browser lifecycle test with an instrumented provider. Live verification uses Microsoft itself.
  await page.route('https://www.clarity.ms/tag/**', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.vendorLoaded = true; setInterval(() => fetch("https://www.clarity.ms/collect"), 50);',
  }));
  await page.route('https://www.clarity.ms/collect', (route) => route.fulfill({ body: 'ok', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /accept/i })).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: /accept/i }).click();
  await expect(page.getByRole('button', { name: /accept/i })).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.vendorLoaded)).toBe(true);
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /reject/i }).click()]);
  const afterReload = requests.length;
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
  expect(await page.evaluate(() => window.vendorLoaded)).toBeUndefined();
  expect(requests.length).toBe(afterReload);
});

test('configuration failure leaves the manifesto usable without tracking', async ({ page }) => {
  const requests = watchClarity(page);
  await page.route('**/api/consent-config', (route) => route.fulfill({ status: 503, json: { error: 'Consent configuration unavailable' } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /software.*team.*sport/i })).toBeVisible();
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await expect(page.getByText(/unavailable/i)).toBeVisible();
  expect(requests).toEqual([]);
});

test('an active tab stops its provider after a runtime configuration disable', async ({ page }) => {
  let enabled = true;
  await page.route('**/api/consent-config', (route) => route.fulfill({ json: {
    schemaVersion: 1, siteId: 'agile-ai-manifesto', revision: enabled ? 1 : 2,
    policyVersion: '2026-11-09', privacyUrl: '/privacy/', consentMaxAgeDays: 180,
    refreshIntervalMs: 1000, clarity: { enabled, projectId: 'z9fo05sbg6' },
  } }));
  await page.route('https://www.clarity.ms/tag/**', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.vendorLoaded = true;' }));
  await page.goto('/');
  await page.getByRole('button', { name: /accept/i }).click();
  await expect.poll(() => page.evaluate(() => window.vendorLoaded)).toBe(true);
  const reloaded = page.waitForEvent('load');
  enabled = false;
  await reloaded;
  await expect(page.getByRole('button', { name: /accept/i })).toBeHidden();
  expect(await page.evaluate(() => window.vendorLoaded)).toBeUndefined();
});
