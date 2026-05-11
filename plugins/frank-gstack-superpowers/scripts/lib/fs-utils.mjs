import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export function assertSafeRelativePath(relativePath, label = "path") {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be relative: ${relativePath}`);
  }
  const normalized = path.normalize(relativePath);
  if (normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error(`${label} escapes its root: ${relativePath}`);
  }
  return normalized;
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJsonAtomic(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const base = path.basename(filePath);
  const tempPath = path.join(
    path.dirname(filePath),
    `.${base}.${process.pid}.${Date.now()}.tmp`,
  );
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tempPath, payload, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function writeTextAtomic(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const base = path.basename(filePath);
  const tempPath = path.join(
    path.dirname(filePath),
    `.${base}.${process.pid}.${Date.now()}.tmp`,
  );
  await fs.writeFile(tempPath, value, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function copyAllowlistedFiles({ sourceRoot, destinationRoot, relativePaths }) {
  await ensureDir(destinationRoot);
  const copied = [];
  const missing = [];

  for (const rawPath of relativePaths) {
    const relativePath = assertSafeRelativePath(rawPath, "allowlisted path");
    const sourcePath = path.join(sourceRoot, relativePath);
    const destinationPath = path.join(destinationRoot, relativePath);

    if (!(await pathExists(sourcePath))) {
      missing.push({ relative_path: relativePath, source_path: sourcePath });
      continue;
    }

    const stat = await fs.lstat(sourcePath);
    if (!stat.isFile()) {
      missing.push({
        relative_path: relativePath,
        source_path: sourcePath,
        reason: "not-a-regular-file",
      });
      continue;
    }

    await ensureDir(path.dirname(destinationPath));
    await fs.copyFile(sourcePath, destinationPath);
    copied.push({ relative_path: relativePath, source_path: sourcePath, destination_path: destinationPath });
  }

  return { copied, missing };
}
