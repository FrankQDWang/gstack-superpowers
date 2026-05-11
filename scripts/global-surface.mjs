#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const PLUGIN_ID = "frank-gstack-superpowers@frankqdwang-local";
const PLUGIN_NAME = "frank-gstack-superpowers";
const MARKETPLACE_NAME = "frankqdwang-local";
const MANAGED_ROOT_NAME = "frank-gstack-superpowers";
const SUPERPOWERS_DISABLED_NAME = ".codex-plugin.disabled-by-frank-gstack-superpowers";
const SUPERPOWERS_SKILLS_DISABLED_NAME = "skills.disabled-by-frank-gstack-superpowers";
const REQUIRED_FW_SKILLS = Object.freeze(["fw-build", "fw-debug", "fw-intake", "fw-plan", "fw-review", "fw-ship-lite"]);
const execFileAsync = promisify(execFile);

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function paths() {
  const home = os.homedir();
  const codexHome = path.join(home, ".codex");
  const disabledRoot = path.join(codexHome, "skills.disabled", MANAGED_ROOT_NAME);
  return {
    home,
    repoRoot: repoRoot(),
    codexHome,
    activeSkillsDir: path.join(codexHome, "skills"),
    disabledRoot,
    disabledGstackDir: path.join(disabledRoot, "gstack-skills"),
    statePath: path.join(disabledRoot, "state.json"),
    superpowersRoot: path.join(codexHome, "superpowers"),
    superpowersPluginActive: path.join(codexHome, "superpowers", ".codex-plugin"),
    superpowersPluginDisabled: path.join(codexHome, "superpowers", SUPERPOWERS_DISABLED_NAME),
    superpowersSkillsActive: path.join(codexHome, "superpowers", "skills"),
    superpowersSkillsDisabled: path.join(codexHome, "superpowers", SUPERPOWERS_SKILLS_DISABLED_NAME),
    codexConfigPath: path.join(codexHome, "config.toml"),
    globalPluginPath: path.join(home, "plugins", PLUGIN_NAME),
    pluginCacheRoot: path.join(codexHome, "plugins", "cache", MARKETPLACE_NAME, PLUGIN_NAME),
  };
}

async function pathExists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJsonIfPresent(filePath, fallback) {
  if (!(await pathExists(filePath))) return fallback;
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readPluginVersion(pluginPath) {
  const pluginJson = await readJsonIfPresent(path.join(pluginPath, ".codex-plugin", "plugin.json"), null);
  return pluginJson?.version ?? null;
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tempPath, filePath);
}

function isGstackSkillName(name) {
  return name === "gstack" || name.startsWith("gstack-");
}

