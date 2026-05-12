---
name: fw-intake
description: "Use for idea intake through office-hours, then confirmed CEO-level scope challenge before planning."
manifest_hash: sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02
generated_from: workflow.manifest.yaml
---

# fw-intake

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: intake
- Owner: gstack
- Role: Core
- Primary system: gstack
- Contract: Run a two-step intake gate: office-hours, stop for user confirmation, plan-ceo-review, then stop again before fw-plan. Do not produce implementation changes.

## Inputs

- Raw idea, product question, demand signal, or scope uncertainty.

## Outputs

- Office-hours notes, CEO review notes, and explicit user confirmation or block before fw-plan.

## Required References

- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/office-hours/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/office-hours/SKILL.md`
- gstack/plan-ceo-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/plan-ceo-review/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- superpowers/brainstorming


## Policy Notes

- fw-intake must not automatically continue from office-hours to plan-ceo-review; stop for user confirmation after office-hours, then stop again before fw-plan.

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
  "wrapper": "fw-intake",
  "stage": "intake",
  "owner": "gstack",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [
    "superpowers/brainstorming"
  ],
  "policy_notes": [
    "fw-intake must not automatically continue from office-hours to plan-ceo-review; stop for user confirmation after office-hours, then stop again before fw-plan."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
