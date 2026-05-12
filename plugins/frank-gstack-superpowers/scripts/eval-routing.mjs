#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EXPECTED_WRAPPERS } from "./generate-plugin.mjs";
import {
  DEFAULT_PLUGIN_ROOT,
  listUpstreamSkillEntries,
  loadProjectState,
  parseManifestYaml,
} from "./lib/reference-resolver.mjs";
import {
  ERROR_CODES,
  markRunFailure,
  markRunRunning,
  markRunSuccess,
} from "./lib/run-state.mjs";

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function parseScalar(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function parseRoutingCases(raw) {
  try {
    const parsed = await parseManifestYaml(raw);
    if (Array.isArray(parsed?.cases) && parsed.cases.every((testCase) => typeof testCase === "object")) {
      return parsed;
    }
  } catch {
    // Fall through to the narrow parser below.
  }

  const parsed = { cases: [] };
  let currentCase = null;
  let currentArrayKey = null;
  for (const rawLine of raw.split(/\r?\n/)) {
    if (rawLine.trim() === "" || rawLine.trimStart().startsWith("#")) continue;

    const caseMatch = rawLine.match(/^  -\s+([^:]+):\s*(.*)$/);
    if (caseMatch) {
      currentCase = { [caseMatch[1].trim()]: parseScalar(caseMatch[2]) };
      parsed.cases.push(currentCase);
      currentArrayKey = null;
      continue;
    }

    const versionMatch = rawLine.match(/^version:\s*(.*)$/);
    if (versionMatch) {
      parsed.version = parseScalar(versionMatch[1]);
      continue;
    }

    const keyMatch = rawLine.match(/^    ([^:]+):\s*(.*)$/);
    if (keyMatch && currentCase) {
      const key = keyMatch[1].trim();
      const value = keyMatch[2].trim();
      if (value === "") {
        currentCase[key] = [];
        currentArrayKey = key;
      } else {
        currentCase[key] = parseScalar(value);
        currentArrayKey = null;
      }
      continue;
    }

    const listMatch = rawLine.match(/^      -\s*(.*)$/);
    if (listMatch && currentCase && currentArrayKey) {
      currentCase[currentArrayKey].push(parseScalar(listMatch[1]));
    }
  }

  return parsed;
}

function wrapperCorpus(wrapper) {
  return normalize(
    [
      wrapper.description,
      wrapper.primary,
      wrapper.role,
      ...(wrapper.references ?? []),
      ...(wrapper.conditional_references ?? []),
      ...(wrapper.suppress ?? []),
    ].join(" "),
  );
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length >= 3);
}

