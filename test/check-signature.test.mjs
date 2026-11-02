import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDocuments } from '../lib/core/check.js'
import { checklist, submission } from './helpers/fixtures.mjs'

const LIST = checklist(['A-1,竣工结算书,1,是', 'A-2,竣工影像,1,否'])

test('a submitted document that is neither signed nor stamped gets both issues', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,1,否,否']))
  assert.deepEqual(result.items[0].issues, ['unsigned', 'unstamped'])
  assert.equal(result.summary.unsigned, 1)
  assert.equal(result.summary.unstamped, 1)
  assert.match(result.issues.find((issue) => issue.type === 'unsigned').message, /“竣工结算书”（A-1）未签字/)
  assert.match(result.issues.find((issue) => issue.type === 'unstamped').message, /“竣工结算书”（A-1）未盖章/)
})

test('signed but not stamped is a single blocking issue', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,1,是,否']))
  assert.deepEqual(result.items[0].issues, ['unstamped'])
  assert.equal(result.summary.blocking_issues, 1)
  assert.equal(result.summary.unsigned, 0)
})

test('stamped but not signed is a single blocking issue', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,1,否,是']))
  assert.deepEqual(result.items[0].issues, ['unsigned'])
  assert.equal(result.summary.unsigned, 1)
  assert.equal(result.summary.unstamped, 0)
})

test('a signature defect on a submitted optional document is info-level', () => {
  const result = checkDocuments(LIST, submission(['A-1,a.pdf,1,是,是', 'A-2,b.pdf,1,否,是']))
  const issue = result.issues.find((entry) => entry.code === 'A-2')
  assert.equal(issue.type, 'unsigned')
  assert.equal(issue.level, 'info')
  assert.equal(result.summary.blocking_issues, 0)
  assert.equal(result.summary.info_issues, 1)
})

test('a missing document reports missing only, never unsigned/unstamped', () => {
  const result = checkDocuments(LIST, '资料编码,文件名,份数,签字,盖章\n')
  assert.deepEqual(
    result.issues.filter((issue) => issue.code === 'A-1').map((issue) => issue.type),
    ['missing'],
  )
  assert.equal(result.summary.unsigned, 0)
  assert.equal(result.summary.unstamped, 0)
})
