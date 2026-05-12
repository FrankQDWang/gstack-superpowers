---
name: fw-debug
description: "Use for bugs and unexpected behavior; use Superpowers root-cause debugging before conditional gstack investigation."
manifest_hash: sha256:c6ef3c75d7e27db06a3841dbbce971371f9709477fca8a8c827d3770260bd495
generated_from: workflow.manifest.yaml
---

# fw-debug

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: debug
- Owner: superpowers
- Role: Conditional
- Primary system: superpowers
- Contract: Find root cause before fixing. Use gstack investigation only as conditional support.

## Inputs

- Bug report, failing test, unexpected behavior, or repro evidence.

## Outputs

- Root cause, fix, regression verification, and any conditional investigation findings.

## Required References

- superpowers/skills/systematic-debugging/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/systematic-debugging/SKILL.md`
- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/investigate/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/investigate/SKILL.md`

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
  "wrapper": "fw-debug",
  "stage": "debug",
  "owner": "superpowers",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:c6ef3c75d7e27db06a3841dbbce971371f9709477fca8a8c827d3770260bd495",
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
