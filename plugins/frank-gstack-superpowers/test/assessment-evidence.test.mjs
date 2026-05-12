import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSESSMENT_SCHEMA,
  assertValidAssessment,
  buildPrompt,
  fallbackAssessment,
  normalizeAssessment,
} from "../scripts/llm-assess-updates.mjs";
import { buildEvidence, computeEvidenceHash, stableJsonStringify } from "../scripts/build-update-evidence.mjs";

function validAssessment(overrides = {}) {
  return {
    status: "ready",
    recommendation: "promote",
    summary: "Adapters remain compatible.",
    findings: [
      {
        severity: "info",
        title: "No blocking change",
        detail: "Synthetic assessment fixture.",
        upstream: "gstack",
        source_path: "review/SKILL.md",
      },
    ],
    adapter_updates: [],
    manifest_updates: [],
    routing_risks: [],
    policy_risks: [],
    ...overrides,
  };
}

test("valid assessment validates and normalization copies evidence metadata", () => {
  const assessment = validAssessment();
  const evidence = {
    generated_at: "2026-05-11T00:00:00.000Z",
    evidence_hash: "hash-from-evidence",
    candidate_commits: {
      gstack: "candidate-gstack",
      superpowers: "candidate-superpowers",
    },
  };

  assert.doesNotThrow(() => assertValidAssessment(assessment));

  const normalized = normalizeAssessment(assessment, evidence);
  assert.equal(normalized.llm_used, true);
  assert.equal(normalized.evidence_generated_at, evidence.generated_at);
  assert.equal(normalized.evidence_hash, evidence.evidence_hash);
  assert.deepEqual(normalized.candidate_commits, evidence.candidate_commits);
  assert.match(normalized.assessed_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("invalid assessment status and recommendation fail schema validation", () => {
  assert.throws(
    () => assertValidAssessment(validAssessment({ status: "approved" })),
    /assessment\.status must be one of: ready, needs-user, blocked/,
  );
  assert.throws(
    () => assertValidAssessment(validAssessment({ recommendation: "merge-now" })),
    /assessment\.recommendation must be one of: promote, promote-with-changes, hold/,
  );
});

test("assessment schema is strict for structured outputs", () => {
  function assertStrictObjects(schema, pathName = "schema") {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false, `${pathName} must disallow additional properties`);
      assert.deepEqual(
        new Set(schema.required ?? []),
        new Set(Object.keys(schema.properties ?? {})),
        `${pathName} must require every property`,
      );
      for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
        assertStrictObjects(childSchema, `${pathName}.${key}`);
      }
    }
    if (schema.type === "array" && schema.items) {
      assertStrictObjects(schema.items, `${pathName}[]`);
    }
  }

  assertStrictObjects(ASSESSMENT_SCHEMA);
});

test("raw LLM assessment rejects fields added only during normalization", () => {
  assert.throws(
    () => assertValidAssessment(validAssessment({ llm_used: true })),
    /assessment\.llm_used is not allowed/,
  );
  assert.throws(
    () =>
      assertValidAssessment(
        validAssessment({
          findings: [
            {
              severity: "info",
              title: "No blocking change",
              detail: "Synthetic assessment fixture.",
              unexpected: "extra",
            },
          ],
        }),
      ),
    /assessment\.findings\[0\]\.unexpected is not allowed/,
  );
});

test("fallback assessment holds without claiming LLM usage", () => {
  const error = Object.assign(new Error("codex unavailable"), {
    code: "LLM_FAILED",
    stdout: "x".repeat(10),
    stderr: "y".repeat(10),
  });
  const evidence = {
    generated_at: "2026-05-11T01:00:00.000Z",
    evidence_hash: "fallback-hash",
    candidate_commits: { gstack: null, superpowers: null },
  };

  const fallback = fallbackAssessment(error, evidence);

  assert.equal(fallback.status, "needs-user");
  assert.equal(fallback.recommendation, "hold");
  assert.equal(fallback.llm_used, false);
  assert.equal(fallback.evidence_hash, evidence.evidence_hash);
  assert.deepEqual(fallback.candidate_commits, evidence.candidate_commits);
  assert.equal(fallback.error.code, "LLM_FAILED");
});

