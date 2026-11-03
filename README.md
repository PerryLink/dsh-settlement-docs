<div align="center">

# dsh-settlement-docs

> **Official repository.** The only official repository of this package, maintained by PerryLink. Same-name repositories under other accounts are not affiliated. Apache-2.0.

[![npm](https://img.shields.io/npm/v/dsh-settlement-docs)](https://www.npmjs.com/package/dsh-settlement-docs)
[![CI](https://github.com/PerryLink/dsh-settlement-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-settlement-docs/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Check a construction final-settlement document checklist against what was actually submitted: missing documents, short copies, missing signatures/stamps, optional documents absent, and the completeness rate → review worksheet CSV.**

> **Status: alpha / public-synthetic / partial / not counted / not GA.** No customer data, customer evidence, or production-readiness claim.

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <profile> add dsh-settlement-docs
```

</div>

## One-liner

Align "which final-settlement documents should have been handed over" with "what actually arrived", list missing documents, short copies, missing signatures/stamps and optional documents absent, compute a completeness rate, and export a reviewable worksheet CSV.

## Fit / not a fit

- **Fits:** settlement document controllers at a main contractor, subcontractor, owner or supervisor doing a pre-submission completeness self-check; a fixed project type (housing / municipal / decoration) with a checklist of tens of items; needing one list of what is missing, how many copies short, and which stamp is absent; needing a worksheet that opens cleanly in Excel.
- **Does not fit:** replacing archive acceptance, completion filing or legal advice; OCR of scanned PDFs/images (CSV only, file contents are never read); judging whether a document is genuine or a signature is authorised; multi-project / multi-section ledgers (one project checklist per run).

## Input

- **Checklist CSV:** UTF-8, header `资料编码,资料名称,应有份数,是否必需` (Chinese) or `code,name,required_copies,required` (English). Column order is free and extra columns are ignored.
  - `应有份数` is a positive integer; `是否必需` is `是/否` (also `必需/非必需`).
  - Every document code appears once; the checklist cannot be empty (header-only is also rejected).
- **Actual-submission CSV:** UTF-8, header `资料编码,文件名,份数,签字,盖章` (or `code,filename,copies,signed,stamped`).
  - `份数` is a non-negative integer; `签字`/`盖章` are `是/否` (also `已签字`, `未盖章`, `true`, `0`). A blank cell means "no".
  - Every code appears once. A header-only file means "nothing submitted" and is valid (0% completeness).
- **Project templates:** 房建 (14 items / 12 required), 市政 (13 / 12), 装饰 (12 / 11).
- **Sample:** `samples/quickstart/input/checklist-housing.csv` (14 items, byte-identical to the 房建 template) and `submitted-2026-11.csv` (11 files). Synthetic only.

## Output

- `settlement.template`: built-in checklist template CSV text, project type, total/required/optional item counts, bytes and sha256. **No file is written.**
- `settlement.check`: `summary` (checklist items, submitted, missing, short copies, unsigned, unstamped, optional missing, completeness rate, blocking/info counts), an `issues` list in checklist order, and merged per-item `items`.
- `settlement.export`: review worksheet CSV (UTF-8 BOM, opens cleanly in Excel), one row per checklist line with issue type and message; written to `$DSH_HOME/dsh-settlement-docs/exports/`; returns path, rows, bytes and sha256. Without `filename` it writes `settlement-check.csv` (same-name files are overwritten).
- The source CSVs are never modified; no upload, no network, no model call.

## Example

Paste this one line into the agent:

> 帮我把这份竣工结算资料核对一下：缺哪些、份数够不够、有没有没签字的，再把核对表导出来。

Reproduce the bundled sample and compare with the golden file:

```sh
node samples/quickstart/run.mjs --check
```

![dsh-settlement-docs quickstart terminal output](docs/assets/quickstart.png)

This is a real run: a 14-item housing checklist (12 required / 2 optional) against 11 submitted files — **2 required + 1 optional missing**, **1 short copy** (settlement book 1/3), **1 missing stamp** (concealed-works record), no missing signatures. The completeness rate is **66.67% (8/12 required)** and **64.29% (9/14) overall**, with **4 blocking + 1 info** issues and a 15-row worksheet. `samples/quickstart/expected/result.json` is the real stdout of `node samples/quickstart/run.mjs --json`, not hand-written.

## Permissions

Read: the checklist CSV and actual-submission CSV the user names (sample: `samples/quickstart/input/`); nothing else.
Write: `$DSH_HOME/dsh-settlement-docs/exports/` (review worksheet CSV) only; source files are not modified.
Network: no.
External systems: none.

`settlement.template` and `settlement.check` are **R0** (read-only; the template lives in memory). `settlement.export` is **R1** (local write under `$DSH_HOME/dsh-settlement-docs`). `DSH_SETTLEMENT_DOCS_HOME` can override the local write root for tests.

## FAQ

### 1. How is the completeness rate computed?

**Rate = complete required documents ÷ all required documents**, rounded to 2 decimals. A document is complete only when it is submitted, has enough copies, is signed and is stamped. `summary.overall_rate_pct` is the same calculation including optional documents; the worksheet has a per-line `是否齐套` column.

### 2. Why doesn't a missing optional document block?

"Optional" means it can be absent at submission, so it produces an info-level issue and does not lower the required completeness rate; it is still listed in `issues` and in the worksheet as `optional_missing`. A submitted optional document with a copy/signature/stamp defect is also reported at info level.

### 3. Why does an unknown submission code abort the check?

Silently ignoring a mismatched code would inflate the rate — a typo of `JS-08` as `JS-09` would mark `JS-09` as received while `JS-08` still looks missing. `E_SETTLEMENT_UNKNOWN_CODE` stops the run and lists every unknown code. A duplicate code in either list is `E_SETTLEMENT_DUP_CODE`.

### 4. What happens when the signature or stamp cell is blank?

A blank cell means "no" and raises the same issue as an explicit `否`. The **column itself cannot be missing**: an absent `签字` or `盖章` header is `E_SETTLEMENT_CSV_ROW`, because that usually means the header was copied wrong.

### 5. Does it modify or upload my CSV? Can it read Excel directly?

It never modifies, uploads or sends the CSV over the network. Save the sheet as **CSV UTF-8** first. Excel-written UTF-8 CSVs with a BOM are accepted.

### 6. Can the built-in template be used as the official checklist?

Not as a statutory register. It is a **minimal starting point** (housing 14, municipal 13, decoration 12) covering the most common settlement-submission documents; local filing, special acceptance and contract requirements usually add more. Treat it as a skeleton and follow the contract and local archive rules.

## Version

`0.1.0` · 72 tests pass (`node --test test/*.test.mjs`).

> ⭐ If this helps, a star makes it easier for the next person to find it. Nothing is gated behind it.

## Install

```sh
dsh plugin --profile <profile> add dsh-settlement-docs
dsh --profile <profile> --dump-config | grep dsh-settlement-docs
```

Uninstall:

```sh
dsh plugin --profile <profile> remove dsh-settlement-docs
```

### Install channels

- **npm (recommended):** `dsh plugin --profile <profile> add dsh-settlement-docs`
- **git channel:** `dsh plugin --profile <profile> add github:PerryLink/dsh-settlement-docs`
- **tarball:** `pnpm pack`, then `dsh plugin --profile <profile> add ./dsh-settlement-docs-<version>.tgz`

## Tools

Tool names are stable API; descriptions stay in English to match runtime output.

| Tool | Purpose | Risk |
|---|---|---|
| `settlement.template` | Generate the built-in checklist template CSV for a project type (housing / municipal / decoration, 12+ items each); returns text and counts | R0 |
| `settlement.check` | Compare checklist vs submission: missing, short copies, missing signature/stamp, optional absent, completeness rate | R0 |
| `settlement.export` | Re-run the check and write the worksheet CSV (UTF-8 BOM); returns path, rows, sha256 | R1 local write |

## Check rules

1. **Missing required** — a required code absent from the submission → `missing`, blocking.
2. **Optional absent** — an optional code absent → `optional_missing`, info only; does not lower the required rate.
3. **Short copies** — `submitted < required` → `copies_short`; equal or more is fine.
4. **Unsigned / unstamped** — `签字` or `盖章` is "no"/blank → `unsigned` / `unstamped`; both can hit one line.
5. **Unknown code** — a submitted code not in the checklist → `E_SETTLEMENT_UNKNOWN_CODE`; the whole check stops.
6. **Duplicate code** — the same code twice in either list → `E_SETTLEMENT_DUP_CODE`.
7. **Complete** — submitted + enough copies + signed + stamped; `items[].complete=true` only then.
8. **Empty checklist** — empty or header-only → `E_SETTLEMENT_EMPTY`. A header-only submission is valid (= nothing submitted).

## Quick start

```sh
# 1) generate a template (tool surface)
#    settlement.template({ project_type: "房建" })

# 2) check (tool surface)
#    settlement.check({ checklist_csv, submission_csv })

# 3) export the worksheet (tool surface)
#    settlement.export({ checklist_csv, submission_csv, filename: "settlement-check-2026-11.csv" })
```

Run the bundled sample:

```sh
node samples/quickstart/run.mjs --check
```

## Acceptance evidence

Public/synthetic fixtures live in `samples/quickstart/`; `ACCEPTANCE.csv` records the checks, and every row except the quickstart row is `counted=false`.

| req_id | metric | threshold | actual | pass | source | counted |
|---|---|---|---|---|---|---|
| SD-A05 | missing documents | 2 required + 1 optional | required=2 optional=1 | true | public/synthetic | false |
| SD-A08 | completeness rate | 66.67% (8/12) | 66.67% (8/12) | true | public/synthetic | false |
| PS1-QS01 | quickstart golden | 1/1 | 1 | true | synthetic/quickstart | true |

*Fixture-backed acceptance rows, not a customer run; no output was invented.*

## Boundaries and known limits

- **Completeness only, not content**: it does not verify amounts, whether a variation is valid, signatory authority or document authenticity.
- **One line per document**: merge split files into one code; duplicate codes fail with `E_SETTLEMENT_DUP_CODE`.
- **No PDF/image reading**: only filename, copy count and signature/stamp markers in the CSV; no OCR.
- **Template is not a statutory register**: follow the contract and local filing requirements.
- **One project/section per run**: split multi-section projects into separate checklists.
- Public/synthetic fixtures only; alpha/partial, not counted, no GA or production-readiness claim.

## Development

```sh
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck
node --test test/*.test.mjs
node scripts/gate.mjs
```

## Compatibility

| Dimension | Status |
|---|---|
| Harness | `dsh >=0.2.1-rc.3 <0.4.0` |
| Node | `>=24.9.0 <25` |
| Platforms | All; local files only |
| Data | No network, no model call, no upload |

## Related projects

- [dsh-progress-payment](https://github.com/PerryLink/dsh-progress-payment) (contract-baseline progress payment)
- [dsh-contract-pack](https://github.com/PerryLink/dsh-contract-pack) (contract clauses and registers)
- [dsh-construction-pack](https://github.com/PerryLink/dsh-construction-pack) (construction scenario bundle)
