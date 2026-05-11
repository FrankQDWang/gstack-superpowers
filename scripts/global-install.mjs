#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_NAME = "frank-gstack-superpowers";
const MARKETPLACE_NAME = "frankqdwang-local";
const DEFAULT_MARKETPLACE = Object.freeze({
  name: MARKETPLACE_NAME,
  interface: {
    displayName: "FrankQDWang Local Plugins",
  },
  plugins: [],
});

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function paths() {
  const home = os.homedir();
  return {
    repoRoot: repoRoot(),
    pluginSource: path.join(repoRoot(), "plugins", PLUGIN_NAME),
    homePluginsDir: path.join(home, "plugins"),
    globalPluginPath: path.join(home, "plugins", PLUGIN_NAME),
    marketplacePath: path.join(home, ".agents", "plugins", "marketplace.json"),
    marketplaceRoot: home,
    codexConfigPath: path.join(home, ".codex", "config.toml"),
    pluginCacheRoot: path.join(home, ".codex", "plugins", "cache", MARKETPLACE_NAME, PLUGIN_NAME),
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

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readPluginJson(pluginPath) {
  const pluginJsonPath = path.join(pluginPath, ".codex-plugin", "plugin.json");
  const pluginJson = await readJson(pluginJsonPath);
  if (!pluginJson.version) {
    throw new Error(`${pluginJsonPath} is missing version`);
  }
  return pluginJson;
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tempPath, filePath);
}

async function readTextIfPresent(filePath) {
  if (!(await pathExists(filePath))) return "";
  return fs.readFile(filePath, "utf8");
}

async function writeTextAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, value);
  await fs.rename(tempPath, filePath);
}

function marketplaceEntry() {
  return {
    name: PLUGIN_NAME,
    source: {
      source: "local",
      path: `./plugins/${PLUGIN_NAME}`,
    },
    policy: {
      installation: "INSTALLED_BY_DEFAULT",
      authentication: "ON_INSTALL",
    },
    category: "Productivity",
  };
}

async function loadMarketplace(filePath) {
  if (!(await pathExists(filePath))) {
    return structuredClone(DEFAULT_MARKETPLACE);
  }

  const marketplace = await readJson(filePath);
  if (!marketplace || typeof marketplace !== "object") {
    throw new Error(`${filePath} is not a JSON object`);
  }
  if (!marketplace.name) marketplace.name = DEFAULT_MARKETPLACE.name;
  if (!marketplace.interface || typeof marketplace.interface !== "object") {
    marketplace.interface = structuredClone(DEFAULT_MARKETPLACE.interface);
  }
  if (!marketplace.interface.displayName) {
    marketplace.interface.displayName = DEFAULT_MARKETPLACE.interface.displayName;
  }
  if (!Array.isArray(marketplace.plugins)) marketplace.plugins = [];
  return marketplace;
}

async function upsertMarketplaceEntry(filePath) {
  const marketplace = await loadMarketplace(filePath);
  const entry = marketplaceEntry();
  const index = marketplace.plugins.findIndex((plugin) => plugin?.name === PLUGIN_NAME);
  if (index === -1) {
    marketplace.plugins.push(entry);
  } else {
    marketplace.plugins[index] = entry;
  }
  await writeJsonAtomic(filePath, marketplace);
}

function upsertTomlTable(source, header, assignments) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);
  const renderedAssignments = Object.entries(assignments).map(([key, value]) => `${key} = ${value}`);

  if (start === -1) {
    const prefix = source.endsWith("\n") || source.length === 0 ? source : `${source}\n`;
    return `${prefix}\n${header}\n${renderedAssignments.join("\n")}\n`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const block = lines.slice(start, end);
  for (const [key, value] of Object.entries(assignments)) {
    const assignment = `${key} = ${value}`;
    const assignmentIndex = block.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
    if (assignmentIndex === -1) {
      block.push(assignment);
    } else {
      block[assignmentIndex] = assignment;
    }
  }

  return [...lines.slice(0, start), ...block, ...lines.slice(end)].join("\n");
}

async function registerMarketplaceInCodexConfig({ codexConfigPath, marketplaceRoot }) {
  const existing = await readTextIfPresent(codexConfigPath);
  const updated = upsertTomlTable(existing, `[marketplaces.${MARKETPLACE_NAME}]`, {
    last_updated: `"${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}"`,
    source_type: "\"local\"",
    source: JSON.stringify(marketplaceRoot),
  });
  if (updated !== existing) {
    await writeTextAtomic(codexConfigPath, updated);
  }
}

