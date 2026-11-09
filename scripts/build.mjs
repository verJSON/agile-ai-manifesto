import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { renderPages } from './site.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const css = read('public/styles.css');
const pages = renderPages({ template: read('public/index.html'), css, manifest: JSON.parse(read('editions/editions.json')), readContent: read });
pages['/privacy/'] = read('public/privacy.html').replace('/* SITE_STYLES */', css);
const assets = {
  '/consent.js': { body: await readFile(new URL(import.meta.resolve('@verjson/consent/browser')), 'utf8'), type: 'text/javascript; charset=utf-8' },
  '/consent-init.js': { body: read('public/consent-init.js'), type: 'text/javascript; charset=utf-8' },
};
await mkdir(new URL('.build/', root), { recursive: true });
await writeFile(new URL('.build/entry.mjs', root), `import { createWorker } from '../scripts/worker.mjs';
import { consentConfigSchema } from '@verjson/consent';
export default createWorker({pages: ${JSON.stringify(pages)}, assets: ${JSON.stringify(assets)}, parseConfig: (value) => consentConfigSchema.parse(value)});
`);
await build({ entryPoints: [new URL('.build/entry.mjs', root).pathname], outfile: new URL('.build/worker.mjs', root).pathname, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true });
