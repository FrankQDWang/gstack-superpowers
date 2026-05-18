# Upstream Diff Report

## Verdict

Assessment recommendation: promote.

## Commits

- `gstack`: active=`74895062fb8a3acbf9f66cd088a83359aaaa56cd` candidate=`026751ea2012ec7cbedc149ba615929a20026501` checked=`2026-05-18T05:48:36.006Z`
- `superpowers`: active=`f2cbfbefebbfef77321e4c9abc9e949826bea9d7` candidate=`f2cbfbefebbfef77321e4c9abc9e949826bea9d7` checked=`2026-05-18T05:48:36.006Z`

## Risk Markers

- risk native_codex_review in `gstack/benchmark/SKILL.md:478` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/canary/SKILL.md:743` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/cso/SKILL.md:748` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/document-release/SKILL.md:747` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk deploy_release_canary in `gstack/document-release/SKILL.md:1122` - `"README.md: added /document-release to skills table, updated skill count from 9 to 10").`
- risk native_codex_review in `gstack/investigate/SKILL.md:784` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/land-and-deploy/SKILL.md:760` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/office-hours/SKILL.md:798` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/plan-ceo-review/SKILL.md:792` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/plan-design-review/SKILL.md:765` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/plan-eng-review/SKILL.md:767` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/qa-only/SKILL.md:762` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/review/SKILL.md:765` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk native_codex_review in `gstack/ship/SKILL.md:766` - `Skills that run plan reviews ('/plan-*-review', '/codex review') include the EXIT PLAN MODE GATE blocking checklist at the end of the skill, which verifies the plan file ends with`
- risk deploy_release_canary in `gstack/ship/SKILL.md:1825` - `~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --query "release ship version changelog merge pr" --cross-project 2>/dev/null || true`
- risk deploy_release_canary in `gstack/ship/SKILL.md:1827` - `~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --query "release ship version changelog merge pr" 2>/dev/null || true`
- risk deploy_release_canary in `gstack/ship/SKILL.md:2462` - `The top-of-skill learnings pull was keyed to "release ship" broadly. Before the VERSION/CHANGELOG step, re-pull learnings keyed to THIS branch's headline feature so any prior versi`
- risk credentials in `gstack/ship/SKILL.md:2466` - `Worked examples (ship-specific): good keywords are 'learnings-search', 'pacing', 'worktree-ship'. Bad: 'the branch headline', 'v1.31.1.0', 'feat: token-or search'.`

## LLM Assessment

- Status: `ready`
- Recommendation: `promote`
- LLM used: true
- Summary: The gstack upstream candidate updates 13 allowlisted files while Superpowers is unchanged. The raw upstream risk markers are covered by current wrapper routing and adapter mitigations: raw gstack skills remain non-exported, upstream-only ship/land/canary content is non-executable behind ship-readiness, standalone/native Codex review is suppressed, and fw-review keeps raw gstack review inside the curated review chain. No missing files, policy violations, or generated forbidden-pattern matches were reported.

Findings:
````json
[
  {
    "severity": "info",
    "title": "Native Codex review references are neutralized by current routing",
    "detail": "Multiple changed gstack files mention `/codex review`, but the manifest forbids standalone Codex review ownership, common-safety neutralizes generic host-native review shortcuts, and fw-review explicitly suppresses `codex/native-review` and `codex/review` while allowing raw gstack review only as part of the curated chain.",
    "upstream": "gstack",
    "source_path": "benchmark/SKILL.md; canary/SKILL.md; cso/SKILL.md; document-release/SKILL.md; investigate/SKILL.md; land-and-deploy/SKILL.md; office-hours/SKILL.md; plan-ceo-review/SKILL.md; plan-design-review/SKILL.md; plan-eng-review/SKILL.md; qa-only/SKILL.md; review/SKILL.md; ship/SKILL.md"
  },
  {
    "severity": "info",
    "title": "Release, deploy, canary, merge, and push risks are mitigated",
    "detail": "Changed upstream-only ship, land-and-deploy, and canary files require `adapters/gstack/ship-readiness.md`, are not directly executable, and are suppressed by fw-ship-lite. The adapter narrows these routes to readiness evidence and requires a separate explicit gate for externally visible actions.",
    "upstream": "gstack",
    "source_path": "ship/SKILL.md; land-and-deploy/SKILL.md; canary/SKILL.md"
  },
  {
    "severity": "info",
    "title": "Document-release marker appears non-actionable",
    "detail": "The deploy/release/canary marker in document-release is from a documentation diff example, not an instruction to release or deploy. fw-ship-lite also applies common-safety and ship-readiness around release documentation publication.",
    "upstream": "gstack",
    "source_path": "document-release/SKILL.md"
  },
  {
    "severity": "info",
    "title": "No wrapper conflict found for changed core and gate skills",
    "detail": "Changed core/gate gstack references remain non-exported reference material and are only reached through fw-office-hours, fw-ceo-review, fw-plan-review, fw-debug, fw-review, or fw-ship-lite. This complements the existing one-execution-owner workflow split between gstack direction/review gates and Superpowers implementation discipline.",
    "upstream": "gstack",
    "source_path": null
  }
]
````

