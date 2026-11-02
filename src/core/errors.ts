/** Every user-facing failure is a stable code plus one human sentence and one next action. */
export type SettlementErrorCode =
  | 'E_SETTLEMENT_CSV_ROW'
  | 'E_SETTLEMENT_DUP_CODE'
  | 'E_SETTLEMENT_UNKNOWN_CODE'
  | 'E_SETTLEMENT_PATH_INVALID'
  | 'E_SETTLEMENT_EMPTY'

interface HumanMessage {
  text: string
  next: string
}

const SETTLEMENT_HUMAN: Record<SettlementErrorCode, HumanMessage> = {
  E_SETTLEMENT_CSV_ROW: {
    text: '资料清单或实际提交清单的表头/某一行读不懂',
    next: '按 README 的列名补齐表头；份数写非负整数，签字/盖章写“是”或“否”，不要带单位或备注',
  },
  E_SETTLEMENT_DUP_CODE: {
    text: '同一个资料编码在一份清单里出现了不止一次',
    next: '每个资料编码在资料清单和实际提交清单里各只能出现一次；合并重复行后重试',
  },
  E_SETTLEMENT_UNKNOWN_CODE: {
    text: '资料编码或工程类型不在已知集合里',
    next: '核对编码是否笔误，工程类型只支持 房建/市政/装饰；确属新增资料就先补进资料清单再核对',
  },
  E_SETTLEMENT_PATH_INVALID: {
    text: '导出路径不可用（文件名不安全或目录不可写）',
    next: '只传一个由字母、数字、点、下划线或短横线组成的文件名，例如 settlement-check-2026-11.csv；确认 $DSH_HOME/dsh-settlement-docs 可写',
  },
  E_SETTLEMENT_EMPTY: {
    text: '清单是空的，只有表头或者一个字都没有',
    next: '资料清单用 settlement.template 生成并至少填一项；实际提交清单至少保留表头（只有表头表示一份都没交）',
  },
}

/** `human sentence（E_CODE）｜Next: one action｜detail` — the only text shown to end users. */
export function settlementErrorMessage(code: SettlementErrorCode, detail?: string): string {
  const human = SETTLEMENT_HUMAN[code]
  return `${human.text}（${code}）｜下一步：${human.next}${detail ? `｜细节：${detail}` : ''}`
}

export class SettlementError extends Error {
  readonly code: SettlementErrorCode
  constructor(code: SettlementErrorCode, detail?: string) {
    super(settlementErrorMessage(code, detail))
    this.name = 'SettlementError'
    this.code = code
  }
}
