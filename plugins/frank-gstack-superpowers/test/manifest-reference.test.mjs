import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_WRAPPERS } from "../scripts/generate-plugin.mjs";
import {
  assertSafeLogicalPath,
  assertSafeUpstreamName,
  loadManifest,
  loadProjectState,
  listUpstreamSkillEntries,
  materializedUpstreamPath,
  resolveActiveReference,
  resolveActiveReferenceStrict,
  resolveReference,
} from "../scripts/lib/reference-resolver.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");

test("manifest exposes exactly the curated wrappers and keeps upstream skills hidden", async () => {
  const { manifest } = await loadManifest(pluginRoot);

  assert.deepEqual(Object.keys(manifest.wrappers).sort(), [...EXPECTED_WRAPPERS].sort());
  assert.equal(EXPECTED_WRAPPERS.length, 6);

  const upstreamEntries = listUpstreamSkillEntries(manifest);
  assert.ok(upstreamEntries.length > 0);
  for (const entry of upstreamEntries) {
    assert.equal(entry.visibility.exported, false, `${entry.id} must not be exported`);
    assert.equal(entry.visibility.executable_directly, false, `${entry.id} must not be directly executable`);
  }

  const hiddenEntries = upstreamEntries.filter((entry) => entry.role === "Hidden" || entry.role === "Upstream-only");
  assert.ok(hiddenEntries.length > 0);
  for (const entry of hiddenEntries) {
    assert.equal(entry.visibility.exported, false, `${entry.id} hidden/upstream-only export policy`);
  }

  assert.equal(manifest.policy.native_codex_review.standalone_codex_review_owner, "forbidden");
  assert.equal(manifest.policy.native_codex_review.codex_review_inside_gstack_review, "forbidden_in_v1");
  assert.ok(manifest.wrappers["fw-review"].suppress.includes("codex/native-review"));
  assert.ok(manifest.wrappers["fw-review"].suppress.includes("codex/review"));
});

test("gstack wrappers read common safety before any raw gstack reference", async () => {
  const { manifest } = await loadManifest(pluginRoot);
  const commonSafety = "adapters/gstack/common-safety.md";
  const wrappersWithGstackRefs = ["fw-intake", "fw-plan", "fw-debug", "fw-review", "fw-ship-lite"];

  for (const wrapperName of wrappersWithGstackRefs) {
    const wrapper = manifest.wrappers[wrapperName];
    const requiredReferences = wrapper.references ?? [];
    const conditionalReferences = wrapper.conditional_references ?? [];
    assert.ok(
      requiredReferences.includes(commonSafety),
      `${wrapperName} must include ${commonSafety} as a required reference`,
    );

    for (const reference of requiredReferences) {
      if (!reference.startsWith("gstack/")) continue;
      assert.ok(
        requiredReferences.indexOf(commonSafety) < requiredReferences.indexOf(reference),
        `${wrapperName} must place ${commonSafety} before ${reference}`,
      );
    }

    if (conditionalReferences.some((reference) => reference.startsWith("gstack/"))) {
      assert.ok(
        requiredReferences.includes(commonSafety),
        `${wrapperName} must read ${commonSafety} before conditional gstack refs are eligible`,
      );
    }
  }

  assert.ok(
    !(manifest.wrappers["fw-build"].references ?? []).includes(commonSafety),
    "fw-build should not include the gstack safety adapter because it has no raw gstack references",
  );
});

test("fw-build places the Superpowers orchestration boundary before subagent guidance", async () => {
  const { manifest } = await loadManifest(pluginRoot);
  const references = manifest.wrappers["fw-build"].references ?? [];
  const boundary = "adapters/superpowers/orchestration-boundary.md";
  const subagent = "superpowers/skills/subagent-driven-development/SKILL.md";

  assert.ok(references.includes(boundary), "fw-build must include the orchestration boundary adapter");
  assert.ok(references.includes(subagent), "fw-build must still include the raw subagent reference");
  assert.ok(
    references.indexOf(boundary) < references.indexOf(subagent),
    "fw-build must read the orchestration boundary before raw subagent guidance",
  );
});

