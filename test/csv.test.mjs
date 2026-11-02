import test from 'node:test'
import assert from 'node:assert/strict'
import { cell, csvField, headerIndex, normalizeHeader, parseCsv, toCsv } from '../lib/core/csv.js'

test('csvField quotes commas, quotes and newlines and doubles embedded quotes', () => {
  assert.equal(csvField('plain'), 'plain')
  assert.equal(csvField('a,b'), '"a,b"')
  assert.equal(csvField('say "hi"'), '"say ""hi"""')
  assert.equal(csvField('line1\nline2'), '"line1\nline2"')
})

test('toCsv joins rows with LF and appends one trailing newline', () => {
  assert.equal(toCsv([]), '')
  assert.equal(toCsv([['a', 'b'], ['c,d', 'e']]), 'a,b\n"c,d",e\n')
})

test('parseCsv handles a UTF-8 BOM, CRLF, quoted commas, doubled quotes and blank lines', () => {
  const rows = parseCsv('\uFEFFcode,name\r\nA-1,"竣工,结算书"\r\n\r\nA-2,"say ""ok"""\r\n')
  assert.deepEqual(rows, [
    ['code', 'name'],
    ['A-1', '竣工,结算书'],
    ['A-2', 'say "ok"'],
  ])
})

test('parseCsv drops rows whose every cell is whitespace', () => {
  assert.deepEqual(parseCsv('a,b\n , \n1,2\n'), [
    ['a', 'b'],
    ['1', '2'],
  ])
})

test('an unclosed quote is a row-level E_SETTLEMENT_CSV_ROW, not a truncated table', () => {
  assert.throws(
    () => parseCsv('a,b\n"x,1'),
    (error) => error.code === 'E_SETTLEMENT_CSV_ROW' && /引号/.test(error.message),
  )
  assert.throws(
    () => parseCsv(42),
    (error) => error.code === 'E_SETTLEMENT_CSV_ROW',
  )
})

test('header helpers normalise case and spaces and return -1 for absent columns', () => {
  assert.equal(normalizeHeader(' Item Code '), 'itemcode')
  assert.equal(headerIndex(['资料编码', 'itemcode'], ['item_code', '资料编码']), 0)
  assert.equal(headerIndex(['x', 'item_code'], ['item_code']), 1)
  assert.equal(headerIndex(['a'], ['missing']), -1)
  assert.equal(cell(['x', ' y '], 1), 'y')
  assert.equal(cell(['x'], 9), '')
})
