#!/usr/bin/env zsh
set -uo pipefail

AUTOMATION_ID="weekly-curated-workflow-upstream-sync"
SOURCE_REPO="${SOURCE_REPO:-/Users/frankqdwang/Agents/gstack-superpowers}"
AUTOMATION_DIR="${AUTOMATION_DIR:-$HOME/.codex/automations/$AUTOMATION_ID}"
MEMORY_FILE="$AUTOMATION_DIR/memory.md"
LOG_DIR="$AUTOMATION_DIR/logs"
WORKTREE_DIR="${WORKTREE_DIR:-$HOME/.codex/worktrees/$AUTOMATION_ID/gstack-superpowers}"
BASE_BRANCH="${BASE_BRANCH:-main}"
RUN_TS="$(date '+%Y-%m-%d-%H%M%S')"
MODE="${WEEKLY_SYNC_MODE:-report}"
case "${1:-}" in
  --apply)
    MODE="apply"
    shift
    ;;
  --report)
    MODE="report"
    shift
    ;;
  "")
    ;;
  *)
    printf 'Usage: %s [--report|--apply]\n' "$0" >&2
    exit 64
    ;;
esac
if [ "$MODE" != "report" ] && [ "$MODE" != "apply" ]; then
  printf 'WEEKLY_SYNC_MODE must be report or apply; got %s\n' "$MODE" >&2
  exit 64
fi
if [ -z "${BRANCH:-}" ]; then
  if [ "$MODE" = "report" ]; then
    BRANCH="automation/weekly-curated-workflow-upstream-sync-report-$RUN_TS"
  else
    BRANCH="automation/weekly-curated-workflow-upstream-sync"
  fi
fi
PR_TITLE="chore: sync curated workflow upstreams"
LOCK_DIR="$AUTOMATION_DIR/run.lock"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
REPORT_BRANCH_KEEP="${REPORT_BRANCH_KEEP:-8}"
REPORT_BRANCH_PREFIX="automation/weekly-curated-workflow-upstream-sync-report-"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.npm-global/bin:$HOME/.bun/bin:$PATH"
export GIT_TERMINAL_PROMPT=0

mkdir -p "$AUTOMATION_DIR" "$LOG_DIR"
LOG_FILE="$LOG_DIR/$RUN_TS.log"
SUMMARY_FILE="$AUTOMATION_DIR/last-run-summary.md"
REVIEW_SUMMARY=""
ARTIFACTS=(
  plugins/frank-gstack-superpowers/artifacts/update-evidence.json
  plugins/frank-gstack-superpowers/artifacts/llm-update-assessment.json
  plugins/frank-gstack-superpowers/artifacts/llm-update-assessment.md
  plugins/frank-gstack-superpowers/artifacts/workflow-run.json
  plugins/frank-gstack-superpowers/artifacts/upstream-diff-report.md
)

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*" | tee -a "$LOG_FILE"
}

append_memory() {
  {
    printf '\n## %s\n\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
    cat "$SUMMARY_FILE"
  } >> "$MEMORY_FILE"
}

cleanup_old_runner_state() {
  find "$LOG_DIR" -type f -name '*.log' -mtime +"$LOG_RETENTION_DAYS" -delete 2>/dev/null || true
  rm -f "$AUTOMATION_DIR/last-review-report.md"
  git -C "$SOURCE_REPO" worktree prune >> "$LOG_FILE" 2>&1 || true
  git -C "$SOURCE_REPO" for-each-ref \
    --format='%(refname:short) %(committerdate:unix)' \
    "refs/heads/$REPORT_BRANCH_PREFIX*" 2>/dev/null |
    sort -k2nr |
    awk -v keep="$REPORT_BRANCH_KEEP" 'NR > keep {print $1}' |
    while IFS= read -r stale_branch; do
      if [ -n "$stale_branch" ] && [ "$stale_branch" != "$BRANCH" ]; then
        git -C "$SOURCE_REPO" branch -D "$stale_branch" >> "$LOG_FILE" 2>&1 || true
      fi
    done
}

