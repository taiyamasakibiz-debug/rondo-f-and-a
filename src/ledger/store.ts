import { create } from 'zustand'
import { type Category, categoryDefinition } from '@/domain/accounting/categories'
import { createClosingEntry, validateEntry } from '@/domain/accounting/ledger'
import { type SyncChannel, createBroadcastSync, createNoopSync } from '@/data/sync'
import { type LedgerRepository, createIndexedDbLedgerRepository } from './repository'
import { STARTER_ACCOUNTS } from './presets'
import type { LedgerAccount, LedgerData, LedgerEntry } from './types'

export type Result = { ok: true } | { ok: false; message: string }

type EntryLine = LedgerEntry['debits'][number]

export type EntryInput = {
  description: string
  debits: readonly EntryLine[]
  credits: readonly EntryLine[]
}

type LedgerState = LedgerData & {
  status: 'loading' | 'ready' | 'error'
  load(): Promise<void>
  addAccount(name: string, category: Category): Promise<Result>
  removeAccount(id: string): Promise<Result>
  addEntry(input: EntryInput): Promise<Result>
  /** 逆仕訳（取消の仕訳）を記帳する */
  reverseEntry(id: string): Promise<Result>
  deleteEntry(id: string): Promise<void>
  /** 削除した仕訳を元に戻す（Undo 用） */
  restoreEntry(entry: LedgerEntry): Promise<void>
  /** 決算振替：収益・費用を利益剰余金へ振り替える */
  closeBooks(): Promise<Result>
  startWithStarterAccounts(): Promise<void>
  /** すべて置き換える（バックアップの読み込み用） */
  replaceAll(data: LedgerData): Promise<void>
  reset(): Promise<void>
}

/**
 * フリーモードの勘定科目と仕訳。複数ウィンドウで開いて使うのが前提（docs/DESIGN.md §2）。
 * 保存し終わったら 'ledger' の変更を知らせ、知らせを受けたウィンドウは保存先から読み直す。
 * 保存と読み直しは 1 列に並べ、保存し終わっていない変更は読み直しで消さない。
 */
