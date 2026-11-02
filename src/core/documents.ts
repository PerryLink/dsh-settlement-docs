import { cell, headerIndex, normalizeHeader, parseCsv } from './csv.js'
import { SettlementError } from './errors.js'

/** One line of the document checklist: what should have been handed over. */
export type ChecklistItem = {
  code: string
  name: string
  /** Copies that must be submitted; a positive integer. */
  requiredCopies: number
  /** Required documents block acceptance; optional ones only produce an info hint. */
  required: boolean
}

/** One line of what was actually submitted. */
export type SubmissionItem = {
  code: string
  filename: string
  /** Copies actually submitted; zero is allowed and reported as a shortfall. */
  copies: number
  signed: boolean
  stamped: boolean
}

export const CHECKLIST_HEADER = ['资料编码', '资料名称', '应有份数', '是否必需'] as const
export const SUBMISSION_HEADER = ['资料编码', '文件名', '份数', '签字', '盖章'] as const

const CHECKLIST_COLUMNS = {
  code: ['资料编码', '编码', 'code'],
  name: ['资料名称', '名称', 'name'],
  copies: ['应有份数', '份数', 'required_copies', 'copies'],
  required: ['是否必需', '必需', 'required'],
} as const

const SUBMISSION_COLUMNS = {
  code: ['资料编码', '编码', 'code'],
  filename: ['文件名', '文件名称', 'filename', 'file'],
  copies: ['份数', '实交份数', 'copies', 'submitted_copies'],
  signed: ['签字', '是否签字', '已签字', 'signed'],
  stamped: ['盖章', '是否盖章', '已盖章', 'stamped'],
} as const

const TRUE_FLAGS = new Set(['是', 'y', 'yes', 'true', '1', '有', '已签', '已签字', '已盖章', '已签字盖章', '√', '✓'])
const FALSE_FLAGS = new Set(['', '否', 'n', 'no', 'false', '0', '无', '未签', '未签字', '未盖章', '未签字未盖章', '×'])
const TRUE_REQUIRED = new Set(['是', '必需', '必须', 'y', 'yes', 'true', '1', 'required'])
const FALSE_REQUIRED = new Set(['否', '非必需', '非必须', '不必须', 'n', 'no', 'false', '0', 'optional'])

interface Table {
  header: string[]
  rows: string[][]
}

/**
 * Read a CSV table and enforce a minimum physical row count. A checklist with
 * only a header is `E_SETTLEMENT_EMPTY`; a header-only submission is valid and
 * means "nothing was submitted yet".
 */
function readTable(text: string, label: string, minimumRows: number): Table {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new SettlementError('E_SETTLEMENT_EMPTY', `${label}是空的（0 字节或只有空白）`)
  }
  const rows = parseCsv(text)
  if (rows.length < minimumRows) {
    throw new SettlementError('E_SETTLEMENT_EMPTY', `${label}只有表头，没有数据行`)
  }
  const header = rows[0].map((value) => normalizeHeader(value))
  return { header, rows: rows.slice(1) }
}

function columnIndexes(header: readonly string[], spec: Readonly<Record<string, readonly string[]>>, label: string): Record<string, number> {
  const indexes: Record<string, number> = {}
  const missing: string[] = []
  for (const [key, aliases] of Object.entries(spec)) {
    const index = headerIndex(header, aliases)
    if (index < 0) missing.push(aliases[0])
    indexes[key] = index
  }
  if (missing.length > 0) {
    throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}缺少列：${missing.join('、')}；实际表头是：${header.join('、')}`)
  }
  return indexes
}

function parseInteger(raw: string, label: string, minimum: number): number {
  if (!/^\d+$/.test(raw)) {
    throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}必须是非负整数，收到：${JSON.stringify(raw)}`)
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}必须是 ≥${minimum} 的整数，收到：${JSON.stringify(raw)}`)
  }
  return value
}

/** Parse a yes/no marker used by the signature and stamp columns. Blank means "no". */
export function parseYesNo(raw: string, label: string): boolean {
  const value = raw.trim().toLowerCase()
  if (TRUE_FLAGS.has(value)) return true
  if (FALSE_FLAGS.has(value)) return false
  throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}只能写“是”或“否”，收到：${JSON.stringify(raw)}`)
}

/** Parse the required/optional column; accepts Chinese and English aliases. */
export function parseRequired(raw: string, label: string): boolean {
  const value = raw.trim().toLowerCase()
  if (TRUE_REQUIRED.has(value)) return true
  if (FALSE_REQUIRED.has(value)) return false
  throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}只能写“是/否”或“必需/非必需”，收到：${JSON.stringify(raw)}`)
}

/** Parse the checklist CSV. A checklist is the authority; an empty one cannot be checked. */
export function parseChecklist(text: string, label = '资料清单'): ChecklistItem[] {
  const table = readTable(text, label, 2)
  const indexes = columnIndexes(table.header, CHECKLIST_COLUMNS, label)
  const seen = new Set<string>()
  return table.rows.map((row, rowIndex) => {
    const line = rowIndex + 2
    const code = cell(row, indexes.code)
    if (!code) throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}第 ${line} 行资料编码为空`)
    if (seen.has(code)) throw new SettlementError('E_SETTLEMENT_DUP_CODE', `${label}里资料编码 ${code} 出现多次（第 ${line} 行再次出现）`)
    seen.add(code)
    const name = cell(row, indexes.name)
    if (!name) throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}第 ${line} 行资料名称为空（资料编码 ${code}）`)
    const requiredCopies = parseInteger(cell(row, indexes.copies), `${label}第 ${line} 行的应有份数`, 1)
    const required = parseRequired(cell(row, indexes.required), `${label}第 ${line} 行的是否必需`)
    return { code, name, requiredCopies, required }
  })
}

/**
 * Parse the actual-submission CSV. A header-only file means "nothing submitted"
 * and is valid; every data row needs a code, a filename and a non-negative copy
 * count. Blank signature/stamp cells are treated as "no".
 */
export function parseSubmission(text: string, label = '实际提交清单'): SubmissionItem[] {
  const table = readTable(text, label, 1)
  const indexes = columnIndexes(table.header, SUBMISSION_COLUMNS, label)
  const seen = new Set<string>()
  return table.rows.map((row, rowIndex) => {
    const line = rowIndex + 2
    const code = cell(row, indexes.code)
    if (!code) throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}第 ${line} 行资料编码为空`)
    if (seen.has(code)) throw new SettlementError('E_SETTLEMENT_DUP_CODE', `${label}里资料编码 ${code} 出现多次（第 ${line} 行再次出现）`)
    seen.add(code)
    const filename = cell(row, indexes.filename)
    if (!filename) throw new SettlementError('E_SETTLEMENT_CSV_ROW', `${label}第 ${line} 行文件名为空（资料编码 ${code}）`)
    const copies = parseInteger(cell(row, indexes.copies), `${label}第 ${line} 行的份数`, 0)
    const signed = parseYesNo(cell(row, indexes.signed), `${label}第 ${line} 行的签字`)
    const stamped = parseYesNo(cell(row, indexes.stamped), `${label}第 ${line} 行的盖章`)
    return { code, filename, copies, signed, stamped }
  })
}
