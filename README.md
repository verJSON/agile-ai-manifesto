# Agile AI Manifesto

The manifesto website for https://agileaimanifesto.org/.

## Run locally

Install Node.js 24.22.2 or newer and run `npm ci`. The `@verjson` npm scope uses GitHub Packages; an authenticated package-read account is required to install the consent package. No Cloudflare login is needed for the local fixture server.

```sh
CONSENT_LOCAL_CONFIG=config/consent.json npm run dev
```

Open http://127.0.0.1:4173/ and stop the server with Ctrl+C. To use a different port, run `PORT=3000 npm run dev`. After editing a file, restart the command to rebuild the page. Run `npm test` for the local behavioral checks.

## Build and deploy

Edit the site's head and chrome in `public/index.html` and `public/styles.css`, and each edition's manifesto text in `editions/NN.html`, where `NN` is its number in `editions/editions.json`, then run `npm run build` to produce the deployable Cloudflare Worker. The build serves the current edition at `/` and every edition at `/editions/NN/`, all in the same chrome, and embeds every page in one Worker, so no asset upload or separate origin is required. To publish a new edition, add `editions/NN.html` and a manifest entry with its number, year, and status `current`, and mark the previous edition `archived`. Deploy to the configured account and custom domain with `npx wrangler deploy` using an authorized Cloudflare account.

The manifesto describes how agentic software development should work. verJSON reports its progress in one [dated status note](https://agileaimanifesto.org/#status) on the site, which separates what is defined, what is in force, what is demonstrated in operation and what is not yet covered, and links the evidence. Calling the contract approach a direction does not make a status-only contract into a contract for intent, decisions, and evidence.

## Hostnames

Both `agileaimanifesto.org` and `www.agileaimanifesto.org` are managed Worker custom domains in `wrangler.jsonc`. The www hostname redirects permanently (308) to the HTTPS apex, preserving the path, query, and request method. Cloudflare provisions DNS and TLS for each custom domain; a CNAME alone does not attach a hostname to the Worker.

After deploying, verify both HTTPS hostnames from outside Cloudflare. Check that www returns a redirect to the apex, the apex serves the expected page, and unknown paths still return 404. Local tests do not verify DNS or certificates.

## Consent and runtime configuration

[Issue #14](https://github.com/Verjson/agile-ai-manifesto/issues/14) tracks implementation and live acceptance. The shared [`@verjson/consent`](https://github.com/Verjson/verjson-consent) package owns validation, the accessible banner, preferences, and the Clarity lifecycle. The site owns its D1 database and public read-only `/api/consent-config` endpoint.

The owner selected **global explicit opt-in**. EEA, UK, Swiss, other, and unknown-region visitors all receive the same protection, so region detection is not an authorization boundary. No Clarity script loads until analytics is accepted; advertising consent is always denied. Withdrawing consent may reload the page to terminate the loaded vendor runtime. The privacy notice at `/privacy/` is linked from every page.

The Worker reads the latest D1 revision for every configuration request and responds with `Cache-Control: no-store`. The browser revalidates within 60 seconds while its JavaScript is running and on foregrounding. Suspended/background tabs can be throttled by the browser; this is not an instantaneous global kill switch. Invalid or unavailable configuration disables optional tracking while pages remain usable. Changes to provider code still require a package release and deployment.

Apply the additive migration to the configured D1 binding before deployment:

```sh
npx wrangler d1 migrations apply CONSENT_DB --remote
```

To update settings, copy `config/consent.json`, set a revision greater than the current database revision, and run:

```sh
npm run consent:publish -- /path/to/revised-consent.json
```

The operator supplies `CLOUDFLARE_API_TOKEN` with D1 write access through the environment. The command validates using the package schema and performs a parameterized, monotonic insert; it does not deploy the Worker. There is no public write endpoint. An operator with the connected Cloudflare API can submit the same validated JSON through the parameterized D1 query API. Do not embed a token in source, arguments, or configuration.

Set `clarity.enabled` to `false` to disable tracking. To roll back a configuration, append its previous settings with a new higher revision; retain existing records for audit. Bump `policyVersion` when purposes or disclosures materially change. A different Clarity project also requires fresh consent. Changes to executable scripts or arbitrary script URLs are not supported configuration.

For local work, `CONSENT_LOCAL_CONFIG` explicitly selects a JSON fixture that the dev server rereads on each request. Without that fixture or a D1 binding, the endpoint returns 503 and analytics stays off. The fixture is never a production fallback. Use `npx wrangler dev` for local Worker/D1 runtime testing, and `npx wrangler d1 migrations apply CONSENT_DB --local` to prepare its isolated local database.

## Verification

Run `npm test` for the built Worker and configuration publication tests. Run `npx playwright install chromium` once, then `npm run test:e2e` for repeatable browser tests. Those tests intercept Microsoft requests; they prove the browser integration and lifecycle without sending test interactions to Microsoft.

After deployment, use a fresh real browser to verify no Clarity network requests or cookies before acceptance, rejection across reloads, acceptance loading the actual Microsoft tag, and withdrawal stopping future collection. Inspect desktop/mobile layouts and browser errors. Check the privacy notice and edition routes, the www-to-apex 308, and unknown-path 404. Record the actual egress region; simulated country metadata is not EU/UK live egress evidence.

To prove restart-free configuration, capture the Worker deployment ID and current configuration revision, append a disabled revision to D1, observe the public endpoint and an already open accepting tab, then restore via another higher revision. Confirm the Worker deployment ID did not change. Keep issue #14 open until package release, site deployment, provider behavior and live evidence are complete.

Configure the `@verjson` registry in your user-level npm configuration, not a repository `.npmrc`: the canonical secretless workflow rejects repository-controlled npm configuration and supplies its own isolated settings.
