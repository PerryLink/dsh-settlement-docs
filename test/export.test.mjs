import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { checkDocuments } from '../lib/core/check.js'
import { WORKSHEET_HEADER, worksheetCsv } from '../lib/core/export.js'
import { checklist, makeTempDir, makeTools, rejectsWithCode, submission } from './helpers/fixtures.mjs'

const LIST = checklist(['A-1,竣工结算书,3,是', 'A-2,施工合同,1,是', 'A-3,竣工影像,1,否'])
const SUBMITTED = submission(['A-1,A-1.pdf,1,是,是', 'A-3,A-3.mp4,1,是,是'])

test('worksheetCsv has the documented header, a BOM and one row per checklist line', () => {
  const csv = worksheetCsv(checkDocuments(LIST, SUBMITTED))
  assert.equal(csv.charCodeAt(0), 0xfeff)
  const lines = csv.replace(/^\uFEFF/, '').trimEnd().split('\n')
  assert.deepEqual(lines[0].split(','), [...WORKSHEET_HEADER])
  assert.equal(lines.length, 4)
  assert.match(lines[1], /^1,A-1,竣工结算书,是,3,1,A-1\.pdf,是,是,否,copies_short,/)
  assert.match(lines[2], /^2,A-2,施工合同,是,1,0,,否,否,否,missing,/)
  assert.match(lines[3], /^3,A-3,竣工影像,否,1,1,A-3\.mp4,是,是,是,,$/)
})

test('export writes a BOM CSV under exports/ and returns a matching sha256', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-export-')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { call } = makeTools(dir)

  const exported = await call('settlement.export', {
    checklist_csv: LIST,
    submission_csv: SUBMITTED,
    filename: 'settlement-check-2026-11.csv',
  })
  assert.equal(exported.path, path.join(dir, 'exports', 'settlement-check-2026-11.csv'))
  assert.equal(exported.rows, 4)
  assert.equal(exported.checklist_items, 3)
  assert.equal(exported.missing_required, 1)
  assert.equal(exported.copies_short, 1)
  assert.equal(exported.unsigned, 0)
  assert.equal(exported.unstamped, 0)
  assert.equal(exported.optional_missing, 0)
  assert.equal(exported.blocking_issues, 2)
  assert.equal(exported.info_issues, 0)

  const csv = await readFile(exported.path, 'utf8')
  assert.equal(csv.charCodeAt(0), 0xfeff)
  assert.equal(exported.sha256, createHash('sha256').update(csv).digest('hex'))
  assert.equal(exported.bytes, Buffer.byteLength(csv, 'utf8'))
  assert.match(csv, /竣工结算书/)
})

test('export defaults to settlement-check.csv and can be called twice', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-export-default-')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { call } = makeTools(dir)
  const first = await call('settlement.export', { checklist_csv: LIST, submission_csv: SUBMITTED })
  const second = await call('settlement.export', { checklist_csv: LIST, submission_csv: SUBMITTED })
  assert.equal(path.basename(first.path), 'settlement-check.csv')
  assert.equal(first.sha256, second.sha256)
})

test('unsafe export filenames fail with E_SETTLEMENT_PATH_INVALID', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-export-errors-')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { call } = makeTools(dir)
  for (const filename of ['../evil.csv', 'sub/dir.csv', 'a b.csv', '核对表.csv', '']) {
    await rejectsWithCode(
      assert,
      () => call('settlement.export', { checklist_csv: LIST, submission_csv: SUBMITTED, filename }),
      'E_SETTLEMENT_PATH_INVALID',
    )
  }
})

test('export re-runs the check, so unknown codes still fail before writing', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-export-unknown-')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { call } = makeTools(dir)
  await rejectsWithCode(
    assert,
    () =>
      call('settlement.export', {
        checklist_csv: LIST,
        submission_csv: submission(['Z-9,z.pdf,1,是,是']),
        filename: 'x.csv',
      }),
    'E_SETTLEMENT_UNKNOWN_CODE',
  )
})
