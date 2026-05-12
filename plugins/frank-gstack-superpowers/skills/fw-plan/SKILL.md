---
name: fw-plan
description: "Use after office-hours and plan-ceo-review confirm direction to write a confirmed spec, linked plan, and gstack plan gates."
manifest_hash: sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02
generated_from: workflow.manifest.yaml
---

# fw-plan

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: plan
- Owner: superpowers
- Role: Core
- Primary system: superpowers
- Contract: Write the spec first, stop for user confirmation, then write the linked implementation plan and run gstack eng/design review as gates. Do not execute implementation.

## Inputs

- Confirmed direction, scope boundaries, and enough constraints to write the spec and implementation plan.

## Outputs

- Confirmed spec in docs/superpowers/specs/, linked implementation plan in docs/superpowers/plans/, gstack eng/design gate notes, and explicit user confirmation or block before fw-build.

## Required References

- superpowers/skills/writing-plans/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/writing-plans/SKILL.md`
- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/plan-eng-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/plan-eng-review/SKILL.md`
- gstack/plan-design-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/plan-design-review/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- None


## Policy Notes

- fw-plan must produce or update both docs/superpowers/specs/YYYY-MM-DD-<slug>.md and docs/superpowers/plans/YYYY-MM-DD-<slug>.md; the plan must reference the spec.
- fw-plan must write or update the spec before the plan, stop for user confirmation after the spec, write the linked plan, treat gstack plan-eng-review and plan-design-review as gates rather than execution owners, and stop again before fw-build.

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
  "manifest_hash": "sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [],
  "policy_notes": [
    "fw-plan must produce or update both docs/superpowers/specs/YYYY-MM-DD-<slug>.md and docs/superpowers/plans/YYYY-MM-DD-<slug>.md; the plan must reference the spec.",
    "fw-plan must write or update the spec before the plan, stop for user confirmation after the spec, write the linked plan, treat gstack plan-eng-review and plan-design-review as gates rather than execution owners, and stop again before fw-build."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
