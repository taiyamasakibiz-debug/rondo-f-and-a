import { useMemo } from 'react'
import { buildStatements } from '@/domain/accounting/ledger'
import { cashFlowByActivity } from '@/domain/cashflow/byActivity'
import { indirectCashFlowFromLedger } from '@/domain/cashflow/indirectFromLedger'
import { balanceSheetTotals, incomeStatementProfits } from '@/domain/statements'
import { useLedgerStore } from '@/ledger/store'

/** フリーモードの仕訳から作った B/S・P/L・CF。仕訳か科目が変わったときだけ計算し直す */
export function useFreeStatements() {
  const accounts = useLedgerStore((state) => state.accounts)
  const entries = useLedgerStore((state) => state.entries)
  return useMemo(() => {
    const statements = buildStatements(accounts, entries)
    return {
      ...statements,
      totals: balanceSheetTotals(statements.balanceSheet),
      profits: incomeStatementProfits(statements.incomeStatement),
      cashFlow: cashFlowByActivity(accounts, entries),
      indirectCashFlow: indirectCashFlowFromLedger(accounts, entries),
    }
  }, [accounts, entries])
}
