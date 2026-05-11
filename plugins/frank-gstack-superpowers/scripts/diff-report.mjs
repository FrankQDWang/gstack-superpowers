#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { pathExists, readJson, writeTextAtomic } from "./lib/fs-utils.mjs";
import { DEFAULT_PLUGIN_ROOT, repoRootFromPluginRoot } from "./lib/reference-resolver.mjs";
import {
  ERROR_CODES,
  markRunFailure,
  markRunRunning,
  markRunSuccess,
  RUN_STATUS,
} from "./lib/run-state.mjs";

function listOrNone(items, render = (item) => String(item)) {
  if (!Array.isArray(items) || items.length === 0) return "- None";
  return items.map((item) => `- ${render(item)}`).join("\n");
}

function jsonLine(value) {
  return JSON.stringify(value);
}

function singleLine(value, fallback = "") {
  const text = String(value ?? fallback)
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0 ? fallback : text;
}

function inlineCode(value, fallback = "unknown") {
  return `\`${singleLine(value, fallback).replace(/`/g, "'")}\``;
}

function repoRelative(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function fencedJson(value) {
  const payload = JSON.stringify(value ?? null, null, 2).replace(/````/g, "` ` ` `");
  return `\`\`\`\`json\n${payload}\n\`\`\`\``;
}

function renderCommits(evidence) {
  const commits = evidence?.commits ?? {};
  const entries = Object.entries(commits);
  if (entries.length === 0) return "- No update evidence available";
  return entries
    .map(
      ([upstream, data]) =>
        `- ${inlineCode(upstream)}: active=${inlineCode(data.active_commit ?? "null")} candidate=${inlineCode(data.candidate_commit ?? "null")} checked=${inlineCode(data.last_checked_at ?? "null")}`,
    )
    .join("\n");
}

function renderRiskMarker(marker) {
  const sourcePath = `${singleLine(marker.upstream, "unknown")}/${singleLine(marker.source_path, "unknown")}:${singleLine(marker.line, "?")}`;
  return `${singleLine(marker.severity, "unknown")} ${singleLine(marker.marker, "risk")} in ${inlineCode(sourcePath)} - ${inlineCode(marker.excerpt ?? "")}`;
}

function renderPolicyViolation(violation) {
  const sourcePath = `${singleLine(violation.upstream, "unknown")}/${singleLine(violation.source_path, "unknown")}:${singleLine(violation.line, "?")}`;
  return `${singleLine(violation.policy, "policy")} at ${inlineCode(sourcePath)}`;
}

function renderChangedFile(change) {
  const sourcePath = `${singleLine(change.upstream, "unknown")}/${singleLine(change.source_path, "unknown")}`;
  return `${singleLine(change.change_type, "changed")} ${inlineCode(sourcePath)} role=${inlineCode(change.role ?? "unknown")} adapter_required=${inlineCode(change.adapter_required === true ? "true" : "false")}`;
}

function stableJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function valuesMatch(left, right) {
  return stableJson(left ?? null) === stableJson(right ?? null);
}

export function assessmentFreshness(evidence, assessment) {
  if (!evidence || !assessment) {
    return {
      stale: false,
      reasons: [],
      current_evidence_hash: evidence?.evidence_hash ?? null,
      assessment_evidence_hash: assessment?.evidence_hash ?? null,
      current_candidate_commits: evidence?.candidate_commits ?? null,
      assessment_candidate_commits: assessment?.candidate_commits ?? null,
    };
  }

  const reasons = [];
  if (!evidence.evidence_hash || assessment.evidence_hash !== evidence.evidence_hash) {
    reasons.push("assessment evidence hash does not match current update evidence");
  }
  if (!valuesMatch(assessment.candidate_commits ?? {}, evidence.candidate_commits ?? {})) {
    reasons.push("assessment candidate commits do not match current update evidence");
  }

  return {
    stale: reasons.length > 0,
    reasons,
    current_evidence_hash: evidence.evidence_hash ?? null,
    assessment_evidence_hash: assessment.evidence_hash ?? null,
    current_candidate_commits: evidence.candidate_commits ?? {},
    assessment_candidate_commits: assessment.candidate_commits ?? {},
  };
}

function wrapperImpact(evidence) {
  const changes = evidence?.changed_allowlisted_files ?? [];
  if (changes.length === 0) return ["No changed allowlisted upstream files reported."];
  return changes.map((change) => {
    if (change.adapter_required) {
      return `${inlineCode(change.skill_id ?? change.source_path)} requires adapter review via ${inlineCode(change.adapter ?? "unknown adapter")}.`;
    }
    if (change.role === "Hidden" || change.role === "Upstream-only") {
      return `${inlineCode(change.skill_id ?? change.source_path)} changed but remains hidden/upstream-only; wrapper export policy must stay unchanged.`;
    }
    return `${inlineCode(change.skill_id ?? change.source_path)} changed; verify any wrapper references that depend on it.`;
  });
}

function renderAssessment(assessment, freshness = assessmentFreshness(null, assessment)) {
  if (!assessment) return "LLM assessment artifact not present.";
  const staleLines = freshness.stale
    ? `\n- Freshness: ${inlineCode("stale")}\n${freshness.reasons.map((reason) => `- Stale: ${singleLine(reason)}.`).join("\n")}`
    : "";
  return `- Status: ${inlineCode(assessment.status ?? "unknown")}
- Recommendation: ${inlineCode(assessment.recommendation ?? "unknown")}
- LLM used: ${assessment.llm_used === true ? "true" : "false"}
- Summary: ${singleLine(assessment.summary, "No summary provided.")}${staleLines}

Findings:
${fencedJson(assessment.findings ?? [])}

Adapter updates:
${fencedJson(assessment.adapter_updates ?? [])}

Manifest updates:
${fencedJson(assessment.manifest_updates ?? [])}

Routing risks:
${fencedJson(assessment.routing_risks ?? [])}

Policy risks:
${fencedJson(assessment.policy_risks ?? [])}`;
}

export function buildDiffReport({ evidence, assessment }) {
  const evidencePresent = Boolean(evidence);
  const assessmentPresent = Boolean(assessment);
  const policyViolations = evidence?.policy_violations ?? [];
  const missingFiles = evidence?.missing_files ?? [];
  const riskMarkers = evidence?.risk_markers ?? [];
  const changedFiles = evidence?.changed_allowlisted_files ?? [];
  const freshness = assessmentFreshness(evidence, assessment);

  let verdict = "No update evidence artifact was present.";
  if (evidencePresent) {
    if (policyViolations.length > 0 || missingFiles.length > 0) {
      verdict = "Hold: policy violations or missing materialized files require attention.";
    } else if (freshness.stale) {
      verdict = "Hold: LLM assessment is stale for the current update evidence.";
    } else if (assessment?.recommendation) {
      verdict = `Assessment recommendation: ${singleLine(assessment.recommendation)}.`;
    } else {
      verdict = "Evidence generated; no blocking policy violations were reported.";
    }
  }

  return `# Upstream Diff Report

## Verdict

${verdict}

## Commits

${renderCommits(evidence)}

## Risk Markers

${listOrNone(riskMarkers, renderRiskMarker)}

## LLM Assessment

${renderAssessment(assessment, freshness)}

## Policy Violations

${listOrNone(policyViolations, renderPolicyViolation)}

## Wrapper Impact

${listOrNone(wrapperImpact(evidence))}

## Changed Files

${listOrNone(changedFiles, renderChangedFile)}

<!-- artifact_presence ${jsonLine({ evidence: evidencePresent, assessment: assessmentPresent })} -->
`;
}

export async function diffReport(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const repoRoot = repoRootFromPluginRoot(pluginRoot);
  const artifactsRoot = path.join(pluginRoot, "artifacts");
  const evidencePath = path.join(artifactsRoot, "update-evidence.json");
  const assessmentPath = path.join(artifactsRoot, "llm-update-assessment.json");
  const evidence = (await pathExists(evidencePath)) ? await readJson(evidencePath) : null;
  const assessment = (await pathExists(assessmentPath)) ? await readJson(assessmentPath) : null;
  const markdown = buildDiffReport({ evidence, assessment });
  const outputPath = path.join(artifactsRoot, "upstream-diff-report.md");
  const rootCopyPath = path.join(repoRoot, "upstream-diff-report.md");

  await writeTextAtomic(outputPath, markdown);
  await writeTextAtomic(rootCopyPath, markdown);
  const freshness = assessmentFreshness(evidence, assessment);

  return {
    status: freshness.stale ? RUN_STATUS.BLOCKED : RUN_STATUS.SUCCESS,
    output_path: repoRelative(repoRoot, outputPath),
    root_copy_path: repoRelative(repoRoot, rootCopyPath),
    evidence_present: Boolean(evidence),
    assessment_present: Boolean(assessment),
    stale_assessment: freshness.stale,
    stale_reasons: freshness.reasons,
  };
}

export async function main() {
  await markRunRunning(DEFAULT_PLUGIN_ROOT, "diff-report");
  try {
    const result = await diffReport(DEFAULT_PLUGIN_ROOT);
    if (result.status === RUN_STATUS.SUCCESS) {
      await markRunSuccess(DEFAULT_PLUGIN_ROOT, "diff-report", result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    await markRunFailure(DEFAULT_PLUGIN_ROOT, "diff-report", ERROR_CODES.LLM_ASSESSMENT_BLOCKED, result, result.status);
    console.error(`${ERROR_CODES.LLM_ASSESSMENT_BLOCKED}: LLM assessment is stale for current update evidence`);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } catch (error) {
    await markRunFailure(DEFAULT_PLUGIN_ROOT, "diff-report", ERROR_CODES.UNKNOWN, {
      message: error.message,
      stack: error.stack,
    });
    console.error(`${ERROR_CODES.UNKNOWN}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
