import { useSearchParams } from 'react-router'

export type PanelId = 'journal' | 'bs' | 'pl' | 'cf' | 'accounts'

export const PANELS: Record<PanelId, { en: string; ja: string }> = {
  journal: { en: 'Journal', ja: '仕訳の入力と仕訳帳' },
  bs: { en: 'Balance Sheet', ja: '貸借対照表' },
  pl: { en: 'Income Statement', ja: '損益計算書' },
  cf: { en: 'Cash Flow', ja: 'キャッシュフロー' },
  accounts: { en: 'Accounts', ja: '科目マスター' },
}

/** 別ウィンドウで開いているか（?window=1）。別ウィンドウではナビを省く */
export function useIsWindowMode(): boolean {
  const [searchParams] = useSearchParams()
  return searchParams.get('window') === '1'
}

export function openPanelWindow(panel: PanelId) {
  window.open(`/free/${panel}?window=1`, `luminous-free-${panel}`, 'popup,width=760,height=900')
}
