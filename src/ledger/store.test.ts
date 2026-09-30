import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { buildStatements } from '@/domain/accounting/ledger'
import { incomeStatementProfits } from '@/domain/statements'
import { createMemorySyncHub } from '@/data/sync'
import { createIndexedDbLedgerRepository, createMemoryLedgerRepository } from './repository'
import { createLedgerStore } from './store'

async function readyStore() {
  const store = createLedgerStore(createMemoryLedgerRepository())
  await store.getState().load()
  await store.getState().startWithStarterAccounts()
  const id = (name: string) => store.getState().accounts.find((a) => a.name === name)!.id
  return { store, id }
}

describe('フリーモードの科目', () => {
  it('標準の科目で始められ、同じ名前の科目は作れない', async () => {
    const { store } = await readyStore()
    expect(store.getState().accounts.map((a) => a.name)).toContain('売上原価')
    expect(await store.getState().addAccount('売上原価', 'costOfSales')).toMatchObject({
      ok: false,
    })
    expect(await store.getState().addAccount(' 消耗品費 ', 'sga')).toEqual({ ok: true })
    expect(store.getState().accounts.at(-1)).toMatchObject({ name: '消耗品費', category: 'sga' })
  })

  it('標準の科目を 2 回選んでも重複しない', async () => {
    const { store } = await readyStore()
    const count = store.getState().accounts.length
    await store.getState().startWithStarterAccounts()
    expect(store.getState().accounts).toHaveLength(count)
  })

  it('v1 の再現：仕訳で使っている科目は削除できない', async () => {
    const { store, id } = await readyStore()
    await store.getState().addEntry({
      description: '出資',
      debits: [{ accountId: id('現金預金'), amount: 1000 }],
      credits: [{ accountId: id('資本金'), amount: 1000 }],
    })
    expect(await store.getState().removeAccount(id('資本金'))).toMatchObject({ ok: false })
    expect(await store.getState().removeAccount(id('商品'))).toEqual({ ok: true })
  })
})

describe('フリーモードの仕訳', () => {
  it('貸借が合わない仕訳や、説明のない仕訳は記帳しない', async () => {
    const { store, id } = await readyStore()
    const unbalanced = await store.getState().addEntry({
      description: '売上',
      debits: [{ accountId: id('現金預金'), amount: 1000 }],
      credits: [{ accountId: id('売上高'), amount: 900 }],
    })
    expect(unbalanced).toMatchObject({
      ok: false,
      message: expect.stringContaining('一致していません'),
    })
    const noDescription = await store.getState().addEntry({
      description: '  ',
      debits: [{ accountId: id('現金預金'), amount: 1 }],
      credits: [{ accountId: id('売上高'), amount: 1 }],
    })
    expect(noDescription.ok).toBe(false)
    expect(store.getState().entries).toEqual([])
  })

  it('取消・削除・元に戻す', async () => {
    const { store, id } = await readyStore()
    await store.getState().addEntry({
      description: '売上',
      debits: [{ accountId: id('現金預金'), amount: 500 }],
      credits: [{ accountId: id('売上高'), amount: 500 }],
    })
    const original = store.getState().entries[0]!
    await store.getState().reverseEntry(original.id)
    const reversal = store.getState().entries[1]!
    expect(reversal).toMatchObject({
      kind: 'reversal',
      description: '取消：売上',
      debits: original.credits,
      credits: original.debits,
    })
    const { incomeStatement } = buildStatements(store.getState().accounts, store.getState().entries)
    expect(incomeStatement.sales).toBe(0)

    await store.getState().deleteEntry(reversal.id)
    expect(store.getState().entries).toHaveLength(1)
    await store.getState().restoreEntry(reversal)
    expect(store.getState().entries).toHaveLength(2)
  })

  it('決算振替で収益・費用を利益剰余金へ振り替える', async () => {
    const { store, id } = await readyStore()
    await store.getState().addEntry({
      description: '売上',
      debits: [{ accountId: id('現金預金'), amount: 800 }],
      credits: [{ accountId: id('売上高'), amount: 800 }],
    })
    await store.getState().addEntry({
      description: '給料',
      debits: [{ accountId: id('給料'), amount: 300 }],
      credits: [{ accountId: id('現金預金'), amount: 300 }],
    })
    expect(await store.getState().closeBooks()).toEqual({ ok: true })
    const { balanceSheet, incomeStatement, isBalanced } = buildStatements(
      store.getState().accounts,
      store.getState().entries,
    )
    expect(incomeStatementProfits(incomeStatement).netIncome).toBe(0)
    expect(balanceSheet.retainedEarnings).toBe(500)
    expect(isBalanced).toBe(true)
    // 振り替える残高がなければ失敗する
    expect((await store.getState().closeBooks()).ok).toBe(false)
  })
})

describe('フリーモードの同期と保存', () => {
  it('一方のウィンドウで記帳すると、もう一方にも届く', async () => {
    const repository = createMemoryLedgerRepository()
    const hub = createMemorySyncHub()
    const input = createLedgerStore(repository, hub.connect())
    const view = createLedgerStore(repository, hub.connect())
    await input.getState().load()
    await view.getState().load()

    await input.getState().startWithStarterAccounts()
    await vi.waitFor(() => expect(view.getState().accounts.length).toBeGreaterThan(0))
    const id = (name: string) => input.getState().accounts.find((a) => a.name === name)!.id
    await input.getState().addEntry({
      description: '出資',
      debits: [{ accountId: id('現金預金'), amount: 1000 }],
      credits: [{ accountId: id('資本金'), amount: 1000 }],
    })
    await vi.waitFor(() => expect(view.getState().entries).toHaveLength(1))
    expect(
      buildStatements(view.getState().accounts, view.getState().entries).balanceSheet
        .cashAndDeposits,
    ).toBe(1000)
  })

  it('IndexedDB に保存し、開き直しても残る', async () => {
    const name = `ledger-test-${crypto.randomUUID()}`
    const store = createLedgerStore(createIndexedDbLedgerRepository(name))
    await store.getState().load()
    await store.getState().startWithStarterAccounts()
    const reopened = createLedgerStore(createIndexedDbLedgerRepository(name))
    await reopened.getState().load()
    expect(reopened.getState().accounts.map((a) => a.name)).toEqual(
      store.getState().accounts.map((a) => a.name),
    )
  })

  it('リセットするとすべて消える', async () => {
    const { store } = await readyStore()
    await store.getState().reset()
    expect(store.getState()).toMatchObject({ accounts: [], entries: [] })
  })
})
