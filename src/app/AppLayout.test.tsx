import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/engine/generate'
import { findTemplate } from '@/problems'
import { liveAttempts } from '@/progress/types'
import { routes } from './router'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

/** 画面は分割して読み込むので、最初の画面の読み込みが終わるのを待ってから表示する */
async function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  await vi.waitFor(() => expect(router.state.initialized).toBe(true))
  render(<RouterProvider router={router} />)
}

describe('ルーティング', () => {
  it('ホームにラボの一覧が出る', async () => {
    await renderAt('/')
    expect(screen.getByRole('heading', { name: /Labs/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CVP ラボ/ })).toBeInTheDocument()
  })

  it('ラボのカードから各ラボに移動できる', async () => {
    await renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: /投資ラボ/ }))
    expect(await screen.findByRole('heading', { name: /投資ラボ/ })).toBeInTheDocument()
  })

  it('存在しないラボは「見つかりません」になる', async () => {
    await renderAt('/labs/unknown')
    expect(screen.getByRole('heading', { name: /ページが見つかりません/ })).toBeInTheDocument()
  })
})

describe('問題を解く', () => {
  it('CVP ラボで問題を解いて採点できる', async () => {
    await renderAt('/labs/cvp/practice?template=cvp.break-even.basic&seed=1')
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(3)
    await userEvent.type(inputs[0]!, '1')
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))

    expect(await screen.findByRole('status')).toHaveTextContent(/INCORRECT|CORRECT/)
    // 未回答のステップには正解が表示される
    expect(screen.getAllByText(/正解は/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /解説/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /次の問題/ })).toBeInTheDocument()
  })

  it('仕訳を入力して採点できる（行の順番は問わない）', async () => {
    const template = findTemplate('journal.credit-sale')!
    const { params } = generateProblem(template, 42)
    const cash = (params.sales! * params.cashPercent!) / 100
    await renderAt('/labs/journal/practice?template=journal.credit-sale&seed=42')

    // 借方に 2 行（売掛金を先、現金を後）、貸方に 1 行
    await userEvent.click(screen.getByRole('button', { name: '借方に行を追加' }))
    await userEvent.selectOptions(screen.getByLabelText('借方 1 行目の科目'), '売掛金')
    await userEvent.type(screen.getByLabelText('借方 1 行目の金額'), String(params.sales! - cash))
    await userEvent.selectOptions(screen.getByLabelText('借方 2 行目の科目'), '現金')
    await userEvent.type(screen.getByLabelText('借方 2 行目の金額'), String(cash))
    await userEvent.selectOptions(screen.getByLabelText('貸方 1 行目の科目'), '売上')
    await userEvent.type(screen.getByLabelText('貸方 1 行目の金額'), String(params.sales!))
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('全問正解')
  })
})

describe('記録', () => {
  it('問題を解くと記録ページとホームに反映される', async () => {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().resetAll()

    await renderAt('/labs/cvp/practice?template=cvp.break-even.basic&seed=1')
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))
    expect(await screen.findByText(/\+\d+ XP/)).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(liveAttempts(useProgressStore.getState().attempts)).toHaveLength(1),
    )

    cleanup()
    await renderAt('/records')
    expect(screen.getByRole('link', { name: /損益分岐点売上高と安全余裕率/ })).toBeInTheDocument()
    expect(screen.getByText(/1 問/)).toBeInTheDocument()

    cleanup()
    await renderAt('/')
    expect(screen.getByText('TODAY').nextElementSibling).toHaveTextContent('1問（ノルマ 3 問）')
  })
})

