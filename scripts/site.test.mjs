import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { renderPages } from './site.mjs';

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

const { editions } = JSON.parse(readFileSync(new URL('../editions/editions.json', import.meta.url), 'utf8'));
const currentEdition = editions.find((edition) => edition.status === 'current');

function editionLabel(markup) {
  const match = markup.match(/<p class="edition">([\s\S]*?)<\/p>/);
  assert.ok(match, 'the hero edition label is missing');
  return match[1];
}

function editionOptions(markup) {
  const select = editionLabel(markup).match(/<select\b[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, 'the hero edition label has no edition selector');
  return [...select[1].matchAll(/<option value="([^"]*)"( selected)?>([^<]*)<\/option>/g)]
    .map(([, target, selected, label]) => ({ target, selected: Boolean(selected), label }));
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

test('on every route each in-page anchor resolves to exactly one element and no id repeats', async () => {
  for (const path of ['/', ...editions.map((edition) => `/editions/${edition.number}/`)]) {
    const markup = await (await worker.fetch(new Request(`https://agileaimanifesto.org${path}`))).text();
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], `${path}: duplicate ids`);
    const targets = [...markup.matchAll(/\shref="#([^"]*)"/g)].map((match) => match[1]);
    assert.ok(targets.length > 0, `${path}: expected in-page anchors`);
    assert.deepEqual(targets.filter((target) => !ids.includes(target)), [], `${path}: anchors without a target`);
  }
});

test('the page carries the Edition 02 label and no Edition 01 label', () => {
  const controls = /<select\b[\s\S]*?<\/select>(<noscript>[\s\S]*?<\/noscript>)?/;
  assert.equal(editionLabel(page).replace(controls, '{selector}'), 'EDITION {selector} &nbsp;·&nbsp; 2026');
  assert.deepEqual(editionOptions(page).filter((option) => option.selected).map((option) => option.label), ['02']);
  assert.doesNotMatch(page, /EDITION 01/);
});

test('the hero edition selector lists editions newest first with the current edition selected', () => {
  const options = editionOptions(page);
  assert.deepEqual(options.map((option) => option.label), editions.map((edition) => edition.number).sort().reverse());
  assert.deepEqual(options.filter((option) => option.selected).map((option) => option.label), [currentEdition.number]);
});

test('each edition selector option opens a page carrying that edition\'s manifesto text', async () => {
  for (const option of editionOptions(page)) {
    const edition = editions.find((candidate) => candidate.number === option.label);
    const content = readFileSync(new URL(`../${edition.source}`, import.meta.url), 'utf8').trim();
    const response = await worker.fetch(new Request(`https://agileaimanifesto.org${option.target}`));
    assert.equal(response.status, 200, `${option.target} returned ${response.status}`);
    assert.ok((await response.text()).includes(content), `${option.target} does not carry Edition ${edition.number}'s text`);
  }
  const editionOne = await (await worker.fetch(new Request('https://agileaimanifesto.org/editions/01/'))).text();
  assertIncludes(textOf(editionOne), 'Versioned JSON schemas can give agents and system tiers a shared contract for intent, decisions, and evidence.');
});

test('archived editions tell the reader which edition is current and link to it; the current edition does not', async () => {
  const noticeOf = (markup) => markup.match(/<p class="edition-notice">([\s\S]*?)<\/p>/)?.[1];
  for (const edition of editions) {
    const notice = noticeOf(await (await worker.fetch(new Request(`https://agileaimanifesto.org/editions/${edition.number}/`))).text());
    if (edition === currentEdition) {
      assert.equal(notice, undefined, `the current edition's archive route shows an archive notice`);
      continue;
    }
    assert.ok(notice, `Edition ${edition.number} has no archive notice`);
    assert.equal(textOf(notice), `You are reading Edition ${edition.number}. The current edition is Edition ${currentEdition.number}.`);
    assert.match(notice, new RegExp(`<a href="/">Edition ${currentEdition.number}</a>`));
  }
  assert.equal(noticeOf(page), undefined, 'the current edition shows an archive notice');
});

