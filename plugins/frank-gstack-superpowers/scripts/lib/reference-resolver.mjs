import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists, readJson } from "./fs-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
export const MANIFEST_FILE = "workflow.manifest.yaml";
export const LOCKFILE_FILE = "upstreams.lock.json";

export function assertSafeLogicalPath(logicalPath, label = "path") {
  if (typeof logicalPath !== "string" || logicalPath.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (logicalPath.includes("\\")) {
    throw new Error(`${label} must use POSIX separators: ${logicalPath}`);
  }
  if (path.posix.isAbsolute(logicalPath)) {
    throw new Error(`${label} must be relative: ${logicalPath}`);
  }
  const normalized = path.posix.normalize(logicalPath);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} escapes its root: ${logicalPath}`);
  }
  return normalized;
}

export function assertSafeUpstreamName(name) {
  if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`upstream name must be a simple logical id: ${name}`);
  }
  return name;
}

function joinLogicalPath(root, logicalPath) {
  return path.join(root, ...assertSafeLogicalPath(logicalPath).split("/"));
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "[]") return [];
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYamlFallback(source) {
  const lines = source
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, index: index + 1 }))
    .filter(({ raw }) => raw.trim() !== "" && !raw.trimStart().startsWith("#"));

  let cursor = 0;

  function currentIndent() {
    const match = lines[cursor]?.raw.match(/^ */);
    return match ? match[0].length : 0;
  }

  function parseBlock(indent) {
    if (cursor >= lines.length) return {};
    if (currentIndent() < indent) return {};

    const first = lines[cursor].raw.slice(indent);
    if (first.startsWith("- ")) {
      const array = [];
      while (cursor < lines.length && currentIndent() === indent) {
        const line = lines[cursor].raw.slice(indent);
        if (!line.startsWith("- ")) break;
        array.push(parseScalar(line.slice(2)));
        cursor += 1;
      }
      return array;
    }

    const object = {};
    while (cursor < lines.length && currentIndent() === indent) {
      const line = lines[cursor].raw.slice(indent);
      const match = line.match(/^([^:]+):(.*)$/);
      if (!match) {
        throw new Error(`Unsupported YAML line ${lines[cursor].index}: ${lines[cursor].raw}`);
      }
      const key = match[1].trim();
      const rest = match[2].trim();
      cursor += 1;

      if (rest === "") {
        if (cursor < lines.length && currentIndent() > indent) {
          object[key] = parseBlock(currentIndent());
        } else {
          object[key] = {};
        }
      } else {
        object[key] = parseScalar(rest);
      }
    }
    return object;
  }

  return parseBlock(0);
}

export async function parseManifestYaml(source) {
  try {
    const yaml = await import("yaml");
    return yaml.parse(source);
  } catch {
    return parseYamlFallback(source);
  }
}

export function repoRootFromPluginRoot(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  return path.resolve(pluginRoot, "..", "..");
}

export async function loadManifest(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const manifestPath = path.join(pluginRoot, MANIFEST_FILE);
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = await parseManifestYaml(raw);
  return { manifest, manifestPath };
}

export async function loadLockfile(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const lockfilePath = path.join(pluginRoot, LOCKFILE_FILE);
  const lockfile = await readJson(lockfilePath);
  return { lockfile, lockfilePath };
}

export async function loadProjectState(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const [{ manifest, manifestPath }, { lockfile, lockfilePath }] = await Promise.all([
    loadManifest(pluginRoot),
    loadLockfile(pluginRoot),
  ]);
  return { pluginRoot, repoRoot: repoRootFromPluginRoot(pluginRoot), manifest, manifestPath, lockfile, lockfilePath };
}

export function listUpstreamSkillEntries(manifest) {
  return Object.entries(manifest.upstream_skills ?? {}).map(([id, skill]) => ({ id, ...skill }));
}

export function listAllowlistedSourcePaths(manifest, upstreamName) {
  const safeUpstreamName = assertSafeUpstreamName(upstreamName);
  return [
    ...new Set(
      listUpstreamSkillEntries(manifest)
        .filter((skill) => assertSafeUpstreamName(skill.upstream) === safeUpstreamName)
        .map((skill) => assertSafeLogicalPath(skill.source_path, "upstream skill source_path")),
    ),
  ].sort();
}

export function findUpstreamSkillByReference(manifest, reference) {
  const normalized = assertSafeLogicalPath(reference, "reference");
  const slashIndex = normalized.indexOf("/");
  if (slashIndex === -1) return null;
  const upstream = normalized.slice(0, slashIndex);
  const sourcePath = normalized.slice(slashIndex + 1);

  return (
    listUpstreamSkillEntries(manifest).find(
      (skill) => skill.upstream === upstream && assertSafeLogicalPath(skill.source_path) === sourcePath,
    ) ?? null
  );
}

export function materializedUpstreamPath(pluginRoot, upstream, commit, sourcePath) {
  const safeUpstream = assertSafeUpstreamName(upstream);
  const safeSourcePath = assertSafeLogicalPath(sourcePath, "source_path");
  if (!commit) return null;
  return joinLogicalPath(
    path.join(pluginRoot, "references", "upstreams", safeUpstream, "commits", commit),
    safeSourcePath,
  );
}

export function adapterPath(pluginRoot, reference) {
  const normalized = assertSafeLogicalPath(reference, "adapter reference");
  if (!normalized.startsWith("adapters/")) {
    throw new Error(`Adapter reference must start with adapters/: ${reference}`);
  }
  return joinLogicalPath(path.join(pluginRoot, "references"), normalized);
}

export function resolveReference(reference, state, { commitKind = "active", requireKnown = true } = {}) {
  const normalized = assertSafeLogicalPath(reference, "reference");

  if (normalized.startsWith("adapters/")) {
    return {
      reference: normalized,
      type: "adapter",
      path: adapterPath(state.pluginRoot, normalized),
      exists: null,
    };
  }

  const skill = findUpstreamSkillByReference(state.manifest, normalized);
  if (!skill) {
    if (requireKnown) {
      throw new Error(`Unknown manifest reference: ${reference}`);
    }
    return { reference: normalized, type: "unknown", path: null, exists: null };
  }

  const upstreamLock = state.lockfile.upstreams?.[skill.upstream] ?? {};
  const commitField = `${commitKind}_commit`;
  const commit = upstreamLock[commitField] ?? null;
  return {
    reference: normalized,
    type: "upstream",
    upstream: skill.upstream,
    source_path: skill.source_path,
    skill_id: skill.id,
    raw_name: skill.raw_name,
    role: skill.role,
    visibility: skill.visibility,
    adapter: skill.adapter ?? null,
    commit_kind: commitKind,
    commit,
    path: materializedUpstreamPath(state.pluginRoot, skill.upstream, commit, skill.source_path),
    exists: null,
  };
}

export async function resolveReferenceWithExistence(reference, state, options = {}) {
  const resolved = resolveReference(reference, state, options);
  return {
    ...resolved,
    exists: resolved.path ? await pathExists(resolved.path) : false,
  };
}

export async function resolveReferenceStrict(reference, state, options = {}) {
  const resolved = await resolveReferenceWithExistence(reference, state, options);

  if (resolved.type === "upstream") {
    if (!resolved.commit) {
      throw new Error(
        `Reference ${resolved.reference} has no ${resolved.commit_kind}_commit for upstream ${resolved.upstream}`,
      );
    }
    if (!resolved.path) {
      throw new Error(`Reference ${resolved.reference} has no materialized path`);
    }
    if (!resolved.exists) {
      throw new Error(`Reference ${resolved.reference} is not materialized at ${resolved.path}`);
    }
  }

  if (resolved.type === "adapter" && !(await pathExists(resolved.path))) {
    throw new Error(`Adapter reference ${resolved.reference} is not materialized at ${resolved.path}`);
  }

  return resolved;
}

export function resolveActiveReference(reference, state, options = {}) {
  return resolveReference(reference, state, { ...options, commitKind: "active" });
}

export function resolveCandidateReference(reference, state, options = {}) {
  return resolveReference(reference, state, { ...options, commitKind: "candidate" });
}

export async function resolveActiveReferenceStrict(reference, state, options = {}) {
  return resolveReferenceStrict(reference, state, { ...options, commitKind: "active" });
}

export async function resolveCandidateReferenceStrict(reference, state, options = {}) {
  return resolveReferenceStrict(reference, state, { ...options, commitKind: "candidate" });
}

export function listWrapperReferences(manifest, wrapperName) {
  const wrapper = manifest.wrappers?.[wrapperName];
  if (!wrapper) {
    throw new Error(`Unknown wrapper: ${wrapperName}`);
  }
  return {
    references: wrapper.references ?? [],
    conditional_references: wrapper.conditional_references ?? [],
    suppress: wrapper.suppress ?? [],
  };
}

export function resolveWrapperReferences(wrapperName, state, options = {}) {
  const refs = listWrapperReferences(state.manifest, wrapperName);
  return {
    wrapper: wrapperName,
    references: refs.references.map((reference) => resolveReference(reference, state, options)),
    conditional_references: refs.conditional_references.map((reference) =>
      resolveReference(reference, state, options),
    ),
    suppress: refs.suppress,
  };
}

export async function resolveWrapperReferencesStrict(wrapperName, state, options = {}) {
  const refs = listWrapperReferences(state.manifest, wrapperName);
  return {
    wrapper: wrapperName,
    references: await Promise.all(
      refs.references.map((reference) => resolveReferenceStrict(reference, state, options)),
    ),
    conditional_references: await Promise.all(
      refs.conditional_references.map((reference) => resolveReferenceStrict(reference, state, options)),
    ),
    suppress: refs.suppress,
  };
}

export function resolveActiveWrapperReferences(wrapperName, state, options = {}) {
  return resolveWrapperReferences(wrapperName, state, { ...options, commitKind: "active" });
}

export function resolveCandidateWrapperReferences(wrapperName, state, options = {}) {
  return resolveWrapperReferences(wrapperName, state, { ...options, commitKind: "candidate" });
}

export async function resolveActiveWrapperReferencesStrict(wrapperName, state, options = {}) {
  return resolveWrapperReferencesStrict(wrapperName, state, { ...options, commitKind: "active" });
}

export async function resolveCandidateWrapperReferencesStrict(wrapperName, state, options = {}) {
  return resolveWrapperReferencesStrict(wrapperName, state, { ...options, commitKind: "candidate" });
}

export function resolveAllWrapperReferences(state, options = {}) {
  return Object.keys(state.manifest.wrappers ?? {}).map((wrapperName) =>
    resolveWrapperReferences(wrapperName, state, options),
  );
}

export async function resolveAllWrapperReferencesStrict(state, options = {}) {
  return Promise.all(
    Object.keys(state.manifest.wrappers ?? {}).map((wrapperName) =>
      resolveWrapperReferencesStrict(wrapperName, state, options),
    ),
  );
}
