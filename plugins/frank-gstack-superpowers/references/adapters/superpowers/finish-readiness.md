# Superpowers Finish Readiness Adapter

This adapter narrows branch finishing to completion evidence and release-readiness reporting.

## Policy

- Use Superpowers branch-finishing material only for local completion discipline, review of remaining work, and integration-status reporting.
- Suppress push, merge, PR creation, release, deploy, and destructive cleanup side effects unless a separate explicit release gate permits them.
- Suppression applies to both Superpowers finishing-a-development-branch material and the gstack ship-readiness material used by fw-ship-lite.
- Cleanup guidance is limited to non-destructive reporting unless the user gives a separate explicit instruction for the cleanup action.
- Choosing a finish option is advisory inside fw-ship-lite; externally visible actions must be moved to the next explicit gate.

## Required Behavior

1. Read this adapter before or with the raw Superpowers branch-finishing material.
2. Verify completion evidence, unresolved risks, and local verification status.
3. Convert any push, merge, PR, release, deploy, or destructive cleanup step into a blocked next-gate item unless the user has separately opened that gate.
4. Report which side effects were suppressed and what explicit gate would be required to continue.

## Output Notes

The output must separate branch finish readiness from remote, release, deployment, and cleanup actions.
