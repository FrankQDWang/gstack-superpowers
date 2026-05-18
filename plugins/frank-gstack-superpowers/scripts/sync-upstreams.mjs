#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  copyAllowlistedFiles,
  ensureDir,
  makeTempDir,
  pathExists,
  readJson,
  writeJsonAtomic,
} from "./lib/fs-utils.mjs";
import {
  DEFAULT_PLUGIN_ROOT,
  assertSafeUpstreamName,
  listAllowlistedSourcePaths,
  loadProjectState,
  materializedUpstreamPath,
} from "./lib/reference-resolver.mjs";
import { buildEvidence } from "./build-update-evidence.mjs";
import {
  ERROR_CODES,
  RUN_STATUS,
  markRunFailure,
  markRunRunning,
  markRunSuccess,
} from "./lib/run-state.mjs";

const execFileAsync = promisify(execFile);
const DEFAULT_RESOLVE_RETRY_DELAYS_MS = [500, 1500];

class CliError extends Error {
  constructor(code, message, details = {}, status = RUN_STATUS.FAILED) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

async function runGit(args, options = {}) {
  try {
    return await execFileAsync("git", args, {
      ...options,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        ...(options.env ?? {}),
      },
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    error.git_args = args;
    throw error;
  }
}

function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function commandOutput(error) {
  return [error?.stderr, error?.stdout, error?.message].filter(Boolean).join("\n");
}

export function classifyLsRemoteFailure(error) {
  const output = commandOutput(error);
  if (
    /Could not resolve host|Name or service not known|nodename nor servname|Temporary failure in name resolution|getaddrinfo ENOTFOUND/i.test(
      output,
    )
  ) {
    return {
      code: ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE,
      reason: "dns_unavailable",
      status: RUN_STATUS.BLOCKED,
    };
  }
  if (/Network is unreachable|No route to host|Could not connect|Connection timed out|Connection refused/i.test(output)) {
    return {
      code: ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE,
      reason: "network_unavailable",
      status: RUN_STATUS.BLOCKED,
    };
  }
  return {
    code: ERROR_CODES.GIT_LS_REMOTE_FAILED,
    reason: "git_ls_remote_failed",
    status: RUN_STATUS.FAILED,
  };
}

function environmentSnapshot() {
  const proxyKeys = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "no_proxy",
  ];
  return {
    cwd: process.cwd(),
    codex_ci: process.env.CODEX_CI ?? null,
    codex_shell: process.env.CODEX_SHELL ?? null,
    codex_thread_id: process.env.CODEX_THREAD_ID ?? null,
    bundle_identifier: process.env.__CFBundleIdentifier ?? null,
    proxy_env: Object.fromEntries(proxyKeys.map((key) => [key, process.env[key] ? "set" : "unset"])),
  };
}

async function resolveLatestCommit(upstreamName, upstream, options = {}) {
  const safeUpstreamName = assertSafeUpstreamName(upstreamName);
  const git = options.git ?? runGit;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RESOLVE_RETRY_DELAYS_MS;
  const attempts = [];

  for (let attempt = 1; attempt <= retryDelaysMs.length + 1; attempt += 1) {
    const startedAt = new Date().toISOString();
    try {
      const { stdout } = await git(["ls-remote", upstream.repo, `refs/heads/${upstream.branch}`]);
      const line = stdout.trim().split(/\r?\n/).find(Boolean);
      const commit = line?.split(/\s+/)[0] ?? null;
      if (!commit || !/^[0-9a-f]{40}$/i.test(commit)) {
        throw new Error(`Unexpected ls-remote output for ${upstreamName}`);
      }
      attempts.push({
        attempt,
        started_at: startedAt,
        status: "success",
      });
      return { commit, attempts };
    } catch (error) {
      const classification = classifyLsRemoteFailure(error);
      attempts.push({
        attempt,
        started_at: startedAt,
        status: "failed",
        reason: classification.reason,
        stderr: error.stderr ? String(error.stderr).slice(0, 2000) : null,
        message: error.message ? String(error.message).slice(0, 1000) : null,
      });

      if (attempt <= retryDelaysMs.length && classification.code === ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE) {
        await sleep(retryDelaysMs[attempt - 1]);
        continue;
      }

      throw new CliError(classification.code, `Could not resolve ${safeUpstreamName}`, {
        upstream: safeUpstreamName,
        repo: upstream.repo,
        branch: upstream.branch,
        reason: classification.reason,
        attempts,
        environment: environmentSnapshot(),
        stderr: error.stderr ?? error.message,
      }, classification.status);
    }
  }

  throw new CliError(ERROR_CODES.GIT_LS_REMOTE_FAILED, `Could not resolve ${safeUpstreamName}`, {
    upstream: safeUpstreamName,
    repo: upstream.repo,
    branch: upstream.branch,
    attempts,
    environment: environmentSnapshot(),
  });
}

export async function preflightUpstreamResolution(upstreams, options = {}) {
  const results = {};
  const failures = [];

  for (const [upstreamName, upstream] of Object.entries(upstreams ?? {})) {
    const safeUpstreamName = assertSafeUpstreamName(upstreamName);
    try {
      const resolved = await resolveLatestCommit(safeUpstreamName, upstream, options);
      results[safeUpstreamName] = {
        repo: upstream.repo,
        branch: upstream.branch,
        commit: resolved.commit,
        status: "success",
        attempts: resolved.attempts,
      };
    } catch (error) {
      const details = error.details ?? {};
      results[safeUpstreamName] = {
        repo: upstream.repo,
        branch: upstream.branch,
        commit: null,
        status: "failed",
        error_code: error.code ?? ERROR_CODES.UNKNOWN,
        reason: details.reason ?? "unknown",
        attempts: details.attempts ?? [],
        stderr: details.stderr ?? error.message,
      };
      failures.push({
        upstream: safeUpstreamName,
        error_code: error.code ?? ERROR_CODES.UNKNOWN,
        reason: details.reason ?? "unknown",
      });
    }
  }

  const blocked = failures.some((failure) => failure.error_code === ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE);
  return {
    status: failures.length === 0 ? "success" : blocked ? RUN_STATUS.BLOCKED : RUN_STATUS.FAILED,
    checked_at: new Date().toISOString(),
    environment: environmentSnapshot(),
    upstreams: results,
    failures,
  };
}

function assertPreflightSucceeded(preflight) {
  if (preflight.status === "success") return;
  const blocked = preflight.status === RUN_STATUS.BLOCKED;
  throw new CliError(
    blocked ? ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE : ERROR_CODES.GIT_LS_REMOTE_FAILED,
    blocked ? "Upstream network preflight failed" : "Upstream resolve preflight failed",
    { preflight },
    blocked ? RUN_STATUS.BLOCKED : RUN_STATUS.FAILED,
  );
}

function commitFromPreflight(preflight, upstreamName) {
  const safeUpstreamName = assertSafeUpstreamName(upstreamName);
  const commit = preflight.upstreams?.[safeUpstreamName]?.commit ?? null;
  if (!commit) {
    throw new CliError(ERROR_CODES.GIT_LS_REMOTE_FAILED, `Preflight did not resolve ${safeUpstreamName}`, {
      upstream: safeUpstreamName,
      preflight,
    });
  }
  return commit;
}

async function materializeCandidate({ pluginRoot, manifest, upstreamName, upstream, commit }) {
  const safeUpstreamName = assertSafeUpstreamName(upstreamName);
  const relativePaths = listAllowlistedSourcePaths(manifest, safeUpstreamName);
  const tempRoot = await makeTempDir(`frank-gstack-superpowers-${safeUpstreamName}-`);
  const checkoutDir = path.join(tempRoot, "checkout");

  try {
    await ensureDir(checkoutDir);
    await runGit(["init", checkoutDir]);
    await runGit(["-C", checkoutDir, "remote", "add", "origin", upstream.repo]);
    await runGit(["-C", checkoutDir, "fetch", "--depth=1", "origin", commit]);

    for (const relativePath of relativePaths) {
      const { stdout } = await runGit(["-C", checkoutDir, "show", `FETCH_HEAD:${relativePath}`]);
      const outputPath = path.join(checkoutDir, relativePath);
      await ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, stdout, "utf8");
    }

    const destinationRoot = path.join(pluginRoot, "references", "upstreams", safeUpstreamName, "commits", commit);
    const result = await copyAllowlistedFiles({
      sourceRoot: checkoutDir,
      destinationRoot,
      relativePaths,
    });

    if (result.missing.length > 0) {
      throw new CliError(ERROR_CODES.UPSTREAM_MATERIALIZATION_FAILED, `${safeUpstreamName} is missing allowlisted files`, {
        upstream: safeUpstreamName,
        commit,
        missing: result.missing,
      });
    }

    return {
      upstream: safeUpstreamName,
      commit,
      copied: result.copied.map((entry) => entry.relative_path),
      materialized_root: destinationRoot,
    };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(ERROR_CODES.GIT_FETCH_FAILED, `Could not materialize ${upstreamName}`, {
      upstream: safeUpstreamName,
      commit,
      stderr: error.stderr ?? error.message,
      git_args: error.git_args ?? null,
    });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function ensureLockUpstream(lockfile, name, manifestUpstream) {
  const safeName = assertSafeUpstreamName(name);
  lockfile.upstreams ??= {};
  lockfile.upstreams[safeName] ??= {};
  lockfile.upstreams[safeName].repo ??= manifestUpstream.repo;
  lockfile.upstreams[safeName].branch ??= manifestUpstream.branch;
  lockfile.upstreams[safeName].active_commit ??= null;
  lockfile.upstreams[safeName].candidate_commit ??= null;
  lockfile.upstreams[safeName].last_checked_at ??= null;
  return lockfile.upstreams[safeName];
}

async function invalidateAssessmentArtifacts(pluginRoot) {
  const paths = [
    path.join(pluginRoot, "artifacts", "llm-update-assessment.json"),
    path.join(pluginRoot, "artifacts", "llm-update-assessment.md"),
  ];
  const removed = [];

  for (const artifactPath of paths) {
    if (await pathExists(artifactPath)) {
      await fs.rm(artifactPath, { force: true });
      removed.push(artifactPath);
    }
  }

  return removed;
}

export async function syncCandidates() {
  const state = await loadProjectState(DEFAULT_PLUGIN_ROOT);
  const checkedAt = new Date().toISOString();
  const materialized = [];
  const preflight = await preflightUpstreamResolution(state.manifest.upstreams);
  assertPreflightSucceeded(preflight);

  for (const [upstreamName, upstream] of Object.entries(state.manifest.upstreams ?? {})) {
    const safeUpstreamName = assertSafeUpstreamName(upstreamName);
    const commit = commitFromPreflight(preflight, safeUpstreamName);
    materialized.push(
      await materializeCandidate({
        pluginRoot: state.pluginRoot,
        manifest: state.manifest,
        upstreamName: safeUpstreamName,
        upstream,
        commit,
      }),
    );

    const lockUpstream = ensureLockUpstream(state.lockfile, safeUpstreamName, upstream);
    lockUpstream.repo = upstream.repo;
    lockUpstream.branch = upstream.branch;
    lockUpstream.candidate_commit = commit;
    lockUpstream.last_checked_at = checkedAt;
  }

  await writeJsonAtomic(state.lockfilePath, state.lockfile);
  const invalidatedAssessmentArtifacts = await invalidateAssessmentArtifacts(state.pluginRoot);
  return {
    checked_at: checkedAt,
    preflight,
    materialized,
    assessment_invalidated: invalidatedAssessmentArtifacts.length > 0,
    invalidated_assessment_artifacts: invalidatedAssessmentArtifacts,
  };
}

function assessmentIsBlocking(assessment) {
  return (
    assessment.llm_used !== true ||
    assessment.status !== "ready" ||
    !["promote", "promote-with-changes"].includes(assessment.recommendation)
  );
}

function currentCandidateCommits(state) {
  return Object.fromEntries(
    Object.keys(state.manifest.upstreams ?? {}).map((upstreamName) => [
      assertSafeUpstreamName(upstreamName),
      state.lockfile.upstreams?.[assertSafeUpstreamName(upstreamName)]?.candidate_commit ?? null,
    ]),
  );
}

function candidateCommitsMatch(assessmentCandidateCommits, lockCandidateCommits) {
  if (!assessmentCandidateCommits || typeof assessmentCandidateCommits !== "object") return false;
  return Object.entries(lockCandidateCommits).every(
    ([upstreamName, commit]) => assessmentCandidateCommits[upstreamName] === commit,
  );
}

export async function promoteCandidate() {
  const state = await loadProjectState(DEFAULT_PLUGIN_ROOT);
  const missingCandidates = [];

  for (const [upstreamName, upstream] of Object.entries(state.manifest.upstreams ?? {})) {
    const safeUpstreamName = assertSafeUpstreamName(upstreamName);
    const lockUpstream = ensureLockUpstream(state.lockfile, safeUpstreamName, upstream);
    if (!lockUpstream.candidate_commit) {
      missingCandidates.push(safeUpstreamName);
      continue;
    }

    for (const sourcePath of listAllowlistedSourcePaths(state.manifest, safeUpstreamName)) {
      const materializedPath = materializedUpstreamPath(
        state.pluginRoot,
        safeUpstreamName,
        lockUpstream.candidate_commit,
        sourcePath,
      );
      if (!(await pathExists(materializedPath))) {
        throw new CliError(ERROR_CODES.UPSTREAM_MATERIALIZATION_FAILED, "Candidate materialization is incomplete", {
          upstream: safeUpstreamName,
          commit: lockUpstream.candidate_commit,
          source_path: sourcePath,
          materialized_path: materializedPath,
        });
      }
    }
  }

  if (missingCandidates.length > 0) {
    throw new CliError(ERROR_CODES.MISSING_CANDIDATE_COMMIT, "Every upstream must have a candidate_commit", {
      missing_upstreams: missingCandidates,
    }, RUN_STATUS.BLOCKED);
  }

  const assessmentPath = path.join(state.pluginRoot, "artifacts", "llm-update-assessment.json");
  if (!(await pathExists(assessmentPath))) {
    throw new CliError(ERROR_CODES.LLM_ASSESSMENT_MISSING, "LLM assessment artifact is required before promotion", {
      assessment_path: assessmentPath,
    }, RUN_STATUS.BLOCKED);
  }

  let evidence;
  try {
    ({ evidence } = await buildEvidence());
  } catch (error) {
    throw new CliError(ERROR_CODES.EVIDENCE_BUILD_FAILED, "Could not rebuild update evidence before promotion", {
      message: error.message,
    }, RUN_STATUS.BLOCKED);
  }
  const assessment = await readJson(assessmentPath);
  if (!evidence.evidence_hash || assessment.evidence_hash !== evidence.evidence_hash) {
    throw new CliError(ERROR_CODES.LLM_ASSESSMENT_BLOCKED, "LLM assessment does not match current evidence hash", {
      assessment_evidence_hash: assessment.evidence_hash ?? null,
      current_evidence_hash: evidence.evidence_hash ?? null,
    }, RUN_STATUS.BLOCKED);
  }

  const lockCandidateCommits = currentCandidateCommits(state);
  if (!candidateCommitsMatch(assessment.candidate_commits, lockCandidateCommits)) {
    throw new CliError(ERROR_CODES.LLM_ASSESSMENT_BLOCKED, "LLM assessment candidate commits are stale", {
      assessment_candidate_commits: assessment.candidate_commits ?? null,
      lock_candidate_commits: lockCandidateCommits,
    }, RUN_STATUS.BLOCKED);
  }

  if (assessmentIsBlocking(assessment)) {
    throw new CliError(ERROR_CODES.LLM_ASSESSMENT_BLOCKED, "LLM assessment does not allow promotion", {
      status: assessment.status ?? null,
      recommendation: assessment.recommendation ?? null,
      llm_used: assessment.llm_used ?? null,
    }, RUN_STATUS.BLOCKED);
  }

  const promoted = {};
  for (const [upstreamName, upstream] of Object.entries(state.manifest.upstreams ?? {})) {
    const safeUpstreamName = assertSafeUpstreamName(upstreamName);
    const lockUpstream = ensureLockUpstream(state.lockfile, safeUpstreamName, upstream);
    lockUpstream.active_commit = lockUpstream.candidate_commit;
    lockUpstream.candidate_commit = null;
    promoted[safeUpstreamName] = lockUpstream.active_commit;
  }

  await writeJsonAtomic(state.lockfilePath, state.lockfile);
  return { promoted };
}

function parseArgs(argv) {
  const candidate = argv.includes("--candidate");
  const promote = argv.includes("--promote-candidate");
  if (candidate === promote || argv.some((arg) => !["--candidate", "--promote-candidate"].includes(arg))) {
    throw new CliError(ERROR_CODES.INVALID_ARGS, "Use exactly one of --candidate or --promote-candidate", {
      argv,
    });
  }
  return candidate ? "candidate" : "promote-candidate";
}

export async function main() {
  let mode = "unknown";
  try {
    mode = parseArgs(process.argv.slice(2));
    await markRunRunning(DEFAULT_PLUGIN_ROOT, `sync-upstreams:${mode}`);

    const details = mode === "candidate" ? await syncCandidates() : await promoteCandidate();
    await markRunSuccess(DEFAULT_PLUGIN_ROOT, `sync-upstreams:${mode}`, details);
    console.log(JSON.stringify({ status: "success", mode, ...details }, null, 2));
  } catch (error) {
    const code = error.code ?? ERROR_CODES.UNKNOWN;
    const status = error.status ?? RUN_STATUS.FAILED;
    const details = error.details ?? { message: error.message };
    await markRunFailure(DEFAULT_PLUGIN_ROOT, `sync-upstreams:${mode}`, code, details, status);
    console.error(`${code}: ${error.message}`);
    if (Object.keys(details).length > 0) {
      console.error(JSON.stringify(details, null, 2));
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
