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

test('homepage serves the manifesto', async () => {
  const response = await worker.fetch(new Request('https://agileaimanifesto.org/'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const html = await response.text();
  assert.match(html, /Verified customer outcomes/);
  assert.match(html, /Give agents meaningful autonomy/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,[^"]*%E2%9C%B3/);
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
  const notes = [...page.matchAll(/<(\w+) id="status"([^>]*)>([\s\S]*?)<\/\1>/g)];
  assert.equal(notes.length, 1, 'expected exactly one status note');
  const [, element, attributes, body] = notes[0];
  assert.equal(element, 'section', 'the status note must be a named region inside main, not a complementary landmark');
  assert.match(attributes, /\saria-label="verJSON status note"/);
  assert.equal(textOf(body), "verJSON status, as of 2026-11-05. Owner: the repository owner. Reviewed every six months; if a review is missed, treat this note as unconfirmed. Defined: versioned agent-message contracts for leg results and a prose fallback. In force: none yet; they take effect only when their conformance checks pass and adoption is recorded. Demonstrated in operation: none yet. Not yet covered: contracts for intent, decisions, and evidence, and a complete inter-agent protocol. Evidence: the repository owner's 2026-11-05 ratification of the architecture review of verJSON's own alignment with Edition 01.");
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

test('Principle 09 says who vouches for an attestation and that a self-report is a claim (M-06)', () => {
  const text = principle(9);
  assertIncludes(text, 'Make claims about identity, authority, provenance, and outcomes verifiable with signed attestations from an issuer that whoever relies on them trusts independently of the message. A signature shows who vouched for a claim, not that the action was permitted or that the outcome happened. Check a new action against current authority, a past action against the authority that applied when it was taken, and an outcome against evidence. What an actor, or the tooling that runs it, reports about itself, including a reviewing model\'s name, is a claim, not an attestation. Record what cannot be verified as unverified, keeping what was observed.');
  assertExcludes(text, 'Use signed attestations to make claims');
});

test('Principle 09 says the named human owner decides the known recommendation before it takes effect (M-07)', () => {
  assertIncludes(principle(9), 'High-consequence decisions must have a named human owner, who accepts, rejects, or returns the specific recommendation once it is known and before it takes effect. Agreeing in advance to follow a recommendation is delegation, not ownership of the decision.');
});

test('Principle 07 defines routine and high-consequence work and who may clear each (M-08)', () => {
  assertIncludes(principle(7), 'Replace routine approval queues with evidence-driven evaluation. The consequences and reversibility of a change determine the scrutiny it receives and who may clear it; some evidence takes time to obtain. Routine work is reversible, and evidence shows its failure is bounded and cheap to detect and undo; an independent reviewer, human or agent, can clear it. Work is high-consequence when it is hard to reverse, when security, legal, or customer harm could occur before it can be detected and undone, or when it widens who may act or weakens or removes a required check; its named human owner decides it. Passing checks do not by themselves make work routine. When the class is uncertain, treat the work as high-consequence.');
});

test('values note says consequence and reversibility decide between collaboration and human ownership (M-09)', () => {
  assertIncludes(textOf(section('values')), 'That is, while there is value in the items on the right, we value the items on the left more. Where autonomous collaboration and human ownership pull apart, consequence and reversibility decide: preferring collaboration to approval queues never removes the named human owner a high-consequence decision requires.');
});

test('Principle 06 keeps blocking findings out of the author\'s hands and requires evidenced independence (M-10)', () => {
  assertIncludes(principle(6), 'No author, human or agent, is the final judge of their own work. A finding is blocking when its reviewer says so, and only the reviewer or someone independent of the author may downgrade or dismiss it; the author may dismiss a non-blocking comment with a stated reason. Independence is shown by evidence, not by a different name: a reviewer acting for the same person as the author is not independent of the author, and the person the author acts for is not independent of the author, separate sessions alone do not show independence or model diversity, shared-model risk is disclosed, and a reviewer whose identity cannot be checked is recorded as unverified.');
});

test('Principle 06 says a required check that did not run has not passed and guards changes to checks (M-11)', () => {
  assertIncludes(principle(6), 'Evaluate the checks as rigorously as the results: people and agents optimize for what you measure. A required check that did not run, or produced no verifiable result of its evaluation, has not passed; hold the work it guards and escalate. A check that does not apply to the work is not required for it, does not hold it, and is never counted as evidence about the work. Any change to a check gets at least the scrutiny of the work it guards; weakening a check, or widening who may bypass it, is high-consequence.');
});

test('Principle 13 keeps dissent on record and sends non-convergence to the accountable owner (M-12)', () => {
  assertIncludes(principle(13), 'People and agents must be able to surface concerns and challenge assumptions. Keep material dissent, and how it was resolved, in the record. When evaluators do not converge, give the disagreement and the options to the accountable owner instead of averaging it away. A time limit, a missing vote, silence, or agreement among evaluators is not by itself proof of correctness, nor a grant of authority. A recorded dissent is a right to be heard, not by itself a veto.');
});

test('Principle 12 judges against a baseline and counts token savings only on a recorded improvement (M-13)', () => {
  const text = principle(12);
  assertIncludes(text, 'Judge the whole outcome against stated goals and a baseline: customer value, quality, latency, operating cost, compute, and the capacity to evaluate and maintain the work. Token efficiency is a means, not a goal. A saving counts only when a recorded comparison shows it improves that whole outcome, for example the same quality at lower cost; an inconclusive comparison is recorded as inconclusive, not as an improvement. A saving never counts when it weakens required verification, traceability, or quality.');
  assert.doesNotMatch(text, /\b[A-Z]{2,}\b/, 'Principle 12 must carry no all-caps emphasis');
});

test('every in-page anchor resolves to exactly one element and no id repeats', () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], 'duplicate ids');
  const targets = [...page.matchAll(/\shref="#([^"]*)"/g)].map((match) => match[1]);
  assert.ok(targets.length > 0, 'expected in-page anchors');
  assert.deepEqual(targets.filter((target) => !ids.includes(target)), [], 'anchors without a target');
});

test('the page carries the Edition 02 label and no Edition 01 label', () => {
  assertIncludes(page, '<p class="edition">EDITION 02 &nbsp;·&nbsp; 2026</p>');
  assert.doesNotMatch(page, /EDITION 01/);
});

test('the status note links its evidence sentence to the public decision summary', () => {
  const [, , , body] = page.match(/<(\w+) id="status"([^>]*)>([\s\S]*?)<\/\1>/);
  const links = [...body.matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, href, label]) => [href, textOf(label)]), [[
    'https://github.com/verJSON/agile-ai-manifesto/blob/main/docs/decisions/edition-02.md',
    "the repository owner's 2026-11-05 ratification of the architecture review of verJSON's own alignment with Edition 01",
  ]]);
});