test("evidence hash ignores volatile fields and changes with candidate content", () => {
  const evidence = {
    generated_at: "2026-05-11T02:00:00.000Z",
    candidate_commits: { gstack: "candidate-a" },
    changed_allowlisted_files: [
      {
        upstream: "gstack",
        source_path: "review/SKILL.md",
        candidate_sha256: "content-a",
      },
    ],
    evidence_hash: "old-hash",
  };

  const sameEvidenceDifferentSelfHash = {
    ...evidence,
    evidence_hash: "new-hash-that-should-be-ignored",
  };
  const sameEvidenceDifferentGeneratedAt = {
    ...evidence,
    generated_at: "2026-05-11T03:00:00.000Z",
  };
  const changedCandidateContent = {
    ...evidence,
    changed_allowlisted_files: [
      {
        ...evidence.changed_allowlisted_files[0],
        candidate_sha256: "content-b",
      },
    ],
  };

  assert.equal(computeEvidenceHash(evidence), computeEvidenceHash(sameEvidenceDifferentSelfHash));
  assert.equal(computeEvidenceHash(evidence), computeEvidenceHash(sameEvidenceDifferentGeneratedAt));
  assert.notEqual(computeEvidenceHash(evidence), computeEvidenceHash(changedCandidateContent));
  assert.equal(
    stableJsonStringify({
      b: 1,
      generated_at: "2026-05-11T04:00:00.000Z",
      evidence_hash: "ignored",
      a: 2,
    }),
    '{"a":2,"b":1}',
  );
});

test("update evidence includes wrapper and adapter mitigation context", async () => {
  const { evidence } = await buildEvidence({ write: false });

  assert.ok(evidence.mitigation_context, "mitigation_context must be present");
  assert.ok(evidence.mitigation_context.manifest_policy_summary.one_execution_owner);
  assert.equal(
    evidence.mitigation_context.manifest_policy_summary.native_codex_review.standalone_codex_review_owner,
    "forbidden",
  );

  const wrapperSummaries = evidence.mitigation_context.wrapper_summaries;
  assert.ok(wrapperSummaries["fw-review"].references.includes("adapters/gstack/common-safety.md"));
  assert.ok(wrapperSummaries["fw-review"].references.includes("gstack/review/SKILL.md"));
  assert.ok(wrapperSummaries["fw-review"].suppressions.includes("codex/native-review"));
  assert.ok(
    wrapperSummaries["fw-review"].policy_notes.some((note) =>
      /raw gstack review is part of the curated review chain/i.test(note),
    ),
  );
  assert.ok(
    wrapperSummaries["fw-build"].references.includes("adapters/superpowers/orchestration-boundary.md"),
  );
  assert.ok(
    wrapperSummaries["fw-build"].policy_notes.some((note) =>
      /host policy controls whether agents can be spawned/i.test(note),
    ),
  );
  assert.ok(wrapperSummaries["fw-ship-lite"].references.includes("adapters/gstack/ship-readiness.md"));
  assert.ok(
    wrapperSummaries["fw-ship-lite"].policy_notes.some((note) => /readiness reporting/i.test(note)),
  );

  assert.equal(
    evidence.mitigation_context.manifest_policy_summary.release_gate.default_route,
    "readiness_report",
  );

  const gstackReview = evidence.mitigation_context.upstream_skill_visibility_role_adapter_map.gstack_review;
  assert.equal(gstackReview.role, "Gate");
  assert.equal(gstackReview.visibility.exported, false);
  assert.equal(gstackReview.visibility.adapter_required, false);
  assert.equal(gstackReview.adapter, null);

  const adapterFiles = evidence.mitigation_context.adapter_files;
  const commonSafety = adapterFiles.find(
    (adapter) => adapter.reference === "adapters/gstack/common-safety.md",
  );
  assert.ok(commonSafety, "common safety adapter evidence must be present");
  assert.match(commonSafety.sha256, /^[a-f0-9]{64}$/);
  assert.ok(commonSafety.excerpt.some((line) => /untrusted reference material/i.test(line.text)));
  assert.ok(commonSafety.excerpt.some((line) => /telemetry/i.test(line.text)));

  const orchestrationBoundary = adapterFiles.find(
    (adapter) => adapter.reference === "adapters/superpowers/orchestration-boundary.md",
  );
  assert.ok(orchestrationBoundary, "orchestration boundary adapter evidence must be present");
  assert.ok(
    orchestrationBoundary.excerpt.some((line) => /Codex host policy controls whether agents can be spawned/i.test(line.text)),
  );

  assert.ok(evidence.mitigation_context.generated_forbidden_pattern_scan);
  assert.deepEqual(evidence.mitigation_context.generated_forbidden_pattern_scan.forbidden_pattern_matches, []);
});

test("assessment prompt requires weighing raw upstream risk against explicit mitigations", () => {
  const prompt = buildPrompt({
    generated_at: "2026-05-11T00:00:00.000Z",
    risk_markers: [{ marker: "native_codex_review", source_path: "review/SKILL.md" }],
    mitigation_context: {
      adapter_files: [{ reference: "adapters/gstack/common-safety.md" }],
      wrapper_summaries: {
        "fw-review": {
          references: ["adapters/gstack/common-safety.md", "gstack/review/SKILL.md"],
          suppressions: ["codex/native-review"],
        },
      },
    },
  });

  assert.match(prompt, /current wrapper\/adapter mitigations/i);
  assert.match(prompt, /hold on unmitigated risk/i);
  assert.match(prompt, /should not hold solely because hidden raw upstream text contains risky instructions/i);
});