test('archived editions are canonical at their own URL and the current edition is canonical at the root', async () => {
  const origin = 'https://agileaimanifesto.org';
  const routes = [['/', `${origin}/`], ...editions.map((edition) => [`/editions/${edition.number}/`,
    edition === currentEdition ? `${origin}/` : `${origin}/editions/${edition.number}/`])];
  for (const [path, canonical] of routes) {
    const [, head] = (await (await worker.fetch(new Request(`${origin}${path}`))).text()).match(/<head>([\s\S]*?)<\/head>/);
    assert.deepEqual([...head.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map((match) => match[1]), [canonical], `${path} canonical`);
  }
});

test('without JavaScript the hero label links to every edition the selector offers', () => {
  const fallback = editionLabel(page).match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(fallback, 'the hero edition label has no no-JavaScript fallback');
  const links = [...fallback[1].matchAll(/<a href="([^"]*)"( aria-current="page")?>([^<]*)<\/a>/g)]
    .map(([, target, current, label]) => ({ target, selected: Boolean(current), label }));
  assert.deepEqual(links, editionOptions(page));
});

test('the edition selector is a native select named "Manifesto edition"', () => {
  assert.match(editionLabel(page), /<select [^>]*\baria-label="Manifesto edition"[^>]*>/);
});

// Runs the page's inline body scripts against a minimal stand-in for the edition <select>,
// built from the page's own options, so browser behavior is testable without a DOM dependency.
function runPageScripts(markup) {
  const [, body] = markup.match(/<body>([\s\S]*?)<\/body>/);
  const scripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0, 'the page body has no inline script');
  const on = (listeners) => (type, listener) => { listeners[type] = listener; };
  const options = editionOptions(markup).map(({ target, selected }) => ({ value: target, selected, defaultSelected: selected }));
  const selectListeners = {};
  const select = {
    options,
    get value() { return options.find((option) => option.selected)?.value ?? ''; },
    set value(target) { for (const option of options) option.selected = option.value === target; },
    get selectedIndex() { return options.findIndex((option) => option.selected); },
    set selectedIndex(index) { options.forEach((option, position) => { option.selected = position === index; }); },
    addEventListener: on(selectListeners),
  };
  const visited = [];
  const windowListeners = {};
  const location = { assign: (target) => visited.push(target), set href(target) { visited.push(target); } };
  const document = { querySelector: () => select, querySelectorAll: () => [select], getElementById: () => select };
  const context = vm.createContext({ document, location, addEventListener: on(windowListeners) });
  context.window = context;
  for (const script of scripts) vm.runInContext(script, context);
  return { select, selectListeners, windowListeners, visited };
}

test('choosing an edition in the selector navigates to that edition', () => {
  const { select, selectListeners, visited } = runPageScripts(page);
  assert.equal(typeof selectListeners.change, 'function', 'no change listener is attached to the edition selector');
  select.value = '/editions/01/';
  selectListeners.change({ target: select, currentTarget: select });
  assert.deepEqual(visited, ['/editions/01/']);
});

test('returning to a page from history resets the selector to that page\'s edition', () => {
  const { select, windowListeners } = runPageScripts(page);
  select.value = '/editions/01/';
  assert.equal(typeof windowListeners.pageshow, 'function', 'nothing resets the selector when the page is shown again');
  windowListeners.pageshow({ persisted: true });
  assert.equal(select.value, '/');
});

test('edition routes that no manifest entry names return 404', async () => {
  for (const path of ['/editions/99/', '/editions/']) {
    assert.equal((await worker.fetch(new Request(`https://agileaimanifesto.org${path}`))).status, 404, path);
  }
});

test('the current edition\'s archive route serves the same page as the root', async () => {
  const archived = await (await worker.fetch(new Request(`https://agileaimanifesto.org/editions/${currentEdition.number}/`))).text();
  assert.ok(archived === page, `/editions/${currentEdition.number}/ differs from /`);
});

test('every edition route keeps the site head, differing only in its canonical link', async () => {
  const headOf = (markup) => markup.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<link rel="canonical" href="[^"]*">/, '');
  for (const edition of editions) {
    const markup = await (await worker.fetch(new Request(`https://agileaimanifesto.org/editions/${edition.number}/`))).text();
    assert.ok(headOf(markup) === headOf(page), `Edition ${edition.number}'s head differs from the site head`);
  }
});

test('the status note links its evidence sentence to the public decision summary', () => {
  const [, , , body] = page.match(/<(\w+) id="status"([^>]*)>([\s\S]*?)<\/\1>/);
  const links = [...body.matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, href, label]) => [href, textOf(label)]), [[
    'https://github.com/verJSON/agile-ai-manifesto/blob/main/docs/decisions/edition-02.md',
    "the repository owner's 2026-11-05 ratification of the architecture review of verJSON's own alignment with Edition 01",
  ]]);
});

