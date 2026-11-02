import { parseChecklist, parseSubmission, type ChecklistItem } from './documents.js'
import { SettlementError } from './errors.js'

export type IssueType = 'missing' | 'copies_short' | 'unsigned' | 'unstamped' | 'optional_missing'
export type IssueLevel = 'blocking' | 'info'

/** One finding. `level=info` means an optional document was not submitted. */
export type CheckIssue = {
  type: IssueType
  level: IssueLevel
  code: string
  name: string
  message: string
  required_copies: number
  submitted_copies: number
}

/** One checklist line merged with its actual submission. */
export type CheckItem = {
  code: string
  name: string
  required: boolean
  required_copies: number
  submitted: boolean
  filename: string
  copies: number
  signed: boolean
  stamped: boolean
  /** True only when submitted, with enough copies, signed and stamped. */
  complete: boolean
  issues: IssueType[]
}

export type CheckSummary = {
  checklist_items: number
  required_items: number
  optional_items: number
  submitted_items: number
  /** Required documents that were not submitted at all. */
  missing_required: number
  /** Submitted documents whose copy count is below the checklist. */
  copies_short: number
  unsigned: number
  unstamped: number
  /** Optional documents that were not submitted (info only). */
  optional_missing: number
  blocking_issues: number
  info_issues: number
  required_complete: number
  overall_complete: number
  /** Headline completeness rate: complete required documents / all required documents, 2 decimals. */
  rate_pct: number
  /** Completeness across required and optional documents, 2 decimals. */
  overall_rate_pct: number
}

export type CheckResult = {
  summary: CheckSummary
  issues: CheckIssue[]
  items: CheckItem[]
}

/** Two-decimal percentage using integer maths; an empty required set counts as 100%. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 100
  return Math.round((part * 10000) / total) / 100
}

function issue(
  type: IssueType,
  level: IssueLevel,
  item: ChecklistItem,
  submittedCopies: number,
  message: string,
): CheckIssue {
  return {
    type,
    level,
    code: item.code,
    name: item.name,
    message,
    required_copies: item.requiredCopies,
    submitted_copies: submittedCopies,
  }
}

/**
 * Check a document checklist against the actual submission.
 *
 * - required + absent → `missing` (blocking)
 * - optional + absent → `optional_missing` (info)
 * - present but `copies < requiredCopies` → `copies_short`
 * - present but unsigned / unstamped → `unsigned` / `unstamped`
 * - a submitted optional document with a defect is reported at info level
 *
 * An unknown submission code is `E_SETTLEMENT_UNKNOWN_CODE` rather than being
 * silently ignored: a typo would otherwise inflate the completeness rate.
 */
export function checkDocuments(checklistCsv: string, submissionCsv: string): CheckResult {
  const checklist = parseChecklist(checklistCsv)
  const submissions = parseSubmission(submissionCsv)
  const known = new Set(checklist.map((item) => item.code))
  const unknown = submissions.map((item) => item.code).filter((code) => !known.has(code))
  if (unknown.length > 0) {
    throw new SettlementError('E_SETTLEMENT_UNKNOWN_CODE', `实际提交清单里有资料清单中没有的编码：${unknown.join('、')}`)
  }
  const byCode = new Map(submissions.map((item) => [item.code, item]))

  const issues: CheckIssue[] = []
  const items: CheckItem[] = checklist.map((item) => {
    const submitted = byCode.get(item.code)
    const itemIssues: IssueType[] = []
    const level: IssueLevel = item.required ? 'blocking' : 'info'

    if (!submitted) {
      if (item.required) {
        itemIssues.push('missing')
        issues.push(issue('missing', 'blocking', item, 0, `必需资料“${item.name}”（${item.code}）未提交`))
      } else {
        itemIssues.push('optional_missing')
        issues.push(issue('optional_missing', 'info', item, 0, `非必需资料“${item.name}”（${item.code}）未提交（提示）`))
      }
      return {
        code: item.code,
        name: item.name,
        required: item.required,
        required_copies: item.requiredCopies,
        submitted: false,
        filename: '',
        copies: 0,
        signed: false,
        stamped: false,
        complete: false,
        issues: itemIssues,
      }
    }

    if (submitted.copies < item.requiredCopies) {
      itemIssues.push('copies_short')
      issues.push(
        issue(
          'copies_short',
          level,
          item,
          submitted.copies,
          `“${item.name}”（${item.code}）应有 ${item.requiredCopies} 份，实交 ${submitted.copies} 份`,
        ),
      )
    }
    if (!submitted.signed) {
      itemIssues.push('unsigned')
      issues.push(issue('unsigned', level, item, submitted.copies, `“${item.name}”（${item.code}）未签字`))
    }
    if (!submitted.stamped) {
      itemIssues.push('unstamped')
      issues.push(issue('unstamped', level, item, submitted.copies, `“${item.name}”（${item.code}）未盖章`))
    }

    return {
      code: item.code,
      name: item.name,
      required: item.required,
      required_copies: item.requiredCopies,
      submitted: true,
      filename: submitted.filename,
      copies: submitted.copies,
      signed: submitted.signed,
      stamped: submitted.stamped,
      complete: itemIssues.length === 0,
      issues: itemIssues,
    }
  })

  const requiredItems = items.filter((item) => item.required)
  const requiredComplete = requiredItems.filter((item) => item.complete).length
  const overallComplete = items.filter((item) => item.complete).length
  const count = (type: IssueType) => issues.filter((entry) => entry.type === type).length

  const summary: CheckSummary = {
    checklist_items: items.length,
    required_items: requiredItems.length,
    optional_items: items.length - requiredItems.length,
    submitted_items: submissions.length,
    missing_required: count('missing'),
    copies_short: count('copies_short'),
    unsigned: count('unsigned'),
    unstamped: count('unstamped'),
    optional_missing: count('optional_missing'),
    blocking_issues: issues.filter((entry) => entry.level === 'blocking').length,
    info_issues: issues.filter((entry) => entry.level === 'info').length,
    required_complete: requiredComplete,
    overall_complete: overallComplete,
    rate_pct: percent(requiredComplete, requiredItems.length),
    overall_rate_pct: percent(overallComplete, items.length),
  }

  return { summary, issues, items }
}

/** One-sentence render for `settlement.check`. */
export function checkSentence(result: CheckResult): string {
  const s = result.summary
  return `竣工结算资料 ${s.checklist_items} 项：缺件 ${s.missing_required}、份数不足 ${s.copies_short}、未签字 ${s.unsigned}、未盖章 ${s.unstamped}、非必需缺失 ${s.optional_missing}；齐套率 ${s.rate_pct.toFixed(2)}%（${s.required_complete}/${s.required_items} 必需），${s.blocking_issues} 个阻塞 / ${s.info_issues} 个提示`
}
