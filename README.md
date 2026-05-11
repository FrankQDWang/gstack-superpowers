# gstack-superpowers

A curated global Codex workflow plugin that combines gstack's product and
release judgment with Superpowers' implementation discipline, without exposing
both full upstream skill sets to Codex routing.

The plugin exposes a small `fw-*` surface and keeps upstream gstack and
Superpowers content as pinned reference material:

- `fw-intake`: product discovery, problem framing, and scope challenge.
- `fw-plan`: reviewed implementation planning and test strategy.
- `fw-build`: worktree, TDD, execution, and verification discipline.
- `fw-debug`: systematic debugging with root-cause investigation.
- `fw-review`: Superpowers plan compliance plus adapted gstack review, with
  native Codex review disabled.
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

This verification uses `codex debug prompt-input` and fails unless all six
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
- Native or generic Codex review is forbidden in v1.
- gstack review is used through an adapter that disables Codex review and
  release/deploy side effects.
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

The weekly automation should:

1. materialize candidate upstream commits,
2. build deterministic update evidence,
3. run an LLM assessment for conflicts and complements,
4. prepare a proposed promotion on a sync branch,
5. run tests, routing audit, eval, and diff report,
6. open or update a PR for human approval.

No automation should merge, deploy, release, or mutate protected branches. When
the source repo is updated, the global symlinked install sees the same plugin
contents without copying workflow files into individual project repositories.

## Upstream Attribution

This repository includes selected MIT-licensed reference material from:

- [garrytan/gstack](https://github.com/garrytan/gstack)
- [obra/superpowers](https://github.com/obra/superpowers)

See `NOTICE` for upstream license and copyright details.