finish() {
  local run_status="$1"
  local message="$2"
  {
    printf -- '- Runner status: `%s`.\n' "$run_status"
    printf -- '- Message: %s\n' "$message"
    printf -- '- Source repo: `%s`.\n' "$SOURCE_REPO"
    printf -- '- Worktree: `%s`.\n' "$WORKTREE_DIR"
    printf -- '- Branch: `%s`.\n' "$BRANCH"
    printf -- '- Mode: `%s`.\n' "$MODE"
    if [ -n "$REVIEW_SUMMARY" ]; then
      printf -- '- Brief: %s\n' "$REVIEW_SUMMARY"
    fi
    printf -- '- Log: `%s`.\n' "$LOG_FILE"
  } > "$SUMMARY_FILE"
  append_memory
  cleanup_old_runner_state
  log "$message"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

ensure_dependencies() {
  if [ ! -d "$WORKTREE_DIR/node_modules/ajv" ]; then
    run_in_worktree npm install || {
      finish failed "Could not install npm dependencies in sync worktree."
      exit 1
    }
  fi
}

build_review_summary() {
  local evidence_json="$WORKTREE_DIR/plugins/frank-gstack-superpowers/artifacts/update-evidence.json"
  local assessment_json="$WORKTREE_DIR/plugins/frank-gstack-superpowers/artifacts/llm-update-assessment.json"

  node --input-type=module - "$evidence_json" "$assessment_json" "$MODE" <<'NODE'
import { existsSync, readFileSync } from "node:fs";

const [evidencePath, assessmentPath, mode] = process.argv.slice(2);
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
const evidence = readJson(evidencePath);
const assessment = readJson(assessmentPath);
const commits = evidence?.commits ?? {};
const policyViolations = evidence?.policy_violations ?? [];
const changedFiles = evidence?.changed_allowlisted_files ?? [];
const riskMarkers = evidence?.risk_markers ?? [];
const recommendation = assessment?.recommendation ?? "unknown";
const status = assessment?.status ?? "unknown";
const canApply = assessment?.llm_used === true && status === "ready" && ["promote", "promote-with-changes"].includes(recommendation);
const changedByUpstream = changedFiles.reduce((groups, change) => {
  const upstream = change.upstream ?? "unknown";
  groups[upstream] ??= [];
  groups[upstream].push(change);
  return groups;
}, {});
const shortName = (change) => String(change.source_path ?? change.skill_id ?? "unknown").replace(/^skills\//, "").replace(/\/SKILL\.md$/, "");
const renderCommitLine = ([name, data]) =>
  `- ${name}: 当前 ${data.active_commit ?? "null"}；候选 ${data.candidate_commit ?? "null"}`;
const renderChangedSummary = ([name, changes]) => {
  if (changes.length === 0) return `- ${name}: 没有变化。`;
  const names = changes.map(shortName).slice(0, 8).join("、");
  const rest = changes.length > 8 ? ` 等 ${changes.length} 个文件` : "";
  return `- ${name}: ${changes.length} 个跟踪文件变化：${names}${rest}。`;
};
const adapterRequired = changedFiles.filter((change) => change.adapter_required === true);
const normalWrapperChanges = changedFiles.filter((change) => change.adapter_required !== true);
const gstack = commits.gstack ?? {};
const superpowers = commits.superpowers ?? {};
const gstackChanged = changedByUpstream.gstack?.length ?? 0;
const superpowersChanged = changedByUpstream.superpowers?.length ?? 0;
const readOnly = adapterRequired.map(shortName).join("、") || "无";
const action = canApply
  ? "建议批准后执行 apply"
  : "建议暂缓 apply";
const wrapperAdvice = normalWrapperChanges.length > 0
  ? "wrapper 不新增，只刷新现有引用和校验值，并保持阶段边界"
  : "wrapper 暂不需要变化";
console.log(
  `${action}：gstack 候选从 ${gstack.active_commit ?? "null"} 到 ${gstack.candidate_commit ?? "null"}，有 ${gstackChanged} 个跟踪文件变化；superpowers 候选 ${superpowers.candidate_commit ?? "null"}，变化 ${superpowersChanged} 个。建议 ${wrapperAdvice}；${readOnly} 继续只读，不暴露成可调用 wrapper。评估为 ${status}/${recommendation}，policy violations ${policyViolations.length}，风险线索 ${riskMarkers.length}。如同意，请回复批准后再运行 apply。`,
);
NODE
}

stage_plugin_changes() {
  run_in_worktree git add plugins/frank-gstack-superpowers || true
  for artifact in "${ARTIFACTS[@]}"; do
    if [ -f "$WORKTREE_DIR/$artifact" ]; then
      run_in_worktree git add -f "$artifact"
    fi
  done
}

run() {
  log "+ $*"
  "$@" >> "$LOG_FILE" 2>&1
}

run_in_worktree() {
  log "+ (cd $WORKTREE_DIR && $*)"
  (cd "$WORKTREE_DIR" && "$@") >> "$LOG_FILE" 2>&1
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  {
    printf -- '- Runner status: `blocked`.\n'
    printf -- '- Message: Another weekly upstream sync runner is already active.\n'
    printf -- '- Lock dir: `%s`.\n' "$LOCK_DIR"
    printf -- '- Log: `%s`.\n' "$LOG_FILE"
  } > "$SUMMARY_FILE"
  append_memory
  exit 75
fi

trap 'finish failed "Runner interrupted before completion."; exit 130' INT TERM

if [ ! -d "$SOURCE_REPO/.git" ]; then
  finish failed "Source repo is not a Git checkout."
  exit 1
fi

log "Starting weekly curated workflow upstream sync runner."
log "Source repo: $SOURCE_REPO"
log "Worktree: $WORKTREE_DIR"
log "Mode: $MODE"

if ! git -C "$WORKTREE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  mkdir -p "$(dirname "$WORKTREE_DIR")"
  if git -C "$SOURCE_REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    if ! run git -C "$SOURCE_REPO" worktree add "$WORKTREE_DIR" "$BRANCH"; then
      finish failed "Could not add existing sync worktree branch."
      exit 1
    fi
  else
    if ! run git -C "$SOURCE_REPO" worktree add -b "$BRANCH" "$WORKTREE_DIR" "$BASE_BRANCH"; then
      finish failed "Could not create sync worktree branch."
      exit 1
    fi
  fi
fi

if [ -n "$(git -C "$WORKTREE_DIR" status --porcelain)" ]; then
  finish blocked "Sync worktree has uncommitted changes; review or clean it before rerunning."
  exit 2
fi

if git -C "$SOURCE_REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  run_in_worktree git switch "$BRANCH" || {
    finish failed "Could not switch sync worktree to $BRANCH."
    exit 1
  }
else
  run_in_worktree git switch -c "$BRANCH" "$BASE_BRANCH" || {
    finish failed "Could not create and switch sync worktree branch $BRANCH."
    exit 1
  }
fi

run_in_worktree git merge --ff-only "$BASE_BRANCH" || {
  finish blocked "Sync branch is not fast-forwardable from $BASE_BRANCH."
  exit 2
}

ensure_dependencies

run_in_worktree npm run sync:upstreams -- --candidate || {
  finish blocked "Candidate upstream sync failed; promotion was not attempted."
  exit 2
}

run_in_worktree npm run evidence:update || {
  finish blocked "Deterministic update evidence failed; promotion was not attempted."
  exit 2
}

run_in_worktree npm run llm:assess-updates || {
  finish blocked "LLM update assessment failed or was unavailable; promotion was not attempted."
  exit 2
}

ASSESSMENT_JSON="$WORKTREE_DIR/plugins/frank-gstack-superpowers/artifacts/llm-update-assessment.json"
ALLOW_PROMOTION="$(node -e 'const fs=require("fs"); const p=process.argv[1]; const a=JSON.parse(fs.readFileSync(p,"utf8")); process.stdout.write(a.llm_used===true && a.status==="ready" && ["promote","promote-with-changes"].includes(a.recommendation) ? "yes" : "no");' "$ASSESSMENT_JSON")"

if [ "$ALLOW_PROMOTION" != "yes" ]; then
  run_in_worktree npm run diff:report || true
  REVIEW_SUMMARY="$(build_review_summary)" || {
    finish failed "Could not build review summary."
    exit 1
  }
  finish blocked "LLM assessment did not allow promotion; candidate artifacts were left for review."
  exit 2
fi

run_in_worktree npm run diff:report || {
  finish failed "Diff report generation failed."
  exit 1
}
REVIEW_SUMMARY="$(build_review_summary)" || {
  finish failed "Could not build review summary."
  exit 1
}

if [ "$MODE" = "report" ]; then
  stage_plugin_changes
  if ! git -C "$WORKTREE_DIR" diff --cached --quiet; then
    run_in_worktree git commit -m "chore: prepare weekly upstream sync report" || {
      finish failed "Could not commit local weekly sync report changes."
      exit 1
    }
  fi
  finish needs-user "Review report is ready; approval is required before promotion, verification, push, and PR."
  exit 0
fi

run_in_worktree npm run sync:upstreams -- --promote-candidate || {
  finish blocked "Candidate promotion was blocked after LLM assessment."
  exit 2
}
run_in_worktree npm run generate || {
  finish failed "Wrapper regeneration failed."
  exit 1
}
run_in_worktree npm test || {
  finish failed "Test suite failed after promotion."
  exit 1
}
run_in_worktree npm run audit:routing || {
  finish failed "Routing audit failed after promotion."
  exit 1
}
run_in_worktree npm run eval:routing || {
  finish failed "Routing eval failed after promotion."
  exit 1
}
run_in_worktree npm run diff:report || {
  finish failed "Diff report generation failed."
  exit 1
}
REVIEW_SUMMARY="$(build_review_summary)" || {
  finish failed "Could not build review summary."
  exit 1
}

stage_plugin_changes

if git -C "$WORKTREE_DIR" diff --cached --quiet; then
  finish success "No upstream sync changes to commit or PR."
  exit 0
fi

run_in_worktree git commit -m "$PR_TITLE" || {
  finish failed "Could not commit weekly sync changes."
  exit 1
}

run_in_worktree git push -u origin "$BRANCH" || {
  finish failed "Could not push weekly sync branch."
  exit 1
}

PR_BODY="$AUTOMATION_DIR/pr-body.md"
{
  printf '# Weekly Curated Workflow Upstream Sync\n\n'
  printf 'Generated by local LaunchAgent runner at `%s`.\n\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
  printf '## Verification\n\n'
  printf -- '- `npm run sync:upstreams -- --candidate`: passed\n'
  printf -- '- `npm run evidence:update`: passed\n'
  printf -- '- `npm run llm:assess-updates`: passed\n'
  printf -- '- `npm run sync:upstreams -- --promote-candidate`: passed\n'
  printf -- '- `npm run generate`: passed\n'
  printf -- '- `npm test`: passed\n'
  printf -- '- `npm run audit:routing`: passed\n'
  printf -- '- `npm run eval:routing`: passed\n'
  printf -- '- `npm run diff:report`: passed\n\n'
  printf '## Artifacts\n\n'
  for artifact in "${ARTIFACTS[@]}"; do
    printf -- '- `%s`\n' "$artifact"
  done
  printf '\n## Manual Review\n\n'
  printf 'Review the LLM assessment, policy risks, wrapper impact, and changed upstream excerpts before merging.\n'
} > "$PR_BODY"

if gh -R FrankQDWang/gstack-superpowers pr view "$BRANCH" --json url >/tmp/weekly-sync-pr.json 2>>"$LOG_FILE"; then
  PR_URL="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync("/tmp/weekly-sync-pr.json","utf8")).url || "")')"
  gh -R FrankQDWang/gstack-superpowers pr edit "$BRANCH" --body-file "$PR_BODY" >> "$LOG_FILE" 2>&1 || true
else
  PR_URL="$(gh -R FrankQDWang/gstack-superpowers pr create --draft --base "$BASE_BRANCH" --head "$BRANCH" --title "$PR_TITLE" --body-file "$PR_BODY" 2>>"$LOG_FILE")"
fi

for label in codex codex-automation; do
  if gh -R FrankQDWang/gstack-superpowers label list --json name --jq '.[].name' | grep -qx "$label"; then
    gh -R FrankQDWang/gstack-superpowers pr edit "$BRANCH" --add-label "$label" >> "$LOG_FILE" 2>&1 || true
  fi
done

{
  printf -- '- Runner status: `success`.\n'
  printf -- '- Message: Weekly upstream sync PR is ready for review.\n'
  printf -- '- PR: `%s`.\n' "$PR_URL"
  printf -- '- Source repo: `%s`.\n' "$SOURCE_REPO"
  printf -- '- Worktree: `%s`.\n' "$WORKTREE_DIR"
  printf -- '- Branch: `%s`.\n' "$BRANCH"
  printf -- '- Mode: `%s`.\n' "$MODE"
  if [ -n "$REVIEW_SUMMARY" ]; then
    printf -- '- Brief: %s\n' "$REVIEW_SUMMARY"
  fi
  printf -- '- Log: `%s`.\n' "$LOG_FILE"
} > "$SUMMARY_FILE"
append_memory
cleanup_old_runner_state
log "Weekly sync PR: $PR_URL"
rmdir "$LOCK_DIR" 2>/dev/null || true