describe('今日のデイリー', () => {
  it('ホームから始めて、3 問を順に解くと達成になる', async () => {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().load()
    await useProgressStore.getState().resetAll()
    await renderAt('/')

    const daily = screen.getByRole('heading', { level: 2, name: /Daily/ }).closest('section')!
    expect(within(daily).getAllByRole('listitem')).toHaveLength(3)

    await userEvent.click(screen.getByRole('link', { name: /はじめる/ }))
    for (const [index, nextLabel] of [
      [1, '次のデイリー'],
      [2, '次のデイリー'],
      [3, 'デイリーの結果へ'],
    ] as const) {
      expect(await screen.findByText(`DAILY ${index} / 3`)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /採点する/ }))
      await userEvent.click(await screen.findByRole('button', { name: new RegExp(nextLabel) }))
    }

    const done = await screen.findByRole('status')
    expect(done).toHaveTextContent('今日のデイリー達成')
    // 最後の問題から来たときだけ、達成の演出を出す
    expect(within(done).getByTestId('burst')).toBeInTheDocument()
    expect(liveAttempts(useProgressStore.getState().attempts)).toHaveLength(3)

    cleanup()
    await renderAt('/daily')
    const reopened = await screen.findByRole('status')
    expect(reopened).toHaveTextContent('今日のデイリー達成')
    expect(within(reopened).queryByTestId('burst')).not.toBeInTheDocument()
  })
})

describe('フリーモード', () => {
  it('標準の科目で始めて記帳すると、B/S に反映される。貸借が合わない仕訳は記帳しない', async () => {
    const { useLedgerStore } = await import('@/ledger/store')
    await useLedgerStore.getState().load()
    await useLedgerStore.getState().reset()
    await renderAt('/free')

    const journal = await screen.findByRole('region', { name: /Journal/ })
    await userEvent.click(within(journal).getByRole('button', { name: '標準の科目で始める' }))
    await userEvent.type(within(journal).getByLabelText('取引の説明'), '出資を受けた')
    await userEvent.selectOptions(within(journal).getByLabelText('借方 1 行目の科目'), '現金預金')
    await userEvent.type(within(journal).getByLabelText('借方 1 行目の金額'), '1000')
    await userEvent.selectOptions(within(journal).getByLabelText('貸方 1 行目の科目'), '資本金')
    await userEvent.type(within(journal).getByLabelText('貸方 1 行目の金額'), '900')
    await userEvent.click(within(journal).getByRole('button', { name: '記帳する' }))
    expect(await within(journal).findByRole('alert')).toHaveTextContent('一致していません')
    expect(useLedgerStore.getState().entries).toHaveLength(0)

    await userEvent.clear(within(journal).getByLabelText('貸方 1 行目の金額'))
    await userEvent.type(within(journal).getByLabelText('貸方 1 行目の金額'), '1000')
    await userEvent.click(within(journal).getByRole('button', { name: '記帳する' }))
    expect(await within(journal).findByText('記帳しました。')).toBeInTheDocument()

    const bs = screen.getByRole('region', { name: /Balance Sheet/ })
    await vi.waitFor(() => expect(within(bs).getAllByLabelText('1,000').length).toBeGreaterThan(0))
    // 記帳したら入力欄は空に戻る
    expect(within(journal).getByLabelText('取引の説明')).toHaveValue('')
  })

  it('別ウィンドウ用のページは、ナビを省いてパネルだけを出す', async () => {
    await renderAt('/free/bs?window=1')
    expect(await screen.findByRole('region', { name: /Balance Sheet/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'メインナビゲーション' }),
    ).not.toBeInTheDocument()
  })
})

describe('認定テスト', () => {
  async function withCvpLevel2() {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().load()
    const at = new Date().toISOString()
    // 全問正解 2 回（30 XP）で Lv.2
    const practice = [1, 2].map((seed) => ({
      id: `practice-${seed}`,
      templateId: 'cvp.break-even.basic',
      topic: 'cvp' as const,
      seed,
      earned: 5,
      total: 5,
      allCorrect: true,
      steps: [],
      durationMs: 1,
      answeredAt: at,
      createdAt: at,
      updatedAt: at,
    }))
    await useProgressStore.getState().replaceAll({
      attempts: practice,
      settings: useProgressStore.getState().settings,
    })
    return useProgressStore
  }

  it('レベルが足りない認定は受けられない', async () => {
    await withCvpLevel2()
    await renderAt('/labs/cvp/exam/silver')
    expect(await screen.findByText(/Lv\.4 から受けられます/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /テストを始める/ })).not.toBeInTheDocument()
  })

  it('5 問を解くと採点結果が出て、記録にテストの情報が残る', async () => {
    const store = await withCvpLevel2()
    await renderAt('/labs/cvp/exam/bronze')
    await userEvent.click(await screen.findByRole('button', { name: /テストを始める/ }))
    for (let i = 1; i <= 5; i += 1) {
      expect(await screen.findByText(`Q${i} / 5`)).toBeInTheDocument()
      await userEvent.click(
        screen.getByRole('button', { name: i === 5 ? /解答して採点する/ : /解答して次へ/ }),
      )
    }
    // 何も入力していないので不合格
    expect(await screen.findByRole('status')).toHaveTextContent('不合格')
    const examAttempts = store.getState().attempts.filter((a) => a.exam)
    expect(examAttempts).toHaveLength(5)
    expect(new Set(examAttempts.map((a) => a.exam!.id)).size).toBe(1)
  })
})