async function materializeLocalPluginCache({ pluginSource, pluginCacheRoot }) {
  const pluginJson = await readPluginJson(pluginSource);
  const cachePath = path.join(pluginCacheRoot, pluginJson.version);
  await fs.rm(cachePath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.cp(pluginSource, cachePath, { recursive: true, dereference: false });
}

async function removeMarketplaceEntry(filePath) {
  if (!(await pathExists(filePath))) return;
  const marketplace = await loadMarketplace(filePath);
  marketplace.plugins = marketplace.plugins.filter((plugin) => plugin?.name !== PLUGIN_NAME);
  await writeJsonAtomic(filePath, marketplace);
}

async function sameSymlinkTarget(linkPath, expectedTarget) {
  const target = await fs.readlink(linkPath);
  return path.resolve(path.dirname(linkPath), target) === path.resolve(expectedTarget);
}

async function installSymlink({ force = false } = {}) {
  const { pluginSource, homePluginsDir, globalPluginPath } = paths();
  if (!(await pathExists(path.join(pluginSource, ".codex-plugin", "plugin.json")))) {
    throw new Error(`plugin source is missing .codex-plugin/plugin.json: ${pluginSource}`);
  }

  await fs.mkdir(homePluginsDir, { recursive: true });
  if (await pathExists(globalPluginPath)) {
    const stat = await fs.lstat(globalPluginPath);
    if (stat.isSymbolicLink() && (await sameSymlinkTarget(globalPluginPath, pluginSource))) {
      return;
    }
    if (!force) {
      throw new Error(`${globalPluginPath} already exists and does not point to ${pluginSource}. Use --force to replace it.`);
    }
    await fs.rm(globalPluginPath, { recursive: true, force: true });
  }

  await fs.symlink(pluginSource, globalPluginPath, "dir");
}

async function uninstallSymlink({ force = false } = {}) {
  const { pluginSource, globalPluginPath } = paths();
  if (!(await pathExists(globalPluginPath))) return;
  const stat = await fs.lstat(globalPluginPath);
  if (stat.isSymbolicLink()) {
    if (force || (await sameSymlinkTarget(globalPluginPath, pluginSource))) {
      await fs.rm(globalPluginPath);
      return;
    }
    throw new Error(`${globalPluginPath} is a symlink, but not to this plugin source. Use --force to remove it.`);
  }
  if (!force) {
    throw new Error(`${globalPluginPath} is not a symlink. Use --force to remove it.`);
  }
  await fs.rm(globalPluginPath, { recursive: true, force: true });
}

async function install(options) {
  const { marketplacePath, codexConfigPath, marketplaceRoot, pluginSource, pluginCacheRoot } = paths();
  await installSymlink(options);
  await upsertMarketplaceEntry(marketplacePath);
  await registerMarketplaceInCodexConfig({ codexConfigPath, marketplaceRoot });
  await materializeLocalPluginCache({ pluginSource, pluginCacheRoot });
  return verify();
}

async function uninstall(options) {
  const { marketplacePath, pluginCacheRoot } = paths();
  await uninstallSymlink(options);
  await removeMarketplaceEntry(marketplacePath);
  await fs.rm(pluginCacheRoot, { recursive: true, force: true });
  return verify({ expectInstalled: false });
}

function tomlTableBlock(source, header) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

async function verify({ expectInstalled = true } = {}) {
  const current = paths();
  const result = {
    plugin: PLUGIN_NAME,
    expected_installed: expectInstalled,
    repo_root: current.repoRoot,
    plugin_source: current.pluginSource,
    global_plugin_path: current.globalPluginPath,
    marketplace_path: current.marketplacePath,
    marketplace_root: current.marketplaceRoot,
    codex_config_path: current.codexConfigPath,
    checks: {},
  };

  result.checks.plugin_source_present = await pathExists(path.join(current.pluginSource, ".codex-plugin", "plugin.json"));

  if (await pathExists(current.globalPluginPath)) {
    const stat = await fs.lstat(current.globalPluginPath);
    result.checks.global_symlink_present = stat.isSymbolicLink();
    result.checks.global_symlink_target_matches =
      stat.isSymbolicLink() && (await sameSymlinkTarget(current.globalPluginPath, current.pluginSource));
  } else {
    result.checks.global_symlink_present = false;
    result.checks.global_symlink_target_matches = false;
  }

  if (await pathExists(current.marketplacePath)) {
    const marketplace = await loadMarketplace(current.marketplacePath);
    const entry = marketplace.plugins.find((plugin) => plugin?.name === PLUGIN_NAME) ?? null;
    result.checks.marketplace_entry_present = Boolean(entry);
    result.checks.marketplace_entry = entry;
    result.checks.marketplace_entry_global_default =
      entry?.source?.source === "local" &&
      entry?.source?.path === `./plugins/${PLUGIN_NAME}` &&
      entry?.policy?.installation === "INSTALLED_BY_DEFAULT";
  } else {
    result.checks.marketplace_entry_present = false;
    result.checks.marketplace_entry = null;
    result.checks.marketplace_entry_global_default = false;
  }

  const configText = await readTextIfPresent(current.codexConfigPath);
  const marketplaceConfigBlock = tomlTableBlock(configText, `[marketplaces.${MARKETPLACE_NAME}]`);
  result.checks.marketplace_registered_in_config =
    /^\s*source_type\s*=\s*"local"\s*$/m.test(marketplaceConfigBlock) &&
    new RegExp(`^\\s*source\\s*=\\s*${JSON.stringify(current.marketplaceRoot).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(
      marketplaceConfigBlock,
    );

  let pluginVersion = null;
  if (result.checks.plugin_source_present) {
    pluginVersion = (await readPluginJson(current.pluginSource)).version;
  }
  result.checks.plugin_cache_path = pluginVersion ? path.join(current.pluginCacheRoot, pluginVersion) : null;
  result.checks.plugin_cache_present = pluginVersion
    ? await pathExists(path.join(current.pluginCacheRoot, pluginVersion, ".codex-plugin", "plugin.json"))
    : false;

  const installed =
    result.checks.plugin_source_present &&
    result.checks.global_symlink_present &&
    result.checks.global_symlink_target_matches &&
    result.checks.marketplace_entry_present &&
    result.checks.marketplace_entry_global_default &&
    result.checks.marketplace_registered_in_config &&
    result.checks.plugin_cache_present;

  result.status = expectInstalled ? (installed ? "installed" : "not-installed") : installed ? "still-installed" : "uninstalled";
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

  if (command === "install") {
    result = await install(options);
  } else if (command === "uninstall") {
    result = await uninstall(options);
  } else if (command === "verify") {
    result = await verify();
  } else {
    throw new Error(`unknown command: ${command}`);
  }

  console.log(JSON.stringify(result, null, 2));
  if (command !== "uninstall" && result.status !== "installed") {
    process.exitCode = 1;
  }
  if (command === "uninstall" && result.status !== "uninstalled") {
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
