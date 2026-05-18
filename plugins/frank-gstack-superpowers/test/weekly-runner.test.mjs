import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/weekly-upstream-sync-runner.sh");

async function readRunner() {
  return fs.readFile(runnerPath, "utf8");
}

test("weekly upstream sync runner defaults to report mode and requires explicit apply for promotion", async () => {
  const source = await readRunner();

  assert.match(source, /MODE="\$\{WEEKLY_SYNC_MODE:-report\}"/);
  assert.match(source, /--apply\)/);
  assert.match(source, /--report\)/);
  assert.match(source, /weekly-curated-workflow-upstream-sync-report-\$RUN_TS/);

  const reportGate = source.indexOf('if [ "$MODE" = "report" ]; then');
  const promote = source.indexOf("npm run sync:upstreams -- --promote-candidate");
  assert.ok(reportGate > -1, "runner should stop in report mode before apply-only steps");
  assert.ok(promote > -1, "runner should retain explicit apply promotion support");
  assert.ok(reportGate < promote, "report stop must happen before candidate promotion");
});

test("weekly upstream sync runner installs missing dependencies before npm scripts", async () => {
  const source = await readRunner();

  assert.match(source, /node_modules\/ajv/);
  assert.match(source, /npm install/);

  const dependencyCheck = source.indexOf('node_modules/ajv');
  const candidate = source.indexOf("npm run sync:upstreams -- --candidate");
  assert.ok(dependencyCheck > -1);
  assert.ok(candidate > -1);
  assert.ok(dependencyCheck < candidate, "dependencies should be present before npm scripts run");
});

test("weekly upstream sync runner force-adds only plugin review artifacts", async () => {
  const source = await readRunner();

  assert.doesNotMatch(source, /git add plugins\/frank-gstack-superpowers upstream-diff-report\.md/);
  assert.match(source, /plugins\/frank-gstack-superpowers\/artifacts\/upstream-diff-report\.md/);
});

test("weekly upstream sync runner avoids zsh readonly status variable", async () => {
  const source = await readRunner();

  assert.doesNotMatch(source, /local status=/);
  assert.match(source, /local run_status=/);
});

test("weekly upstream sync runner writes a concise Chinese brief instead of a report file", async () => {
  const source = await readRunner();

  assert.match(source, /build_review_summary/);
  assert.match(source, /REVIEW_SUMMARY/);
  assert.match(source, /- Brief: %s/);
  assert.match(source, /建议 .*wrapper/);
  assert.match(source, /gstack 候选/);
  assert.doesNotMatch(source, /REPORT_FILE=/);
  assert.doesNotMatch(source, /## 原始 Diff Report/);
});

test("weekly upstream sync runner prunes old local report state", async () => {
  const source = await readRunner();

  assert.match(source, /cleanup_old_runner_state/);
  assert.match(source, /LOG_RETENTION_DAYS="\$\{LOG_RETENTION_DAYS:-30\}"/);
  assert.match(source, /REPORT_BRANCH_KEEP="\$\{REPORT_BRANCH_KEEP:-8\}"/);
  assert.match(source, /branch -D "\$stale_branch"/);
  assert.match(source, /worktree prune/);
});
