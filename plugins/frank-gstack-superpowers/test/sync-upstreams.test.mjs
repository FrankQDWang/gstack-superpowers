import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLsRemoteFailure,
  preflightUpstreamResolution,
} from "../scripts/sync-upstreams.mjs";
import { ERROR_CODES, RUN_STATUS } from "../scripts/lib/run-state.mjs";

const UPSTREAMS = {
  gstack: {
    repo: "https://github.com/garrytan/gstack.git",
    branch: "main",
  },
  superpowers: {
    repo: "https://github.com/obra/superpowers.git",
    branch: "main",
  },
};

test("ls-remote DNS failures are classified as blocked network preflight failures", () => {
  const classification = classifyLsRemoteFailure({
    stderr: "fatal: unable to access 'https://github.com/garrytan/gstack.git/': Could not resolve host: github.com",
  });

  assert.equal(classification.code, ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE);
  assert.equal(classification.reason, "dns_unavailable");
  assert.equal(classification.status, RUN_STATUS.BLOCKED);
});

test("upstream preflight resolves all commits before candidate materialization", async () => {
  const calls = [];
  const git = async (args) => {
    calls.push(args);
    const repo = args[1];
    if (repo.includes("garrytan/gstack")) {
      return {
        stdout: "026751ea2012ec7cbedc149ba615929a20026501\trefs/heads/main\n",
      };
    }
    return {
      stdout: "f2cbfbefebbfef77321e4c9abc9e949826bea9d7\trefs/heads/main\n",
    };
  };

  const preflight = await preflightUpstreamResolution(UPSTREAMS, { git, retryDelaysMs: [] });

  assert.equal(preflight.status, "success");
  assert.equal(preflight.upstreams.gstack.commit, "026751ea2012ec7cbedc149ba615929a20026501");
  assert.equal(preflight.upstreams.superpowers.commit, "f2cbfbefebbfef77321e4c9abc9e949826bea9d7");
  assert.deepEqual(preflight.failures, []);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ["ls-remote", UPSTREAMS.gstack.repo, "refs/heads/main"]);
});

test("upstream preflight retries transient DNS failures and records attempts", async () => {
  let callCount = 0;
  const git = async () => {
    callCount += 1;
    if (callCount === 1) {
      throw Object.assign(new Error("git failed"), {
        stderr: "fatal: unable to access 'https://github.com/garrytan/gstack.git/': Could not resolve host: github.com",
      });
    }
    return {
      stdout: "026751ea2012ec7cbedc149ba615929a20026501\trefs/heads/main\n",
    };
  };

  const preflight = await preflightUpstreamResolution({ gstack: UPSTREAMS.gstack }, { git, retryDelaysMs: [0] });

  assert.equal(preflight.status, "success");
  assert.equal(preflight.upstreams.gstack.commit, "026751ea2012ec7cbedc149ba615929a20026501");
  assert.equal(preflight.upstreams.gstack.attempts.length, 2);
  assert.equal(preflight.upstreams.gstack.attempts[0].reason, "dns_unavailable");
  assert.equal(preflight.upstreams.gstack.attempts[1].status, "success");
});

test("upstream preflight reports blocked when DNS remains unavailable", async () => {
  const git = async () => {
    throw Object.assign(new Error("git failed"), {
      stderr: "fatal: unable to access 'https://github.com/garrytan/gstack.git/': Could not resolve host: github.com",
    });
  };

  const preflight = await preflightUpstreamResolution({ gstack: UPSTREAMS.gstack }, { git, retryDelaysMs: [0] });

  assert.equal(preflight.status, RUN_STATUS.BLOCKED);
  assert.equal(preflight.failures[0].error_code, ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE);
  assert.equal(preflight.upstreams.gstack.error_code, ERROR_CODES.UPSTREAM_NETWORK_UNAVAILABLE);
  assert.equal(preflight.upstreams.gstack.reason, "dns_unavailable");
  assert.equal(preflight.upstreams.gstack.attempts.length, 2);
  assert.ok(preflight.environment);
});
