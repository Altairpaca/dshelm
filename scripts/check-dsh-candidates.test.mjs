import assert from "node:assert/strict";
import test from "node:test";

import { validateCandidateManifest } from "./check-dsh-candidates.mjs";

const compatibility = { tested: { dshPackages: "0.1.0-rc.7" } };
const candidate = {
  runtime: "@deepseek-ai/dsh",
  version: "0.1.2-rc.1",
  state: "blocked",
  requiredChecks: ["package-graph-complete", "web-client-boot"],
  blockers: [
    {
      id: "upstream-bug",
      surface: "web-client",
      url: "https://example.invalid/upstream-bug",
      summary: "web client does not boot",
      resolved: false,
    },
  ],
};

function manifest(overrides = {}) {
  return {
    schemaVersion: "dshelm.compat-candidates/v1",
    candidates: [{ ...candidate, ...overrides }],
  };
}

test("blocked candidate remains valid while tested baseline stays old", () => {
  const [report] = validateCandidateManifest(manifest(), compatibility);
  assert.equal(report.state, "blocked");
  assert.deepEqual(report.unresolvedBlockers, ["upstream-bug"]);
  assert.equal(report.promoted, false);
});

test("ready state rejects unresolved blockers", () => {
  assert.throws(
    () => validateCandidateManifest(manifest({ state: "ready" }), compatibility),
    /ready candidate has unresolved blockers/,
  );
});

test("compatibility baseline cannot promote blocked candidate", () => {
  assert.throws(
    () => validateCandidateManifest(manifest(), { tested: { dshPackages: "0.1.2-rc.1" } }),
    /cannot promote a candidate that is blocked/,
  );
});

test("ready candidate can be promoted after blockers resolve", () => {
  const ready = manifest({
    state: "ready",
    blockers: [{ ...candidate.blockers[0], resolved: true }],
  });
  const [report] = validateCandidateManifest(ready, { tested: { dshPackages: "0.1.2-rc.1" } });
  assert.equal(report.promoted, true);
  assert.deepEqual(report.unresolvedBlockers, []);
});
