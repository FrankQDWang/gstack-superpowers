# Superpowers Review Synthesis Adapter

This adapter reconciles review request and review response discipline.

## Policy

- Treat review feedback as claims that require repository evidence.
- Verify each actionable finding before editing.
- Do not collapse review, remediation, and completion into one unverified step.

## Required Behavior

1. Classify each finding as actionable, unclear, duplicate, or rejected with evidence.
2. Implement only verified actionable findings.
3. Re-run the smallest useful verification after remediation.
4. Report unresolved findings and test gaps separately.

## Output Notes

The output should preserve issue identifiers, file paths, commands, and exact failure text where available.
