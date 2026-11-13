import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { checkDocuments, checkSentence, type CheckResult } from '../core/check.js'
import { SettlementError } from '../core/errors.js'
import { worksheetCsv } from '../core/export.js'
import { buildTemplate, type TemplateResult } from '../core/template.js'
import { safeExportPath } from '../core/safe-path.js'

export interface ToolDeps {
  /** Local write root; the plugin uses `$DSH_HOME/dsh-settlement-docs`. */
  baseDir: string
}

const text = (value: string) => [{ type: 'text' as const, text: value }]
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

export function createTools(deps: ToolDeps) {
  const check = defineTool({
    name: 'settlement_check',
    description:
      'Check a final-settlement document checklist (code, name, required copies, required flag) against the actual submission (code, filename, copies, signed, stamped). Returns missing required documents, short copies, missing signatures/stamps, optional documents absent (info only) and the completeness rate. Read-only.',
    parameters: {
      checklist_csv: { type: 'string', required: true },
      submission_csv: { type: 'string', required: true },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'json', required: true },
          issues: { type: 'json', required: true },
          items: { type: 'json', required: true },
        },
      },
      render: (_args, value) => text(checkSentence(value as unknown as CheckResult)),
    },
    async execute(args) {
      return checkDocuments(args.checklist_csv, args.submission_csv)
    },
  })

  const template = defineTool({
    name: 'settlement_template',
    description:
      'Return the built-in minimal settlement-document checklist template CSV for a project type (房建/市政/装饰; 12+ unique items each) with columns 资料编码,资料名称,应有份数,是否必需. Read-only; no file is written.',
    parameters: {
      project_type: { type: 'string', required: true },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          project_type: { type: 'string', required: true },
          items: { type: 'json', required: true },
          required_items: { type: 'number', required: true },
          optional_items: { type: 'number', required: true },
          csv: { type: 'string', required: true },
          sha256: { type: 'string', required: true },
          bytes: { type: 'number', required: true },
        },
      },
      render: (_args, value) => {
        const template = value as unknown as TemplateResult
        return text(
          `竣工结算资料模板（${template.project_type}）：${template.items.length} 项（必需 ${template.required_items} / 非必需 ${template.optional_items}），${template.bytes} 字节`,
        )
      },
    },
    async execute(args) {
      return buildTemplate(args.project_type)
    },
  })

  const exportCsv = defineTool({
    name: 'settlement_export',
    description:
      'Re-run the document check and write the review worksheet CSV (UTF-8 BOM, one row per checklist line with issue types and messages) under $DSH_HOME/dsh-settlement-docs/exports; returns path, rows, bytes and sha256. Local R1 write.',
    parameters: {
      checklist_csv: { type: 'string', required: true },
      submission_csv: { type: 'string', required: true },
      filename: { type: 'string' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          sha256: { type: 'string', required: true },
          rows: { type: 'number', required: true },
          bytes: { type: 'number', required: true },
          checklist_items: { type: 'number', required: true },
          missing_required: { type: 'number', required: true },
          copies_short: { type: 'number', required: true },
          unsigned: { type: 'number', required: true },
          unstamped: { type: 'number', required: true },
          optional_missing: { type: 'number', required: true },
          blocking_issues: { type: 'number', required: true },
          info_issues: { type: 'number', required: true },
          rate_pct: { type: 'number', required: true },
        },
      },
      render: (_args, value) => text(`核对表 ${value.rows} 行 -> ${value.path}（齐套率 ${value.rate_pct.toFixed(2)}%）`),
    },
    async execute(args) {
      const result = checkDocuments(args.checklist_csv, args.submission_csv)
      const csv = worksheetCsv(result)
      const filename = args.filename ?? 'settlement-check.csv'
      let filePath: string
      try {
        filePath = await safeExportPath(path.join(deps.baseDir, 'exports'), filename)
      } catch (error) {
        if (error instanceof SettlementError) throw error
        throw new SettlementError('E_SETTLEMENT_PATH_INVALID', String(error))
      }
      try {
        await writeFile(filePath, csv, 'utf8')
      } catch (error) {
        throw new SettlementError('E_SETTLEMENT_PATH_INVALID', `写入 ${filePath} 失败：${String(error)}`)
      }
      return {
        path: filePath,
        sha256: sha256(csv),
        rows: result.items.length + 1,
        bytes: Buffer.byteLength(csv, 'utf8'),
        checklist_items: result.summary.checklist_items,
        missing_required: result.summary.missing_required,
        copies_short: result.summary.copies_short,
        unsigned: result.summary.unsigned,
        unstamped: result.summary.unstamped,
        optional_missing: result.summary.optional_missing,
        blocking_issues: result.summary.blocking_issues,
        info_issues: result.summary.info_issues,
        rate_pct: result.summary.rate_pct,
      }
    },
  })

  return [check, template, exportCsv]
}
