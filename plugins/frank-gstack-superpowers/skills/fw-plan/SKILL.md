---
name: fw-plan
description: "Use after CEO review confirms direction to write Superpowers spec and linked implementation plan."
manifest_hash: sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4
generated_from: workflow.manifest.yaml
---

# fw-plan

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: plan
- Owner: superpowers
- Role: Core
- Primary system: superpowers
- Contract: Use Superpowers writing-plans to produce or update the spec and linked implementation plan. Do not run gstack plan review or implementation inside this wrapper.

## Inputs

- Confirmed direction, scope boundaries, and enough constraints to write the spec and implementation plan.

## Outputs

- Superpowers spec in docs/superpowers/specs/ plus linked implementation plan in docs/superpowers/plans/, ready for fw-plan-review.

## Required References

- superpowers/skills/writing-plans/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/writing-plans/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- None


## Policy Notes

- fw-plan must produce or update both docs/superpowers/specs/YYYY-MM-DD-<slug>.md and docs/superpowers/plans/YYYY-MM-DD-<slug>.md; the plan must reference the spec.
- fw-plan must use Superpowers writing-plans only; do not run gstack plan-eng-review or plan-design-review inside fw-plan. Stop after the linked spec and plan are ready for fw-plan-review.

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
  "wrapper": "fw-plan",
  "stage": "plan",
  "owner": "superpowers",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [],
  "policy_notes": [
    "fw-plan must produce or update both docs/superpowers/specs/YYYY-MM-DD-<slug>.md and docs/superpowers/plans/YYYY-MM-DD-<slug>.md; the plan must reference the spec.",
    "fw-plan must use Superpowers writing-plans only; do not run gstack plan-eng-review or plan-design-review inside fw-plan. Stop after the linked spec and plan are ready for fw-plan-review."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
