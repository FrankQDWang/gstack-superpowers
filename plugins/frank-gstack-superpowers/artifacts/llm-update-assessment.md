# LLM Update Assessment

- Status: ready
- Recommendation: promote
- LLM used: true
- Assessed at: 2026-05-18T05:49:13.876Z

## Summary

The gstack upstream candidate updates 13 allowlisted files while Superpowers is unchanged. The raw upstream risk markers are covered by current wrapper routing and adapter mitigations: raw gstack skills remain non-exported, upstream-only ship/land/canary content is non-executable behind ship-readiness, standalone/native Codex review is suppressed, and fw-review keeps raw gstack review inside the curated review chain. No missing files, policy violations, or generated forbidden-pattern matches were reported.

## Findings

- [info] Native Codex review references are neutralized by current routing: Multiple changed gstack files mention `/codex review`, but the manifest forbids standalone Codex review ownership, common-safety neutralizes generic host-native review shortcuts, and fw-review explicitly suppresses `codex/native-review` and `codex/review` while allowing raw gstack review only as part of the curated chain.
- [info] Release, deploy, canary, merge, and push risks are mitigated: Changed upstream-only ship, land-and-deploy, and canary files require `adapters/gstack/ship-readiness.md`, are not directly executable, and are suppressed by fw-ship-lite. The adapter narrows these routes to readiness evidence and requires a separate explicit gate for externally visible actions.
- [info] Document-release marker appears non-actionable: The deploy/release/canary marker in document-release is from a documentation diff example, not an instruction to release or deploy. fw-ship-lite also applies common-safety and ship-readiness around release documentation publication.
- [info] No wrapper conflict found for changed core and gate skills: Changed core/gate gstack references remain non-exported reference material and are only reached through fw-office-hours, fw-ceo-review, fw-plan-review, fw-debug, fw-review, or fw-ship-lite. This complements the existing one-execution-owner workflow split between gstack direction/review gates and Superpowers implementation discipline.

## Adapter Updates

- None reported

## Manifest Updates

- Update gstack active commit from `74895062fb8a3acbf9f66cd088a83359aaaa56cd` to `026751ea2012ec7cbedc149ba615929a20026501`.
- Refresh recorded sha256 values for the 13 changed allowlisted gstack files.
- Keep upstream-only mappings for `gstack_ship`, `gstack_land_and_deploy`, and `gstack_canary` non-exported and adapter-required via `adapters/gstack/ship-readiness.md`.
- No Superpowers manifest commit change is needed because active and candidate commits are identical.

## Routing Risks

- If raw gstack skills become directly exported later, `/codex review` mentions and ship/deploy guidance would need reassessment before promotion.
- fw-review must remain the only route that can include raw gstack review; adding standalone/native Codex review as an owner would conflict with project rules.
- fw-ship-lite must continue suppressing `gstack/ship`, `gstack/land-and-deploy`, and `gstack/canary` as executable routes.

## Policy Risks

- Raw upstream includes review-routing text that references native Codex review, but current common-safety and fw-review mitigations neutralize it.
- Raw upstream includes release/deploy/canary/merge-related text in ship material, but current ship-readiness and finish-readiness adapters keep it to readiness reporting without side effects.
- Risk markers are acceptable only because mitigation evidence is present; removal or weakening of common-safety, ship-readiness, or review-synthesis should block future promotion.
