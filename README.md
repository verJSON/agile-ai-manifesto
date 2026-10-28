# Agile AI Manifesto

The manifesto website for https://agileaimanifesto.org/.

Edit `public/index.html` and `public/styles.css`, then run `npm run build` to produce the deployable Cloudflare Worker. The build embeds the static site in one Worker, so no asset upload or separate origin is required. Deploy to the configured account and custom domain with `npx wrangler deploy` using an authorized Cloudflare account.

The manifesto describes principles for how agentic software development should work; verJSON is building toward them. The description of inter-agent and inter-tier schemas expresses an evolving direction rather than a claim that a complete protocol is deployed.
