#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pathExists, writeJsonAtomic } from "./lib/fs-utils.mjs";
import {
  DEFAULT_PLUGIN_ROOT,
  adapterPath,
  listAllowlistedSourcePaths,
  listUpstreamSkillEntries,
  loadProjectState,
  materializedUpstreamPath,
  repoRootFromPluginRoot,
} from "./lib/reference-resolver.mjs";
import {
  ERROR_CODES,
  RUN_STATUS,
  markRunFailure,
  markRunRunning,
  markRunSuccess,
} from "./lib/run-state.mjs";

const MAX_EXCERPT_LINES = 12;
const MAX_EXCERPT_LINE_CHARS = 180;

const RISK_PATTERNS = [
  {
    name: "native_codex_review",
    severity: "risk",
    regex: /\bcodex\s+(?:exec\s+)?review\b|\bcodex\/review\b|native codex review/i,
  },
  {
    name: "merge_or_push",
    severity: "risk",
    regex: /\b(git\s+push|merge\s+the\s+pr|merge\s+to\s+main|push\s+to\s+main)\b/i,
  },
  {
    name: "deploy_release_canary",
    severity: "risk",
    regex: /\b(deploy|release|canary|land-and-deploy)\b/i,
  },
  {
    name: "credentials",
    severity: "risk",
    regex: /\b(api[_-]?key|token|secret|credential|password)\b/i,
  },
  {
    name: "telemetry",
    severity: "risk",
    regex: /\b(telemetry|analytics|tracking|phone home)\b/i,
  },
  {
    name: "network",
    severity: "risk",
    regex: /\b(curl|wget|fetch\s+https?:|http request|network)\b/i,
  },
  {
    name: "memory",
    severity: "risk",
    regex: /\b(memory|remember|learned|persistent state)\b/i,
  },
  {
    name: "executable_permission",
    severity: "risk",
    regex: /\b(chmod\s+\+x|executable permission|run this script|execute)\b/i,
  },
];

