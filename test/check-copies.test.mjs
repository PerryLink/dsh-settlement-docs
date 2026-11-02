import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDocuments } from '../lib/core/check.js'
import { checklist, submission } from './helpers/fixtures.mjs'

const LIST = checklist(['A-1,竣工结算书,3,是', 'A-2,影像,2,否'])

test('the exact required copy count passes; one short is blocking', () => {
  const exact = checkDocuments(LIST, submission(['A-1,a.pdf,3,是,是']))
  assert.equal(exact.summary.copies_short, 0)
  assert.equal(exact.items[0].complete, true)

  const short = checkDocuments(LIST, submission(['A-1,a.pdf,2,是,是']))
  assert.equal(short.summary.copies_short, 1)
  assert.equal(short.items[0].complete, false)
  assert.deepEqual(short.items[0].issues, ['copies_short'])
  assert.equal(short.issues[0].level, 'blocking')
  assert.match(short.issues[0].message, /应有 3 份，实交 2 份/)
})

test('more copies than required is fine', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,5,是,是']))
  assert.equal(result.summary.copies_short, 0)
  assert.equal(result.items[0].complete, true)
})

test('zero submitted copies is a blocking shortfall', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,0,是,是']))
  assert.equal(result.summary.copies_short, 1)
  assert.equal(result.items[0].submitted, true)
  assert.equal(result.items[0].copies, 0)
})

test('a short optional document is reported at info level and does not block', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,3,是,是', 'A-2,b.pdf,1,是,是']))
  assert.equal(result.summary.copies_short, 1)
  assert.equal(result.summary.blocking_issues, 0)
  assert.equal(result.summary.info_issues, 1)
  const issue = result.issues.find((entry) => entry.code === 'A-2')
  assert.equal(issue.level, 'info')
  assert.equal(issue.type, 'copies_short')
})

test('copies short combines with signature issues on the same line', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,1,否,否']))
  assert.deepEqual(result.items[0].issues, ['copies_short', 'unsigned', 'unstamped'])
  assert.equal(result.summary.blocking_issues, 3)
})
