import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createTools } from '../../lib/plugin/tools.js'

export function makeTempDir(prefix = 'dsh-settlement-docs-test-') {
  return mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function makeTools(baseDir) {
  const tools = Object.fromEntries(createTools({ baseDir }).map((tool) => [tool.name, tool]))
  const call = (name, args) => tools[name].execute(args, { callId: 'test', agent: { id: 'test' } })
  return { tools, call }
}

export const CHECKLIST_HEADER = '资料编码,资料名称,应有份数,是否必需'
export const SUBMISSION_HEADER = '资料编码,文件名,份数,签字,盖章'

export const CLEAN_CHECKLIST = `${CHECKLIST_HEADER}
A-1,竣工结算书,2,是
A-2,施工合同,1,是
A-3,竣工影像资料,1,否
`

export const CLEAN_SUBMISSION = `${SUBMISSION_HEADER}
A-1,A-1-竣工结算书.pdf,2,是,是
A-2,A-2-施工合同.pdf,1,是,是
A-3,A-3-竣工影像.mp4,1,是,是
`

export function checklist(rows) {
  return `${CHECKLIST_HEADER}\n${rows.join('\n')}\n`
}

export function submission(rows) {
  return `${SUBMISSION_HEADER}\n${rows.join('\n')}\n`
}

/** Assert that a promise or thunk rejects with a stable settlement error code. */
export async function rejectsWithCode(assert, action, code) {
  const promise = typeof action === 'function' ? Promise.resolve().then(action) : action
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`)
    return true
  })
}
