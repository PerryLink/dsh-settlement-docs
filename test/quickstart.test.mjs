import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTemplate } from '../lib/core/template.js'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('the bundled checklist is byte-identical to the 房建 template', async () => {
  const checklistPath = path.join(packageRoot, 'samples', 'quickstart', 'input', 'checklist-housing.csv')
  const text = await readFile(checklistPath, 'utf8')
  assert.equal(text, buildTemplate('房建').csv)
  assert.equal(text.charCodeAt(0), 0xfeff)
  assert.equal(text.trimEnd().split('\n').length, 15)
})

test('the bundled submission has 11 files and 11 unique codes', async () => {
  const submissionPath = path.join(packageRoot, 'samples', 'quickstart', 'input', 'submitted-2026-11.csv')
  const text = await readFile(submissionPath, 'utf8')
  const rows = text.replace(/^\uFEFF/, '').trimEnd().split('\n')
  assert.equal(rows.length, 12)
  const codes = rows.slice(1).map((line) => line.split(',')[0])
  assert.equal(new Set(codes).size, 11)
  assert.ok((await stat(submissionPath)).size > 100)
})

test('quickstart --check reproduces the committed golden result', () => {
  const result = spawnSync(process.execPath, ['samples/quickstart/run.mjs', '--check'], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /template: 房建 14 items \(12 required \/ 2 optional\), checklist matches template/)
  assert.match(result.stdout, /submitted: 11 files \/ 14 items/)
  assert.match(result.stdout, /missing: 2 required \+ 1 optional \(info\)/)
  assert.match(result.stdout, /copies short: 1; unsigned: 0; unstamped: 1/)
  assert.match(result.stdout, /completeness: 66\.67% \(8\/12 required\), overall 64\.29%/)
  assert.match(result.stdout, /issues: 4 blocking, 1 info/)
  assert.match(result.stdout, /golden samples\/quickstart\/expected\/result\.json matches/)
  assert.match(result.stdout, /quickstart ok/)
})

test('the golden result records the expected sample numbers', async () => {
  const expected = JSON.parse(
    await readFile(path.join(packageRoot, 'samples', 'quickstart', 'expected', 'result.json'), 'utf8'),
  )
  assert.equal(expected.template.project_type, '房建')
  assert.equal(expected.check.summary.checklist_items, 14)
  assert.equal(expected.check.summary.submitted_items, 11)
  assert.equal(expected.check.summary.missing_required, 2)
  assert.equal(expected.check.summary.optional_missing, 1)
  assert.equal(expected.check.summary.rate_pct, 66.67)
  assert.equal(expected.export.rows, 15)
  assert.equal(expected.export.path, 'exports/settlement-check-2026-11.csv')
  assert.equal(expected.worksheet.bom, true)
  assert.match(expected.worksheet.text, /^行号,资料编码,资料名称,是否必需,应有份数,实交份数,文件名,签字,盖章,是否齐套,问题类型,问题说明/)
})
