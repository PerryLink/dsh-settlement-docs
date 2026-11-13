# Changelog

## [0.2.0] — 2026-11-13

### Breaking

- **Tool names no longer contain a dot.** The three tools are now `settlement_check`, `settlement_template` and `settlement_export`. Providers validate `tools[].name` against `^[a-zA-Z0-9_-]+$`; the old dotted names invalidated the whole `tools` array, so the plugin registered but every request carrying its tools was rejected with `Invalid 'tools[N].name'`. Minor bump because tool names are part of the 0.1.0 compatibility promise — update prompts, saved calls and permission rules that still use the old dotted names.
- `test/tool-name-wire.test.mjs` pins the wire pattern so a new tool cannot reintroduce a dot or drop the `settlement_` namespace.
- Earlier changelog entries use the new spelling, so a repository-wide search no longer finds dotted tool names.

## [0.1.0] — 2026-11-03

### Stable

- First non-alpha release: tool names and the CLI surface are covered by a
  compatibility promise (breaking changes require a minor bump).
- Ships a quickstart sample, a one-line prompt, a permission block and real captures.

## 0.1.0-alpha.1 — 2026-11-03

- First public alpha of `dsh-settlement-docs`.
- `settlement_template`: built-in minimal checklists for 房建 (14 items / 12 required), 市政 (13 / 12) and 装饰 (12 / 11), returned as a UTF-8-BOM CSV with counts and sha256; aliases `housing` / `municipal` / `decoration` accepted.
- `settlement_check`: checklist-vs-submission comparison for missing required documents, short copies, missing signatures/stamps, optional documents absent (info level) and the completeness rate; one issue list in checklist order plus merged per-item results.
- `settlement_export`: UTF-8-BOM review worksheet under `$DSH_HOME/dsh-settlement-docs/exports/` via `safeExportPath`; one row per checklist line with issue types and messages.
- Stable error codes `E_SETTLEMENT_CSV_ROW`, `E_SETTLEMENT_DUP_CODE`, `E_SETTLEMENT_UNKNOWN_CODE`, `E_SETTLEMENT_PATH_INVALID`, `E_SETTLEMENT_EMPTY`.
- Synthetic 14-item checklist + 11-file submission, real-output golden and terminal screenshot; 72 tests.
- No network, no OCR, no xlsx: CSV in, CSV out, no customer data.