Adapter updates:
````json
[]
````

Manifest updates:
````json
[
  "Update gstack active commit from `74895062fb8a3acbf9f66cd088a83359aaaa56cd` to `026751ea2012ec7cbedc149ba615929a20026501`.",
  "Refresh recorded sha256 values for the 13 changed allowlisted gstack files.",
  "Keep upstream-only mappings for `gstack_ship`, `gstack_land_and_deploy`, and `gstack_canary` non-exported and adapter-required via `adapters/gstack/ship-readiness.md`.",
  "No Superpowers manifest commit change is needed because active and candidate commits are identical."
]
````

Routing risks:
````json
[
  "If raw gstack skills become directly exported later, `/codex review` mentions and ship/deploy guidance would need reassessment before promotion.",
  "fw-review must remain the only route that can include raw gstack review; adding standalone/native Codex review as an owner would conflict with project rules.",
  "fw-ship-lite must continue suppressing `gstack/ship`, `gstack/land-and-deploy`, and `gstack/canary` as executable routes."
]
````

Policy risks:
````json
[
  "Raw upstream includes review-routing text that references native Codex review, but current common-safety and fw-review mitigations neutralize it.",
  "Raw upstream includes release/deploy/canary/merge-related text in ship material, but current ship-readiness and finish-readiness adapters keep it to readiness reporting without side effects.",
  "Risk markers are acceptable only because mitigation evidence is present; removal or weakening of common-safety, ship-readiness, or review-synthesis should block future promotion."
]
````

## Policy Violations

- None

## Wrapper Impact

- `gstack_benchmark` changed; verify any wrapper references that depend on it.
- `gstack_canary` requires adapter review via `adapters/gstack/ship-readiness.md`.
- `gstack_cso` changed; verify any wrapper references that depend on it.
- `gstack_document_release` changed; verify any wrapper references that depend on it.
- `gstack_investigate` changed; verify any wrapper references that depend on it.
- `gstack_land_and_deploy` requires adapter review via `adapters/gstack/ship-readiness.md`.
- `gstack_office_hours` changed; verify any wrapper references that depend on it.
- `gstack_plan_ceo_review` changed; verify any wrapper references that depend on it.
- `gstack_plan_design_review` changed; verify any wrapper references that depend on it.
- `gstack_plan_eng_review` changed; verify any wrapper references that depend on it.
- `gstack_qa_only` changed; verify any wrapper references that depend on it.
- `gstack_review` changed; verify any wrapper references that depend on it.
- `gstack_ship` requires adapter review via `adapters/gstack/ship-readiness.md`.

## Changed Files

- modified `gstack/benchmark/SKILL.md` role=`Conditional` adapter_required=`false`
- modified `gstack/canary/SKILL.md` role=`Upstream-only` adapter_required=`true`
- modified `gstack/cso/SKILL.md` role=`Conditional` adapter_required=`false`
- modified `gstack/document-release/SKILL.md` role=`Conditional` adapter_required=`false`
- modified `gstack/investigate/SKILL.md` role=`Conditional` adapter_required=`false`
- modified `gstack/land-and-deploy/SKILL.md` role=`Upstream-only` adapter_required=`true`
- modified `gstack/office-hours/SKILL.md` role=`Core` adapter_required=`false`
- modified `gstack/plan-ceo-review/SKILL.md` role=`Core` adapter_required=`false`
- modified `gstack/plan-design-review/SKILL.md` role=`Gate` adapter_required=`false`
- modified `gstack/plan-eng-review/SKILL.md` role=`Gate` adapter_required=`false`
- modified `gstack/qa-only/SKILL.md` role=`Conditional` adapter_required=`false`
- modified `gstack/review/SKILL.md` role=`Gate` adapter_required=`false`
- modified `gstack/ship/SKILL.md` role=`Upstream-only` adapter_required=`true`

<!-- artifact_presence {"evidence":true,"assessment":true} -->
