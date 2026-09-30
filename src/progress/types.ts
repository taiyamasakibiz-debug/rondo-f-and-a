import { z } from 'zod'

const topicSchema = z.enum(['journal', 'analysis', 'cf', 'cvp', 'npv'])

/** 1 問を解いた記録。保存するのはこれと設定だけで、レベルやストリークはここから計算する */
export const attemptSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  topic: topicSchema,
  /** この値とテンプレートで、同じ問題を作り直せる */
  seed: z.number().int().nonnegative(),
  earned: z.number().nonnegative(),
  total: z.number().positive(),
  allCorrect: z.boolean(),
  steps: z.array(z.object({ stepId: z.string(), correct: z.boolean() })),
  durationMs: z.number().nonnegative(),
  /** 解答した日時（ISO 8601） */
  answeredAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  /** 論理削除（将来の同期で、削除も伝えられるように） */
  deletedAt: z.iso.datetime({ offset: true }).optional(),
  /** 認定テストで解いた問題なら、そのテストの情報（合否は src/progress/certification.ts で計算する） */
  exam: z
    .object({
      id: z.string().min(1),
      tier: z.enum(['bronze', 'silver', 'gold']),
      /** テストの何問目か（0 から） */
      index: z.number().int().nonnegative(),
      startedAt: z.iso.datetime({ offset: true }),
    })
    .optional(),
})
export type Attempt = z.infer<typeof attemptSchema>

export const settingsSchema = z.object({
  /** 1 日のノルマ（問題数） */
  dailyGoal: z.number().int().min(1).max(20),
  /** 日付の切り替わり時刻（0〜23 時） */
  dayStartHour: z.number().int().min(0).max(23),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 3,
  dayStartHour: 4,
  updatedAt: new Date(0).toISOString(),
}
