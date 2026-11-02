#!/usr/bin/env node
/**
 * Acceptance checks over the synthetic quickstart fixtures. Writes ACCEPTANCE.csv
 * and evidence/<run_id>/result.json. No network, no customer data.
 *
 *   node scripts/acceptance.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { percent } from '../lib/core/check.js'
import { buildTemplate } from '../lib/core/template.js'
import { createTools } from '../lib/plugin/tools.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const errors = []
const CHECKLIST_HEADER = '资料编码,资料名称,应有份数,是否必需'
const checklist = (rows) => `${CHECKLIST_HEADER}\n${rows.join('\n')}\n`

async function errorCode(action) {
  try {
    await action()
    return 'NO_ERROR'
  } catch (error) {
    return error?.code ?? error?.name ?? 'UNKNOWN'
  }
}

async function main() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'dsh-settlement-docs-acceptance-'))
  try {
    const tools = Object.fromEntries(createTools({ baseDir: tempDir }).map((tool) => [tool.name, tool]))
    const exec = { callId: 'acceptance' }
    const checklistText = readFileSync(path.join(root, 'samples', 'quickstart', 'input', 'checklist-housing.csv'), 'utf8')
    const submissionText = readFileSync(path.join(root, 'samples', 'quickstart', 'input', 'submitted-2026-11.csv'), 'utf8')

    const template = await tools['settlement.template'].execute({ project_type: '房建' }, exec)
    const checked = await tools['settlement.check'].execute(
      { checklist_csv: checklistText, submission_csv: submissionText },
      exec,
    )
    const exported = await tools['settlement.export'].execute(
      { checklist_csv: checklistText, submission_csv: submissionText, filename: 'settlement-check-2026-11.csv' },
      exec,
    )
    const csvText = readFileSync(exported.path, 'utf8')
    const counts = checked.summary

    const summaryOf = ['房建', '市政', '装饰'].map((type) => buildTemplate(type))
    const allItems = summaryOf.flatMap((entry) => entry.items)

    const traversal = await errorCode(() =>
      tools['settlement.export'].execute(
        { checklist_csv: checklistText, submission_csv: submissionText, filename: '../evil.csv' },
        exec,
      ),
    )
    const duplicate = await errorCode(() =>
      tools['settlement.check'].execute(
        { checklist_csv: checklist(['A-1,结算书,1,是', 'A-1,副本,1,否']), submission_csv: '资料编码,文件名,份数,签字,盖章\n' },
        exec,
      ),
    )
    const unknown = await errorCode(() =>
      tools['settlement.check'].execute(
        {
          checklist_csv: checklistText,
          submission_csv: '资料编码,文件名,份数,签字,盖章\nZZ-99,unknown.pdf,1,是,是\n',
        },
        exec,
      ),
    )
    const empty = await errorCode(() => tools['settlement.check'].execute({ checklist_csv: '', submission_csv: submissionText }, exec))
    const rowError = await errorCode(() =>
      tools['settlement.check'].execute(
        { checklist_csv: checklist(['A-1,结算书,0,是']), submission_csv: '资料编码,文件名,份数,签字,盖章\n' },
        exec,
      ),
    )
    const unknownType = await errorCode(() => tools['settlement.template'].execute({ project_type: '桥梁' }, exec))

    // ACCEPTANCE.csv uses a simple comma-split schema: keep every field free of commas.
    const metrics = [
      {
        req_id: 'SD-A01',
        metric: 'template item counts',
        threshold: '14/13/12 with 12/12/11 required',
        actual: summaryOf.map((entry) => `${entry.items.length}/${entry.required_items}`).join(' '),
        pass:
          summaryOf[0].items.length === 14 &&
          summaryOf[0].required_items === 12 &&
          summaryOf[1].items.length === 13 &&
          summaryOf[1].required_items === 12 &&
          summaryOf[2].items.length === 12 &&
          summaryOf[2].required_items === 11,
      },
      {
        req_id: 'SD-A02',
        metric: 'template well-formedness',
        threshold: 'unique codes + BOM + header',
        actual: `${allItems.length} items/${new Set(allItems.map((item) => item.code)).size} codes`,
        pass:
          summaryOf.every((entry) => entry.items.length >= 12) &&
          new Set(allItems.map((item) => item.code)).size === allItems.length &&
          summaryOf.every((entry) => entry.csv.charCodeAt(0) === 0xfeff && entry.csv.includes('资料编码,资料名称,应有份数,是否必需')),
      },
      {
        req_id: 'SD-A03',
        metric: 'sample checklist = 房建 template',
        threshold: 'byte-identical',
        actual: sha256(checklistText).slice(0, 12),
        pass: checklistText === template.csv && template.project_type === '房建',
      },
      {
        req_id: 'SD-A04',
        metric: 'check checklist/submitted counts',
        threshold: '14 items 11 submitted',
        actual: `${counts.checklist_items} items ${counts.submitted_items} submitted`,
        pass: counts.checklist_items === 14 && counts.submitted_items === 11 && counts.required_items === 12,
      },
      {
        req_id: 'SD-A05',
        metric: 'missing documents',
        threshold: '2 required + 1 optional',
        actual: `required=${counts.missing_required} optional=${counts.optional_missing}`,
        pass: counts.missing_required === 2 && counts.optional_missing === 1,
      },
      {
        req_id: 'SD-A06',
        metric: 'short copies',
        threshold: '1 (JS-01 1/3)',
        actual: `${counts.copies_short}`,
        pass:
          counts.copies_short === 1 &&
          checked.issues.some((issue) => issue.type === 'copies_short' && issue.code === 'JS-01' && issue.submitted_copies === 1),
      },
      {
        req_id: 'SD-A07',
        metric: 'signature/stamp',
        threshold: 'unsigned 0 unstamped 1',
        actual: `unsigned=${counts.unsigned} unstamped=${counts.unstamped}`,
        pass: counts.unsigned === 0 && counts.unstamped === 1 && checked.issues.some((issue) => issue.code === 'JS-10' && issue.type === 'unstamped'),
      },
      {
        req_id: 'SD-A08',
        metric: 'headline completeness rate',
        threshold: '66.67% (8/12)',
        actual: `${counts.rate_pct}% (${counts.required_complete}/${counts.required_items})`,
        pass: counts.rate_pct === 66.67 && counts.required_complete === 8,
      },
      {
        req_id: 'SD-A09',
        metric: 'overall completeness rate',
        threshold: '64.29% (9/14)',
        actual: `${counts.overall_rate_pct}% (${counts.overall_complete}/${counts.checklist_items})`,
        pass: counts.overall_rate_pct === 64.29 && counts.overall_complete === 9,
      },
      {
        req_id: 'SD-A10',
        metric: 'export sha256/rows/BOM',
        threshold: 'sha equals file rows=15 BOM=yes',
        actual: `${exported.rows} rows ${exported.bytes} bytes`,
        pass:
          exported.rows === 15 &&
          exported.sha256 === sha256(csvText) &&
          exported.bytes === Buffer.byteLength(csvText, 'utf8') &&
          csvText.charCodeAt(0) === 0xfeff,
      },
      {
        req_id: 'SD-A11',
        metric: 'export path safety',
        threshold: 'traversal rejected',
        actual: traversal,
        pass: traversal === 'E_SETTLEMENT_PATH_INVALID',
      },
      {
        req_id: 'SD-A12',
        metric: 'duplicate code error',
        threshold: 'E_SETTLEMENT_DUP_CODE',
        actual: duplicate,
        pass: duplicate === 'E_SETTLEMENT_DUP_CODE',
      },
      {
        req_id: 'SD-A13',
        metric: 'unknown code error',
        threshold: 'E_SETTLEMENT_UNKNOWN_CODE',
        actual: unknown,
        pass: unknown === 'E_SETTLEMENT_UNKNOWN_CODE',
      },
      {
        req_id: 'SD-A14',
        metric: 'empty checklist error',
        threshold: 'E_SETTLEMENT_EMPTY',
        actual: empty,
        pass: empty === 'E_SETTLEMENT_EMPTY',
      },
      {
        req_id: 'SD-A15',
        metric: 'row value error',
        threshold: 'E_SETTLEMENT_CSV_ROW',
        actual: rowError,
        pass: rowError === 'E_SETTLEMENT_CSV_ROW',
      },
      {
        req_id: 'SD-A16',
        metric: 'unknown project type error',
        threshold: 'E_SETTLEMENT_UNKNOWN_CODE',
        actual: unknownType,
        pass: unknownType === 'E_SETTLEMENT_UNKNOWN_CODE',
      },
      {
        req_id: 'SD-A17',
        metric: 'percent integer rounding',
        threshold: '1/3=33.33 2/3=66.67',
        actual: `${percent(1, 3)} ${percent(2, 3)}`,
        pass: percent(1, 3) === 33.33 && percent(2, 3) === 66.67,
      },
    ]

    let quickstartPass = true
    try {
      execFileSync(process.execPath, ['samples/quickstart/run.mjs', '--check'], { cwd: root, stdio: 'ignore' })
    } catch {
      quickstartPass = false
    }
    const quickstartHash = sha256(readFileSync(path.join(root, 'samples', 'quickstart', 'expected', 'result.json')))
    const quickstart = {
      req_id: 'PS1-QS01',
      metric: 'quickstart golden',
      threshold: '1/1',
      actual: quickstartPass ? '1' : '0',
      pass: quickstartPass,
      evidence_sha256: quickstartHash,
    }

    const failures = metrics.filter((item) => !item.pass)
    for (const failure of failures) errors.push(`${failure.req_id} ${failure.metric}: ${failure.actual}`)
    if (!quickstartPass) errors.push('PS1-QS01 quickstart golden failed')

    const runId = `settlement-docs-${Date.now()}`
    const evidence = {
      run_id: runId,
      scope: 'SETTLEMENT-DOCS-S1',
      status: failures.length === 0 && quickstartPass ? 'pass' : 'fail',
      counted: false,
      note: 'synthetic settlement-document checklist + submission only; no customer data, no network',
      metrics,
      pass: failures.length === 0 && quickstartPass,
    }
    const evidenceDir = path.join(root, 'evidence', runId)
    mkdirSync(evidenceDir, { recursive: true })
    const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`
    writeFileSync(path.join(evidenceDir, 'result.json'), evidenceJson)
    const evidenceHash = sha256(evidenceJson)

    const rows = [
      ...metrics.map(
        (item) =>
          `${item.req_id},${item.metric},${item.threshold},${item.actual},scripts/acceptance.mjs,${evidenceHash},${item.pass},public/synthetic,false`,
      ),
      `${quickstart.req_id},${quickstart.metric},${quickstart.threshold},${quickstart.actual},samples/quickstart/run.mjs,${quickstart.evidence_sha256},${quickstart.pass},synthetic/quickstart,true`,
    ]
    writeFileSync(
      path.join(root, 'ACCEPTANCE.csv'),
      `req_id,metric,threshold,actual,script,evidence_sha256,pass,source,counted\n${rows.join('\n')}\n`,
    )

    if (errors.length > 0) {
      for (const error of errors) console.error(`acceptance: ${error}`)
      process.exit(1)
    }
    console.log(`acceptance ok: ${metrics.length + 1} checks`)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

await main()
