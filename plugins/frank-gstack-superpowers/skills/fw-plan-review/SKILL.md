---
name: fw-plan-review
description: "Use after fw-plan to run gstack plan-eng-review and conditional plan-design-review before build."
manifest_hash: sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4
generated_from: workflow.manifest.yaml
---

# fw-plan-review

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: plan-review
- Owner: gstack
- Role: Gate
- Primary system: gstack
- Contract: Run gstack plan-eng-review as the planning gate, use plan-design-review only for UI/UX-affecting plans, then stop before fw-build.

## Inputs

- Completed Superpowers spec, linked implementation plan, and relevant repo context.

## Outputs

- Plan review verdict, engineering risks, conditional design review notes, and explicit user confirmation or block before fw-build.

## Required References

- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/plan-eng-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/plan-eng-review/SKILL.md`

## Conditional References

- gstack/plan-design-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/plan-design-review/SKILL.md`

## Suppressed Routes

- None


## Policy Notes

- Common-safety applies to conditional gstack references before raw conditional material is read.
- fw-plan-review owns the gstack planning gate: run plan-eng-review, use plan-design-review only when UI/UX is affected, and stop for user confirmation before fw-build.

## Execution Rules

- Read this wrapper first, then read every required reference listed above before acting.
- Read conditional references only when the user request reaches that gate.
- Common-safety applies to conditional gstack references before raw conditional material is read.
- If an active upstream materialization is unavailable, report that the wrapper is blocked on upstream sync instead of guessing from installed skills.
- Treat installed skills as callable surfaces, not source-of-truth project documentation.
- Keep one execution owner for the current task.

## Workflow-Run JSON Output

Every run of this wrapper should be able to produce a machine-readable stage artifact with this shape:

```json
{
  "wrapper": "fw-plan-review",
  "stage": "plan-review",
  "owner": "gstack",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [],
  "policy_notes": [
    "Common-safety applies to conditional gstack references before raw conditional material is read.",
    "fw-plan-review owns the gstack planning gate: run plan-eng-review, use plan-design-review only when UI/UX is affected, and stop for user confirmation before fw-build."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
