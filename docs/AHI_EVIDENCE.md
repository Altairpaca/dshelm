# Agent Harness Index evidence in DSHelm

DSHelm can consume normalized Agent Harness Index (`ahi.summary/v1`) cells through `@dshelm/model-knowledge` without adding AHI-specific logic to the core resolver.

## Data path

```text
ahi.summary/v1
  -> AhiSummarySchema
  -> explicit AhiEvidenceMapping
  -> KnowledgeBundle (layer=empirical)
  -> runtimeKnowledgeOverlay
  -> existing DSHelm routing evidence / soft scores
```

The bridge therefore preserves the existing architectural boundary: model knowledge translates evidence; core resolves policy.

## Explicit semantic mapping

AHI benchmark names are not interpreted automatically. For every ingested summary the caller supplies:

- provider identity;
- display name;
- one DSHelm model-knowledge soft capability;
- confidence in that benchmark-to-capability interpretation;
- observation timestamp;
- staleness horizon;
- optional source URL/commit.

A benchmark called `coding`, `planning`, `review` or similar has no routing meaning by name alone.

## Score and confidence

The AHI cell's `success_rate` becomes the empirical capability score. Mapping confidence remains a separate field. The existing runtime overlay multiplies score by confidence for routing soft scores; the raw success rate and benchmark provenance remain available in the evidence record.

## Comparability provenance

The generated evidence value preserves:

- benchmark and benchmark version;
- harness and harness version;
- model version;
- observation/success counts;
- Wilson interval;
- task-set SHA-256;
- configuration SHA-256;
- environment SHA-256.

These fields are evidence provenance, not hard runtime capability claims.

## Validation boundary

The bridge rejects internally inconsistent AHI cells, including impossible counts, inconsistent success rates, invalid Wilson intervals and telemetry coverage exceeding observation count. Duplicate mappings of the same provider/model to the same capability are rejected rather than silently averaged.

## No local-runtime claim

The synthetic fixture used by this integration establishes schema and conversion semantics only. It does not claim that DSHelm, DSH, Codex or another harness produced a real benchmark result on the current machine.
