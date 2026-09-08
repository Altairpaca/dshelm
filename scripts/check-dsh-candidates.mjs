#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const CANDIDATE_SCHEMA = "dshelm.compat-candidates/v1";

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
}

export function validateCandidateManifest(manifest, compatibility) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("candidate manifest must be an object");
  if (manifest.schemaVersion !== CANDIDATE_SCHEMA) throw new Error(`schemaVersion must equal ${CANDIDATE_SCHEMA}`);
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length === 0) throw new Error("candidates must be a non-empty array");

  const seen = new Set();
  const reports = [];
  const testedVersion = compatibility?.tested?.dshPackages;
  assertNonEmpty(testedVersion, "compatibility.tested.dshPackages");

  for (const candidate of manifest.candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("candidate entries must be objects");
    assertNonEmpty(candidate.runtime, "candidate.runtime");
    assertNonEmpty(candidate.version, "candidate.version");
    const key = `${candidate.runtime}@${candidate.version}`;
    if (seen.has(key)) throw new Error(`duplicate candidate: ${key}`);
    seen.add(key);

    if (!new Set(["blocked", "candidate", "ready"]).has(candidate.state)) {
      throw new Error(`${key}: state must be blocked, candidate, or ready`);
    }
    if (!Array.isArray(candidate.requiredChecks) || candidate.requiredChecks.length === 0) {
      throw new Error(`${key}: requiredChecks must be a non-empty array`);
    }
    if (new Set(candidate.requiredChecks).size !== candidate.requiredChecks.length) {
      throw new Error(`${key}: requiredChecks must be unique`);
    }
    for (const check of candidate.requiredChecks) assertNonEmpty(check, `${key}: check`);

    if (!Array.isArray(candidate.blockers)) throw new Error(`${key}: blockers must be an array`);
    const blockerIds = new Set();
    const unresolved = [];
    for (const blocker of candidate.blockers) {
      assertNonEmpty(blocker?.id, `${key}: blocker.id`);
      assertNonEmpty(blocker?.surface, `${key}: blocker.surface`);
      assertNonEmpty(blocker?.url, `${key}: blocker.url`);
      assertNonEmpty(blocker?.summary, `${key}: blocker.summary`);
      if (typeof blocker?.resolved !== "boolean") throw new Error(`${key}: blocker.resolved must be boolean`);
      if (blockerIds.has(blocker.id)) throw new Error(`${key}: duplicate blocker id ${blocker.id}`);
      blockerIds.add(blocker.id);
      if (!blocker.resolved) unresolved.push(blocker.id);
    }

    if (candidate.state === "ready" && unresolved.length > 0) {
      throw new Error(`${key}: ready candidate has unresolved blockers: ${unresolved.join(", ")}`);
    }
    if (candidate.state === "blocked" && unresolved.length === 0) {
      throw new Error(`${key}: blocked candidate must identify at least one unresolved blocker`);
    }
    if (testedVersion === candidate.version && candidate.state !== "ready") {
      throw new Error(`${key}: compatibility.json cannot promote a candidate that is ${candidate.state}`);
    }

    reports.push({
      runtime: candidate.runtime,
      version: candidate.version,
      state: candidate.state,
      unresolvedBlockers: unresolved,
      requiredChecks: candidate.requiredChecks,
      promoted: testedVersion === candidate.version,
    });
  }
  return reports;
}

async function main() {
  const [candidateText, compatibilityText] = await Promise.all([
    readFile(new URL("../compatibility-candidates.json", import.meta.url), "utf8"),
    readFile(new URL("../compatibility.json", import.meta.url), "utf8"),
  ]);
  const reports = validateCandidateManifest(JSON.parse(candidateText), JSON.parse(compatibilityText));
  process.stdout.write(`${JSON.stringify({ valid: true, candidates: reports }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`compat:candidate-check: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
