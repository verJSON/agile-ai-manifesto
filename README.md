# Agile AI Manifesto

The manifesto website for https://agileaimanifesto.org/.

## Run locally

Install Node.js 24 or newer. No dependencies or Cloudflare login are needed to run the site locally.

```sh
npm run dev
```

Open http://127.0.0.1:4173/ and stop the server with Ctrl+C. To use a different port, run `PORT=3000 npm run dev`. After editing a file, restart the command to rebuild the page. Run `npm test` for the local behavioral checks.

## Build and deploy

Edit `public/index.html` and `public/styles.css`, then run `npm run build` to produce the deployable Cloudflare Worker. The build embeds the static site in one Worker, so no asset upload or separate origin is required. Deploy to the configured account and custom domain with `npx wrangler deploy` using an authorized Cloudflare account.

The manifesto describes principles for how agentic software development should work; verJSON is building toward them. The description of inter-agent and inter-tier schemas expresses an evolving direction rather than a claim that a complete protocol is deployed.
