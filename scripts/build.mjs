import { readFile, mkdir, writeFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const marker = '/* SITE_STYLES */';
if (!html.includes(marker) || html.indexOf(marker) !== html.lastIndexOf(marker)) {
  throw new Error('Expected exactly one style insertion marker');
}
const page = html.replace(marker, css);
const worker = `const page = ${JSON.stringify(page)};\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n    if (url.pathname !== '/') return new Response('Not found', { status: 404 });\n    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });\n    return new Response(request.method === 'HEAD' ? null : page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });\n  }\n};\n`;
await mkdir(new URL('../.build/', import.meta.url), { recursive: true });
await writeFile(new URL('../.build/worker.mjs', import.meta.url), worker);
