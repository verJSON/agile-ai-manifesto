import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { renderPages } from './site.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const pages = renderPages({ template: read('public/index.html'), css: read('public/styles.css'), manifest: JSON.parse(read('editions/editions.json')), readContent: read });
const worker = `const pages = ${JSON.stringify(pages)};\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n    if (url.hostname === 'www.agileaimanifesto.org') {\n      url.protocol = 'https:';\n      url.host = 'agileaimanifesto.org';\n      url.port = '';\n      return Response.redirect(url.href, 308);\n    }\n    if (!Object.hasOwn(pages, url.pathname)) return new Response('Not found', { status: 404 });\n    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });\n    return new Response(request.method === 'HEAD' ? null : pages[url.pathname], { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });\n  }\n};\n`;
await mkdir(new URL('.build/', root), { recursive: true });
await writeFile(new URL('.build/worker.mjs', root), worker);
