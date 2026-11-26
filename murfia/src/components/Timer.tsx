import { useCountdown } from '../hooks/useCountdown';
import { useGameStore } from '../store/gameStore';

/** Обратный отсчёт фазы + полоска прогресса */
export default function Timer() {
  const endsAt = useGameStore((s) => s.view?.phaseEndsAt ?? null);
  const offset = useGameStore((s) => s.clockOffset);
  const total = useGameStore((s) => s.phaseTotal);
  const left = useCountdown(endsAt, offset);
  if (!endsAt) return null;
  const pct = total > 0 ? Math.min(100, Math.max(0, (left * 1000 * 100) / total)) : 0;
  return (
    <div className="min-w-[7rem]" aria-label={`Осталось ${left} секунд`}>
      <div className="text-right text-lg font-black tabular-nums">⏳ {left}с</div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15">
        <div className="h-full rounded-full bg-paw transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
