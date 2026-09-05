#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const EVIDENCE_SCHEMA = "dshelm.compat-evidence/v1";
const ALLOWED_STATUS = new Set(["pending", "pass", "fail", "blocked"]);

export function validateCompatibilityEvidence(candidateManifest, evidence) {
  if (evidence?.schemaVersion !== EVIDENCE_SCHEMA) throw new Error(`schemaVersion must equal ${EVIDENCE_SCHEMA}`);
  if (typeof evidence.runtime !== "string" || typeof evidence.version !== "string") throw new Error("evidence runtime/version are required");
  const candidate = candidateManifest?.candidates?.find(
    (item) => item.runtime === evidence.runtime && item.version === evidence.version,
  );
  if (!candidate) throw new Error(`no candidate matches ${evidence.runtime}@${evidence.version}`);
  if (!evidence.checks || typeof evidence.checks !== "object" || Array.isArray(evidence.checks)) {
    throw new Error("checks must be an object");
  }

  const required = new Set(candidate.requiredChecks);
  const actual = new Set(Object.keys(evidence.checks));
  const missing = [...required].filter((check) => !actual.has(check));
  const extra = [...actual].filter((check) => !required.has(check));
  if (missing.length) throw new Error(`missing evidence checks: ${missing.join(", ")}`);
  if (extra.length) throw new Error(`unexpected evidence checks: ${extra.join(", ")}`);

  const blockerMap = new Map(candidate.blockers.map((blocker) => [blocker.id, blocker]));
  const report = [];
  for (const checkId of candidate.requiredChecks) {
    const check = evidence.checks[checkId];
    if (!check || typeof check !== "object" || Array.isArray(check)) throw new Error(`${checkId}: check must be an object`);
    if (!ALLOWED_STATUS.has(check.status)) throw new Error(`${checkId}: invalid status ${check.status}`);
    if (check.status === "pass") {
      if (typeof check.evidenceUri !== "string" || !check.evidenceUri.trim()) throw new Error(`${checkId}: pass requires evidenceUri`);
      if (typeof check.observedAt !== "string" || Number.isNaN(Date.parse(check.observedAt))) throw new Error(`${checkId}: pass requires observedAt`);
      if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(check.observedAt)) throw new Error(`${checkId}: observedAt must include timezone`);
    }
    const blockerIds = check.blockerIds ?? [];
    if (!Array.isArray(blockerIds) || blockerIds.some((id) => typeof id !== "string")) throw new Error(`${checkId}: blockerIds must be strings`);
    for (const blockerId of blockerIds) {
      const blocker = blockerMap.get(blockerId);
      if (!blocker) throw new Error(`${checkId}: unknown blocker ${blockerId}`);
      if (blocker.resolved) throw new Error(`${checkId}: resolved blocker ${blockerId} cannot keep a check blocked`);
    }
    if (check.status === "blocked" && blockerIds.length === 0) throw new Error(`${checkId}: blocked status requires blockerIds`);
    if (check.status !== "blocked" && blockerIds.length > 0) throw new Error(`${checkId}: blockerIds require blocked status`);
    report.push({ id: checkId, status: check.status });
  }

  const allPassed = report.every((check) => check.status === "pass");
  const unresolved = candidate.blockers.filter((blocker) => !blocker.resolved);
  if (candidate.state === "ready" && (!allPassed || unresolved.length > 0)) {
    throw new Error("ready candidate requires every evidence check to pass and every blocker to resolve");
  }
  return { runtime: evidence.runtime, version: evidence.version, allPassed, checks: report };
}

async function main() {
  const [candidatesText, evidenceText] = await Promise.all([
    readFile(new URL("../compatibility-candidates.json", import.meta.url), "utf8"),
    readFile(new URL("../compatibility-evidence.json", import.meta.url), "utf8"),
  ]);
  const report = validateCompatibilityEvidence(JSON.parse(candidatesText), JSON.parse(evidenceText));
  process.stdout.write(`${JSON.stringify({ valid: true, ...report }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`compat:evidence-check: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
