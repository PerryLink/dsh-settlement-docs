import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChecklist } from '../lib/core/documents.js'
import { rejectsWithCode, checklist } from './helpers/fixtures.mjs'

test('parseChecklist reads the Chinese checklist header and keeps required flags', () => {
  const items = parseChecklist(
    checklist(['JS-01,竣工结算书,3,是', 'JS-02,工程量清单结算书,2,是', 'JS-13,甲供材料领用对账单,1,否']),
  )
  assert.equal(items.length, 3)
  assert.deepEqual(items[0], { code: 'JS-01', name: '竣工结算书', requiredCopies: 3, required: true })
  assert.equal(items[2].required, false)
})

test('parseChecklist accepts English and reordered headers plus extra columns', () => {
  const text = 'name,code,required,required_copies,note\n竣工结算书,JS-01,required,3,first\n影像,JS-14,optional,1,-'
  const items = parseChecklist(text)
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { code: 'JS-01', name: '竣工结算书', requiredCopies: 3, required: true })
  assert.equal(items[1].required, false)
})

test('parseChecklist strips a UTF-8 BOM and accepts 必需/非必需 aliases', () => {
  const text = `\uFEFF资料编码,资料名称,应有份数,是否必需\nA-1,结算书,2,必需\nA-2,影像,1,非必需\n`
  const items = parseChecklist(text)
  assert.equal(items[0].required, true)
  assert.equal(items[1].required, false)
})

test('parseChecklist keeps a quoted comma inside a document name', () => {
  const items = parseChecklist('资料编码,资料名称,应有份数,是否必需\nA-1,"竣工结算书, 正本",2,是\n')
  assert.equal(items[0].name, '竣工结算书, 正本')
})

test('a missing checklist column is E_SETTLEMENT_CSV_ROW and names the column', async () => {
  await rejectsWithCode(
    assert,
    () => parseChecklist('资料编码,资料名称,应有份数\nA-1,结算书,2\n'),
    'E_SETTLEMENT_CSV_ROW',
  )
  assert.throws(
    () => parseChecklist('资料编码,资料名称,应有份数\nA-1,结算书,2\n'),
    /缺少列：是否必需/,
  )
})

test('an empty or header-only checklist is E_SETTLEMENT_EMPTY', async () => {
  await rejectsWithCode(assert, () => parseChecklist(''), 'E_SETTLEMENT_EMPTY')
  await rejectsWithCode(assert, () => parseChecklist('资料编码,资料名称,应有份数,是否必需\n'), 'E_SETTLEMENT_EMPTY')
})

test('bad checklist rows fail with E_SETTLEMENT_CSV_ROW', async () => {
  await rejectsWithCode(assert, () => parseChecklist(checklist([',结算书,2,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseChecklist(checklist(['A-1,,2,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseChecklist(checklist(['A-1,结算书,0,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseChecklist(checklist(['A-1,结算书,2.5,是'])), 'E_SETTLEMENT_CSV_ROW')
  await rejectsWithCode(assert, () => parseChecklist(checklist(['A-1,结算书,2,也许'])), 'E_SETTLEMENT_CSV_ROW')
})

test('a duplicate checklist code is E_SETTLEMENT_DUP_CODE', async () => {
  await rejectsWithCode(
    assert,
    () => parseChecklist(checklist(['A-1,结算书,2,是', 'A-1,副本,1,否'])),
    'E_SETTLEMENT_DUP_CODE',
  )
})
