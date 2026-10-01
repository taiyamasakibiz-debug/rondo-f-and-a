import { type RouteObject, createBrowserRouter } from 'react-router'
import { DailyPage } from '@/features/daily/DailyPage'
import { HomePage } from '@/features/home/HomePage'
import { LabPage } from '@/features/labs/LabPage'
import { LabsPage } from '@/features/labs/LabsPage'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { AppLayout } from './AppLayout'

/**
 * ホーム・デイリー・ラボは最初に表示するのでまとめて読み込み、
 * 問題・記録・設定・フリーモードは開いたときに読み込む（最初に読み込む量を減らすため）。
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    // 分割した画面を直接開いたとき、読み込み終わるまでの間に出す（背景色だけ）
    hydrateFallbackElement: <div className="min-h-dvh bg-background" />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'daily', element: <DailyPage /> },
      {
        path: 'free',
        lazy: () => import('@/features/free/FreePage').then((m) => ({ Component: m.FreePage })),
      },
      {
        path: 'free/:panel',
        lazy: () =>
          import('@/features/free/FreePage').then((m) => ({ Component: m.FreePanelPage })),
      },
      { path: 'labs', element: <LabsPage /> },
      { path: 'labs/:labId', element: <LabPage /> },
      {
        path: 'labs/:labId/practice',
        lazy: () =>
          import('@/features/practice/PracticePage').then((m) => ({ Component: m.PracticePage })),
      },
      {
        path: 'exam/:tier',
        lazy: () => import('@/features/exam/ExamPage').then((m) => ({ Component: m.ExamPage })),
      },
      {
        path: 'records',
        lazy: () =>
          import('@/features/records/RecordsPage').then((m) => ({ Component: m.RecordsPage })),
      },
      {
        path: 'settings',
        lazy: () =>
          import('@/features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
