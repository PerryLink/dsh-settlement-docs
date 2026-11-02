import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDocuments } from '../lib/core/check.js'
import { checklist, submission } from './helpers/fixtures.mjs'

const LIST = checklist(['A-1,竣工结算书,1,是', 'A-2,施工合同,1,是', 'A-3,竣工影像资料,1,否'])
const SUBMITTED = submission(['A-1,A-1-竣工结算书.pdf,1,是,是'])

test('a missing required document is blocking; a missing optional one is info', () => {
  const result = checkDocuments(LIST, SUBMITTED)
  assert.equal(result.summary.missing_required, 1)
  assert.equal(result.summary.optional_missing, 1)
  assert.equal(result.summary.blocking_issues, 1)
  assert.equal(result.summary.info_issues, 1)

  const missing = result.issues.find((issue) => issue.type === 'missing')
  assert.equal(missing.level, 'blocking')
  assert.equal(missing.code, 'A-2')
  assert.match(missing.message, /必需资料“施工合同”（A-2）未提交/)

  const optional = result.issues.find((issue) => issue.type === 'optional_missing')
  assert.equal(optional.level, 'info')
  assert.equal(optional.code, 'A-3')
  assert.match(optional.message, /非必需资料“竣工影像资料”（A-3）未提交（提示）/)
})

test('missing items keep their checklist metadata and are never marked submitted', () => {
  const result = checkDocuments(LIST, SUBMITTED)
  const item = result.items.find((entry) => entry.code === 'A-2')
  assert.deepEqual(
    { submitted: item.submitted, filename: item.filename, copies: item.copies, signed: item.signed, stamped: item.stamped, complete: item.complete },
    { submitted: false, filename: '', copies: 0, signed: false, stamped: false, complete: false },
  )
  assert.deepEqual(item.issues, ['missing'])
})

test('an all-submitted, fully signed checklist has no issues and a 100% rate', () => {
  const result = checkDocuments(
    LIST,
    submission(['A-1,a.pdf,1,是,是', 'A-2,b.pdf,1,是,是', 'A-3,c.mp4,1,是,是']),
  )
  assert.equal(result.summary.blocking_issues, 0)
  assert.equal(result.summary.info_issues, 0)
  assert.equal(result.summary.rate_pct, 100)
  assert.equal(result.summary.overall_rate_pct, 100)
  assert.equal(result.issues.length, 0)
})

test('a header-only submission marks every required document missing', () => {
  const result = checkDocuments(LIST, '资料编码,文件名,份数,签字,盖章\n')
  assert.equal(result.summary.submitted_items, 0)
  assert.equal(result.summary.missing_required, 2)
  assert.equal(result.summary.optional_missing, 1)
  assert.equal(result.summary.required_complete, 0)
  assert.equal(result.summary.rate_pct, 0)
})

test('issues stay in checklist order, not submission order', () => {
  const result = checkDocuments(
    checklist(['B-1,乙,1,是', 'A-1,甲,1,是']),
    submission(['A-1,a.pdf,1,否,否']),
  )
  assert.deepEqual(
    result.issues.map((issue) => [issue.code, issue.type]),
    [
      ['B-1', 'missing'],
      ['A-1', 'unsigned'],
      ['A-1', 'unstamped'],
    ],
  )
})
