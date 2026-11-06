# Agile AI Manifesto

The manifesto website for https://agileaimanifesto.org/.

## Run locally

Install Node.js 24 or newer. No dependencies or Cloudflare login are needed to run the site locally.

```sh
npm run dev
```

Open http://127.0.0.1:4173/ and stop the server with Ctrl+C. To use a different port, run `PORT=3000 npm run dev`. After editing a file, restart the command to rebuild the page. Run `npm test` for the local behavioral checks.

## Build and deploy

Edit the site's head and chrome in `public/index.html` and `public/styles.css`, and each edition's manifesto text in `editions/NN.html`, where `NN` is its number in `editions/editions.json`, then run `npm run build` to produce the deployable Cloudflare Worker. The build serves the current edition at `/` and every edition at `/editions/NN/`, all in the same chrome, and embeds every page in one Worker, so no asset upload or separate origin is required. To publish a new edition, add `editions/NN.html` and a manifest entry with its number, year, and status `current`, and mark the previous edition `archived`. Deploy to the configured account and custom domain with `npx wrangler deploy` using an authorized Cloudflare account.

The manifesto describes how agentic software development should work. verJSON reports its progress in one [dated status note](https://agileaimanifesto.org/#status) on the site, which separates what is defined, what is in force, what is demonstrated in operation and what is not yet covered, and links the evidence. Calling the contract approach a direction does not make a status-only contract into a contract for intent, decisions, and evidence.

## Hostnames

Both `agileaimanifesto.org` and `www.agileaimanifesto.org` are managed Worker custom domains in `wrangler.jsonc`. The www hostname redirects permanently (308) to the HTTPS apex, preserving the path, query, and request method. Cloudflare provisions DNS and TLS for each custom domain; a CNAME alone does not attach a hostname to the Worker.

After deploying, verify both HTTPS hostnames from outside Cloudflare. Check that www returns a redirect to the apex, the apex serves the expected page, and unknown paths still return 404. Local tests do not verify DNS or certificates.
