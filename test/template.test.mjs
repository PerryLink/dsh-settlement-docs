import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  CHECKLIST_TEMPLATES,
  PROJECT_TYPES,
  buildTemplate,
  normalizeProjectType,
  templateCsv,
} from '../lib/core/template.js'
import { rejectsWithCode } from './helpers/fixtures.mjs'

test('all three project types ship at least 12 unique, well-formed items', () => {
  assert.deepEqual([...PROJECT_TYPES], ['房建', '市政', '装饰'])
  for (const projectType of PROJECT_TYPES) {
    const items = CHECKLIST_TEMPLATES[projectType]
    assert.ok(items.length >= 12, `${projectType} has only ${items.length} items`)
    assert.equal(new Set(items.map((item) => item.code)).size, items.length, `${projectType} has duplicate codes`)
    for (const item of items) {
      assert.match(item.code, /^[A-Z]{2}-\d{2}$/)
      assert.ok(item.name.length > 0)
      assert.ok(Number.isInteger(item.requiredCopies) && item.requiredCopies >= 1)
    }
  }
})

test('built-in counts are stable and every list has at least one required item', () => {
  assert.deepEqual(
    PROJECT_TYPES.map((projectType) => {
      const items = CHECKLIST_TEMPLATES[projectType]
      return [projectType, items.length, items.filter((item) => item.required).length]
    }),
    [
      ['房建', 14, 12],
      ['市政', 13, 12],
      ['装饰', 12, 11],
    ],
  )
})

test('templateCsv starts with a BOM, uses the checklist header and ends with a newline', () => {
  const csv = templateCsv('房建')
  assert.equal(csv.charCodeAt(0), 0xfeff)
  assert.match(csv, /^\uFEFF资料编码,资料名称,应有份数,是否必需\n/)
  assert.ok(csv.endsWith('\n'))
  assert.equal(csv.replace(/^\uFEFF/, '').trimEnd().split('\n').length, 15)
})

test('buildTemplate reports the project type, counts, bytes and a matching sha256', () => {
  const result = buildTemplate('房建')
  assert.equal(result.project_type, '房建')
  assert.equal(result.items.length, 14)
  assert.equal(result.required_items, 12)
  assert.equal(result.optional_items, 2)
  assert.equal(result.bytes, Buffer.byteLength(result.csv, 'utf8'))
  assert.equal(result.sha256, createHash('sha256').update(result.csv).digest('hex'))
})

test('project type aliases map to the three supported types', () => {
  assert.equal(normalizeProjectType('房建工程'), '房建')
  assert.equal(normalizeProjectType('housing'), '房建')
  assert.equal(normalizeProjectType(' 市政 '), '市政')
  assert.equal(normalizeProjectType('MUNICIPAL'), '市政')
  assert.equal(normalizeProjectType('装修'), '装饰')
  assert.equal(normalizeProjectType('fitout'), '装饰')
})

test('an unknown project type is E_SETTLEMENT_UNKNOWN_CODE', async () => {
  await rejectsWithCode(assert, () => buildTemplate('桥梁'), 'E_SETTLEMENT_UNKNOWN_CODE')
  await rejectsWithCode(assert, () => buildTemplate(undefined), 'E_SETTLEMENT_UNKNOWN_CODE')
})

test('buildTemplate returns defensive copies of the built-in items', () => {
  const first = buildTemplate('装饰')
  first.items[0].name = '被改掉的名字'
  assert.equal(buildTemplate('装饰').items[0].name, '竣工结算书')
})
