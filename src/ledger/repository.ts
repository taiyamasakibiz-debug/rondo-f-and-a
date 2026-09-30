import { clear, createStore, del, entries, set, setMany } from 'idb-keyval'
import {
  type LedgerAccount,
  type LedgerData,
  type LedgerEntry,
  ledgerAccountSchema,
  ledgerEntrySchema,
} from './types'

/**
 * フリーモードの保存先。科目と仕訳を 1 件ずつ別のキーで保存するので、
 * 複数のウィンドウが同時に書いても、ほかのウィンドウの変更を上書きしない。
 */
export type LedgerRepository = {
  load(): Promise<LedgerData>
  putAccount(account: LedgerAccount): Promise<void>
  deleteAccount(id: string): Promise<void>
  putEntries(entries: readonly LedgerEntry[]): Promise<void>
  deleteEntry(id: string): Promise<void>
  replaceAll(data: LedgerData): Promise<void>
}

const ACCOUNT = 'account:'
const ENTRY = 'entry:'

export function createIndexedDbLedgerRepository(
  dbName = 'luminous-insight-ledger',
): LedgerRepository {
  const store = createStore(dbName, 'ledger')
  return {
    async load() {
      const accounts: LedgerAccount[] = []
      const ledgerEntries: LedgerEntry[] = []
      for (const [key, value] of await entries<string, unknown>(store)) {
        if (key.startsWith(ACCOUNT)) {
          const parsed = ledgerAccountSchema.safeParse(value)
          if (parsed.success) accounts.push(parsed.data)
        } else if (key.startsWith(ENTRY)) {
          const parsed = ledgerEntrySchema.safeParse(value)
          if (parsed.success) ledgerEntries.push(parsed.data)
        }
      }
      return sortLedger({ accounts, entries: ledgerEntries })
    },
    putAccount: (account) => set(ACCOUNT + account.id, account, store),
    deleteAccount: (id) => del(ACCOUNT + id, store),
    putEntries: (items) =>
      setMany(
        items.map((entry): [string, LedgerEntry] => [ENTRY + entry.id, entry]),
        store,
      ),
    deleteEntry: (id) => del(ENTRY + id, store),
    async replaceAll(data) {
      await clear(store)
      await setMany(
        [
          ...data.accounts.map((a): [string, unknown] => [ACCOUNT + a.id, a]),
          ...data.entries.map((e): [string, unknown] => [ENTRY + e.id, e]),
        ],
        store,
      )
    },
  }
}

export function createMemoryLedgerRepository(initial?: Partial<LedgerData>): LedgerRepository {
  const accounts = new Map((initial?.accounts ?? []).map((a) => [a.id, a]))
  const ledgerEntries = new Map((initial?.entries ?? []).map((e) => [e.id, e]))
  return {
    load: async () =>
      sortLedger({ accounts: [...accounts.values()], entries: [...ledgerEntries.values()] }),
    putAccount: async (account) => void accounts.set(account.id, account),
    deleteAccount: async (id) => void accounts.delete(id),
    putEntries: async (items) => items.forEach((entry) => ledgerEntries.set(entry.id, entry)),
    deleteEntry: async (id) => void ledgerEntries.delete(id),
    async replaceAll(data) {
      accounts.clear()
      ledgerEntries.clear()
      data.accounts.forEach((a) => accounts.set(a.id, a))
      data.entries.forEach((e) => ledgerEntries.set(e.id, e))
    },
  }
}

/** 科目は作った順、仕訳は記帳した順に並べる */
function sortLedger(data: LedgerData): LedgerData {
  const byCreated = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  return {
    accounts: [...data.accounts].sort(byCreated),
    entries: [...data.entries].sort(byCreated),
  }
}
