import assert from "node:assert/strict";
import test from "node:test";

import { validateCompatibilityEvidence } from "./check-dsh-evidence.mjs";

const candidateManifest = {
  candidates: [
    {
      runtime: "@deepseek-ai/dsh",
      version: "0.1.2-rc.1",
      state: "blocked",
      requiredChecks: ["package", "web"],
      blockers: [{ id: "upstream-web", resolved: false }],
    },
  ],
};

function evidence(overrides = {}) {
  return {
    schemaVersion: "dshelm.compat-evidence/v1",
    runtime: "@deepseek-ai/dsh",
    version: "0.1.2-rc.1",
    checks: {
      package: { status: "pending" },
      web: { status: "blocked", blockerIds: ["upstream-web"] },
    },
    ...overrides,
  };
}

test("blocked candidate keeps explicit machine-readable evidence state", () => {
  const result = validateCompatibilityEvidence(candidateManifest, evidence());
  assert.equal(result.allPassed, false);
});

test("pass requires timestamped evidence", () => {
  const value = evidence();
  value.checks.package = { status: "pass" };
  assert.throws(() => validateCompatibilityEvidence(candidateManifest, value), /pass requires evidenceUri/);
});

test("blocked check must reference a current blocker", () => {
  const value = evidence();
  value.checks.web = { status: "blocked", blockerIds: ["missing"] };
  assert.throws(() => validateCompatibilityEvidence(candidateManifest, value), /unknown blocker/);
});

test("ready candidates require all checks passed and blockers resolved", () => {
  const readyCandidates = structuredClone(candidateManifest);
  readyCandidates.candidates[0].state = "ready";
  readyCandidates.candidates[0].blockers[0].resolved = true;
  const value = evidence({
    checks: {
      package: { status: "pass", evidenceUri: "artifact://package", observedAt: "2026-09-05T00:00:00Z" },
      web: { status: "pass", evidenceUri: "artifact://web", observedAt: "2026-09-05T00:01:00Z" },
    },
  });
  assert.equal(validateCompatibilityEvidence(readyCandidates, value).allPassed, true);
});

test("ready state cannot be declared while evidence is still pending", () => {
  const readyCandidates = structuredClone(candidateManifest);
  readyCandidates.candidates[0].state = "ready";
  readyCandidates.candidates[0].blockers[0].resolved = true;
  const value = evidence({ checks: { package: { status: "pending" }, web: { status: "pending" } } });
  assert.throws(() => validateCompatibilityEvidence(readyCandidates, value), /ready candidate requires every evidence check/);
});
