# Changelog

## [0.1.0] — 2026-11-03

### Stable

- First non-alpha release: tool names and the CLI surface are covered by a
  compatibility promise (breaking changes require a minor bump).
- Ships a quickstart sample, a one-line prompt, a permission block and real captures.

## 0.1.0-alpha.1 — 2026-11-03

- First public alpha of `dsh-settlement-docs`.
- `settlement.template`: built-in minimal checklists for 房建 (14 items / 12 required), 市政 (13 / 12) and 装饰 (12 / 11), returned as a UTF-8-BOM CSV with counts and sha256; aliases `housing` / `municipal` / `decoration` accepted.
- `settlement.check`: checklist-vs-submission comparison for missing required documents, short copies, missing signatures/stamps, optional documents absent (info level) and the completeness rate; one issue list in checklist order plus merged per-item results.
- `settlement.export`: UTF-8-BOM review worksheet under `$DSH_HOME/dsh-settlement-docs/exports/` via `safeExportPath`; one row per checklist line with issue types and messages.
- Stable error codes `E_SETTLEMENT_CSV_ROW`, `E_SETTLEMENT_DUP_CODE`, `E_SETTLEMENT_UNKNOWN_CODE`, `E_SETTLEMENT_PATH_INVALID`, `E_SETTLEMENT_EMPTY`.
- Synthetic 14-item checklist + 11-file submission, real-output golden and terminal screenshot; 72 tests.
- No network, no OCR, no xlsx: CSV in, CSV out, no customer data.
