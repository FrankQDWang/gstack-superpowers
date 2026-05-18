import path from "node:path";
import { pathExists, readJson, writeJsonAtomic } from "./fs-utils.mjs";

export const RUN_STATUS = Object.freeze({
  RUNNING: "running",
  SUCCESS: "success",
  BLOCKED: "blocked",
  NEEDS_USER: "needs-user",
  FAILED: "failed",
});

export const ERROR_CODES = Object.freeze({
  INVALID_ARGS: "INVALID_ARGS",
  MANIFEST_LOAD_FAILED: "MANIFEST_LOAD_FAILED",
  LOCKFILE_LOAD_FAILED: "LOCKFILE_LOAD_FAILED",
  UPSTREAM_NETWORK_UNAVAILABLE: "UPSTREAM_NETWORK_UNAVAILABLE",
  GIT_LS_REMOTE_FAILED: "GIT_LS_REMOTE_FAILED",
  GIT_FETCH_FAILED: "GIT_FETCH_FAILED",
  UPSTREAM_MATERIALIZATION_FAILED: "UPSTREAM_MATERIALIZATION_FAILED",
  MISSING_CANDIDATE_COMMIT: "MISSING_CANDIDATE_COMMIT",
  LLM_ASSESSMENT_MISSING: "LLM_ASSESSMENT_MISSING",
  LLM_ASSESSMENT_BLOCKED: "LLM_ASSESSMENT_BLOCKED",
  EVIDENCE_BUILD_FAILED: "EVIDENCE_BUILD_FAILED",
  LLM_ASSESSMENT_FAILED: "LLM_ASSESSMENT_FAILED",
  UNKNOWN: "UNKNOWN",
});

export function workflowRunPath(pluginRoot) {
  return path.join(pluginRoot, "artifacts", "workflow-run.json");
}

export async function writeWorkflowRun(pluginRoot, { step, status, errorCode = null, details = {} }) {
  const filePath = workflowRunPath(pluginRoot);
  const timestamp = new Date().toISOString();
  let previous = null;

  if (await pathExists(filePath)) {
    try {
      previous = await readJson(filePath);
    } catch {
      previous = null;
    }
  }

  const history = Array.isArray(previous?.history) ? previous.history.slice(-19) : [];
  if (previous?.timestamp && previous?.step && previous?.status) {
    history.push({
      timestamp: previous.timestamp,
      step: previous.step,
      status: previous.status,
      error_code: previous.error_code ?? null,
      details: previous.details ?? {},
    });
  }

  const record = {
    timestamp,
    step,
    status,
    error_code: errorCode,
    details,
    history,
  };
  await writeJsonAtomic(filePath, record);
  return record;
}

export async function markRunRunning(pluginRoot, step, details = {}) {
  return writeWorkflowRun(pluginRoot, { step, status: RUN_STATUS.RUNNING, details });
}

export async function markRunSuccess(pluginRoot, step, details = {}) {
  return writeWorkflowRun(pluginRoot, { step, status: RUN_STATUS.SUCCESS, details });
}

export async function markRunFailure(pluginRoot, step, errorCode, details = {}, status = RUN_STATUS.FAILED) {
  return writeWorkflowRun(pluginRoot, { step, status, errorCode, details });
}