export function createLedgerStore(
  repository: LedgerRepository,
  sync: SyncChannel = createNoopSync(),
) {
  let queue: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
  }
  const unsaved = {
    accounts: new Map<string, LedgerAccount | null>(),
    entries: new Map<string, LedgerEntry | null>(),
  }

  return create<LedgerState>()((set, get) => {
    const reload = () =>
      enqueue(async () => {
        const data = await repository.load()
        set({
          status: 'ready',
          accounts: applyUnsaved(data.accounts, unsaved.accounts),
          entries: applyUnsaved(data.entries, unsaved.entries),
        })
      })

    sync.subscribe((message) => {
      if (message.scope !== 'ledger') return
      reload().catch((error: unknown) => console.error('仕訳の読み直しに失敗しました', error))
    })

    /** 画面にすぐ反映してから、保存を順番に行い、ほかのウィンドウに知らせる */
    async function commit(
      change: {
        accounts?: (LedgerAccount | { id: string; deleted: true })[]
        entries?: (LedgerEntry | { id: string; deleted: true })[]
      },
      save: () => Promise<void>,
    ) {
      for (const item of change.accounts ?? []) {
        unsaved.accounts.set(item.id, 'deleted' in item ? null : item)
      }
      for (const item of change.entries ?? []) {
        unsaved.entries.set(item.id, 'deleted' in item ? null : item)
      }
      set({
        accounts: applyUnsaved(get().accounts, unsaved.accounts),
        entries: applyUnsaved(get().entries, unsaved.entries),
      })
      try {
        await enqueue(save)
      } finally {
        for (const item of change.accounts ?? []) unsaved.accounts.delete(item.id)
        for (const item of change.entries ?? []) unsaved.entries.delete(item.id)
      }
      sync.notify('ledger')
    }

    const now = () => new Date().toISOString()

    async function postEntry(input: EntryInput, kind: LedgerEntry['kind']): Promise<Result> {
      const description = input.description.trim()
      if (!description) return { ok: false, message: '取引の説明を入力してください。' }
      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        description,
        debits: input.debits.map((line) => ({ ...line })),
        credits: input.credits.map((line) => ({ ...line })),
        kind,
        createdAt: now(),
        updatedAt: now(),
      }
      const errors = validateEntry(entry, get().accounts)
      if (errors.length > 0) return { ok: false, message: entryErrorMessage(errors[0]!) }
      await commit({ entries: [entry] }, () => repository.putEntries([entry]))
      return { ok: true }
    }

    return {
      status: 'loading',
      accounts: [],
      entries: [],

      async load() {
        try {
          await reload()
        } catch (error) {
          console.error('仕訳の読み込みに失敗しました', error)
          set({ status: 'error' })
        }
      },

      async addAccount(name, category) {
        const trimmed = name.trim()
        if (!trimmed) return { ok: false, message: '科目名を入力してください。' }
        if (get().accounts.some((account) => account.name === trimmed)) {
          return { ok: false, message: `「${trimmed}」はすでにあります。` }
        }
        const account: LedgerAccount = {
          id: crypto.randomUUID(),
          name: trimmed,
          category,
          createdAt: now(),
          updatedAt: now(),
        }
        await commit({ accounts: [account] }, () => repository.putAccount(account))
        return { ok: true }
      },

      async removeAccount(id) {
        // 使われている科目を消すと、仕訳が「不明な科目」になって B/S がずれる（v1 のバグ）
        const used = get().entries.some((entry) =>
          [...entry.debits, ...entry.credits].some((line) => line.accountId === id),
        )
        if (used) return { ok: false, message: '仕訳で使われている科目は削除できません。' }
        await commit({ accounts: [{ id, deleted: true }] }, () => repository.deleteAccount(id))
        return { ok: true }
      },

      addEntry: (input) => postEntry(input, 'normal'),

      async reverseEntry(id) {
        const original = get().entries.find((entry) => entry.id === id)
        if (!original) return { ok: false, message: '仕訳が見つかりません。' }
        return postEntry(
          {
            description: `取消：${original.description}`.slice(0, 100),
            debits: original.credits,
            credits: original.debits,
          },
          'reversal',
        )
      },

      async deleteEntry(id) {
        await commit({ entries: [{ id, deleted: true }] }, () => repository.deleteEntry(id))
      },

      async restoreEntry(entry) {
        await commit({ entries: [entry] }, () => repository.putEntries([entry]))
      },

      async closeBooks() {
        const result = createClosingEntry(get().accounts, get().entries, 'closing')
        if (!result.ok) {
          return {
            ok: false,
            message:
              result.reason === 'missingRetainedEarnings'
                ? '決算振替には「利益剰余金」の区分の科目が必要です。科目マスターで作成してください。'
                : '振り替える収益・費用の残高がありません。',
          }
        }
        return postEntry(
          { description: '決算振替', debits: result.entry.debits, credits: result.entry.credits },
          'closing',
        )
      },

      async startWithStarterAccounts() {
        const existing = new Set(get().accounts.map((account) => account.name))
        const base = Date.now()
        const accounts = STARTER_ACCOUNTS.filter(([name]) => !existing.has(name)).map(
          ([name, category], i): LedgerAccount => {
            // 作った順に並ぶよう、1 ミリ秒ずつずらす
            const time = new Date(base + i).toISOString()
            return { id: crypto.randomUUID(), name, category, createdAt: time, updatedAt: time }
          },
        )
        await commit({ accounts }, async () => {
          for (const account of accounts) await repository.putAccount(account)
        })
      },

      async replaceAll({ accounts, entries }) {
        await enqueue(async () => {
          await repository.replaceAll({ accounts, entries })
          set({ accounts, entries })
        })
        sync.notify('ledger')
      },

      reset: () => get().replaceAll({ accounts: [], entries: [] }),
    }
  })
}

function applyUnsaved<T extends { id: string }>(
  items: readonly T[],
  unsaved: Map<string, T | null>,
): T[] {
  const result = items.filter((item) => !unsaved.has(item.id))
  for (const value of unsaved.values()) if (value) result.push(value)
  return result
}

function entryErrorMessage(error: ReturnType<typeof validateEntry>[number]): string {
  switch (error.kind) {
    case 'noLines':
      return '借方と貸方の両方に、科目と金額を入力してください。'
    case 'invalidAmount':
      return '金額は 1 以上の整数で入力してください。'
    case 'unknownAccount':
      return '存在しない科目が含まれています。'
    case 'unbalanced':
      return `借方合計（${error.debitTotal.toLocaleString('ja-JP')}）と貸方合計（${error.creditTotal.toLocaleString('ja-JP')}）が一致していません。`
  }
}

/** 大区分ごとの科目。科目マスターと B/S・P/L の表示で使う */
export function accountsByMajor(accounts: readonly LedgerAccount[]) {
  const groups = new Map<string, LedgerAccount[]>()
  for (const account of accounts) {
    const major = categoryDefinition(account.category).major
    groups.set(major, [...(groups.get(major) ?? []), account])
  }
  return groups
}

export const useLedgerStore = createLedgerStore(
  createIndexedDbLedgerRepository(),
  createBroadcastSync(),
)
