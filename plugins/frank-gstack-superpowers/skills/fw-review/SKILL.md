---
name: fw-review
description: "Use when implementation is complete and review must combine Superpowers with raw gstack review."
manifest_hash: sha256:dc633a36293778877952457ae1a52bd58675bf95abc2cf50f4d75d914e859f87
generated_from: workflow.manifest.yaml
---

# fw-review

Generated wrapper skill for the curated gstack + Superpowers workflow.

## Stage Contract

- Stage: review
- Owner: mixed
- Role: Gate
- Primary system: mixed
- Contract: Run the curated review gate with Superpowers review discipline and raw gstack review.

## Inputs

- Completed implementation, diff, tests, and review request context.

## Outputs

- Evidence-backed findings, policy note, remediation route, and unresolved risks.

## Required References

- superpowers/skills/requesting-code-review/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/requesting-code-review/SKILL.md`
- adapters/gstack/common-safety.md
  - Read: `references/adapters/gstack/common-safety.md`
- gstack/review/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/review/SKILL.md`
- superpowers/skills/receiving-code-review/SKILL.md
  - Read active materialization: `references/upstreams/superpowers/commits/f2cbfbefebbfef77321e4c9abc9e949826bea9d7/skills/receiving-code-review/SKILL.md`
- adapters/superpowers/review-synthesis.md
  - Read: `references/adapters/superpowers/review-synthesis.md`

## Conditional References

- gstack/qa-only/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/qa-only/SKILL.md`
- gstack/cso/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/cso/SKILL.md`
- gstack/benchmark/SKILL.md
  - Read active materialization: `references/upstreams/gstack/commits/49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8/benchmark/SKILL.md`

## Suppressed Routes

- codex/native-review
- codex/review


## Policy Notes

- Common-safety applies to conditional gstack references before raw conditional material is read.
- Raw gstack review is part of the curated review chain; standalone/native Codex review remains suppressed outside that gstack-managed gate.

## Execution Rules

- Read this wrapper first, then read every required reference listed above before acting.
- Read conditional references only when the user request reaches that gate.
- Common-safety applies to conditional gstack references before raw conditional material is read.
- If an active upstream materialization is unavailable, report that the wrapper is blocked on upstream sync instead of guessing from installed skills.
- Treat installed skills as callable surfaces, not source-of-truth project documentation.
- Keep one execution owner for the current task.

## Workflow-Run JSON Output

Every run of this wrapper should be able to produce a machine-readable stage artifact with this shape:

```json
{
  "wrapper": "fw-review",
  "stage": "review",
  "owner": "mixed",
  "status": "success|needs-user|blocked|failed",
  "manifest_hash": "sha256:dc633a36293778877952457ae1a52bd58675bf95abc2cf50f4d75d914e859f87",
  "inputs": [],
  "outputs": [],
  "references_read": [],
  "suppressed_routes": [
    "codex/native-review",
    "codex/review"
  ],
  "policy_notes": [
    "Common-safety applies to conditional gstack references before raw conditional material is read.",
    "Raw gstack review is part of the curated review chain; standalone/native Codex review remains suppressed outside that gstack-managed gate."
  ],
  "verification": {
    "commands": [],
    "artifacts": []
  },
  "next_action": null
}
```
