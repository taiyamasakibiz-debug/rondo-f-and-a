import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { useLedgerStore } from './ledger/store'
import { useProgressStore } from './progress/store'
import './index.css'

// 解答記録・設定と、フリーモードの仕訳を読み込む（読み込み中も画面は表示する）
void useProgressStore.getState().load()
void useLedgerStore.getState().load()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