test('the public decision summary exists and leaks no private repository names or gate details', () => {
  const summaryUrl = new URL('../docs/decisions/edition-02.md', import.meta.url);
  assert.ok(existsSync(summaryUrl), 'docs/decisions/edition-02.md is missing');
  const summary = readFileSync(summaryUrl, 'utf8');
  const slateDigests = [
    '5bbe6712ae657fbf214b6e3b38c18591db19bc64e8dfe99e2659b7e65f982bca',
    'cc07abf1b4ef4d29e28b07a4427910a59535738a0d41b2f83d23d52b8b286ea5',
  ];
  for (const digest of slateDigests) assertIncludes(summary, digest);
  const text = slateDigests.reduce((remaining, digest) => remaining.replaceAll(digest, ''), summary);
  const leaks = {
    'private repository name': [/verjson-[a-z]/i, /\.github\b/i],
    'gate detail': [/ruleset/i, /bypass/i, /suspended/i, /renovate/i, /integration\s*\d+/i, /organizationadmin/i, /branch protection/i,
      /\brequired\b[\w\s-]{0,40}\bchecks?\b[\w\s-]{0,20}\b(off|skipped|skips|no-op|bypass\w*)\b/i],
    'issue, pull request, or ADR number': [/#\d+/, /\b(ADR|PR|pull request|issue)\s*#?\d+/i],
    'commit SHA': [/\b[0-9a-f]{7,}\b/],
    'local path or host': [/\/home\//, /\/tmp\//, /scratchpad/i, /\bwsl\b/i],
    'CLI name or version': [/\b[\w-]+-cli\b/i, /\d+\.\d+\.\d+/],
    'session ID': [/\bsession [0-9a-f]{6,}/i],
    'ballot line': [/\b(ACCEPT|REVISE|REJECT)\b/],
    'source citation': [/\b[\w.-]+\.(md|py|json|cjs|mjs|html):\d+/i, /\bREADME:\d+/i],
  };
  for (const [kind, patterns] of Object.entries(leaks)) {
    for (const pattern of patterns) assert.doesNotMatch(text, pattern, `summary leaks a ${kind}`);
  }
});

test('the page loads the Microsoft Clarity tag for project z9fo05sbg6 once, in the head', () => {
  const [, head] = page.match(/<head>([\s\S]*?)<\/head>/);
  assertIncludes(head, '"https://www.clarity.ms/tag/"+i');
  assertIncludes(head, '(window, document, "clarity", "script", "z9fo05sbg6")');
  assert.equal(page.match(/clarity\.ms\/tag\//g)?.length, 1, 'expected exactly one Clarity tag');
});

const fixtureTemplate = '<head><!-- EDITION_CANONICAL --><style>/* SITE_STYLES */</style></head><main><!-- EDITION_NOTICE --><!-- EDITION_LABEL --><!-- EDITION_CONTENT --></main>';
const renderFixture = (entries) => renderPages({
  template: fixtureTemplate,
  css: '',
  manifest: { editions: entries },
  contents: Object.fromEntries(entries.map((entry) => [entry.number, `<p>Edition ${entry.number}</p>`])),
});

test('the build rejects a manifest without exactly one current edition', () => {
  assert.throws(() => renderFixture([
    { number: '02', year: 2026, source: 'editions/02.html', status: 'archived' },
    { number: '01', year: 2026, source: 'editions/01.html', status: 'archived' },
  ]), /exactly one current edition, found 0/);
  assert.throws(() => renderFixture([
    { number: '02', year: 2026, source: 'editions/02.html', status: 'current' },
    { number: '01', year: 2026, source: 'editions/01.html', status: 'current' },
  ]), /exactly one current edition, found 2/);
});

test('the build rejects a manifest that repeats an edition number', () => {
  assert.throws(() => renderFixture([
    { number: '01', year: 2026, source: 'editions/02.html', status: 'current' },
    { number: '01', year: 2026, source: 'editions/01.html', status: 'archived' },
  ]), /Edition 01 is listed more than once/);
});

test('the build rejects a malformed edition entry', () => {
  const current = { number: '02', year: 2026, source: 'editions/02.html', status: 'current' };
  const cases = [
    [{ number: '1', year: 2026, source: 'editions/01.html', status: 'archived' }, /number "1" must be two digits/],
    [{ number: '01', year: 2026, source: 'editions/01.html', status: 'retired' }, /Edition 01 has unknown status "retired"/],
    [{ number: '01', year: '2026', source: 'editions/01.html', status: 'archived' }, /Edition 01 year must be an integer/],
  ];
  for (const [entry, reason] of cases) assert.throws(() => renderFixture([current, entry]), reason);
});
