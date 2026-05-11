# GStack Review Adapter: Host Review Disabled

This adapter keeps the review gate inside the curated workflow.

## Policy

- Use Superpowers requesting-code-review and receiving-code-review as the review discipline.
- Use gstack review judgment only through this adapter.
- Host-runtime review shortcuts are forbidden for this wrapper.
- Do not invoke standalone command-style review routes from the host runtime.
- All native/generic host review route examples, upstream review status-table references, and platform review shortcuts from upstream review material are neutralized by this adapter.
- Allowed second opinions are only the manifest allowlist.

## Required Behavior

1. Read the Superpowers review request material.
2. Read this adapter before any gstack review material.
3. Check that review findings cite concrete files, lines, diffs, tests, or policy.
4. Return findings first, ordered by severity.
5. Route remediation through Superpowers receiving-code-review before edits.

## Output Notes

The review output must include a policy note stating that host-runtime review shortcuts were suppressed by this adapter.
