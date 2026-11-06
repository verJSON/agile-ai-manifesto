# Unreleased

- List every manifesto edition, newest first, as links under the hero label; with JavaScript on they collapse into a disclosure button showing the current edition. Serve each edition at `/editions/NN/` with its own title (Edition 01 as published at 3aa4ed3), redirect `/editions/NN` without a trailing slash there with a 308, and derive all of it from one manifest, `editions/editions.json`.

- Load the Microsoft Clarity tag (project `z9fo05sbg6`) in the page head to observe visitor sessions and activity.

- Label the site Edition 02 and link the status note's evidence to a public summary of the two Architecture Review Boards behind it (`docs/decisions/edition-02.md`).

- Apply the owner-ratified Edition 02 wording to the values, principles, Contracts section, and README, and add a dated verJSON status note (Architecture Review Board, ratified 2026-11-05).

- Restore the manifesto asterisk as the browser tab icon.

- Give specification ownership its own principle and number the manifesto from 1 through 13.

- Link the contracts section to the published verJSON articles on versioned contracts and audit evidence (#7).

- Restore the www hostname with a managed Cloudflare custom domain and an HTTPS canonical redirect that preserves paths and queries (#4).

- Ignore local Serena project configuration.

- Strengthen manifesto principles on evidence, specifications, delegated authority, and human accountability.


- Add a dependency-free local development server and startup instructions.

- Add an original diagram illustrating the relationship between intent, agents, and evidence.

- Launch the Agile AI Manifesto working draft, including the values, twelve principles, and a description of versioned contracts for agent communication and audit.
