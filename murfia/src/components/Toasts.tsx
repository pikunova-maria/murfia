import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { useGameStore } from '../store/gameStore';

/** Всплывающие подсказки и «мяу»-уведомления */
export default function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'max-w-md rounded-2xl px-4 py-2.5 text-sm font-extrabold shadow-xl',
              t.tone === 'error' && 'bg-red-500 text-white',
              t.tone === 'good' && 'bg-emerald-500 text-white',
              t.tone === 'info' && 'bg-ink text-cream',
            )}
            role="status"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
