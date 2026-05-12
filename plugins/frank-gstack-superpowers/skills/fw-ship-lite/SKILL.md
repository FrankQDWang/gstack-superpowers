---
name: fw-ship-lite
description: "Use for branch finishing, release documentation, and release-readiness reporting without default deploy actions."
manifest_hash: sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02
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
  - Read active materialization: `references/upstreams/gstack/commits/74895062fb8a3acbf9f66cd088a83359aaaa56cd/document-release/SKILL.md`
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
  "manifest_hash": "sha256:b3fc08bd648d6ca0467e2fe51b6c9c737649ed457b345bf2df315df96ce5dc02",
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
