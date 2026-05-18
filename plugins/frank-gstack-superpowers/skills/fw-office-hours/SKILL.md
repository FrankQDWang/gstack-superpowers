---
name: fw-office-hours
description: "Use for gstack office-hours idea intake, demand reality, product direction, and problem framing before CEO review."
manifest_hash: sha256:96ce573cf6726198db016437609570b3170330c0ea1f001329dacb822cbaaee4
generated_from: workflow.manifest.yaml
---

# fw-office-hours

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: office-hours
- Owner: gstack
- Role: Core
- Primary system: gstack
- Contract: Run gstack office-hours only, then stop for user confirmation before fw-ceo-review. Do not run CEO review or planning inside this wrapper.

## Inputs

- Raw idea, product question, demand signal, or scope uncertainty.

## Outputs

- Office-hours notes, demand reality assessment, direction options, and explicit user confirmation or block before fw-ceo-review.

## Required References

- adapters/gstack/common-safety.md
  - Read: `../../references/adapters/gstack/common-safety.md`
- gstack/office-hours/SKILL.md
  - Read active materialization: `../../references/upstreams/gstack/commits/026751ea2012ec7cbedc149ba615929a20026501/office-hours/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- superpowers/brainstorming


## Policy Notes

- fw-office-hours must not automatically continue to plan-ceo-review; stop for user confirmation before fw-ceo-review.

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
  "wrapper": "fw-office-hours",
  "stage": "office-hours",
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
    "fw-office-hours must not automatically continue to plan-ceo-review; stop for user confirmation before fw-ceo-review."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
