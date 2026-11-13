import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import * as plugin from '../lib/plugin/index.js'
import {
  CLEAN_CHECKLIST,
  CLEAN_SUBMISSION,
  makeTempDir,
  makeTools,
  rejectsWithCode,
} from './helpers/fixtures.mjs'

test('createTools exposes the three settlement_* tools in order with renderers', () => {
  const { tools } = makeTools(makeTempDir('dsh-settlement-docs-tools-'))
  const list = Object.values(tools)
  assert.deepEqual(
    list.map((tool) => tool.name),
    ['settlement_check', 'settlement_template', 'settlement_export'],
  )
  assert.equal(new Set(list.map((tool) => tool.name)).size, 3)
  for (const tool of list) {
    assert.ok(tool.name.startsWith('settlement_'))
    assert.ok(tool.description.length > 0)
    assert.equal(typeof tool.execute, 'function')
    assert.equal(typeof tool.output.render, 'function')
  }
})

test('resolveBaseDir defaults to $DSH_HOME/dsh-settlement-docs and honors the override', () => {
  assert.equal(plugin.resolveBaseDir({ DSH_HOME: '/tmp/dsh-home' }), path.join('/tmp/dsh-home', 'dsh-settlement-docs'))
  assert.equal(
    plugin.resolveBaseDir({ DSH_HOME: '/tmp/dsh-home', DSH_SETTLEMENT_DOCS_HOME: '/tmp/settlement-home' }),
    '/tmp/settlement-home',
  )
})

test('apply() registers the tools and wires the documented write root', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-apply-')
  const previous = process.env.DSH_SETTLEMENT_DOCS_HOME
  process.env.DSH_SETTLEMENT_DOCS_HOME = dir
  t.after(async () => {
    if (previous === undefined) delete process.env.DSH_SETTLEMENT_DOCS_HOME
    else process.env.DSH_SETTLEMENT_DOCS_HOME = previous
    await rm(dir, { recursive: true, force: true })
  })

  const registered = []
  await plugin.apply({ tools: { register(tool) { registered.push(tool) } } })
  assert.equal(plugin.name, 'dsh-settlement-docs')
  assert.deepEqual(plugin.inject, ['tools'])
  assert.equal(registered.length, 3)

  const call = (name, args) => registered.find((tool) => tool.name === name).execute(args, { callId: 'apply' })
  const template = await call('settlement_template', { project_type: '房建' })
  assert.equal(template.items.length, 14)
  const checked = await call('settlement_check', {
    checklist_csv: CLEAN_CHECKLIST,
    submission_csv: CLEAN_SUBMISSION,
  })
  assert.equal(checked.summary.checklist_items, 3)
  const exported = await call('settlement_export', {
    checklist_csv: CLEAN_CHECKLIST,
    submission_csv: CLEAN_SUBMISSION,
    filename: 'apply.csv',
  })
  assert.ok(exported.path.startsWith(`${dir}${path.sep}exports${path.sep}`), exported.path)
  assert.equal(exported.rows, 4)
  const csv = await readFile(exported.path, 'utf8')
  assert.equal(csv.charCodeAt(0), 0xfeff)
})

test('tool renderers summarise check, template and export results', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-render-')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { tools, call } = makeTools(dir)

  const template = await call('settlement_template', { project_type: '市政' })
  const templateText = tools['settlement_template'].output.render({ project_type: '市政' }, template)[0].text
  assert.match(templateText, /竣工结算资料模板（市政）：13 项（必需 12 \/ 非必需 1）/)

  const checked = await call('settlement_check', { checklist_csv: CLEAN_CHECKLIST, submission_csv: CLEAN_SUBMISSION })
  const checkText = tools['settlement_check'].output.render({}, checked)[0].text
  assert.match(checkText, /竣工结算资料 3 项/)
  assert.match(checkText, /齐套率 100\.00%（2\/2 必需）/)

  const exported = await call('settlement_export', {
    checklist_csv: CLEAN_CHECKLIST,
    submission_csv: CLEAN_SUBMISSION,
    filename: 'render.csv',
  })
  const exportText = tools['settlement_export'].output.render({}, exported)[0].text
  assert.match(exportText, /核对表 4 行/)
  assert.match(exportText, /齐套率 100\.00%/)
})

test('unknown submission codes and unsafe filenames keep their stable codes through the tool layer', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-errors-')
  t.after(() => rm(dir, { recursive: true, force: true }))
  const { call } = makeTools(dir)
  await rejectsWithCode(
    assert,
    () => call('settlement_check', { checklist_csv: CLEAN_CHECKLIST, submission_csv: '资料编码,文件名,份数,签字,盖章\nZ-9,z.pdf,1,是,是\n' }),
    'E_SETTLEMENT_UNKNOWN_CODE',
  )
  await rejectsWithCode(
    assert,
    () => call('settlement_export', { checklist_csv: CLEAN_CHECKLIST, submission_csv: CLEAN_SUBMISSION, filename: '../x.csv' }),
    'E_SETTLEMENT_PATH_INVALID',
  )
  await rejectsWithCode(assert, () => call('settlement_template', { project_type: '桥梁' }), 'E_SETTLEMENT_UNKNOWN_CODE')
})
