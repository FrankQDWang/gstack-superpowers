import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditRouting } from "../scripts/audit-routing.mjs";
import { buildDiffReport } from "../scripts/diff-report.mjs";
import { evalRouting } from "../scripts/eval-routing.mjs";
import { loadProjectState } from "../scripts/lib/reference-resolver.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");

async function copyPluginWithActiveCommitsCleared() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "frank-gstack-superpowers-presync-"));
  const tempPluginRoot = path.join(tempRoot, "plugin");
  await fs.cp(pluginRoot, tempPluginRoot, { recursive: true });

  const lockfilePath = path.join(tempPluginRoot, "upstreams.lock.json");
  const lockfile = JSON.parse(await fs.readFile(lockfilePath, "utf8"));
  for (const upstream of Object.values(lockfile.upstreams ?? {})) {
    upstream.active_commit = null;
  }
  await fs.writeFile(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);

  return { tempRoot, tempPluginRoot };
}

test("audit routing accepts promoted active commits and still covers pre-sync missing active commits", async () => {
  const state = await loadProjectState(pluginRoot);
  const hasActiveCommits = Object.values(state.lockfile.upstreams ?? {}).every((upstream) => upstream.active_commit);
  const preSync = await auditRouting(pluginRoot, { preSyncOk: true });

  assert.equal(preSync.status, "success");
  assert.deepEqual(preSync.errors, []);

  const strict = await auditRouting(pluginRoot);
  if (hasActiveCommits) {
    assert.ok(!preSync.warnings.some((warning) => warning.includes("has no active_commit")));
    assert.equal(strict.status, "success");
    assert.deepEqual(strict.errors, []);
  } else {
    assert.ok(preSync.warnings.some((warning) => warning.includes("has no active_commit")));
    assert.equal(strict.status, "failed");
    assert.ok(strict.errors.length > 0);
    assert.ok(strict.errors.every((error) => error.includes("has no active_commit")));
  }

  if (hasActiveCommits) {
    const { tempRoot, tempPluginRoot } = await copyPluginWithActiveCommitsCleared();
    try {
      const preSyncMissingActive = await auditRouting(tempPluginRoot, { preSyncOk: true });
      assert.equal(preSyncMissingActive.status, "success");
      assert.deepEqual(preSyncMissingActive.errors, []);
      assert.ok(preSyncMissingActive.warnings.some((warning) => warning.includes("has no active_commit")));

      const strictMissingActive = await auditRouting(tempPluginRoot);
      assert.equal(strictMissingActive.status, "failed");
      assert.ok(strictMissingActive.errors.length > 0);
      assert.ok(strictMissingActive.errors.every((error) => error.includes("has no active_commit")));
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
});

test("eval routing returns the expected wrapper for every case", async () => {
  const result = await evalRouting(pluginRoot);

  assert.equal(result.status, "success");
  assert.deepEqual(result.errors, []);
  assert.ok(result.cases.length > 0);
  for (const testCase of result.cases) {
    assert.equal(testCase.status, "passed", testCase.id);
    assert.equal(testCase.actual_wrapper, testCase.expected_wrapper, testCase.id);
  }
});

test("diff report has fixed sections and prevents dynamic headings from becoming top-level sections", () => {
  const injected = "safe text\n# Injected H1\n## Injected H2\n### Injected H3";
  const markdown = buildDiffReport({
    evidence: {
      commits: {
        "gstack\n## Bad Commit Section": {
          active_commit: "active\n# Bad Active",
          candidate_commit: "candidate\n## Bad Candidate",
          last_checked_at: "now\n# Bad Checked",
        },
      },
      missing_files: [],
      risk_markers: [
        {
          upstream: "gstack\n# Bad Risk Upstream",
          source_path: "review/SKILL.md\n## Bad Risk Source",
          line: "7\n# Bad Line",
          severity: "policy\n# Bad Severity",
          marker: "native_codex_review\n## Bad Marker",
          excerpt: injected,
        },
      ],
      policy_violations: [
        {
          upstream: "gstack\n# Bad Policy Upstream",
          source_path: "review/SKILL.md\n## Bad Policy Source",
          line: "9\n# Bad Policy Line",
          policy: "native_codex_review_forbidden\n## Bad Policy",
        },
      ],
      changed_allowlisted_files: [
        {
          upstream: "superpowers\n# Bad Change Upstream",
          source_path: "skills/test-driven-development/SKILL.md\n## Bad Change Source",
          change_type: "modified\n# Bad Change Type",
          role: "Core\n## Bad Role",
          adapter_required: false,
          skill_id: "superpowers_test_driven_development\n# Bad Skill",
        },
      ],
    },
    assessment: {
      status: "ready\n# Bad Status",
      recommendation: "promote\n## Bad Recommendation",
      llm_used: true,
      summary: injected,
      findings: [{ title: injected, detail: injected }],
      adapter_updates: [injected],
      manifest_updates: [injected],
      routing_risks: [injected],
      policy_risks: [injected],
    },
  });

  const headings = markdown.split(/\r?\n/).filter((line) => /^#{1,2} /.test(line));
  assert.deepEqual(headings, [
    "# Upstream Diff Report",
    "## Verdict",
    "## Commits",
    "## Risk Markers",
    "## LLM Assessment",
    "## Policy Violations",
    "## Wrapper Impact",
    "## Changed Files",
  ]);
  assert.doesNotMatch(markdown, /^# Injected/m);
  assert.doesNotMatch(markdown, /^## Injected/m);
  assert.doesNotMatch(markdown, /^# Bad/m);
  assert.doesNotMatch(markdown, /^## Bad/m);
  assert.match(markdown, /<!-- artifact_presence \{"evidence":true,"assessment":true\} -->/);
});

test("diff report holds when LLM assessment is stale for current evidence", () => {
  const markdown = buildDiffReport({
    evidence: {
      evidence_hash: "current-evidence-hash",
      candidate_commits: {
        gstack: null,
        superpowers: null,
      },
      commits: {
        gstack: {
          active_commit: "active-gstack",
          candidate_commit: null,
          last_checked_at: "now",
        },
        superpowers: {
          active_commit: "active-superpowers",
          candidate_commit: null,
          last_checked_at: "now",
        },
      },
      missing_files: [],
      risk_markers: [],
      policy_violations: [],
      changed_allowlisted_files: [],
    },
    assessment: {
      status: "ready",
      recommendation: "promote",
      llm_used: true,
      summary: "Old assessment from before promotion.",
      evidence_hash: "old-evidence-hash",
      candidate_commits: {
        gstack: "candidate-gstack",
        superpowers: "candidate-superpowers",
      },
      findings: [],
      adapter_updates: [],
      manifest_updates: [],
      routing_risks: [],
      policy_risks: [],
    },
  });

  assert.match(markdown, /Hold: LLM assessment is stale for the current update evidence\./);
  assert.match(markdown, /Stale: assessment evidence hash does not match current update evidence\./);
  assert.match(markdown, /Stale: assessment candidate commits do not match current update evidence\./);
  assert.doesNotMatch(markdown, /Assessment recommendation: promote\./);
});
