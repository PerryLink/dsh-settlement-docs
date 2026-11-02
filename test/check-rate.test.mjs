import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDocuments, checkSentence, percent } from '../lib/core/check.js'
import { checklist, submission } from './helpers/fixtures.mjs'

test('percent formats to two decimals with integer maths', () => {
  assert.equal(percent(2, 3), 66.67)
  assert.equal(percent(1, 3), 33.33)
  assert.equal(percent(0, 3), 0)
  assert.equal(percent(3, 3), 100)
  assert.equal(percent(8, 12), 66.67)
})

test('an empty required set counts as 100% so an all-optional checklist is not punished', () => {
  assert.equal(percent(0, 0), 100)
  const result = checkDocuments(checklist(['A-1,影像,1,否']), '资料编码,文件名,份数,签字,盖章\n')
  assert.equal(result.summary.required_items, 0)
  assert.equal(result.summary.rate_pct, 100)
  assert.equal(result.summary.overall_rate_pct, 0)
})

test('headline rate counts complete required documents only; overall rate includes optional ones', () => {
  const list = checklist(['A-1,结算书,1,是', 'A-2,合同,1,是', 'A-3,许可证,1,是', 'A-4,影像,1,否'])
  const submitted = submission(['A-1,a.pdf,1,是,是', 'A-2,b.pdf,1,是,是'])
  const result = checkDocuments(list, submitted)
  assert.equal(result.summary.required_items, 3)
  assert.equal(result.summary.required_complete, 2)
  assert.equal(result.summary.overall_complete, 2)
  assert.equal(result.summary.rate_pct, 66.67)
  assert.equal(result.summary.overall_rate_pct, 50)
})

test('a fully missing checklist scores 0%', () => {
  const list = checklist(['A-1,结算书,1,是', 'A-2,合同,1,是'])
  const result = checkDocuments(list, '资料编码,文件名,份数,签字,盖章\n')
  assert.equal(result.summary.rate_pct, 0)
  assert.equal(result.summary.overall_rate_pct, 0)
})

test('checkSentence reports counters, rate and blocking/info split', () => {
  const list = checklist(['A-1,结算书,3,是', 'A-2,合同,1,是', 'A-3,影像,1,否'])
  const submitted = submission(['A-1,a.pdf,1,是,否'])
  const sentence = checkSentence(checkDocuments(list, submitted))
  assert.match(sentence, /竣工结算资料 3 项/)
  assert.match(sentence, /缺件 1、份数不足 1、未签字 0、未盖章 1、非必需缺失 1/)
  assert.match(sentence, /齐套率 0\.00%（0\/2 必需）/)
  assert.match(sentence, /3 个阻塞 \/ 1 个提示/)
})
