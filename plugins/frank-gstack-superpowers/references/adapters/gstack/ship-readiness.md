# GStack Ship Readiness Adapter

This adapter narrows shipping to branch completion and release-readiness reporting.

## Policy

- Do not default to deploy, land, canary, production monitoring, or merge side effects.
- Suppress commit, push, PR, merge, deploy, canary, release, and native/generic host review verification side effects unless a later explicit gate permits them.
- Produce readiness evidence and the next explicit gate instead.
- Release documentation may be prepared, but publication requires a separate user request.

## Required Behavior

1. Verify the branch completion state.
2. Summarize tests, review status, documentation updates, and remaining risks.
3. Identify whether deploy, land, canary, or release automation is out of scope.
4. Stop at readiness unless the user explicitly asks for the next gate.

## Output Notes

The output must clearly distinguish readiness reporting from externally visible release actions.
