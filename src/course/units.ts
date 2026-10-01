/**
 * 学習コース（docs/COURSE.md）。Stage と単元の並び、前提、どの問題テンプレートがどの単元に入るか。
 * 単元の状態や Stage の修了は、解答記録から src/progress/units.ts で計算する。
 */
import type { Tier } from '@/progress/certification'

export type StageId = 1 | 2 | 3

export type Stage = {
  id: StageId
  name: string
  /** この Stage を修了すると受けられる認定 */
  tier: Tier
  description: string
}

export const STAGES: readonly Stage[] = [
  {
    id: 1,
    name: '基礎手続の自動化',
    tier: 'bronze',
    description: '単一の取引や数値から、仕訳・指標・CF・CVP・時間価値を迷わず計算できる',
  },
  {
    id: 2,
    name: '標準・意思決定',
    tier: 'silver',
    description: 'NPV、セグメント別損益、企業価値など、標準的な解法手順を展開できる',
  },
  {
    id: 3,
    name: '事例Ⅳ総合',
    tier: 'gold',
    description: '複数の論点がからむ大問を、制限時間内に解き、助言まで書ける',
  },
]

/** 必須と推奨は Stage の修了に数える。後回しは数えない */
export type Priority = 'must' | 'recommended' | 'later'

export type Unit = {
  id: string
  name: string
  stage: StageId
  priority: Priority
  /** 前提の単元。ロックではなく、「次の単元」を選ぶときの案内 */
  prerequisites: readonly string[]
  /** この単元の問題テンプレート。空の単元は「準備中」 */
  templateIds: readonly string[]
  /** 1 問あたりの想定時間（分）。設計値 */
  expectedMinutes: number
}

export const UNITS: readonly Unit[] = [
  {
    id: 'acc-bs-pl',
    name: '財務諸表・仕訳基礎',
    stage: 1,
    priority: 'recommended',
    prerequisites: [],
    templateIds: [
      'journal.credit-sale',
      'journal.depreciation',
      'journal.allowance',
      'journal.fixed-asset-sale',
      'journal.prepaid-expense',
      'journal.bad-debt-write-off',
    ],
    expectedMinutes: 3,
  },
  {
    id: 'acc-ca',
    name: '経営分析',
    stage: 1,
    priority: 'must',
    prerequisites: ['acc-bs-pl'],
    templateIds: [
      'analysis.profitability',
      'analysis.safety',
      'analysis.efficiency',
      'analysis.compare-peer',
      'analysis.receivable-turnover-days',
    ],
    expectedMinutes: 4,
  },
  {
    id: 'acc-cf',
    name: 'キャッシュ・フロー計算書',
    stage: 1,
    priority: 'must',
    prerequisites: ['acc-bs-pl'],
    templateIds: [
      'cf.working-capital',
      'cf.adjustments',
      'cf.income-taxes-paid',
      'cf.investing-financing',
    ],
    expectedMinutes: 5,
  },
  {
    id: 'mgt-cvp',
    name: 'CVP 分析',
    stage: 1,
    priority: 'must',
    prerequisites: ['acc-bs-pl'],
    templateIds: [
      'cvp.break-even.basic',
      'cvp.target-profit',
      'cvp.high-low',
      'cvp.operating-leverage',
      'cvp.price-cut',
    ],
    expectedMinutes: 5,
  },
  {
    id: 'fin-tvm',
    name: '資金の時間価値',
    stage: 1,
    priority: 'must',
    prerequisites: ['acc-bs-pl'],
    templateIds: ['tvm.payment-plans', 'tvm.perpetuity'],
    expectedMinutes: 3,
  },
  {
    id: 'fin-npv',
    name: '投資評価・NPV',
    stage: 2,
    priority: 'must',
    prerequisites: ['fin-tvm', 'acc-cf'],
    templateIds: [
      'npv.new-investment',
      'npv.replacement',
      'npv.payback',
      'npv.working-capital-residual',
    ],
    expectedMinutes: 7,
  },
  {
    id: 'mgt-seg',
    name: 'セグメント別・意思決定',
    stage: 2,
    priority: 'recommended',
    prerequisites: ['mgt-cvp'],
    templateIds: ['seg.store-closure', 'seg.special-order'],
    expectedMinutes: 5,
  },
  {
    id: 'fin-val',
    name: '企業価値・WACC',
    stage: 2,
    priority: 'recommended',
    prerequisites: ['fin-npv'],
    templateIds: ['val.wacc', 'val.dcf'],
    expectedMinutes: 6,
  },
  {
    id: 'fin-fx',
    name: '為替・デリバティブ',
    stage: 2,
    priority: 'later',
    prerequisites: ['fin-tvm'],
    templateIds: [],
    expectedMinutes: 5,
  },
  {
    id: 'case4-int',
    name: '事例Ⅳ総合',
    stage: 3,
    priority: 'must',
    prerequisites: ['acc-ca', 'acc-cf', 'mgt-cvp', 'fin-npv'],
    templateIds: [
      'case4.peer-and-price-cut',
      'case4.investment-funding',
      'case4.segment-withdrawal',
      'case4.replacement-funding',
    ],
    expectedMinutes: 12,
  },
]

export function findUnit(id: string): Unit | undefined {
  return UNITS.find((unit) => unit.id === id)
}

export function findStage(id: StageId): Stage {
  return STAGES.find((stage) => stage.id === id)!
}

export function unitOfTemplate(templateId: string): Unit | undefined {
  return UNITS.find((unit) => unit.templateIds.includes(templateId))
}
