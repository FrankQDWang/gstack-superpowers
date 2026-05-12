---
name: fw-plan
description: "Use after gstack direction is confirmed to write a Superpowers-consumable spec and implementation plan."
manifest_hash: sha256:8ca6f6b7e2228fa56a568272dd938e509f307dd97e40b959ca903bd93bded35a
generated_from: workflow.manifest.yaml
---

# fw-plan

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: plan
- Owner: superpowers
- Role: Core
- Primary system: superpowers
- Contract: Write and harden the spec and implementation plan. Do not execute implementation.

## Inputs

- Confirmed direction, scope boundaries, and enough constraints to write the spec and implementation plan.

## Outputs

- Superpowers-consumable spec in docs/superpowers/specs/ plus linked implementation plan in docs/superpowers/plans/, with engineering and design review notes.

## Required References

- superpowers/skills/writing-plans/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/writing-plans/SKILL.md`
- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/plan-eng-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/plan-eng-review/SKILL.md`
- gstack/plan-design-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/plan-design-review/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- None


## Policy Notes

- fw-plan must produce or update both docs/superpowers/specs/YYYY-MM-DD-<slug>.md and docs/superpowers/plans/YYYY-MM-DD-<slug>.md; the plan must reference the spec.

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
  "manifest_hash": "sha256:8ca6f6b7e2228fa56a568272dd938e509f307dd97e40b959ca903bd93bded35a",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [],
  "policy_notes": [
    "fw-plan must produce or update both docs/superpowers/specs/YYYY-MM-DD-<slug>.md and docs/superpowers/plans/YYYY-MM-DD-<slug>.md; the plan must reference the spec."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
