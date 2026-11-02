import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDocuments } from '../lib/core/check.js'
import { settlementErrorMessage, SettlementError } from '../lib/core/errors.js'
import { checklist, rejectsWithCode, submission } from './helpers/fixtures.mjs'

test('a duplicate checklist code fails before any comparison', async () => {
  await rejectsWithCode(
    assert,
    () => checkDocuments(checklist(['A-1,结算书,1,是', 'A-1,副本,1,是']), '资料编码,文件名,份数,签字,盖章\n'),
    'E_SETTLEMENT_DUP_CODE',
  )
})

test('a duplicate submission code fails before any comparison', async () => {
  await rejectsWithCode(
    assert,
    () =>
      checkDocuments(
        checklist(['A-1,结算书,1,是']),
        submission(['A-1,a.pdf,1,是,是', 'A-1,b.pdf,1,是,是']),
      ),
    'E_SETTLEMENT_DUP_CODE',
  )
})

test('an unknown submission code is rejected and all unknown codes are listed', async () => {
  const list = checklist(['A-1,结算书,1,是'])
  const actual = submission(['A-1,a.pdf,1,是,是', 'Z-9,z.pdf,1,是,是', 'Y-2,y.pdf,1,是,是'])
  await rejectsWithCode(assert, () => checkDocuments(list, actual), 'E_SETTLEMENT_UNKNOWN_CODE')
  assert.throws(() => checkDocuments(list, actual), /Z-9、Y-2/)
})

test('an empty checklist and an empty submission file are E_SETTLEMENT_EMPTY', async () => {
  await rejectsWithCode(assert, () => checkDocuments('', '资料编码,文件名,份数,签字,盖章\n'), 'E_SETTLEMENT_EMPTY')
  await rejectsWithCode(assert, () => checkDocuments(checklist(['A-1,结算书,1,是']), ''), 'E_SETTLEMENT_EMPTY')
})

test('a checklist row error surfaces as E_SETTLEMENT_CSV_ROW', async () => {
  await rejectsWithCode(assert, () => checkDocuments(checklist(['A-1,结算书,x,是']), '资料编码,文件名,份数,签字,盖章\n'), 'E_SETTLEMENT_CSV_ROW')
})

test('every error message carries the code and one next action', () => {
  for (const code of [
    'E_SETTLEMENT_CSV_ROW',
    'E_SETTLEMENT_DUP_CODE',
    'E_SETTLEMENT_UNKNOWN_CODE',
    'E_SETTLEMENT_PATH_INVALID',
    'E_SETTLEMENT_EMPTY',
  ]) {
    const message = settlementErrorMessage(code, 'detail')
    assert.match(message, new RegExp(`（${code}）`))
    assert.match(message, /下一步：/)
    assert.match(message, /细节：detail/)
  }
  const error = new SettlementError('E_SETTLEMENT_EMPTY')
  assert.equal(error.name, 'SettlementError')
  assert.equal(error.code, 'E_SETTLEMENT_EMPTY')
})
