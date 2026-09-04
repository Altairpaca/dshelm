# Provider integration policy

DSHelm is provider-neutral. External LLM providers may be added when they expand user choice without changing existing routing semantics, credential ownership, privacy boundaries, or evidence standards.

This document defines the minimum technical and maintenance contract for provider proposals. It applies equally to community contributions, maintainer-initiated integrations, and commercial or ecosystem partnerships.

## Default position

A new provider is opt-in unless a separate evidence-backed routing policy explicitly says otherwise. An integration must not silently change:

- existing provider/model defaults;
- fallback order;
- project or request overrides;
- credential storage or ownership;
- routing scores because of sponsorship, referral, or revenue-sharing terms.

Commercial metadata and technical capability evidence are separate concerns. A partnership does not count as compatibility evidence, and technical acceptance does not imply endorsement.

## What to validate

OpenAI-compatible request shape is only an initial transport signal. A provider proposal should document the behavior DSHelm and DSH actually depend on.

| Surface | Evidence expected |
| --- | --- |
| Endpoint / authentication | official documentation plus a redacted working request |
| Model identifiers | official model list or reproducible discovery result |
| Streaming | observed behavior and termination/error semantics |
| Tool / function calling | supported schema and one reproducible call when claimed |
| Reasoning controls | mapping to DSHelm/DSH reasoning semantics; lossy mappings must be explicit |
| Context / capability metadata | source, confidence, and update path |
| Errors / rate limits | observable status/error behavior and documented limits where available |
| Credentials | owner/store/reference boundary; DSHelm must not copy product-owned secrets |
| Tracking / referral | any extra header, identifier, cookie, query parameter, or attribution mechanism |
| Privacy / network | material data-location, logging, retention, or proxy boundary known to the integration |
| Route evidence | one redacted Resolution Trace showing the provider remains an explicit selectable candidate |

Unknown or unverified behavior stays unknown. Marketing copy, benchmark claims, and provider self-description should not be converted directly into routing scores.

## Contribution path

1. Open a focused Issue describing the provider, the intended integration surface, and why users benefit.
2. Link primary API/documentation sources and identify ambiguous semantics before implementation.
3. Add deterministic contract tests or fixtures where possible without private credentials.
4. Validate live behavior separately and redact tokens, account identifiers, private URLs, and sensitive paths.
5. Keep paid/private credentials out of required CI. Public CI should test the adapter/contract rather than depend on a live commercial account.
6. Update provider/model knowledge only for claims supported by a source or reproducible runtime evidence.
7. Document any referral or partnership mechanism separately from capability metadata and routing policy.

Provider/authentication changes should be scoped in an Issue before a substantial PR, following `CONTRIBUTING.md`.

## Partnership guardrails

If an integration is associated with sponsorship, referral revenue, free credits, or cross-promotion:

- participation must remain non-exclusive unless the repository explicitly changes this policy through a public design decision;
- the provider must remain optional;
- commercial terms must not determine capability scores or default routing;
- user-visible referral/tracking behavior must be disclosed before use;
- README placement or launch copy must not overstate verification status;
- DSHelm must remain clearly independent from provider and model vendors.

The maintainer may decline a technically possible integration when its maintenance burden, privacy impact, attribution mechanism, or product coupling is disproportionate to user value.

## Evidence boundary for public claims

Use the following language discipline:

- **verified**: reproduced against a recorded provider/model/runtime version;
- **source-backed**: supported by primary documentation but not yet reproduced locally;
- **target / candidate**: being evaluated; no compatibility claim yet;
- **unknown**: evidence is insufficient.

Public README, release notes, model metadata, and promotional material should preserve these distinctions.

Tracked in #22.