const GENERATED_FORBIDDEN_PATTERNS = [
  {
    name: "native_codex_review",
    regex: /\bcodex\s+review\b|\bcodex\s+exec\s+review\b|\bcodex\/review\b|\b(?:native|generic)\s+(?:platform\s+|host-runtime\s+)?codex\s+review\b/i,
  },
  {
    name: "standalone_review_route",
    regex: /(^|[\s"'`(])\/review\b/i,
  },
  {
    name: "gstack_telemetry_command",
    regex: /\bgstack-(?:timeline-log|question-log|routing-injection|lake-intro|upgrade-check)\b/,
  },
  {
    name: "raw_reference_side_effect_command",
    regex: /\b(?:telemetry|analytics|timeline|question-log|routing-injection|lake-intro|upgrade-check)\s+commands?\b/,
  },
];

class EvidenceError extends Error {
  constructor(code, message, details = {}, status = RUN_STATUS.FAILED) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

async function readTextIfPresent(filePath) {
  if (!filePath || !(await pathExists(filePath))) return null;
  return fs.readFile(filePath, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function repoRelative(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

const EVIDENCE_HASH_VOLATILE_FIELDS = new Set(["evidence_hash", "generated_at"]);

export function stableJsonStringify(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => !EVIDENCE_HASH_VOLATILE_FIELDS.has(key))
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeEvidenceHash(evidence) {
  return sha256(stableJsonStringify(evidence));
}

function lineExcerpt(content, matchingIndexes = []) {
  const lines = content.split(/\r?\n/);
  const selected = [];
  const seen = new Set();

  for (const index of matchingIndexes) {
    for (let cursor = Math.max(0, index - 1); cursor <= Math.min(lines.length - 1, index + 1); cursor += 1) {
      if (!seen.has(cursor)) {
        selected.push(cursor);
        seen.add(cursor);
      }
    }
  }

  if (selected.length === 0) {
    for (let index = 0; index < Math.min(lines.length, MAX_EXCERPT_LINES); index += 1) {
      selected.push(index);
    }
  }

  return selected
    .slice(0, MAX_EXCERPT_LINES)
    .map((index) => ({
      line: index + 1,
      text: lines[index].slice(0, MAX_EXCERPT_LINE_CHARS),
    }));
}

async function collectFiles(dirPath) {
  if (!(await pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function stripSuppressedRoutesSection(source) {
  const lines = source.split(/\r?\n/);
  const kept = [];
  let skip = false;

  for (const line of lines) {
    if (/^##\s+Suppressed Routes\s*$/i.test(line.trim())) {
      skip = true;
      continue;
    }
    if (skip && /^##\s+/.test(line)) {
      skip = false;
    }
    if (!skip) kept.push(line);
  }

  return kept.join("\n");
}

function stripSuppressedRoutesJson(source) {
  const lines = source.split(/\r?\n/);
  const kept = [];
  let skip = false;

  for (const line of lines) {
    if (!skip && /"suppressed_routes"\s*:/.test(line)) {
      skip = true;
      if (/\]\s*,?\s*$/.test(line)) skip = false;
      continue;
    }
    if (skip) {
      if (/^\s*\]\s*,?\s*$/.test(line)) skip = false;
      continue;
    }
    kept.push(line);
  }

  return kept.join("\n");
}

function stripExplicitSuppressionNotes(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => {
      const hasForbidden = GENERATED_FORBIDDEN_PATTERNS.some((pattern) => pattern.regex.test(line));
      if (!hasForbidden) return true;
      return !/\b(suppress(?:ed|ion)?|forbid(?:den)?|disallow(?:ed)?|disabled|do not invoke|do not use|never run|neutralized)\b/i.test(
        line,
      );
    })
    .join("\n");
}

function auditableGeneratedSource(source) {
  return stripExplicitSuppressionNotes(stripSuppressedRoutesJson(stripSuppressedRoutesSection(source)));
}

function collectManifestAdapterReferences(manifest) {
  const references = [];
  for (const reference of manifest.policy?.default_review_chain ?? []) {
    if (reference.startsWith("adapters/")) references.push(reference);
  }
  for (const wrapper of Object.values(manifest.wrappers ?? {})) {
    for (const reference of [...(wrapper.references ?? []), ...(wrapper.conditional_references ?? [])]) {
      if (reference.startsWith("adapters/")) references.push(reference);
    }
  }
  for (const skill of Object.values(manifest.upstream_skills ?? {})) {
    if (skill.adapter?.startsWith("adapters/")) references.push(skill.adapter);
  }
  return [...new Set(references)].sort();
}

function manifestPolicySummary(manifest) {
  return {
    one_execution_owner: manifest.policy?.one_execution_owner ?? null,
    native_codex_review: manifest.policy?.native_codex_review ?? null,
    common_safety: manifest.policy?.common_safety ?? null,
    release_gate: manifest.policy?.release_gate ?? null,
    default_review_chain: manifest.policy?.default_review_chain ?? [],
  };
}

function wrapperPolicyNotes(wrapperName, wrapper, manifest) {
  const notes = [];
  const references = wrapper.references ?? [];
  const conditionalReferences = wrapper.conditional_references ?? [];

  if (
    references.includes("adapters/gstack/common-safety.md") &&
    conditionalReferences.some((reference) => reference.startsWith("gstack/"))
  ) {
    notes.push("Common-safety applies to conditional gstack references before raw conditional material is read.");
  }

  if (references.includes("adapters/superpowers/orchestration-boundary.md")) {
    notes.push(
      "Superpowers subagent-driven instructions define implementation discipline only; Codex host policy controls whether agents can be spawned.",
    );
  }

  if (references.includes("gstack/review/SKILL.md")) {
    notes.push(
      "Raw gstack review is part of the curated review chain; standalone/native Codex review remains suppressed outside that gstack-managed gate.",
    );
  }

  const releaseGate = manifest.policy?.release_gate;
  const releaseRequests = new Set(releaseGate?.requests ?? []);
  const releaseReferenced =
    references.some((reference) =>
      /(?:ship|document-release|land-and-deploy|canary|finish-readiness|ship-readiness)/.test(reference),
    ) ||
    (wrapper.suppress ?? []).some((suppression) =>
      [...releaseRequests].some((request) => suppression.includes(request)),
    );
  if (releaseGate?.default_route === "readiness_report" && releaseReferenced) {
    notes.push(
      "Release, deploy, canary, merge, and push requests route to readiness reporting unless a separate explicit release gate is present.",
    );
  }

  return notes;
}

function wrapperSummaries(manifest) {
  return Object.fromEntries(
    Object.entries(manifest.wrappers ?? {}).map(([wrapperName, wrapper]) => {
      const references = wrapper.references ?? [];
      const conditionalReferences = wrapper.conditional_references ?? [];
      const allReferences = [...references, ...conditionalReferences];
      return [
        wrapperName,
        {
          description: wrapper.description,
          primary: wrapper.primary,
          role: wrapper.role,
          references,
          conditional_references: conditionalReferences,
          suppressions: wrapper.suppress ?? [],
          policy_notes: wrapperPolicyNotes(wrapperName, wrapper, manifest),
          adapter_references: allReferences.filter((reference) => reference.startsWith("adapters/")),
          raw_gstack_references: allReferences.filter((reference) => reference.startsWith("gstack/")),
          raw_superpowers_references: allReferences.filter((reference) => reference.startsWith("superpowers/")),
        },
      ];
    }),
  );
}

function upstreamSkillVisibilityRoleAdapterMap(manifest) {
  return Object.fromEntries(
    listUpstreamSkillEntries(manifest).map((entry) => [
      entry.id,
      {
        upstream: entry.upstream,
        source_path: entry.source_path,
        raw_name: entry.raw_name,
        codex_exported_name: entry.codex_exported_name,
        role: entry.role,
        visibility: entry.visibility,
        adapter: entry.adapter ?? null,
      },
    ]),
  );
}

async function adapterFileEvidence(state) {
  const files = [];
  for (const reference of collectManifestAdapterReferences(state.manifest)) {
    const filePath = adapterPath(state.pluginRoot, reference);
    const content = await readTextIfPresent(filePath);
    files.push({
      reference,
      path: path.relative(state.pluginRoot, filePath).split(path.sep).join("/"),
      missing: content === null,
      sha256: content === null ? null : sha256(content),
      excerpt: content === null ? [] : lineExcerpt(content),
    });
  }
  return files;
}

async function generatedForbiddenPatternScan(state) {
  const files = [
    ...(await collectFiles(path.join(state.pluginRoot, "skills"))),
    ...(await collectFiles(path.join(state.pluginRoot, "references", "adapters"))),
  ];
  const matches = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const auditable = auditableGeneratedSource(content);
    const relativePath = path.relative(state.pluginRoot, filePath).split(path.sep).join("/");
    for (const pattern of GENERATED_FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(auditable)) {
        matches.push({
          path: relativePath,
          pattern: pattern.name,
        });
      }
    }
  }

  return {
    files_scanned: files.length,
    forbidden_pattern_matches: matches,
    summary:
      matches.length === 0
        ? "No forbidden route or reference-side-effect command patterns found in generated skills/adapters after suppression-aware filtering."
        : "Forbidden route or reference-side-effect command patterns remain in generated skills/adapters.",
  };
}

async function buildMitigationContext(state) {
  return {
    manifest_policy_summary: manifestPolicySummary(state.manifest),
    wrapper_summaries: wrapperSummaries(state.manifest),
    upstream_skill_visibility_role_adapter_map: upstreamSkillVisibilityRoleAdapterMap(state.manifest),
    adapter_files: await adapterFileEvidence(state),
    generated_forbidden_pattern_scan: await generatedForbiddenPatternScan(state),
  };
}

function findRiskMarkers({ upstream, sourcePath, content, activeContent }) {
  if (!content) return [];
  const activeLines = new Set((activeContent ?? "").split(/\r?\n/).map((line) => line.trim()));
  const markers = [];

  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || activeLines.has(trimmed)) return;

    for (const pattern of RISK_PATTERNS) {
      if (pattern.regex.test(line)) {
        markers.push({
          upstream,
          source_path: sourcePath,
          marker: pattern.name,
          severity: pattern.severity,
          line: index + 1,
          excerpt: trimmed.slice(0, MAX_EXCERPT_LINE_CHARS),
        });
      }
    }
  });

  return markers;
}

function skillFor(manifest, upstream, sourcePath) {
  return listUpstreamSkillEntries(manifest).find(
    (entry) => entry.upstream === upstream && entry.source_path === sourcePath,
  );
}

export async function buildEvidence({ write = true } = {}) {
  const state = await loadProjectState(DEFAULT_PLUGIN_ROOT);
  const repoRoot = repoRootFromPluginRoot(state.pluginRoot);
  const evidence = {
    generated_at: new Date().toISOString(),
    plugin_root: repoRelative(repoRoot, state.pluginRoot),
    commits: {},
    candidate_commits: {},
    changed_allowlisted_files: [],
    missing_files: [],
    adapter_required_upstream_changes: [],
    hidden_upstream_only_changed_mappings: [],
    risk_markers: [],
    policy_violations: [],
    source_excerpts: [],
  };

  evidence.mitigation_context = await buildMitigationContext(state);

  for (const [upstreamName] of Object.entries(state.manifest.upstreams ?? {})) {
    const lock = state.lockfile.upstreams?.[upstreamName] ?? {};
    const activeCommit = lock.active_commit ?? null;
    const candidateCommit = lock.candidate_commit ?? null;
    evidence.commits[upstreamName] = {
      active_commit: activeCommit,
      candidate_commit: candidateCommit,
      last_checked_at: lock.last_checked_at ?? null,
    };
    evidence.candidate_commits[upstreamName] = candidateCommit;

    for (const sourcePath of listAllowlistedSourcePaths(state.manifest, upstreamName)) {
      const activePath = materializedUpstreamPath(state.pluginRoot, upstreamName, activeCommit, sourcePath);
      const candidatePath = materializedUpstreamPath(state.pluginRoot, upstreamName, candidateCommit, sourcePath);

      if (activeCommit && !(await pathExists(activePath))) {
        evidence.missing_files.push({
          upstream: upstreamName,
          commit_kind: "active",
          commit: activeCommit,
          source_path: sourcePath,
          expected_path: repoRelative(repoRoot, activePath),
        });
      }

      if (candidateCommit && !(await pathExists(candidatePath))) {
        evidence.missing_files.push({
          upstream: upstreamName,
          commit_kind: "candidate",
          commit: candidateCommit,
          source_path: sourcePath,
          expected_path: repoRelative(repoRoot, candidatePath),
        });
      }

      if (!candidateCommit) continue;

      const [activeContent, candidateContent] = await Promise.all([
        readTextIfPresent(activePath),
        readTextIfPresent(candidatePath),
      ]);

      if (candidateContent === null) continue;
      const activeHash = activeContent === null ? null : sha256(activeContent);
      const candidateHash = sha256(candidateContent);
      if (activeHash === candidateHash) continue;

      const skill = skillFor(state.manifest, upstreamName, sourcePath);
      const change = {
        upstream: upstreamName,
        source_path: sourcePath,
        skill_id: skill?.id ?? null,
        role: skill?.role ?? null,
        adapter_required: skill?.visibility?.adapter_required === true,
        adapter: skill?.adapter ?? null,
        active_commit: activeCommit,
        candidate_commit: candidateCommit,
        active_sha256: activeHash,
        candidate_sha256: candidateHash,
        change_type: activeContent === null ? "added" : "modified",
      };
      evidence.changed_allowlisted_files.push(change);

      if (change.adapter_required) {
        evidence.adapter_required_upstream_changes.push(change);
      }
      if (change.role === "Hidden" || change.role === "Upstream-only") {
        evidence.hidden_upstream_only_changed_mappings.push(change);
      }

      const markers = findRiskMarkers({
        upstream: upstreamName,
        sourcePath,
        content: candidateContent,
        activeContent,
      });
      evidence.risk_markers.push(...markers);
      evidence.policy_violations.push(
        ...markers
          .filter((marker) => marker.severity === "policy")
          .map((marker) => ({
            ...marker,
            policy: "standalone_native_review_forbidden",
          })),
      );

      evidence.source_excerpts.push({
        upstream: upstreamName,
        source_path: sourcePath,
        candidate_commit: candidateCommit,
        reason: markers.length > 0 ? "risk-marker-context" : "changed-file-start",
        lines: lineExcerpt(candidateContent, markers.map((marker) => marker.line - 1)),
      });
    }
  }

  evidence.evidence_hash = computeEvidenceHash(evidence);
  const outputPath = path.join(state.pluginRoot, "artifacts", "update-evidence.json");
  if (write) {
    await writeJsonAtomic(outputPath, evidence);
  }
  return { output_path: repoRelative(repoRoot, outputPath), evidence };
}

export async function main() {
  await markRunRunning(DEFAULT_PLUGIN_ROOT, "build-update-evidence");
  try {
    const { output_path, evidence } = await buildEvidence();
    const details = {
      output_path,
      changed_files: evidence.changed_allowlisted_files.length,
      missing_files: evidence.missing_files.length,
      risk_markers: evidence.risk_markers.length,
      policy_violations: evidence.policy_violations.length,
    };
    await markRunSuccess(DEFAULT_PLUGIN_ROOT, "build-update-evidence", details);
    console.log(JSON.stringify({ status: "success", ...details }, null, 2));
  } catch (error) {
    const wrapped =
      error instanceof EvidenceError
        ? error
        : new EvidenceError(ERROR_CODES.EVIDENCE_BUILD_FAILED, error.message, { stack: error.stack });
    await markRunFailure(
      DEFAULT_PLUGIN_ROOT,
      "build-update-evidence",
      wrapped.code,
      wrapped.details,
      wrapped.status,
    );
    console.error(`${wrapped.code}: ${wrapped.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
