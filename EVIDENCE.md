# Evidence — dsh-settlement-docs 0.1.0-alpha.1

All runs are local and offline, over synthetic settlement documents. No customer data, no network
call, no model call. **No `git commit` and no `npm publish` were performed.**

## Environment

- Node `v24.22.1`
- pnpm `11.28.5` (locked by `packageManager`; run through corepack)
- TypeScript `7.0.2` (NodeNext, strict)
- Runtime dependencies: none (Node standard library + host contracts)
- Date: 2026-11-03 (Asia/Shanghai)

## Commands and results

| Command | Result |
|---|---|
| `pnpm build` | exit 0, `tsc -p tsconfig.json` emits `lib/` |
| `pnpm typecheck` | exit 0 |
| `pnpm test` (`tsc` + `node --test test/*.test.mjs`) | 72 tests, 72 pass, 0 fail (13 test files) |
| `node samples/quickstart/run.mjs --check` | golden `expected/result.json` matches |
| `pnpm gate` | lint ok, acceptance ok, 18/18 acceptance rows pass |
| `npm pack --dry-run --json` | 37 files, 127,825 bytes packed; no publish |

## Local Package Standard v1 score

The package is intentionally **not** added to `04-build/dsh-plugins/family.json` (it is not in the
committed roster yet, and no market package page exists). To verify the standard locally, the
official `04-build/dsh-plugins/scripts/score-packages.mjs` was copied to a temporary
`dsh-plugins/scripts/` tree with a temporary one-item `family.json`, and the package files were
copied to a temporary sibling directory (the real `family.json` was never modified):

```
PS1 scores: 1 packages | green 1 / yellow 0 / red 0
domain packages: 1, avg 10.0
 10 green  dsh-settlement-docs

name,status,scope,page,sample,prompt,expected,permissions,errors,evidence,total,grade,missing
dsh-settlement-docs,active,domain,1,2,1,1,2,1,2,10,green,""
```

Every scored category is non-zero; the score is 10/10 against the same rules the family uses
(gate `--gate 8` passes with margin).

## Screenshot / golden hashes

| Artifact | SHA-256 |
|---|---|
| `docs/assets/quickstart.png` | `52baf454751b23c8ae23fa0465c30f92ea5020fbd1cc7ab9eb2c8a9f3322f317` |
| `docs/assets/quickstart.log` | `3045252ebdda5a61c8d83d0c2cc15447673366915c7850ea7bb92429c10206b5` |
| `samples/quickstart/expected/result.json` | `b0ff2f96af53757c8c47ac3ed3ec5ea62fcf76bea6facd7eb7b44a552b53cb1f` |
| `ACCEPTANCE.csv` quickstart row | uses the `expected/result.json` hash above |

The screenshot was rendered by `04-build/dsh-plugins/scripts/render-capture.py` from the real
captured terminal output in `docs/assets/quickstart.log`; no output text was invented. The CJK
font used for rendering was the local `msyh.ttc` / `msyhbd.ttc`; the capture text is unchanged.

## Quickstart numbers

A 14-item housing checklist (12 required / 2 optional) against 11 submitted files:

- Missing: **2 required** (`JS-08` design-change notice, `JS-12` completion filing record) +
  **1 optional** (`JS-14` delay/claims file) — 3 absent in total.
- Short copies: **1** — `JS-01` settlement book, 1 submitted of 3 required.
- Signatures: **0 unsigned**; **1 unstamped** — `JS-10` concealed-works acceptance record.
- Completeness: **66.67%** (8/12 required); overall **64.29%** (9/14).
- Issues: **4 blocking + 1 info**.
- Worksheet: 15 rows (header + 14), 1,638 bytes, UTF-8 BOM, sha256 `6a09d934a37c…`.

## Error-path coverage

- `E_SETTLEMENT_CSV_ROW` — missing column, empty name/filename, non-integer or negative copies, unknown yes/no marker, unclosed quote.
- `E_SETTLEMENT_DUP_CODE` — a code appears twice in the checklist or in the submission.
- `E_SETTLEMENT_UNKNOWN_CODE` — a submitted code is absent from the checklist; unknown `project_type`.
- `E_SETTLEMENT_EMPTY` — checklist empty/header-only, or the submission file is zero bytes (header-only submission is valid).
- `E_SETTLEMENT_PATH_INVALID` — unsafe/traversal/Chinese/spaced export filename, `.` as filename, over-long name, write failure.
- Result-level issue types: `missing`, `copies_short`, `unsigned`, `unstamped` (blocking for required documents) and `optional_missing` (info).

## Scope

alpha / public-synthetic / partial / not counted / not GA. This package checks document
completeness only; it does not verify document contents, amounts, signatory authority or
authenticity, and it does not replace archive acceptance, completion filing or legal advice.
