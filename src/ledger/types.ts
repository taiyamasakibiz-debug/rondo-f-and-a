import { z } from 'zod'
import { CATEGORIES, type Category } from '@/domain/accounting/categories'

const categorySchema = z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]])
const timestamp = z.iso.datetime({ offset: true })

/** フリーモードの勘定科目 */
export const ledgerAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(30),
  category: categorySchema,
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type LedgerAccount = z.infer<typeof ledgerAccountSchema>

const lineSchema = z.object({
  accountId: z.string().min(1),
  amount: z.number().int().positive(),
})

/** フリーモードの仕訳 */
export const ledgerEntrySchema = z.object({
  id: z.string().min(1),
  description: z.string().max(100),
  debits: z.array(lineSchema).min(1),
  credits: z.array(lineSchema).min(1),
  /** 決算振替・取消の仕訳（表示を分けるため） */
  kind: z.enum(['normal', 'closing', 'reversal']),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

export type LedgerData = {
  accounts: LedgerAccount[]
  entries: LedgerEntry[]
}