describe('正解とレベルアップの演出', () => {
  /** 仕訳ラボで全問正解 5 回（75 XP）。あと 5 XP で Lv.3 */
  async function withJournalXp75() {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().load()
    const at = new Date(Date.now() - 86_400_000 * 3).toISOString()
    const attempts = [1, 2, 3, 4, 5].map((seed) => ({
      id: `journal-${seed}`,
      templateId: 'journal.credit-sale',
      topic: 'journal' as const,
      seed,
      earned: 1,
      total: 1,
      allCorrect: true,
      steps: [],
      durationMs: 1,
      answeredAt: at,
      createdAt: at,
      updatedAt: at,
    }))
    await useProgressStore.getState().replaceAll({
      attempts,
      settings: useProgressStore.getState().settings,
    })
    return useProgressStore
  }

  async function solveCreditSale() {
    const { params } = generateProblem(findTemplate('journal.credit-sale')!, 42)
    const cash = (params.sales! * params.cashPercent!) / 100
    await renderAt('/labs/journal/practice?template=journal.credit-sale&seed=42')
    await userEvent.click(screen.getByRole('button', { name: '借方に行を追加' }))
    await userEvent.selectOptions(screen.getByLabelText('借方 1 行目の科目'), '売掛金')
    await userEvent.type(screen.getByLabelText('借方 1 行目の金額'), String(params.sales! - cash))
    await userEvent.selectOptions(screen.getByLabelText('借方 2 行目の科目'), '現金')
    await userEvent.type(screen.getByLabelText('借方 2 行目の金額'), String(cash))
    await userEvent.selectOptions(screen.getByLabelText('貸方 1 行目の科目'), '売上')
    await userEvent.type(screen.getByLabelText('貸方 1 行目の金額'), String(params.sales!))
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))
  }

  it('全問正解すると波紋が出て、経験値のバーが伸び、レベルが上がる', async () => {
    const store = await withJournalXp75()
    await solveCreditSale()

    const feedback = (await screen.findAllByRole('status'))[0]!
    expect(feedback).toHaveTextContent('全問正解')
    expect(within(feedback).getByTestId('burst')).toBeInTheDocument()
    expect(screen.getByText('+15 XP')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '次のレベルまでの経験値' })).toHaveAttribute(
      'aria-valuenow',
      String(Math.round((10 / 70) * 100)),
    )
    // バーが満タンになったところで、レベルアップのカードに切り替わる
    expect(await screen.findByText('LEVEL UP', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Lv.3')).toBeInTheDocument()
    await store.getState().resetAll()
  })

  it('間違えたときは波紋を出さず、レベルも上がらない', async () => {
    const store = await withJournalXp75()
    await renderAt('/labs/journal/practice?template=journal.credit-sale&seed=42')
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))
    const feedback = (await screen.findAllByRole('status'))[0]!
    expect(feedback).toHaveTextContent('INCORRECT')
    expect(within(feedback).queryByTestId('burst')).not.toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(screen.queryByText('LEVEL UP')).not.toBeInTheDocument()
    await store.getState().resetAll()
  })
})

describe('ストリークの演出', () => {
  it('この 1 問で今日のノルマを達成すると、ストリークが伸びた演出が出る', async () => {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().load()
    await useProgressStore.getState().resetAll()
    await useProgressStore.getState().updateSettings({ dailyGoal: 1 })

    await renderAt('/labs/cvp/practice?template=cvp.break-even.basic&seed=1')
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))
    expect(await screen.findByText('今日のノルマ達成')).toBeInTheDocument()
    await useProgressStore.getState().resetAll()
  })
})
