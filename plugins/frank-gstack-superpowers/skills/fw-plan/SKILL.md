---
name: fw-plan
description: "Use after gstack direction is confirmed to write a Superpowers-consumable implementation plan."
manifest_hash: sha256:dc633a36293778877952457ae1a52bd58675bf95abc2cf50f4d75d914e859f87
generated_from: workflow.manifest.yaml
---

# fw-plan

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: plan
- Owner: superpowers
- Role: Core
- Primary system: superpowers
- Contract: Write and harden the plan. Do not execute implementation.

## Inputs

- Confirmed direction and enough constraints to plan implementation.

## Outputs

- Superpowers-consumable implementation plan plus engineering and design review notes.

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

- None

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
  "manifest_hash": "sha256:dc633a36293778877952457ae1a52bd58675bf95abc2cf50f4d75d914e859f87",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [],
  "policy_notes": [],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
