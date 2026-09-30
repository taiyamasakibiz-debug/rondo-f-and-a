import { createBrowserRouter } from 'react-router'
import { DailyPage } from '@/features/daily/DailyPage'
import { FreePage, FreePanelPage } from '@/features/free/FreePage'
import { HomePage } from '@/features/home/HomePage'
import { LabPage } from '@/features/labs/LabPage'
import { LabsPage } from '@/features/labs/LabsPage'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { PracticePage } from '@/features/practice/PracticePage'
import { RecordsPage } from '@/features/records/RecordsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AppLayout } from './AppLayout'

export const routes = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'daily', element: <DailyPage /> },
      { path: 'free', element: <FreePage /> },
      { path: 'free/:panel', element: <FreePanelPage /> },
      { path: 'labs', element: <LabsPage /> },
      { path: 'labs/:labId', element: <LabPage /> },
      { path: 'labs/:labId/practice', element: <PracticePage /> },
      { path: 'records', element: <RecordsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
