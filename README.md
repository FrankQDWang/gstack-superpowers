# gstack-superpowers

A curated global Codex workflow plugin that combines gstack's product and
release judgment with Superpowers' implementation discipline, without exposing
both full upstream skill sets to Codex routing.

The plugin exposes a small `fw-*` surface and keeps upstream gstack and
Superpowers content as pinned reference material:

- `fw-office-hours`: product discovery, problem framing, and demand reality.
- `fw-ceo-review`: CEO-level scope, ambition, and premise challenge.
- `fw-plan`: Superpowers spec plus linked implementation plan.
- `fw-plan-review`: gstack plan engineering review and conditional design review.
- `fw-build`: worktree, TDD, execution, and verification discipline.
- `fw-debug`: systematic debugging with root-cause investigation.
- `fw-review`: Superpowers review discipline plus raw gstack review, with
  standalone/native Codex review suppressed outside that gstack-managed gate.
- `fw-ship-lite`: branch finish, documentation, and release readiness report.

## Repository Layout

- `scripts/global-install.mjs`: installs this plugin into the user's global
  Codex plugin marketplace so every project can use it.
- `plugins/frank-gstack-superpowers/.codex-plugin/plugin.json`: Codex plugin
  metadata.
- `plugins/frank-gstack-superpowers/workflow.manifest.yaml`: source of truth for
  wrapper routing, upstream skill mapping, visibility, and policy.
- `plugins/frank-gstack-superpowers/references/adapters/`: curated adapters that
  neutralize conflicting upstream behavior.
- `plugins/frank-gstack-superpowers/references/upstreams/`: pinned upstream
  reference material from gstack and Superpowers.
- `plugins/frank-gstack-superpowers/skills/`: generated exported Codex wrapper
  skills.
- `plugins/frank-gstack-superpowers/scripts/`: deterministic sync, generation,
  audit, eval, report, and LLM-assessment tooling.

## Global Installation

This repository is the source of truth, but the runtime install is global. The
installer symlinks the plugin to:

```text
~/plugins/frank-gstack-superpowers
```

and registers it in:

```text
~/.agents/plugins/marketplace.json
```

Install or refresh the global plugin:

```bash
npm run install:global
```

Verify that all projects can see the same global plugin registration:

```bash
npm run verify:global
```

Reduce the active Codex skill surface to the curated workflow:

```bash
npm run activate:curated
```

This moves raw `gstack*` entries out of `~/.codex/skills`, disables the
Superpowers Codex plugin manifest and raw `~/.codex/superpowers/skills`
directory, registers `frankqdwang-local` in `~/.codex/config.toml`,
materializes the plugin under `~/.codex/plugins/cache/`, and explicitly
enables `frank-gstack-superpowers@frankqdwang-local`.

Verify that the raw upstream surface is hidden:

```bash
npm run verify:surface
```

This verification uses `codex debug prompt-input` and fails unless all eight
`frank-gstack-superpowers:fw-*` skills are visible and raw gstack/Superpowers
skills are absent from the next-session prompt surface.

Restore the original raw gstack/Superpowers surface:

```bash
npm run restore:raw
```

Remove the global registration:

```bash
npm run uninstall:global
```

## Safety Model

- Raw upstream skills are treated as untrusted reference text.
- Only generated `fw-*` wrapper skills are exposed to Codex routing.
- The global curated mode hides raw gstack and Superpowers from Codex's active
  skill/plugin surface while preserving their source files for update sync.
- Standalone/native Codex review is forbidden as an independent review owner.
- Raw gstack review is used inside `fw-review`; it is not exported as a direct
  route.
- `fw-ship-lite` reports readiness only; it does not merge, push to protected
  branches, deploy, release, or canary by default.
- Weekly upstream updates require deterministic evidence plus an LLM assessment
  before promotion is proposed.

## Development

Install dependencies in this source repo:

```bash
npm install
```

Regenerate wrappers from the manifest:

```bash
npm run generate
```

Run the local verification suite:

```bash
npm test
npm run audit:routing
npm run eval:routing
```

Build update evidence and a review report:

```bash
npm run sync:upstreams -- --candidate
npm run evidence:update
npm run llm:assess-updates
npm run diff:report
```

Promotion is a separate, explicit step:

```bash
npm run sync:upstreams -- --promote-candidate
npm run generate
npm test
npm run audit:routing
npm run eval:routing
```

## Automation

The intended recurring workflow is documented in
`plugins/frank-gstack-superpowers/automation/weekly-upstream-sync.md`.

The networked weekly runner is installed as a macOS LaunchAgent, not as a Codex
App cron automation. Codex App automation sessions can be network-restricted,
while this workflow must call GitHub during candidate upstream resolution. The
local runner keeps Codex as the review and collaboration surface while moving
the networked execution into the user's normal macOS environment.

Run or inspect the local runner:

```bash
scripts/weekly-upstream-sync-runner.sh --report
scripts/weekly-upstream-sync-runner.sh --apply
launchctl print gui/$(id -u)/com.frankqdwang.weekly-curated-workflow-upstream-sync
```

The runner writes logs and summaries to:

```text
~/.codex/automations/weekly-curated-workflow-upstream-sync/
```

The weekly automation should:

1. materialize candidate upstream commits,
2. build deterministic update evidence,
3. run an LLM assessment for conflicts and complements,
4. write a concise Chinese `Brief` into `~/.codex/automations/weekly-curated-workflow-upstream-sync/last-run-summary.md`,
5. stop for human approval.

The Codex cron automation reads that brief and replies directly in the thread.
It should not create a separate report file or inline raw evidence. The brief
should answer, in plain terms: what changed in `gstack` and `superpowers`, how
the curated `fw-*` wrappers should change, and what decision is needed from the
user.

The runner also prunes old local automation state: logs older than 30 days,
stale generated report files from older versions, and old local report branches
beyond the most recent 8.

After approval, run `scripts/weekly-upstream-sync-runner.sh --apply`. Apply mode
re-runs the evidence path, promotes only when the LLM assessment allows it,
regenerates wrappers, runs tests, routing audit, eval, and diff report, then
fast-forwards local `main` so the curated workflow is immediately usable from
the local source repo and global symlinked install.

Push, PR creation, merge, deploy, release, and canary are separate explicit
gates. The weekly runner must not perform them as part of report or apply. When
the source repo is updated locally, the global symlinked install sees the same
plugin contents without copying workflow files into individual project
repositories.

## Upstream Attribution

This repository includes selected MIT-licensed reference material from:

- [garrytan/gstack](https://github.com/garrytan/gstack)
- [obra/superpowers](https://github.com/obra/superpowers)

See `NOTICE` for upstream license and copyright details.
