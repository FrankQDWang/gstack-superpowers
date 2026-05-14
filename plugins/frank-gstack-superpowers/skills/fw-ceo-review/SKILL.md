---
name: fw-ceo-review
description: "Use after office-hours confirms direction to run gstack CEO-level scope, ambition, and premise review before planning."
manifest_hash: sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4
generated_from: workflow.manifest.yaml
---

# fw-ceo-review

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: ceo-review
- Owner: gstack
- Role: Core
- Primary system: gstack
- Contract: Run gstack plan-ceo-review only, then stop for user confirmation before fw-plan. Do not write implementation specs or plans inside this wrapper.

## Inputs

- User-confirmed office-hours direction, scope notes, and unresolved premise risks.

## Outputs

- CEO-level scope challenge, ambition and premise notes, and explicit user confirmation or block before fw-plan.

## Required References

- adapters/gstack/common-safety.md
  - Read: `../../references/adapters/gstack/common-safety.md`
- gstack/plan-ceo-review/SKILL.md
  - Read active materialization: `../../references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/plan-ceo-review/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- superpowers/brainstorming


## Policy Notes

- fw-ceo-review must not write specs or plans; stop for user confirmation before fw-plan.

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
  "wrapper": "fw-ceo-review",
  "stage": "ceo-review",
  "owner": "gstack",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [
    "superpowers/brainstorming"
  ],
  "policy_notes": [
    "fw-ceo-review must not write specs or plans; stop for user confirmation before fw-plan."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
