import { useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { useDocumentTitle } from '@/components/useDocumentTitle'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { useLedgerStore } from '@/ledger/store'
import { AccountsPanel } from './AccountsPanel'
import { BalanceSheetPanel } from './BalanceSheetPanel'
import { CashFlowPanel } from './CashFlowPanel'
import { IncomeStatementPanel } from './IncomeStatementPanel'
import { JournalPanel } from './JournalPanel'
import { PANELS, type PanelId, useIsWindowMode } from './panels'

const PANEL_COMPONENTS: Record<PanelId, () => React.JSX.Element> = {
  journal: JournalPanel,
  bs: BalanceSheetPanel,
  pl: IncomeStatementPanel,
  cf: CashFlowPanel,
  accounts: AccountsPanel,
}

function LedgerStatus({ children }: { children: React.ReactNode }) {
  const status = useLedgerStore((state) => state.status)
  if (status === 'loading') return null
  if (status === 'error') {
    return (
      <p role="alert" className="text-body-sm text-ink-body">
        フリーモードのデータを読み込めませんでした。ブラウザの設定で、このサイトのデータ保存が許可されているか確認してください。
      </p>
    )
  }
  return <>{children}</>
}

/** フリーモードのダッシュボード。各パネルは別ウィンドウでも開ける */
export function FreePage() {
  return (
    <>
      <PageHeader
        title="Free Mode"
        subtitle="仕訳ラボ・フリーモード"
        description="仕訳を記帳すると、B/S・P/L・キャッシュフローがその場で組み上がります。パネルは別ウィンドウでも開けます。"
      />
      <LedgerStatus>
        {/* 左に入力（仕訳・科目）、右に結果（B/S・P/L・CF）。列ごとに上から詰めて、すき間を作らない */}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            <JournalPanel />
            <AccountsPanel />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <BalanceSheetPanel />
            <IncomeStatementPanel />
            <CashFlowPanel />
          </div>
        </div>
      </LedgerStatus>
    </>
  )
}

/** 1 つのパネルだけを開くページ（別ウィンドウ用） */
export function FreePanelPage() {
  const { panel } = useParams()
  const windowMode = useIsWindowMode()
  if (!panel || !(panel in PANELS)) return <NotFoundPage />
  const Component = PANEL_COMPONENTS[panel as PanelId]
  return (
    <>
      {windowMode ? (
        <WindowTitle panel={panel as PanelId} />
      ) : (
        <PageHeader title="Free Mode" subtitle="仕訳ラボ・フリーモード" />
      )}
      <LedgerStatus>
        <Component />
      </LedgerStatus>
    </>
  )
}

/** 別ウィンドウでは大きな見出しを出さないが、読み上げとタブのタイトル用に見出しを持つ */
function WindowTitle({ panel }: { panel: PanelId }) {
  useDocumentTitle(PANELS[panel].ja)
  return <h1 className="sr-only">フリーモード・{PANELS[panel].ja}</h1>
}
