---
name: fw-build
description: "Use for approved implementation with Superpowers worktrees, TDD, execution plans, subagents, and verification."
manifest_hash: sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02
generated_from: workflow.manifest.yaml
---

# fw-build

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: build
- Owner: superpowers
- Role: Core
- Primary system: superpowers
- Contract: Execute implementation discipline with worktree, TDD, plan execution, and verification practices.

## Inputs

- Approved implementation plan that links to its spec, repository context, and verification expectations.

## Outputs

- Scoped code changes, tests, verification evidence, and remaining risks.

## Required References

- superpowers/skills/using-git-worktrees/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/using-git-worktrees/SKILL.md`
- superpowers/skills/test-driven-development/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/test-driven-development/SKILL.md`
- superpowers/skills/executing-plans/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/executing-plans/SKILL.md`
- adapters/superpowers/orchestration-boundary.md
  - Read: `references/adapters/superpowers/orchestration-boundary.md`
- superpowers/skills/subagent-driven-development/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/subagent-driven-development/SKILL.md`
- superpowers/skills/verification-before-completion/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/verification-before-completion/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- None


## Policy Notes

- Superpowers subagent-driven instructions define implementation discipline only; Codex host policy controls whether agents can be spawned.
- fw-build consumes the approved plan and uses its linked spec as the scope-compliance source.

## Execution Rules

- Read this wrapper first, then read every required reference listed above before acting.
- Read conditional references only when the user request reaches that gate.
- If an active upstream materialization is unavailable, report that the wrapper is blocked on upstream sync instead of guessing from installed skills.
- Treat installed skills as callable surfaces, not source-of-truth project documentation.
- Keep one execution owner for the current task.

## Workflow-Run JSON Output

Every run of this wrapper should be able to produce a machine-readable stage artifact with this shape:

```json
{
  "wrapper": "fw-build",
  "stage": "build",
  "owner": "superpowers",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [],
  "policy_notes": [
    "Superpowers subagent-driven instructions define implementation discipline only; Codex host policy controls whether agents can be spawned.",
    "fw-build consumes the approved plan and uses its linked spec as the scope-compliance source."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
