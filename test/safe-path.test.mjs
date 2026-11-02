import test from 'node:test'
import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { SAFE_EXPORT_FILENAME, safeExportPath } from '../lib/core/safe-path.js'
import { makeTempDir, rejectsWithCode } from './helpers/fixtures.mjs'

test('SAFE_EXPORT_FILENAME accepts a single safe component and rejects separators/whitespace', () => {
  assert.ok(SAFE_EXPORT_FILENAME.test('settlement-check-2026-11.csv'))
  assert.ok(SAFE_EXPORT_FILENAME.test('A_1.csv'))
  for (const name of ['../x.csv', 'sub/dir.csv', 'a b.csv', '核对表.csv', '', 'a'.repeat(121)]) {
    assert.equal(SAFE_EXPORT_FILENAME.test(name), false, name)
  }
})

test('safeExportPath creates the base directory and returns a path below it', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-safe-')
  t.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(dir, { recursive: true, force: true })
  })
  const base = path.join(dir, 'nested', 'exports')
  const target = await safeExportPath(base, 'check.csv')
  assert.equal(target, path.join(base, 'check.csv'))
  assert.ok((await stat(base)).isDirectory())
})

test('traversal, nested filenames and Chinese names are E_SETTLEMENT_PATH_INVALID', async (t) => {
  const dir = makeTempDir('dsh-settlement-docs-safe-errors-')
  t.after(async () => {
    const { rm } = await import('node:fs/promises')
    await rm(dir, { recursive: true, force: true })
  })
  for (const filename of ['../evil.csv', 'sub/dir.csv', 'a b.csv', '核对表.csv', '.', '', 'a'.repeat(121)]) {
    await rejectsWithCode(assert, () => safeExportPath(path.join(dir, 'exports'), filename), 'E_SETTLEMENT_PATH_INVALID')
  }
  await rejectsWithCode(assert, () => safeExportPath(path.join(dir, 'exports'), 42), 'E_SETTLEMENT_PATH_INVALID')
})
