import { describe, expect, it } from 'vitest'
import { createMemoryLedgerRepository } from '@/ledger/repository'
import { createLedgerStore } from '@/ledger/store'
import { createProgressStore } from '@/progress/store'
import { DEFAULT_SETTINGS, liveAttempts, settingsValues } from '@/progress/types'
import { createBackup, parseBackup, restoreBackup } from './backup'
import { createMemoryRepository } from './repository'

async function stores() {
  const progress = createProgressStore(createMemoryRepository())
  const ledger = createLedgerStore(createMemoryLedgerRepository())
  await progress.getState().load()
  await ledger.getState().load()
  return {
    progress,
    ledger,
    targets: {
      replaceProgress: progress.getState().replaceAll,
      replaceLedger: ledger.getState().replaceAll,
    },
  }
}

async function withData() {
  const s = await stores()
  await s.progress.getState().recordAttempt({
    templateId: 'cvp.break-even.basic',
    topic: 'cvp',
    seed: 1,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: 1,
  })
  await s.progress.getState().updateSettings({ dailyGoal: 5 })
  await s.ledger.getState().startWithStarterAccounts()
  const id = (name: string) => s.ledger.getState().accounts.find((a) => a.name === name)!.id
  await s.ledger.getState().addEntry({
    description: '出資',
    debits: [{ accountId: id('現金預金'), amount: 1000 }],
    credits: [{ accountId: id('資本金'), amount: 1000 }],
  })
  return s
}

describe('バックアップ', () => {
  it('書き出したものを読み込むと、解答記録・設定・フリーモードが元どおりになる', async () => {
    const source = await withData()
    const json = JSON.stringify(
      createBackup(
        {
          attempts: source.progress.getState().attempts,
          settings: source.progress.getState().settings,
        },
        { accounts: source.ledger.getState().accounts, entries: source.ledger.getState().entries },
      ),
    )

    const target = await stores()
    const parsed = parseBackup(json)
    if (!parsed.ok) throw new Error(parsed.message)
    await restoreBackup(parsed.backup, target.targets)

    expect(target.progress.getState().attempts).toEqual(source.progress.getState().attempts)
    expect(settingsValues(target.progress.getState().settings)).toEqual(
      settingsValues(source.progress.getState().settings),
    )
    expect(target.ledger.getState().accounts).toEqual(source.ledger.getState().accounts)
    expect(target.ledger.getState().entries).toEqual(source.ledger.getState().entries)
  })

  it('バージョン 1（フリーモードなし）のファイルも読み込め、フリーモードは今のまま残す', async () => {
    const target = await withData()
    const entriesBefore = target.ledger.getState().entries
    const v1 = JSON.stringify({
      app: 'luminous-insight',
      version: 1,
      exportedAt: new Date().toISOString(),
      attempts: [],
      settings: DEFAULT_SETTINGS,
    })
    const parsed = parseBackup(v1)
    if (!parsed.ok) throw new Error(parsed.message)
    await restoreBackup(parsed.backup, target.targets)

    expect(liveAttempts(target.progress.getState().attempts)).toEqual([])
    expect(target.ledger.getState().entries).toEqual(entriesBefore)
  })

  it('JSON でない・別のアプリ・存在しない科目を使う仕訳を含むデータは読み込まない', async () => {
    const source = await withData()
    const broken = createBackup(
      { attempts: [], settings: DEFAULT_SETTINGS },
      { accounts: [], entries: source.ledger.getState().entries },
    )
    expect(parseBackup('not json').ok).toBe(false)
    expect(parseBackup('{"app":"other","version":2}').ok).toBe(false)
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false)
  })
})