test("manifest records release gate and common safety policy notes", async () => {
  const { manifest } = await loadManifest(pluginRoot);

  assert.equal(manifest.policy.release_gate.default_route, "readiness_report");
  assert.equal(manifest.policy.release_gate.explicit_gate_required, true);
  assert.ok(manifest.policy.release_gate.requests.includes("deploy"));
  assert.ok(manifest.policy.common_safety.inert_historical_routes.includes("native/generic host review"));
  assert.ok(manifest.policy.common_safety.disabled_reference_side_effects.includes("upgrade-check"));
});

test("reference resolver handles adapters, nullable pre-sync upstreams, and strict active failures", async () => {
  const state = await loadProjectState(pluginRoot);

  const adapter = resolveReference("adapters/gstack/review-no-codex.md", state);
  assert.equal(adapter.type, "adapter");
  assert.equal(adapter.reference, "adapters/gstack/review-no-codex.md");
  assert.equal(adapter.path, path.join(pluginRoot, "references", "adapters", "gstack", "review-no-codex.md"));

  const loose = resolveActiveReference("gstack/office-hours/SKILL.md", state);
  assert.equal(loose.type, "upstream");
  assert.equal(loose.upstream, "gstack");
  assert.equal(loose.commit_kind, "active");
  if (state.lockfile.upstreams?.gstack?.active_commit) {
    assert.equal(loose.commit, state.lockfile.upstreams.gstack.active_commit);
    assert.equal(
      loose.path,
      path.join(pluginRoot, "references", "upstreams", "gstack", "commits", loose.commit, "office-hours", "SKILL.md"),
    );
    await fs.access(loose.path);

    const strict = await resolveActiveReferenceStrict("gstack/office-hours/SKILL.md", state);
    assert.equal(strict.commit, loose.commit);
    assert.equal(strict.path, loose.path);
    assert.equal(strict.exists, true);

    const preSyncState = {
      ...state,
      lockfile: {
        ...state.lockfile,
        upstreams: {
          ...state.lockfile.upstreams,
          gstack: {
            ...state.lockfile.upstreams.gstack,
            active_commit: null,
          },
        },
      },
    };
    const preSyncLoose = resolveActiveReference("gstack/office-hours/SKILL.md", preSyncState);
    assert.equal(preSyncLoose.commit, null);
    assert.equal(preSyncLoose.path, null);
    await assert.rejects(
      () => resolveActiveReferenceStrict("gstack/office-hours/SKILL.md", preSyncState),
      /no active_commit/,
    );
  } else {
    assert.equal(loose.commit, null);
    assert.equal(loose.path, null);

    await assert.rejects(
      () => resolveActiveReferenceStrict("gstack/office-hours/SKILL.md", state),
      /no active_commit/,
    );
  }
});

test("reference resolver rejects invalid upstream names, path escapes, and unknown upstream refs", async () => {
  const state = await loadProjectState(pluginRoot);

  assert.throws(() => assertSafeUpstreamName("../gstack"), /upstream name must be a simple logical id/);
  assert.throws(() => assertSafeUpstreamName("gstack/main"), /upstream name must be a simple logical id/);
  assert.throws(() => assertSafeLogicalPath("../secrets.md"), /escapes its root/);
  assert.throws(() => assertSafeLogicalPath("/absolute.md"), /must be relative/);
  assert.throws(
    () => materializedUpstreamPath(pluginRoot, "../gstack", "abc123", "office-hours/SKILL.md"),
    /upstream name must be a simple logical id/,
  );
  assert.throws(
    () => materializedUpstreamPath(pluginRoot, "gstack", "abc123", "../office-hours/SKILL.md"),
    /source_path escapes its root/,
  );
  assert.throws(
    () => resolveReference("not-an-upstream/office-hours/SKILL.md", state),
    /Unknown manifest reference/,
  );
});
