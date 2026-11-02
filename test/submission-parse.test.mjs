import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSubmission } from '../lib/core/documents.js'
import { rejectsWithCode, submission } from './helpers/fixtures.mjs'

test('parseSubmission reads the Chinese submission header', () => {
  const items = parseSubmission(submission(['JS-01,JS-01-竣工结算书.pdf,3,是,是', 'JS-10,隐蔽记录.pdf,1,是,否']))
  assert.deepEqual(items, [
    { code: 'JS-01', filename: 'JS-01-竣工结算书.pdf', copies: 3, signed: true, stamped: true },
    { code: 'JS-10', filename: '隐蔽记录.pdf', copies: 1, signed: true, stamped: false },
  ])
})

test('parseSubmission accepts English/reordered headers and extra columns', () => {
  const text = 'filename,signed,code,copies,stamped,note\nx.pdf,yes,A-1,2,true,-'
  const items = parseSubmission(text)
  assert.deepEqual(items[0], { code: 'A-1', filename: 'x.pdf', copies: 2, signed: true, stamped: true })
})

test('a header-only submission is valid and means nothing was submitted', () => {
  assert.deepEqual(parseSubmission('资料编码,文件名,份数,签字,盖章\n'), [])
})

test('an empty submission file is E_SETTLEMENT_EMPTY', async () => {
  await rejectsWithCode(assert, () => parseSubmission(''), 'E_SETTLEMENT_EMPTY')
  await rejectsWithCode(assert, () => parseSubmission('   \n\n'), 'E_SETTLEMENT_EMPTY')
})

test('blank signature/stamp cells mean "no"; accepted aliases map to booleans', () => {
  const items = parseSubmission(
    submission(['A-1,a.pdf,1,,', 'A-2,b.pdf,1,已签字,未盖章', 'A-3,c.pdf,1,true,0', 'A-4,d.pdf,1,否,是']),
  )
  assert.deepEqual(
    items.map((item) => [item.signed, item.stamped]),
    [
      [false, false],
      [true, false],
      [true, false],
      [false, true],
    ],
  )
})

test('zero copies is allowed at parse time (reported later as a shortfall)', () => {
  assert.equal(parseSubmission(submission(['A-1,a.pdf,0,是,是']))[0].copies, 0)
})

test('bad submission rows fail with E_SETTLEMENT_CSV_ROW', async () => {
  await rejectsWithCode(assert, () => parseSubmission(submission(['A-1,,1,是,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseSubmission(submission(['A-1,a.pdf,-1,是,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseSubmission(submission(['A-1,a.pdf,1,maybe,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseSubmission(submission([',a.pdf,1,是,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseSubmission('资料编码,文件名,份数,签字\nA-1,a.pdf,1,是\n'), 'E_SETTLEMENT_CSV_ROW')
})

test('a duplicate submission code is E_SETTLEMENT_DUP_CODE', async () => {
  await rejectsWithCode(
    assert,
    () => parseSubmission(submission(['A-1,a.pdf,1,是,是', 'A-1,a-copy.pdf,1,是,是'])),
    'E_SETTLEMENT_DUP_CODE',
  )
})
