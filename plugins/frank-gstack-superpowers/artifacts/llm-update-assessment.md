# LLM Update Assessment

- Status: ready
- Recommendation: promote
- LLM used: true
- Assessed at: 2026-05-12T01:47:34.158Z

## Summary

GStack advances from 49cc4ff9c99e9b24f39aa7dcbfc456e840be29a8 to 74895062fb8a3acbf9f66cd088a83359aaaa56cd; Superpowers is unchanged. The changed gstack skills are compatible with the curated wrapper model. Raw release/deploy/canary side effects are present in upstream descriptions, but the affected upstream-only skills remain non-exported, non-directly executable, adapter-required, and covered by ship-readiness plus common-safety mitigations. No risk markers, policy violations, missing files, or generated forbidden-pattern matches were reported.

## Findings

- [info] Upstream-only shipping changes remain mitigated: canary, land-and-deploy, and ship changed and include raw deploy, merge, production monitoring, push, PR, or canary language. Current visibility keeps them reference-only and non-executable, while adapters/gstack/ship-readiness.md suppresses those side effects unless a later explicit gate permits them.
- [info] Raw gstack review remains inside curated review chain: review, qa-only, and cso changed, but the manifest policy and fw-review wrapper keep raw gstack review as a component of the curated Superpowers/gstack/Superpowers chain and suppress standalone native Codex review routes.
- [info] Proactive raw invocation language is neutralized by wrappers: Several changed descriptions include proactive invocation guidance. The mapped skills are not exported or directly executable, and common-safety says upstream invocation guidance is overridden when it conflicts with the active wrapper.

## Adapter Updates

- None reported

## Manifest Updates

- Update the curated gstack candidate/active commit reference to 74895062fb8a3acbf9f66cd088a83359aaaa56cd after promotion.
- Refresh recorded SHA-256 values for the 12 changed gstack allowlisted files.
- No Superpowers manifest update is needed because active and candidate commits are identical.

## Routing Risks

- Release/deploy/canary/merge/push trigger phrases remain present in raw upstream shipping skills, but routing is mitigated by fw-ship-lite defaulting to readiness_report and requiring an explicit release gate.
- Raw gstack review and conditional qa/cso material must continue to be reachable only through fw-review, not as standalone/native Codex review ownership.
- Proactive invocation text in raw gstack skills should remain advisory reference material under wrapper control, not direct routing authority.

## Policy Risks

- Raw upstream allowed-tools and preamble-tier declarations include Bash and deployment-oriented workflows; common-safety and ship-readiness currently override these permissions.
- cso security-audit language may imply active scanning or pentest behavior; current conditional fw-review use and common-safety constraints should keep it review-bound unless explicitly authorized.
- No unmitigated policy risk is evidenced by the provided risk markers, policy scan, or adapter context.
