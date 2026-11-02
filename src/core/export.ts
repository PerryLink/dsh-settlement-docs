import { toCsv } from './csv.js'
import type { CheckResult } from './check.js'

export const WORKSHEET_HEADER = [
  '行号',
  '资料编码',
  '资料名称',
  '是否必需',
  '应有份数',
  '实交份数',
  '文件名',
  '签字',
  '盖章',
  '是否齐套',
  '问题类型',
  '问题说明',
] as const

/**
 * Build the review worksheet CSV (UTF-8 BOM, one row per checklist line in
 * checklist order). Missing documents keep the checklist copy requirement and
 * show `实交份数=0`; every issue type and message for the line is joined so the
 * worksheet can be filtered in Excel without losing the reason.
 */
export function worksheetCsv(result: CheckResult): string {
  const rows = result.items.map((item, index) => {
    const issues = result.issues.filter((issue) => issue.code === item.code)
    return [
      String(index + 1),
      item.code,
      item.name,
      item.required ? '是' : '否',
      String(item.required_copies),
      String(item.copies),
      item.filename,
      item.signed ? '是' : '否',
      item.stamped ? '是' : '否',
      item.complete ? '是' : '否',
      issues.map((issue) => issue.type).join(';'),
      issues.map((issue) => issue.message).join('；'),
    ]
  })
  return `\uFEFF${toCsv([[...WORKSHEET_HEADER], ...rows])}`
}