function nativeReviewPressure(prompt) {
  const text = normalize(prompt);
  return (
    /\bcodex\s+review\b/i.test(text) ||
    /\bcodex\s+exec\s+review\b/i.test(text) ||
    /\bcodex\/review\b/i.test(text) ||
    /(^|[\s"'`(])\/review\b/i.test(text) ||
    /\b(?:native|generic)\s+(?:platform\s+|host-runtime\s+)?codex\s+review\b/i.test(text)
  );
}

function deployPressure(prompt) {
  const text = normalize(prompt);
  return /\b(deploy|land|canary|production|release\s+now|ship\s+this\s+now)\b/i.test(text);
}

function planReviewPressure(prompt) {
  const text = normalize(prompt);
  return (
    /\bplan-eng-review\b/i.test(text) ||
    /\bplan-design-review\b/i.test(text) ||
    /\bplan-review\b/i.test(text) ||
    /\b(?:engineering|architecture|design|ui|ux)\s+review\b/i.test(text)
  );
}

function wrapperHints(wrapperName) {
  return {
    "fw-office-hours": ["idea", "demand", "product", "direction", "intake", "reality", "office-hours"],
    "fw-ceo-review": ["ceo", "scope", "ambition", "premise", "challenge", "plan-ceo-review"],
    "fw-plan": ["plan", "planning", "implementation", "write", "spec", "linked"],
    "fw-plan-review": ["plan-review", "plan-eng-review", "plan-design-review", "engineering", "architecture", "design", "ui", "ux", "gate"],
    "fw-build": ["implement", "approved", "tdd", "verification", "build", "execute"],
    "fw-debug": ["debug", "bug", "failing", "failure", "root", "cause", "unexpected"],
    "fw-review": ["review", "diff", "complete", "gate", "finished", "implementation"],
    "fw-ship-lite": ["ship", "release", "readiness", "deploy", "land", "canary", "branch"],
  }[wrapperName] ?? [];
}

export function routePrompt(prompt, manifest) {
  if (nativeReviewPressure(prompt)) return "fw-review";
  if (deployPressure(prompt)) return "fw-ship-lite";
  if (planReviewPressure(prompt)) return "fw-plan-review";

  const promptTokens = tokenize(prompt);
  const wrappers = manifest.wrappers ?? {};
  const scores = EXPECTED_WRAPPERS.map((wrapperName) => {
    const wrapper = wrappers[wrapperName];
    const corpus = wrapperCorpus(wrapper);
    let score = 0;
    for (const token of promptTokens) {
      if (corpus.includes(token)) score += 1;
      if (wrapperHints(wrapperName).includes(token)) score += 3;
    }
    return { wrapperName, score };
  });

  scores.sort((a, b) => b.score - a.score || EXPECTED_WRAPPERS.indexOf(a.wrapperName) - EXPECTED_WRAPPERS.indexOf(b.wrapperName));
  return scores[0]?.score > 0 ? scores[0].wrapperName : "fw-office-hours";
}

function caseHasPromptKeyword(testCase) {
  const prompt = normalize(testCase.prompt);
  return (testCase.prompt_keywords ?? []).some((keyword) => prompt.includes(normalize(keyword)));
}

function caseMatchesWrapperMetadata(testCase, wrapper) {
  const corpus = wrapperCorpus(wrapper);
  return (testCase.prompt_keywords ?? []).some((keyword) => corpus.includes(normalize(keyword)));
}

function hiddenRawNames(manifest) {
  return new Set(
    listUpstreamSkillEntries(manifest)
      .filter((entry) => entry.role === "Hidden" || entry.role === "Upstream-only" || entry.visibility?.exported === false)
      .flatMap((entry) => [
        entry.id,
        entry.raw_name,
        entry.codex_exported_name,
        entry.codex_exported_name?.replace(/^superpowers:/, ""),
      ])
      .filter(Boolean),
  );
}

function knownSuppressedRoutes(manifest) {
  return new Set(
    Object.values(manifest.wrappers ?? {})
      .flatMap((wrapper) => wrapper.suppress ?? [])
      .filter(Boolean),
  );
}

function evaluateCase(testCase, state) {
  const errors = [];
  const wrappers = state.manifest.wrappers ?? {};
  const expectedWrapper = testCase.expected_wrapper;
  const actualWrapper = routePrompt(testCase.prompt, state.manifest);

  if (!EXPECTED_WRAPPERS.includes(expectedWrapper)) {
    errors.push(`expected_wrapper must be one of the generated wrappers: ${expectedWrapper}`);
  }
  if (!wrappers[expectedWrapper]) {
    errors.push(`expected wrapper does not exist in manifest: ${expectedWrapper}`);
    return { id: testCase.id, status: "failed", errors };
  }

  if (hiddenRawNames(state.manifest).has(expectedWrapper)) {
    errors.push(`case expects a hidden/raw upstream skill: ${expectedWrapper}`);
  }
  for (const forbidden of testCase.forbidden_expected_wrappers ?? []) {
    if (hiddenRawNames(state.manifest).has(forbidden) || knownSuppressedRoutes(state.manifest).has(forbidden)) {
      continue;
    }
    errors.push(`forbidden_expected_wrappers must resolve to hidden/raw names or suppressed routes: ${forbidden}`);
  }

  if (actualWrapper !== expectedWrapper) {
    errors.push(`routePrompt returned ${actualWrapper}, expected ${expectedWrapper}`);
  }

  if (!Array.isArray(testCase.prompt_keywords) || testCase.prompt_keywords.length === 0) {
    errors.push(`prompt_keywords must be a non-empty list`);
  } else {
    if (!caseHasPromptKeyword(testCase)) {
      errors.push(`prompt does not contain any declared prompt_keywords`);
    }
    if (!caseMatchesWrapperMetadata(testCase, wrappers[expectedWrapper])) {
      errors.push(`expected wrapper metadata/references do not match prompt_keywords`);
    }
  }

  if (testCase.policy === "forbid_native_review") {
    if (expectedWrapper !== "fw-review") {
      errors.push(`forbid_native_review policy cases must route to fw-review`);
    }
    if (!normalize(testCase.expected_policy_note).includes("native")) {
      errors.push(`forbid_native_review cases must include a native-review suppression policy note`);
    }
  }

  if (testCase.policy === "no_default_deploy") {
    if (expectedWrapper !== "fw-ship-lite") {
      errors.push(`no_default_deploy policy cases must route to fw-ship-lite`);
    }
    const note = normalize(testCase.expected_policy_note);
    if (!(note.includes("deploy") && note.includes("explicit"))) {
      errors.push(`no_default_deploy cases must state that deploy requires an explicit request`);
    }
  }

  return {
    id: testCase.id,
    status: errors.length === 0 ? "passed" : "failed",
    expected_wrapper: expectedWrapper,
    actual_wrapper: actualWrapper,
    errors,
  };
}

export async function evalRouting(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const state = await loadProjectState(pluginRoot);
  const casesPath = path.join(pluginRoot, "evals", "routing-cases.yaml");
  const raw = await fs.readFile(casesPath, "utf8");
  const parsed = await parseRoutingCases(raw);
  const cases = parsed.cases ?? [];
  const results = [];
  const errors = [];

  if (!Array.isArray(cases) || cases.length === 0) {
    errors.push("routing-cases.yaml must contain a non-empty cases list");
  }

  for (const testCase of cases) {
    const result = evaluateCase(testCase, state);
    results.push(result);
    errors.push(...result.errors.map((error) => `${testCase.id}: ${error}`));
  }

  return {
    status: errors.length === 0 ? "success" : "failed",
    cases: results,
    errors,
  };
}

export async function main() {
  await markRunRunning(DEFAULT_PLUGIN_ROOT, "eval-routing");
  const result = await evalRouting(DEFAULT_PLUGIN_ROOT);
  if (result.errors.length > 0) {
    await markRunFailure(DEFAULT_PLUGIN_ROOT, "eval-routing", ERROR_CODES.UNKNOWN, result);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  await markRunSuccess(DEFAULT_PLUGIN_ROOT, "eval-routing", result);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
