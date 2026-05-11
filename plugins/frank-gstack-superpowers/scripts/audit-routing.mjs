#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EXPECTED_WRAPPERS } from "./generate-plugin.mjs";
import { pathExists, readJson } from "./lib/fs-utils.mjs";
import {
  DEFAULT_PLUGIN_ROOT,
  adapterPath,
  listUpstreamSkillEntries,
  loadProjectState,
  materializedUpstreamPath,
  resolveReference,
} from "./lib/reference-resolver.mjs";
import {
  ERROR_CODES,
  RUN_STATUS,
  markRunFailure,
  markRunRunning,
  markRunSuccess,
} from "./lib/run-state.mjs";

const FORBIDDEN_NATIVE_REVIEW_PATTERNS = Object.freeze([
  { label: "codex review", regex: /\bcodex\s+review\b/i },
  { label: "codex exec review", regex: /\bcodex\s+exec\s+review\b/i },
  { label: "codex/review", regex: /\bcodex\/review\b/i },
  { label: "standalone /review", regex: /(^|[\s"'`(])\/review\b/i },
  {
    label: "native/generic Codex review wording",
    regex: /\b(?:native|generic)\s+(?:platform\s+|host-runtime\s+)?codex\s+review\b/i,
  },
]);
const ALLOWED_WORKFLOW_STATUSES = new Set([
  RUN_STATUS.RUNNING,
  RUN_STATUS.SUCCESS,
  RUN_STATUS.BLOCKED,
  RUN_STATUS.NEEDS_USER,
  RUN_STATUS.FAILED,
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(errors, message) {
  errors.push(message);
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return {};
  const end = source.indexOf("\n---", 4);
  if (end === -1) return {};
  const body = source.slice(4, end);
  const values = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    values[match[1]] =
      (raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
  return values;
}

async function listDirectories(dirPath) {
  if (!(await pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
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

function forbiddenNativeReviewMatches(source) {
  const matches = [];
  for (const pattern of FORBIDDEN_NATIVE_REVIEW_PATTERNS) {
    if (pattern.regex.test(source)) matches.push(pattern.label);
  }
  return matches;
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
      if (forbiddenNativeReviewMatches(line).length === 0) return true;
      return !/\b(suppress(?:ed|ion)?|forbid(?:den)?|disallow(?:ed)?|disabled|do not invoke|do not use)\b/i.test(
        line,
      );
    })
    .join("\n");
}

function auditableGeneratedSkillSource(source) {
  return stripExplicitSuppressionNotes(stripSuppressedRoutesJson(stripSuppressedRoutesSection(source)));
}

function manifestReferences(manifest) {
  const refs = [];
  for (const reference of manifest.policy?.default_review_chain ?? []) {
    refs.push({ source: "policy.default_review_chain", reference });
  }
  for (const [wrapperName, wrapper] of Object.entries(manifest.wrappers ?? {})) {
    for (const reference of wrapper.references ?? []) {
      refs.push({ source: `wrappers.${wrapperName}.references`, reference });
    }
    for (const reference of wrapper.conditional_references ?? []) {
      refs.push({ source: `wrappers.${wrapperName}.conditional_references`, reference });
    }
  }
  for (const [skillId, skill] of Object.entries(manifest.upstream_skills ?? {})) {
    if (skill.adapter) {
      refs.push({ source: `upstream_skills.${skillId}.adapter`, reference: skill.adapter });
    }
  }
  return refs;
}

async function auditPluginJson(state, errors) {
  const pluginJsonPath = path.join(state.pluginRoot, ".codex-plugin", "plugin.json");
  if (!(await pathExists(pluginJsonPath))) {
    fail(errors, `.codex-plugin/plugin.json is missing`);
    return;
  }
  let pluginJson;
  try {
    pluginJson = await readJson(pluginJsonPath);
  } catch (error) {
    fail(errors, `.codex-plugin/plugin.json is not valid JSON: ${error.message}`);
    return;
  }
  if (!pluginJson.skills) {
    fail(errors, `.codex-plugin/plugin.json must declare a skills path`);
    return;
  }
  const skillsPath = path.resolve(state.pluginRoot, pluginJson.skills);
  if (!(await pathExists(skillsPath))) {
    fail(errors, `plugin.json skills path does not exist: ${pluginJson.skills}`);
  }
}

async function auditGeneratedSkills(state, manifestHash, errors) {
  const skillsRoot = path.join(state.pluginRoot, "skills");
  const dirs = await listDirectories(skillsRoot);
  const expected = [...EXPECTED_WRAPPERS].sort();
  if (JSON.stringify(dirs) !== JSON.stringify(expected)) {
    fail(errors, `skills/ must contain exactly ${expected.join(", ")}; found ${dirs.join(", ")}`);
  }

  const upstreamEntries = listUpstreamSkillEntries(state.manifest);
  for (const entry of upstreamEntries) {
    const rawNames = new Set([
      entry.raw_name,
      entry.codex_exported_name,
      entry.id,
      entry.codex_exported_name?.replace(/^superpowers:/, ""),
    ]);
    for (const rawName of rawNames) {
      if (rawName && dirs.includes(rawName)) {
        fail(errors, `raw upstream skill directory was exported: skills/${rawName}`);
      }
    }
  }

  for (const wrapperName of expected) {
    const skillPath = path.join(skillsRoot, wrapperName, "SKILL.md");
    if (!(await pathExists(skillPath))) {
      fail(errors, `missing generated skill: skills/${wrapperName}/SKILL.md`);
      continue;
    }
    const source = await fs.readFile(skillPath, "utf8");
    const frontmatter = parseFrontmatter(source);
    if (frontmatter.name !== wrapperName) {
      fail(errors, `frontmatter name mismatch in ${wrapperName}: ${frontmatter.name ?? "<missing>"}`);
    }
    const description = frontmatter.description ?? "";
    if (description.length < 20 || description.length > 220) {
      fail(errors, `frontmatter description length is unreasonable in ${wrapperName}: ${description.length}`);
    }
    if (frontmatter.manifest_hash !== `sha256:${manifestHash}`) {
      fail(errors, `manifest hash mismatch in ${wrapperName}`);
    }
  }
}

async function auditReferences(state, errors, warnings, { preSyncOk = false } = {}) {
  for (const { source, reference } of manifestReferences(state.manifest)) {
    let resolved;
    try {
      resolved = resolveReference(reference, state, { commitKind: "active" });
    } catch (error) {
      fail(errors, `${source} has unresolved reference ${reference}: ${error.message}`);
      continue;
    }

    if (resolved.type === "adapter") {
      const filePath = adapterPath(state.pluginRoot, reference);
      if (!(await pathExists(filePath))) {
        fail(errors, `${source} adapter is missing: ${reference}`);
      }
      continue;
    }

    if (resolved.type !== "upstream") {
      fail(errors, `${source} has unsupported reference type for ${reference}`);
      continue;
    }

    const activeCommit = state.lockfile.upstreams?.[resolved.upstream]?.active_commit ?? null;
    if (!activeCommit) {
      const message = `${reference} has no active_commit`;
      if (preSyncOk) {
        warnings.push(`${message}; pre-sync materialization check skipped`);
      } else {
        fail(errors, `${source} ${message}`);
      }
      continue;
    }

    const expectedPath = materializedUpstreamPath(
      state.pluginRoot,
      resolved.upstream,
      activeCommit,
      resolved.source_path,
    );
    if (!(await pathExists(expectedPath))) {
      fail(errors, `${source} active upstream file is missing: ${reference} at ${expectedPath}`);
    }
  }
}

function auditHiddenExports(manifest, errors) {
  for (const entry of listUpstreamSkillEntries(manifest)) {
    if (entry.visibility?.exported !== false) {
      fail(errors, `upstream skill must not be exported: ${entry.id}`);
    }
    if (entry.visibility?.executable_directly !== false) {
      fail(errors, `upstream skill must not be directly executable: ${entry.id}`);
    }
    if ((entry.role === "Hidden" || entry.role === "Upstream-only") && entry.visibility?.exported !== false) {
      fail(errors, `hidden/upstream-only entry is exported: ${entry.id}`);
    }
  }
}

async function auditForbiddenPatterns(state, errors) {
  const skillFiles = await collectFiles(path.join(state.pluginRoot, "skills"));
  const adapterFiles = await collectFiles(path.join(state.pluginRoot, "references", "adapters"));

  for (const filePath of skillFiles) {
    const source = await fs.readFile(filePath, "utf8");
    const matches = forbiddenNativeReviewMatches(auditableGeneratedSkillSource(source));
    if (matches.length > 0) {
      fail(
        errors,
        `forbidden native review invocation found in ${path.relative(state.pluginRoot, filePath)}: ${matches.join(", ")}`,
      );
    }
  }

  for (const filePath of adapterFiles) {
    const source = await fs.readFile(filePath, "utf8");
    const matches = forbiddenNativeReviewMatches(stripExplicitSuppressionNotes(source));
    if (matches.length > 0) {
      fail(
        errors,
        `forbidden native review invocation found in ${path.relative(state.pluginRoot, filePath)}: ${matches.join(", ")}`,
      );
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function auditWorkflowRunArtifacts(state, errors) {
  const artifactPath = path.join(state.pluginRoot, "artifacts", "workflow-run.json");
  if (!(await pathExists(artifactPath))) return;

  let record;
  try {
    record = await readJson(artifactPath);
  } catch (error) {
    fail(errors, `workflow-run.json is not valid JSON: ${error.message}`);
    return;
  }

  if (typeof record.timestamp !== "string" || Number.isNaN(Date.parse(record.timestamp))) {
    fail(errors, `workflow-run.json timestamp is invalid`);
  }
  if (typeof record.step !== "string" || record.step.length === 0) {
    fail(errors, `workflow-run.json step must be a non-empty string`);
  }
  if (!ALLOWED_WORKFLOW_STATUSES.has(record.status)) {
    fail(errors, `workflow-run.json status is invalid: ${record.status}`);
  }
  if (!(record.error_code === null || typeof record.error_code === "string")) {
    fail(errors, `workflow-run.json error_code must be null or string`);
  }
  if (!isPlainObject(record.details)) {
    fail(errors, `workflow-run.json details must be an object`);
  }
  if (!Array.isArray(record.history)) {
    fail(errors, `workflow-run.json history must be an array`);
  }
}

export async function auditRouting(pluginRoot = DEFAULT_PLUGIN_ROOT, options = {}) {
  const state = await loadProjectState(pluginRoot);
  const manifestRaw = await fs.readFile(state.manifestPath, "utf8");
  const manifestHash = sha256(manifestRaw);
  const errors = [];
  const warnings = [];

  await auditPluginJson(state, errors);
  await auditGeneratedSkills(state, manifestHash, errors);
  await auditReferences(state, errors, warnings, options);
  auditHiddenExports(state.manifest, errors);
  await auditForbiddenPatterns(state, errors);
  await auditWorkflowRunArtifacts(state, errors);

  return {
    status: errors.length === 0 ? "success" : "failed",
    manifest_hash: `sha256:${manifestHash}`,
    errors,
    warnings,
  };
}

export async function main() {
  await markRunRunning(DEFAULT_PLUGIN_ROOT, "audit-routing");
  const preSyncOk = process.argv.includes("--pre-sync-ok");
  const result = await auditRouting(DEFAULT_PLUGIN_ROOT, { preSyncOk });
  if (result.errors.length > 0) {
    await markRunFailure(DEFAULT_PLUGIN_ROOT, "audit-routing", ERROR_CODES.UNKNOWN, result);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  await markRunSuccess(DEFAULT_PLUGIN_ROOT, "audit-routing", result);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
