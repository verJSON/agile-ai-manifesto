# Edition 02: Architecture Review Board summary

This is the public summary of two reviews behind Edition 02 of the Agile AI Manifesto and the verJSON status note on the site. The repository owner ratified both on 2026-11-05.

## What an Architecture Review Board is here

An Architecture Review Board is an advisory review carried out by independent AI model reviewers.

- Each member first reviews the same sources independently.
- The candidate changes are then gathered into one common slate. The slate is identified by its SHA-256 digest, so every member votes on exactly the same text.
- A candidate converges only when every member that completed the round accepts it. At least two members must have verified model identities. A member whose model identity is unverified may vote and block, but does not count toward that minimum.
- The board has at most three rounds. A candidate still unresolved at the limit is published with its dissent and the options for the decision owner, rather than being forced to consensus.
- Model consensus is advisory. A human decision owner ratifies the outcome, and that ratification is the decision.

Model identities were verified from the run metadata each tool recorded. That is an observation, not a cryptographic attestation. One member ran the same model as the board's chair, who did not vote, so readers should weigh that shared-model risk.

## Board 1: verJSON's alignment with Edition 01

- **Question:** how well verJSON's own agent-message contracts, agent identity, and treatment of humans and agents as peers align with Edition 01 of the manifesto, and what bounded changes verJSON should make in each area.
- **Members:** claude-opus-5-5 (verified), grok-4.7-high (verified), gemini-4-argon-trial (verified), and Codex (model unverified).
- **Decision rule:** unanimous acceptance per candidate among the members that completed the round, with at least two identity-verified members, and at most three rounds.
- **Outcome:** 7 of 11 candidates converged. The other 4 were unresolved at the round limit and were ratified with the dissenting member's narrower wording.
- **Final slate digest (SHA-256):** `5bbe6712ae657fbf214b6e3b38c18591db19bc64e8dfe99e2659b7e65f982bca`
- **Ratification:** by the repository owner on 2026-11-05.

### What it found, as reflected in the status note

- **Defined, not yet in force:** verJSON's version 1 agent-message contracts are defined. They are versioned, closed, and reject versions and kinds they do not recognize. They do not take effect until their conformance checks pass and their adoption is recorded.
- **Not yet demonstrated:** they are not yet demonstrated in operation. The board's own deliberation did not use them.
- **Not yet covered:** the version 1 contracts carry the delivery state of a unit of work, not intent, decisions, or evidence.
- **Agent identity:** distinct, issuer-verified agent identity, with authority scoped to it, is not yet operating. The target identity design aligns with the manifesto at the design level only.
- **Attestations:** the version 1 contracts identify a message's producer only as an unauthenticated claim. Signed message attestations remain future work and depend on issuer-verified agent identity.
- **Humans and agents as peers:** review-authority and independence practices were assessed, and improvements were ratified.

## Board 2: changes to the manifesto for Edition 02

- **Question:** what changes the manifesto itself, Edition 01, needs for a next edition, so that its principles are internally consistent, testable, and informed by what verJSON learned while trying to live by Edition 01. Board 1's ratified findings were inputs, not candidates.
- **Members:** claude-opus-5-5 (verified), grok-4.7-high (verified), gemini-4-argon-trial (verified), and Codex (model unverified).
- **Decision rule:** unanimous acceptance per candidate among the members that completed the round, with at least two identity-verified members, and at most three rounds.
- **Outcome:** 12 of 13 candidates converged. M-10 was unresolved at the round limit and was ratified with the dissenting member's added clause.
- **Final slate digest (SHA-256):** `cc07abf1b4ef4d29e28b07a4427910a59535738a0d41b2f83d23d52b8b286ea5`
- **Ratification:** by the repository owner on 2026-11-05.

### Ratified changes

| Change | Target | Gist |
| --- | --- | --- |
| M-01 | Principle 04 | An exchanged contract carries intent, decisions, evidence, and who produced them; a status-only contract or a free-text side record does not meet that. |
| M-02 | Contracts section | A receiver rejects versions and kinds it does not recognize; a schema-valid message is well formed, not true; free text never moves work into an approved or finished state. |
| M-03 | Contracts section and status note | The undated progress statement is replaced by "a direction does not lower the bar", and verJSON's progress moves to a dated, owned status note that is reviewed every six months. |
| M-04 | README | The README points to the one dated status note and uses its four levels: defined, in force, demonstrated, and not yet covered. |
| M-05 | Principle 05 | An identity is distinct when an issuer other than the agent binds it and others can check it; authority is scoped to named actions and enforced where they happen. |
| M-06 | Principle 09 | Attestations come from an issuer the relying party trusts independently of the message; a signature is not permission or proof of outcome; self-reports are claims. |
| M-07 | Principle 09 | The named human owner decides a known recommendation before it takes effect; agreeing in advance is delegation, not ownership. |
| M-08 | Principle 07 | Defines routine and high-consequence work and who may clear each; uncertain work is treated as high-consequence. |
| M-09 | Values note | Where collaboration and human ownership pull apart, consequence and reversibility decide; a high-consequence decision keeps its named human owner. |
| M-10 | Principle 06 | Only the reviewer, or someone independent of the author, may downgrade or dismiss a blocking finding; independence is shown by evidence. |
| M-11 | Principle 06 | A required check that did not run has not passed; a change to a check gets at least the scrutiny of the work it guards. |
| M-12 | Principle 13 | Material dissent stays on the record; non-convergence goes to the accountable owner; silence or a time limit is not agreement. |
| M-13 | Principle 12 | Judge the whole outcome against stated goals and a baseline; a token saving counts only when a recorded comparison shows an improvement. |

M-10's ratified wording adds the dissenting member's clause ", and the person the author acts for is not independent of the author", so the person an author acts for cannot dismiss a blocking finding on the author's behalf.

## Full records

The full decision records, including member ballots, cited source lines, and process details, include non-public material and are held by verJSON.
