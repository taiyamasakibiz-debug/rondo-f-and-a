import { z } from 'zod'
import { ledgerAccountSchema, ledgerEntrySchema, type LedgerData } from '@/ledger/types'
import { attemptSchema, settingsSchema } from '@/progress/types'
import type { ProgressData } from './repository'

/**
 * バックアップ（書き出し・読み込み）の形式。
 * - バージョン 1：解答記録と設定
 * - バージョン 2：それに加えて、フリーモードの科目と仕訳
 * 古いバージョンのファイルも読み込める。
 */
export const BACKUP_VERSION = 2 as const

const common = {
  app: z.literal('luminous-insight'),
  exportedAt: z.iso.datetime({ offset: true }),
  attempts: z.array(attemptSchema),
  settings: settingsSchema,
}

const ledgerSchema = z
  .object({
    accounts: z.array(ledgerAccountSchema),
    entries: z.array(ledgerEntrySchema),
  })
  // 仕訳が存在しない科目を使っていると、「不明な科目」で B/S がずれる（v1 のバグ）
  .refine(
    ({ accounts, entries }) => {
      const ids = new Set(accounts.map((account) => account.id))
      return entries.every((entry) =>
        [...entry.debits, ...entry.credits].every((line) => ids.has(line.accountId)),
      )
    },
    { message: '仕訳が存在しない科目を使っています。' },
  )

const backupSchema = z.discriminatedUnion('version', [
  z.object({ ...common, version: z.literal(1) }),
  z.object({ ...common, version: z.literal(2), ledger: ledgerSchema }),
])

export type Backup = z.infer<typeof backupSchema>
/** 書き出すのは常に最新のバージョン */
export type LatestBackup = Extract<Backup, { version: typeof BACKUP_VERSION }>

export function createBackup(
  progress: ProgressData,
  ledger: LedgerData,
  now = new Date(),
): LatestBackup {
  return {
    app: 'luminous-insight',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    attempts: progress.attempts,
    settings: progress.settings,
    ledger: { accounts: ledger.accounts, entries: ledger.entries },
  }
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; message: string }

export function parseBackup(json: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, message: 'JSON として読み取れませんでした。' }
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'このアプリで書き出したデータではないか、形式が壊れています。',
    }
  }
  return { ok: true, backup: parsed.data }
}

export type BackupTargets = {
  replaceProgress(data: ProgressData): Promise<void>
  replaceLedger(data: LedgerData): Promise<void>
}

/** バックアップで置き換える。バージョン 1 にはフリーモードがないので、フリーモードは今のまま残す */
export async function restoreBackup(backup: Backup, targets: BackupTargets): Promise<void> {
  await targets.replaceProgress({ attempts: backup.attempts, settings: backup.settings })
  if (backup.version === 2) await targets.replaceLedger(backup.ledger)
}

/** 置き換える前に、何がどう変わるかを説明する */
export function describeBackup(backup: Backup): string {
  const ledger =
    backup.version === 2
      ? `フリーモードの科目 ${backup.ledger.accounts.length} 件・仕訳 ${backup.ledger.entries.length} 件`
      : 'フリーモードのデータは含まれていないため、今のまま残ります'
  return `解答記録 ${backup.attempts.filter((a) => !a.deletedAt).length} 件と設定、${ledger}`
}
