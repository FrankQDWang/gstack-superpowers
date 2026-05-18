# Upstream Diff Report

## Verdict

Assessment recommendation: promote.

## Commits

- `gstack`: active=`74895062fb8a3acbf9f66cd088a83359aaaa56cd` candidate=`026751ea2012ec7cbedc149ba615929a20026501` checked=`2026-05-18T06:26:52.223Z`
- `superpowers`: active=`f2cbfbefebbfef77321e4c9abc9e949826bea9d7` candidate=`f2cbfbefebbfef77321e4c9abc9e949826bea9d7` checked=`2026-05-18T06:26:52.223Z`

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
- Summary: 建议 promote。此次更新仅推进 gstack 从 74895062fb8a3acbf9f66cd088a83359aaaa56cd 到 026751ea2012ec7cbedc149ba615929a20026501；superpowers 未变化。raw upstream 中的 native_codex_review、deploy/release/canary、credentials 风险均有 evidence.mitigation_context 中的 common-safety、ship-readiness、finish-readiness 与 fw-review/f+w-ship-lite 路由约束覆盖；未发现缺失文件、policy_violations 或生成侧 forbidden pattern。

Findings:
````json
[
  {
    "severity": "low",
    "title": "raw gstack 文本继续包含 native_codex_review 标记，但当前 wrapper 已中和独立 review owner",
    "detail": "多个 gstack SKILL.md 提到 `/codex review`，但 manifest_policy_summary 明确 standalone_codex_review_owner=forbidden，fw-review suppressions 包含 codex/native-review 与 codex/review，且 common-safety 将 standalone host-native review shortcuts 中和。raw gstack review 仅在 fw-review 链中作为 curated review chain 的组件出现，因此未构成未缓解冲突。",
    "upstream": "gstack",
    "source_path": "review/SKILL.md"
  },
  {
    "severity": "low",
    "title": "ship/canary/land-and-deploy 上游内容变化涉及发布类风险，但已保持 Upstream-only 并经 ship-readiness 限缩",
    "detail": "gstack_canary、gstack_land_and_deploy、gstack_ship 均为 Upstream-only、exported=false、executable_directly=false、adapter_required=true，并绑定 adapters/gstack/ship-readiness.md。fw-ship-lite suppressions 明确压制 gstack/ship/SKILL.md、gstack/land-and-deploy/SKILL.md、gstack/canary/SKILL.md，release/deploy/canary/merge/push 只输出 readiness_report，需 separate explicit gate。",
    "upstream": "gstack",
    "source_path": "ship/SKILL.md"
  },
  {
    "severity": "info",
    "title": "document-release 的 deploy_release_canary 标记看似误报且不需要 hold",
    "detail": "document-release/SKILL.md:1122 的 excerpt 是文档 diff 示例，不是发布、部署或 canary 执行动作。fw-ship-lite 只引用 document-release 作为 release documentation/readiness reporting 的一部分，并由 ship-readiness 与 finish-readiness 抑制发布副作用。",
    "upstream": "gstack",
    "source_path": "document-release/SKILL.md"
  }
]
````

Adapter updates:
````json
[
  "无需强制 adapter 内容更新；现有 adapters/gstack/common-safety.md 已覆盖 raw gstack 不可信引用、standalone/native Codex review 中和、telemetry/analytics/learning side effects 禁用。",
  "无需强制更新 adapters/gstack/ship-readiness.md；其已覆盖 commit、push、PR、merge、deploy、canary、release 以及 native/generic host review verification side effects 抑制。",
  "保留 adapters/superpowers/finish-readiness.md、adapters/superpowers/orchestration-boundary.md、adapters/superpowers/review-synthesis.md 当前策略；此次 superpowers commit 未变化。"
]
````

Manifest updates:
````json
[
  "将 gstack pinned commit 从 74895062fb8a3acbf9f66cd088a83359aaaa56cd 更新为 026751ea2012ec7cbedc149ba615929a20026501。",
  "更新 changed_allowlisted_files 中 13 个 gstack SKILL.md 的 candidate_sha256 记录。",
  "保持 superpowers pinned commit f2cbfbefebbfef77321e4c9abc9e949826bea9d7 不变。",
  "保持 raw gstack skills exported=false、reference_available=true、executable_directly=false 的可见性策略；尤其 gstack_ship、gstack_land_and_deploy、gstack_canary 继续 adapter_required=true。"
]
````

Routing risks:
````json
[
  "若未来 manifest 将 gstack-review、gstack-plan-eng-review、gstack-plan-design-review 或其他 raw gstack skills 直接 exported/executable，会绕过 fw-* wrapper 的 one_execution_owner 与 safety adapter 约束；当前证据未显示该问题。",
  "fw-review 必须继续作为唯一 review gate 入口；不能引入 standalone/native Codex review 作为独立 review owner。",
  "fw-ship-lite 必须继续只做 branch finish 与 release-readiness report；release、deploy、canary、merge、push 仍需 separate explicit gate。"
]
````

Policy risks:
````json
[
  "raw upstream 中存在 `/codex review` 文本与发布相关命令/短语，但 common-safety 与 ship-readiness 明确将其作为非可执行参考并中和副作用，当前不构成 hold。",
  "ship/SKILL.md 中 credentials marker 的 excerpt 实际是关键词示例风险上下文；没有证据显示凭据读取、泄露或新增 side effect route。",
  "generated_forbidden_pattern_scan 显示 suppression-aware filtering 后无 forbidden route 或 reference-side-effect command patterns，降低了 wrapper 生成物层面的策略风险。"
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
