import type { Topic } from '@/engine/types'

export type LabId = Topic

export type Lab = {
  id: LabId
  name: string
  nameEn: string
  description: string
}

// 名前は仮（docs/DESIGN.md §11）。並びは学習の流れに合わせる
export const LABS: readonly Lab[] = [
  {
    id: 'journal',
    name: '仕訳ラボ',
    nameEn: 'Journal',
    description: '仕訳から財務諸表ができるまでを確かめる',
  },
  {
    id: 'analysis',
    name: '分析ラボ',
    nameEn: 'Analysis',
    description: '収益性・効率性・安全性の指標を読み解く',
  },
  {
    id: 'cf',
    name: 'CF ラボ',
    nameEn: 'Cash Flow',
    description: '間接法のキャッシュフロー計算書を組み立てる',
  },
  {
    id: 'cvp',
    name: 'CVP ラボ',
    nameEn: 'CVP',
    description: '損益分岐点と目標利益を計算する',
  },
  {
    id: 'npv',
    name: '投資ラボ',
    nameEn: 'Investment',
    description: '税引後 CF と NPV で投資を判断する',
  },
]

export function findLab(id: string | undefined): Lab | undefined {
  return LABS.find((lab) => lab.id === id)
}
