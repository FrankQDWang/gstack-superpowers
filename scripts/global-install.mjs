#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_NAME = "frank-gstack-superpowers";
const DEFAULT_MARKETPLACE = Object.freeze({
  name: "frankqdwang-local",
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

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
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
  const { marketplacePath } = paths();
  await installSymlink(options);
  await upsertMarketplaceEntry(marketplacePath);
  return verify();
}

async function uninstall(options) {
  const { marketplacePath } = paths();
  await uninstallSymlink(options);
  await removeMarketplaceEntry(marketplacePath);
  return verify({ expectInstalled: false });
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

  const installed =
    result.checks.plugin_source_present &&
    result.checks.global_symlink_present &&
    result.checks.global_symlink_target_matches &&
    result.checks.marketplace_entry_present &&
    result.checks.marketplace_entry_global_default;

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
