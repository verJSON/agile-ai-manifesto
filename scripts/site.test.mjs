import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

execFileSync(process.execPath, ['scripts/build.mjs']);
const { default: worker } = await import('../.build/worker.mjs');
const page = await (await worker.fetch(new Request('https://agileaimanifesto.org/'))).text();

function textOf(markup) {
  return markup.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function principle(number) {
  const match = page.match(new RegExp(`<article><span>${String(number).padStart(2, '0')} / 13</span>([\\s\\S]*?)</article>`));
  assert.ok(match, `principle ${number} is missing from the page`);
  return textOf(match[1]);
}

function section(id) {
  const match = page.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`));
  assert.ok(match, `section #${id} is missing from the page`);
  return match[0];
}

function assertIncludes(text, expected) {
  assert.ok(text.includes(expected), `expected text to include:\n  ${expected}\nactual:\n  ${text}`);
}

function assertExcludes(text, unexpected) {
  assert.ok(!text.includes(unexpected), `expected text not to include:\n  ${unexpected}`);
}

test('homepage serves the manifesto and versioned-contracts context', async () => {
  const response = await worker.fetch(new Request('https://agileaimanifesto.org/'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const html = await response.text();
  assert.match(html, /Verified customer outcomes/);
  assert.match(html, /Give agents meaningful autonomy/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,[^"]*%E2%9C%B3/);
  assert.match(html, /https:\/\/verjson\.com\/blog\/versioned-contracts-for-agentic-systems/);
  assert.match(html, /https:\/\/verjson\.com\/blog\/audit-evidence-for-agentic-actions/);
  assert.deepEqual([...html.matchAll(/<article><span>(\d\d) \/ 13<\/span>/g)].map((match) => Number(match[1])), Array.from({ length: 13 }, (_, index) => index + 1));
  assert.match(html, /<h3>Own the specification\.<\/h3>/);
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

test('www redirects to the HTTPS apex without losing the path or query', async () => {
  for (const method of ['GET', 'HEAD', 'POST']) {
    for (const origin of ['http://www.agileaimanifesto.org', 'https://www.agileaimanifesto.org', 'http://www.agileaimanifesto.org:8080', 'https://www.agileaimanifesto.org:8443']) {
      const response = await worker.fetch(new Request(`${origin}/missing?next=https%3A%2F%2Fexample.com`, { method }));
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), 'https://agileaimanifesto.org/missing?next=https%3A%2F%2Fexample.com');
      assert.equal(await response.text(), '');
    }
  }
});

test('Principle 04 says what an exchanged contract carries and that status alone does not meet it (M-01)', () => {
  const text = principle(4);
  assertIncludes(text, 'Where systems exchange intent, decisions, or evidence, use versioned, machine-readable contracts that carry them and identify who produced them. A contract that carries only status is not a contract for intent, decisions, or evidence, and a free-text side record does not supply what the contract must carry.');
  assertExcludes(text, 'Use versioned, machine-readable contracts where systems exchange intent and evidence.');
});

test('Contracts section names the content, rejects the unknown, and separates well formed from true (M-02)', () => {
  const text = textOf(section('contracts'));
  assertIncludes(text, 'Versioned, machine-readable contracts give agents and system tiers a shared language for intent, decisions, evidence, and who produced them. Explicit versions make change visible, keep the meaning of past records, and support compatibility, audit and continuous improvement. A receiver rejects versions and kinds it does not recognize instead of guessing their meaning. A message that passes its schema is well formed, not true: free text can explain, but it never moves work into an approved or finished state, and a claim about who produced a message stays a claim until it is verified.');
  assertExcludes(text, 'Versioned JSON schemas can give agents');
});

test('Contracts section drops the undated progress hedge and says a direction does not lower the bar (M-03)', () => {
  const markup = section('contracts');
  const text = textOf(markup);
  assertIncludes(text, 'A direction does not lower the bar: a contract that carries only status is not yet a contract for intent, decisions, and evidence. Read more about versioned contracts and audit evidence.');
  assertIncludes(markup, '<a href="https://verjson.com/blog/versioned-contracts-for-agentic-systems">versioned contracts</a>');
  assertIncludes(markup, '<a href="https://verjson.com/blog/audit-evidence-for-agentic-actions">audit evidence</a>');
  assertExcludes(text, 'verJSON is building toward this approach');
  assertExcludes(text, 'an evolving direction');
});

test('a dated, owned status note set apart from the principles and Contracts body reports verJSON progress (M-03)', () => {
  const notes = [...page.matchAll(/<(\w+) id="status"[^>]*>([\s\S]*?)<\/\1>/g)];
  assert.equal(notes.length, 1, 'expected exactly one status note');
  assert.equal(textOf(notes[0][2]), "verJSON status, as of 2026-11-05. Owner: the repository owner. Reviewed every six months; if a review is missed, treat this note as unconfirmed. Defined: versioned agent-message contracts for leg results and a prose fallback. In force: none yet; they take effect only when their conformance checks pass and adoption is recorded. Demonstrated in operation: none yet. Not yet covered: contracts for intent, decisions, and evidence, and a complete inter-agent protocol. Evidence: the repository owner's 2026-11-05 ratification of the architecture review of verJSON's own alignment with Edition 01.");
  assertExcludes(section('contracts'), 'id="status"');
  assertExcludes(section('principles'), 'id="status"');
});

test('README points to the site status note and repeats that a direction does not lower the bar (M-04)', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const text = readme.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
  assertIncludes(text, 'The manifesto describes how agentic software development should work. verJSON reports its progress in one dated status note on the site, which separates what is defined, what is in force, what is demonstrated in operation and what is not yet covered, and links the evidence. Calling the contract approach a direction does not make a status-only contract into a contract for intent, decisions, and evidence.');
  assertIncludes(readme, '](https://agileaimanifesto.org/#status)');
  assertIncludes(page, ' id="status"');
  assertExcludes(text, 'verJSON is building toward them');
});

test('Principle 05 says what makes an identity distinct and authority scoped (M-05)', () => {
  assertIncludes(principle(5), 'Equip agents with context, tools, distinct identities, and scoped authority to investigate, implement, review, decide, and merge work within the policies that govern them. An identity is distinct when an issuer other than the agent binds the agent run to the person or system it acts for, records the model it runs on as verified or unverified, and others can check it. Authority is scoped when it is limited to named actions and enforced where the action happens. A session label, a commit trailer, or a prompt instruction does not establish identity, and a credential the agent can merely reach is not delegated authority, even if it works; limit what it can do where the action happens.');
});
