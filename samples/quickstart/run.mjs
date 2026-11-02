#!/usr/bin/env node
/**
 * dsh-settlement-docs quickstart — checks the bundled synthetic 房建 checklist
 * against the bundled submission and exports the review worksheet.
 *
 *   node samples/quickstart/run.mjs            # human-readable summary
 *   node samples/quickstart/run.mjs --json     # the golden result on stdout
 *   node samples/quickstart/run.mjs --check    # recompute and diff against the golden file
 *
 * The golden file `expected/result.json` is the stdout of `--json`; it is a real
 * run over the committed CSVs, not hand-written output. The checklist file is
 * byte-identical to `settlement.template({ project_type: '房建' })`. No network,
 * no model, no customer data: every code, name and copy count is synthetic.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTools } from '../../lib/plugin/tools.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const CHECKLIST = 'samples/quickstart/input/checklist-housing.csv'
const SUBMISSION = 'samples/quickstart/input/submitted-2026-11.csv'
const expectedPath = path.join(here, 'expected', 'result.json')
const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--json') ? 'json' : 'summary'
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

async function run() {
  const checklistText = await readFile(path.join(root, CHECKLIST), 'utf8')
  const submissionText = await readFile(path.join(root, SUBMISSION), 'utf8')
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-settlement-docs-quickstart-'))
  try {
    const tools = Object.fromEntries(createTools({ baseDir: tempDir }).map((tool) => [tool.name, tool]))
    const exec = { callId: 'quickstart', agent: { id: 'quickstart' } }

    const template = await tools['settlement.template'].execute({ project_type: '房建' }, exec)
    assert.equal(template.csv, checklistText, 'the committed checklist must equal the 房建 template')
    const checked = await tools['settlement.check'].execute(
      { checklist_csv: template.csv, submission_csv: submissionText },
      exec,
    )
    const exported = await tools['settlement.export'].execute(
      {
        checklist_csv: template.csv,
        submission_csv: submissionText,
        filename: 'settlement-check-2026-11.csv',
      },
      exec,
    )
    const csvText = await readFile(exported.path, 'utf8')

    return {
      _note:
        'Real tool output. The export path is normalised to exports/<file>.csv (the run directory is a temp dir); everything else is verbatim. Copies are integers; the checklist file equals the 房建 template byte-for-byte.',
      template: {
        project_type: template.project_type,
        items: template.items.length,
        required_items: template.required_items,
        optional_items: template.optional_items,
        sha256: template.sha256,
        bytes: template.bytes,
      },
      sample: {
        checklist: { path: CHECKLIST, bytes: Buffer.byteLength(checklistText), sha256: sha256(checklistText) },
        submission: { path: SUBMISSION, bytes: Buffer.byteLength(submissionText), sha256: sha256(submissionText) },
      },
      check: checked,
      export: {
        path: `exports/${path.basename(exported.path)}`,
        sha256: exported.sha256,
        rows: exported.rows,
        bytes: exported.bytes,
        checklist_items: exported.checklist_items,
        missing_required: exported.missing_required,
        copies_short: exported.copies_short,
        unsigned: exported.unsigned,
        unstamped: exported.unstamped,
        optional_missing: exported.optional_missing,
        blocking_issues: exported.blocking_issues,
        info_issues: exported.info_issues,
        rate_pct: exported.rate_pct,
      },
      worksheet: {
        bom: csvText.charCodeAt(0) === 0xfeff,
        text: csvText.replace(/^\uFEFF/, ''),
      },
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function printSummary(result) {
  const { check, export: exported, template, worksheet } = result
  const summary = check.summary
  console.log('dsh-settlement-docs quickstart - synthetic settlement document checklist (not customer data)')
  console.log(
    `template: ${template.project_type} ${template.items} items (${template.required_items} required / ${template.optional_items} optional), checklist matches template`,
  )
  console.log(`checklist: ${result.sample.checklist.path} (${summary.checklist_items} items)`)
  console.log(`submitted: ${summary.submitted_items} files / ${summary.checklist_items} items`)
  console.log(`missing: ${summary.missing_required} required + ${summary.optional_missing} optional (info)`)
  console.log(`copies short: ${summary.copies_short}; unsigned: ${summary.unsigned}; unstamped: ${summary.unstamped}`)
  console.log(
    `completeness: ${summary.rate_pct.toFixed(2)}% (${summary.required_complete}/${summary.required_items} required), overall ${summary.overall_rate_pct.toFixed(2)}%`,
  )
  console.log(`issues: ${summary.blocking_issues} blocking, ${summary.info_issues} info`)
  for (const issue of check.issues) console.log(`  ${issue.level} ${issue.type} ${issue.code} ${issue.message}`)
  console.log(
    `worksheet: ${exported.path} ${exported.rows} rows, ${exported.bytes} bytes, sha256 ${exported.sha256.slice(0, 12)}...`,
  )
  console.log(`worksheet columns: ${worksheet.text.split('\n')[0]}`)
}

const result = await run()

if (mode === 'json') {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else if (mode === 'check') {
  const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
  assert.deepEqual(result, expected)
  printSummary(result)
  console.log('golden samples/quickstart/expected/result.json matches')
  console.log('quickstart ok')
} else {
  printSummary(result)
  console.log('run with --check to compare against expected/result.json')
}
