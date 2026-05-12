---
name: fw-ship-lite
description: "Use for branch finishing, release documentation, and release-readiness reporting without default deploy actions."
manifest_hash: sha256:dc633a36293778877952457ae1a52bd58675bf95abc2cf50f4d75d914e859f87
generated_from: workflow.manifest.yaml
---

# fw-ship-lite

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: ship-lite
- Owner: mixed
- Role: Conditional
- Primary system: mixed
- Contract: Report readiness only. Do not default to deploy, land, canary, merge, or release side effects.

## Inputs

- Reviewed branch, verification evidence, and release documentation context.

## Outputs

- Branch finishing status, release-readiness report, documentation notes, and explicit next gate.

## Required References

- adapters/superpowers/finish-readiness.md
  - Read: `references/adapters/superpowers/finish-readiness.md`
- superpowers/skills/finishing-a-development-branch/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/finishing-a-development-branch/SKILL.md`
- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/document-release/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/document-release/SKILL.md`
- adapters/gstack/ship-readiness.md
  - Read: `references/adapters/gstack/ship-readiness.md`

## Conditional References

- None

## Suppressed Routes

- gstack/ship/SKILL.md
- gstack/land-and-deploy/SKILL.md
- gstack/canary/SKILL.md


## Policy Notes

- Release, deploy, canary, merge, and push requests route to readiness reporting unless a separate explicit release gate is present.

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
  "wrapper": "fw-ship-lite",
  "stage": "ship-lite",
  "owner": "mixed",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:dc633a36293778877952457ae1a52bd58675bf95abc2cf50f4d75d914e859f87",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [
    "gstack/ship/SKILL.md",
    "gstack/land-and-deploy/SKILL.md",
    "gstack/canary/SKILL.md"
  ],
  "policy_notes": [
    "Release, deploy, canary, merge, and push requests route to readiness reporting unless a separate explicit release gate is present."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
