import { createHash } from 'node:crypto'
import { toCsv } from './csv.js'
import { CHECKLIST_HEADER, type ChecklistItem } from './documents.js'
import { SettlementError } from './errors.js'

export const PROJECT_TYPES = ['房建', '市政', '装饰'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

/**
 * Built-in minimal checklists. Each list is deliberately short enough to read
 * and long enough to be useful (12+ items), and every code is unique inside its
 * project type. These are starting points, not a statutory register: a real
 * project adds local filing requirements on top.
 */
export const CHECKLIST_TEMPLATES: Readonly<Record<ProjectType, readonly ChecklistItem[]>> = {
  房建: [
    { code: 'JS-01', name: '竣工结算书', requiredCopies: 3, required: true },
    { code: 'JS-02', name: '工程量清单结算书', requiredCopies: 2, required: true },
    { code: 'JS-03', name: '施工合同及补充协议', requiredCopies: 1, required: true },
    { code: 'JS-04', name: '招标文件与投标文件', requiredCopies: 1, required: true },
    { code: 'JS-05', name: '开工报告与竣工报告', requiredCopies: 1, required: true },
    { code: 'JS-06', name: '施工许可证', requiredCopies: 1, required: true },
    { code: 'JS-07', name: '图纸会审纪要', requiredCopies: 1, required: true },
    { code: 'JS-08', name: '设计变更通知单', requiredCopies: 2, required: true },
    { code: 'JS-09', name: '现场签证单', requiredCopies: 2, required: true },
    { code: 'JS-10', name: '隐蔽工程验收记录', requiredCopies: 1, required: true },
    { code: 'JS-11', name: '分部分项工程质量验收记录', requiredCopies: 1, required: true },
    { code: 'JS-12', name: '竣工验收备案表', requiredCopies: 1, required: true },
    { code: 'JS-13', name: '甲供材料领用对账单', requiredCopies: 1, required: false },
    { code: 'JS-14', name: '工期顺延与索赔资料', requiredCopies: 1, required: false },
  ],
  市政: [
    { code: 'SZ-01', name: '竣工结算书', requiredCopies: 3, required: true },
    { code: 'SZ-02', name: '工程量清单结算书', requiredCopies: 2, required: true },
    { code: 'SZ-03', name: '施工合同及补充协议', requiredCopies: 1, required: true },
    { code: 'SZ-04', name: '中标通知书', requiredCopies: 1, required: true },
    { code: 'SZ-05', name: '开工报告与竣工报告', requiredCopies: 1, required: true },
    { code: 'SZ-06', name: '施工许可证', requiredCopies: 1, required: true },
    { code: 'SZ-07', name: '图纸会审纪要', requiredCopies: 1, required: true },
    { code: 'SZ-08', name: '设计变更通知单', requiredCopies: 2, required: true },
    { code: 'SZ-09', name: '现场签证单', requiredCopies: 2, required: true },
    { code: 'SZ-10', name: '隐蔽工程验收记录', requiredCopies: 1, required: true },
    { code: 'SZ-11', name: '市政工程质量验收记录', requiredCopies: 1, required: true },
    { code: 'SZ-12', name: '竣工验收备案表', requiredCopies: 1, required: true },
    { code: 'SZ-13', name: '管线迁改与交通导改资料', requiredCopies: 1, required: false },
  ],
  装饰: [
    { code: 'ZS-01', name: '竣工结算书', requiredCopies: 3, required: true },
    { code: 'ZS-02', name: '工程量清单结算书', requiredCopies: 2, required: true },
    { code: 'ZS-03', name: '装饰施工合同及补充协议', requiredCopies: 1, required: true },
    { code: 'ZS-04', name: '中标通知书与投标文件', requiredCopies: 1, required: true },
    { code: 'ZS-05', name: '开工报审与竣工报告', requiredCopies: 1, required: true },
    { code: 'ZS-06', name: '施工图与深化设计图', requiredCopies: 1, required: true },
    { code: 'ZS-07', name: '设计变更与洽商记录', requiredCopies: 2, required: true },
    { code: 'ZS-08', name: '现场签证单', requiredCopies: 2, required: true },
    { code: 'ZS-09', name: '隐蔽工程验收记录', requiredCopies: 1, required: true },
    { code: 'ZS-10', name: '装饰工程质量验收记录', requiredCopies: 1, required: true },
    { code: 'ZS-11', name: '室内环境检测报告', requiredCopies: 1, required: true },
    { code: 'ZS-12', name: '竣工影像资料', requiredCopies: 1, required: false },
  ],
}

const PROJECT_TYPE_ALIASES: Readonly<Record<string, ProjectType>> = {
  房建: '房建',
  房建工程: '房建',
  housing: '房建',
  building: '房建',
  fangjian: '房建',
  市政: '市政',
  市政工程: '市政',
  municipal: '市政',
  shizheng: '市政',
  装饰: '装饰',
  装饰工程: '装饰',
  装饰装修: '装饰',
  装修: '装饰',
  decoration: '装饰',
  fitout: '装饰',
  zhuangshi: '装饰',
}

/** Resolve a project type alias; anything else is `E_SETTLEMENT_UNKNOWN_CODE`. */
export function normalizeProjectType(value: string | undefined): ProjectType {
  const key = (value ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const projectType = PROJECT_TYPE_ALIASES[key]
  if (!projectType) {
    throw new SettlementError(
      'E_SETTLEMENT_UNKNOWN_CODE',
      `未知工程类型：${JSON.stringify(value ?? '')}；只支持 ${PROJECT_TYPES.join('/')}`,
    )
  }
  return projectType
}

export type TemplateResult = {
  project_type: ProjectType
  items: ChecklistItem[]
  required_items: number
  optional_items: number
  csv: string
  sha256: string
  bytes: number
}

/** Build the checklist template CSV (UTF-8 BOM so Excel opens it cleanly). */
export function templateCsv(projectType: ProjectType): string {
  const rows = CHECKLIST_TEMPLATES[projectType].map((item) => [
    item.code,
    item.name,
    String(item.requiredCopies),
    item.required ? '是' : '否',
  ])
  return `\uFEFF${toCsv([[...CHECKLIST_HEADER], ...rows])}`
}

/** `settlement_template` body: template CSV plus counts and a content hash. */
export function buildTemplate(projectTypeInput: string | undefined): TemplateResult {
  const projectType = normalizeProjectType(projectTypeInput)
  const items = CHECKLIST_TEMPLATES[projectType].map((item) => ({ ...item }))
  const csv = templateCsv(projectType)
  return {
    project_type: projectType,
    items,
    required_items: items.filter((item) => item.required).length,
    optional_items: items.filter((item) => !item.required).length,
    csv,
    sha256: createHash('sha256').update(csv).digest('hex'),
    bytes: Buffer.byteLength(csv, 'utf8'),
  }
}