async function listActiveGstackEntries(activeSkillsDir) {
  if (!(await pathExists(activeSkillsDir))) return [];
  const entries = await fs.readdir(activeSkillsDir, { withFileTypes: true });
  return entries
    .filter((entry) => isGstackSkillName(entry.name))
    .map((entry) => ({
      name: entry.name,
      path: path.join(activeSkillsDir, entry.name),
      kind: entry.isSymbolicLink() ? "symlink" : entry.isDirectory() ? "directory" : "other",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function readState(current) {
  return readJsonIfPresent(current.statePath, {
    version: 1,
    managed_by: MANAGED_ROOT_NAME,
    gstack_entries: [],
    superpowers_codex_plugin_disabled: false,
    superpowers_skills_disabled: false,
    updated_at: null,
  });
}

async function writeState(current, state) {
  await writeJsonAtomic(current.statePath, {
    ...state,
    version: 1,
    managed_by: MANAGED_ROOT_NAME,
    updated_at: new Date().toISOString(),
  });
}

async function movePath(sourcePath, destPath, { force = false } = {}) {
  if (!(await pathExists(sourcePath))) return false;
  if (await pathExists(destPath)) {
    if (!force) {
      throw new Error(`${destPath} already exists. Use --force to replace it.`);
    }
    await fs.rm(destPath, { recursive: true, force: true });
  }
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.rename(sourcePath, destPath);
  return true;
}

function upsertTomlPluginEnabled(source, pluginId, enabled) {
  const header = `[plugins."${pluginId}"]`;
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);
  const enabledLine = `enabled = ${enabled ? "true" : "false"}`;

  if (start === -1) {
    const prefix = source.endsWith("\n") || source.length === 0 ? source : `${source}\n`;
    return `${prefix}\n${header}\n${enabledLine}\n`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const block = lines.slice(start, end);
  const enabledIndex = block.findIndex((line) => /^\s*enabled\s*=/.test(line));
  if (enabledIndex === -1) {
    block.splice(1, 0, enabledLine);
  } else {
    block[enabledIndex] = enabledLine;
  }

  return [...lines.slice(0, start), ...block, ...lines.slice(end)].join("\n");
}

async function setCuratedPluginEnabled(current, enabled) {
  const existing = (await pathExists(current.codexConfigPath)) ? await fs.readFile(current.codexConfigPath, "utf8") : "";
  const updated = upsertTomlPluginEnabled(existing, PLUGIN_ID, enabled);
  if (updated !== existing) {
    await fs.writeFile(current.codexConfigPath, updated);
  }
}

async function curatedCachePath(current) {
  const version = await readPluginVersion(current.globalPluginPath);
  return version ? path.join(current.pluginCacheRoot, version) : null;
}

async function listCachedFwSkills(current) {
  const cachePath = await curatedCachePath(current);
  if (!cachePath) return [];
  const skillsPath = path.join(cachePath, "skills");
  if (!(await pathExists(skillsPath))) return [];
  const entries = await fs.readdir(skillsPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("fw-"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function extractPromptText(promptInput) {
  return promptInput
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("\n");
}

function extractSkillsInstructions(promptText) {
  return promptText.match(/<skills_instructions>[\s\S]*?<\/skills_instructions>/)?.[0] ?? "";
}

async function verifyPromptSurface() {
  try {
    const { stdout } = await execFileAsync("codex", ["debug", "prompt-input", "test curated skill surface"], {
      maxBuffer: 32 * 1024 * 1024,
    });
    const promptInput = JSON.parse(stdout);
    const skillsInstructions = extractSkillsInstructions(extractPromptText(promptInput));
    const missingFwSkills = REQUIRED_FW_SKILLS.filter((skill) => !skillsInstructions.includes(`${PLUGIN_NAME}:${skill}`));
    const rawSuperpowersPresent =
      /^- superpowers:/m.test(skillsInstructions) || skillsInstructions.includes("/.codex/superpowers/skills/");
    const rawGstackPresent = skillsInstructions.includes("/.gstack/repos/gstack/.agents/skills/");
    const passed = missingFwSkills.length === 0 && !rawSuperpowersPresent && !rawGstackPresent;

    return {
      checked: true,
      passed,
      missing_fw_skills: missingFwSkills,
      raw_superpowers_present: rawSuperpowersPresent,
      raw_gstack_present: rawGstackPresent,
    };
  } catch (error) {
    return {
      checked: true,
      passed: false,
      error: error.message,
    };
  }
}

async function activate(options) {
  const current = paths();
  const state = await readState(current);
  const activeEntries = await listActiveGstackEntries(current.activeSkillsDir);
  const movedEntries = new Map((state.gstack_entries ?? []).map((entry) => [entry.name, entry]));

  for (const entry of activeEntries) {
    const disabledPath = path.join(current.disabledGstackDir, entry.name);
    const moved = await movePath(entry.path, disabledPath, options);
    if (moved) {
      movedEntries.set(entry.name, {
        name: entry.name,
        original_path: entry.path,
        disabled_path: disabledPath,
        kind: entry.kind,
      });
    }
  }

  let superpowersDisabled = state.superpowers_codex_plugin_disabled === true;
  const movedSuperpowers = await movePath(current.superpowersPluginActive, current.superpowersPluginDisabled, options);
  if (movedSuperpowers) superpowersDisabled = true;

  let superpowersSkillsDisabled = state.superpowers_skills_disabled === true;
  const movedSuperpowersSkills = await movePath(current.superpowersSkillsActive, current.superpowersSkillsDisabled, options);
  if (movedSuperpowersSkills) superpowersSkillsDisabled = true;

  await setCuratedPluginEnabled(current, true);
  await writeState(current, {
    ...state,
    gstack_entries: [...movedEntries.values()].sort((left, right) => left.name.localeCompare(right.name)),
    superpowers_codex_plugin_disabled: superpowersDisabled,
    superpowers_skills_disabled: superpowersSkillsDisabled,
  });

  return verify();
}

async function restore(options) {
  const current = paths();
  const state = await readState(current);

  for (const entry of state.gstack_entries ?? []) {
    await movePath(entry.disabled_path, entry.original_path, options);
  }

  await movePath(current.superpowersPluginDisabled, current.superpowersPluginActive, options);
  await movePath(current.superpowersSkillsDisabled, current.superpowersSkillsActive, options);
  await writeState(current, {
    ...state,
    gstack_entries: [],
    superpowers_codex_plugin_disabled: false,
    superpowers_skills_disabled: false,
  });

  return verify();
}

async function verify() {
  const current = paths();
  const activeGstackEntries = await listActiveGstackEntries(current.activeSkillsDir);
  const state = await readState(current);
  const configText = (await pathExists(current.codexConfigPath)) ? await fs.readFile(current.codexConfigPath, "utf8") : "";
  const curatedEnabled = new RegExp(`\\[plugins\\."${PLUGIN_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\][\\s\\S]*?enabled\\s*=\\s*true`).test(
    configText,
  );

  const result = {
    status: "unknown",
    managed_by: MANAGED_ROOT_NAME,
    active_gstack_count: activeGstackEntries.length,
    active_gstack_entries: activeGstackEntries.map((entry) => entry.name),
    disabled_gstack_count: state.gstack_entries?.length ?? 0,
    superpowers_codex_plugin_active: await pathExists(current.superpowersPluginActive),
    superpowers_codex_plugin_disabled: await pathExists(current.superpowersPluginDisabled),
    superpowers_raw_skills_active: await pathExists(current.superpowersSkillsActive),
    superpowers_raw_skills_disabled: await pathExists(current.superpowersSkillsDisabled),
    curated_global_plugin_installed: await pathExists(path.join(current.globalPluginPath, ".codex-plugin", "plugin.json")),
    curated_cache_path: await curatedCachePath(current),
    curated_cached_fw_skills: await listCachedFwSkills(current),
    curated_plugin_enabled_in_config: curatedEnabled,
    disabled_state_path: current.statePath,
  };
  result.curated_cache_present = REQUIRED_FW_SKILLS.every((skill) => result.curated_cached_fw_skills.includes(skill));
  result.prompt_surface = await verifyPromptSurface();

  const curatedOnly =
    result.active_gstack_count === 0 &&
    !result.superpowers_codex_plugin_active &&
    result.superpowers_codex_plugin_disabled &&
    !result.superpowers_raw_skills_active &&
    result.superpowers_raw_skills_disabled &&
    result.curated_global_plugin_installed &&
    result.curated_cache_present &&
    result.curated_plugin_enabled_in_config &&
    result.prompt_surface.passed;

  result.status = curatedOnly ? "curated-only" : "raw-surface-active";
  return result;
}

function parseOptions(args) {
  return {
    force: args.includes("--force"),
  };
}

async function main() {
  const [command = "verify", ...args] = process.argv.slice(2);
  const options = parseOptions(args);
  let result;

  if (command === "activate") {
    result = await activate(options);
  } else if (command === "restore") {
    result = await restore(options);
  } else if (command === "verify") {
    result = await verify();
  } else {
    throw new Error(`unknown command: ${command}`);
  }

  console.log(JSON.stringify(result, null, 2));
  if (command !== "restore" && result.status !== "curated-only") {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
