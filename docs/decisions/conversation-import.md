# ADR: Conversation Import (INDEX / ARCHIVE / CONTINUE)

> Status: ACCEPTED (design only — no importer ships in v0.1)

## Context

Users arrive at DSHelm with transcripts from other harnesses (OmO, OpenCode,
Codex). Resuming work requires importing that context without corrupting the
DSH session log or leaking credentials.

## Design

ExternalConversation != DSH Session. A foreign transcript is never forged
into a native DSH log; it is INDEXED (read-only extraction), ARCHIVED
(durable local storage outside the session log), and CONTINUE (a NEW
DSH-native session carrying `derived-from` provenance).

```text
conversation-import/core     interfaces: Indexer, Archiver, Continuation
import-senpi                adapter over ~/.omo stores
import-opencode             adapter over OpenCode storage/DB
import-codex                adapter over ~/.codex
```

## Safety contract

- Source adapters are READ-ONLY: they never write to ~/.omo, OpenCode
  storage, or ~/.codex.
- No importer reads tokens or API keys.
- CONTINUE creates a fresh DSH session whose first events carry
  `derived-from` provenance pointing at the archive entry.
- Lossy mappings are explicit (schema version, unsupported block types).

## v0.1 scope

- This ADR + the core interfaces are sufficient for v0.1.
- The three parsers are NOT part of the v0.1-alpha acceptance checklist.
- OmO migration UX (`dshelm migrate omo`) remains behavioral-level only; no
  source port of OmO code.
