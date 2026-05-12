---
name: fw-intake
description: "Use for idea intake, demand reality, product direction, and CEO-level scope challenge before planning."
manifest_hash: sha256:c6ef3c75d7e27db06a3841dbbce971371f9709477fca8a8c827d3770260bd495
generated_from: workflow.manifest.yaml
---

# fw-intake

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: intake
- Owner: gstack
- Role: Core
- Primary system: gstack
- Contract: Clarify product direction before planning. Do not produce implementation changes.

## Inputs

- Raw idea, product question, demand signal, or scope uncertainty.

## Outputs

- Direction decision, scope challenge notes, and planning handoff criteria.

## Required References

- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/office-hours/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/office-hours/SKILL.md`
- gstack/plan-ceo-review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/plan-ceo-review/SKILL.md`

## Conditional References

- None

## Suppressed Routes

- superpowers/brainstorming


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
  "wrapper": "fw-intake",
  "stage": "intake",
  "owner": "gstack",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:c6ef3c75d7e27db06a3841dbbce971371f9709477fca8a8c827d3770260bd495",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [
    "superpowers/brainstorming"
  ],
  "policy_notes": [],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
