# Superpowers Orchestration Boundary Adapter

This adapter keeps Superpowers subagent guidance inside Codex host policy.

## Policy

- Superpowers subagent-driven instructions define implementation discipline only.
- Codex host policy controls whether agents can be spawned.
- If the host does not expose an approved agent-spawn mechanism, use the Superpowers guidance as sequencing and checklist discipline inside the current execution owner.
- Do not treat raw Superpowers orchestration examples as permission to create external workers, background jobs, or additional execution owners.

## Required Behavior

1. Read this adapter before raw subagent-driven-development material.
2. Check the active Codex host capabilities and user instructions before spawning any agent.
3. Preserve one execution owner for the current task unless the user explicitly opens a parallel-agent workflow.
4. Report orchestration as blocked or local-only when host policy does not permit spawning.

## Output Notes

The output must state whether subagent guidance was used as implementation discipline only or whether a separate explicit host-approved orchestration gate was present.
