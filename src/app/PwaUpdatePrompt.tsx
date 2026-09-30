import { AnimatePresence, motion } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

// v1 は Service Worker のキャッシュが古いまま残りやすかったため、
// 新しい版が届いたら知らせて、ユーザーの操作で切り替える
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-lg md:bottom-6"
        >
          <p className="text-sm">新しいバージョンがあります</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
              あとで
            </Button>
            <Button size="sm" onClick={() => updateServiceWorker(true)}>
              更新する
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
