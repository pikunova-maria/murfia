// Карта роли игрока. full — крупная при раздаче, compact — в боковой панели.
import { motion } from 'framer-motion';
import { ROLE_META, TEAM_META } from '../../shared/constants';
import type { GameView } from '../../shared/types';
import { cn } from '../lib/cn';

const GOALS = {
  town: 'Изгнать всех Чёрных Котов и Маньяка.',
  mafia: 'Остаться в большинстве: Чёрных Котов должно стать не меньше остальных.',
  maniac: 'Остаться в Мурграде в одиночестве.',
} as const;

const TEAM_STYLE = {
  town: 'from-paw/60 to-cream-300 dark:from-night-600 dark:to-night-700',
  mafia: 'from-mafia/60 to-night-700 text-cream',
  maniac: 'from-red-400/70 to-night-800 text-cream',
} as const;

export default function RoleCard({ view, variant = 'compact' }: { view: GameView; variant?: 'full' | 'compact' }) {
  const { me } = view;
  if (!me.role || !me.team) return null;
  const meta = ROLE_META[me.role];
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '???';
  const full = variant === 'full';

  return (
    <motion.div
      initial={full ? { rotateY: 180, scale: 0.7, opacity: 0 } : { opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={cn(
        'rounded-4xl bg-gradient-to-br p-4 shadow-soft ring-2 ring-ink/10',
        TEAM_STYLE[me.team],
        full ? 'mx-auto w-full max-w-sm p-6 text-center' : 'flex items-center gap-3',
      )}
    >
      <div className={cn(full ? 'text-8xl' : 'text-5xl')}>{meta.emoji}</div>
      <div className={cn('min-w-0', full && 'mt-3')}>
        <div className="flex flex-wrap items-center gap-2 font-black">
          <span className={cn(full ? 'w-full text-3xl' : 'text-lg')}>{meta.name}</span>
          <span className="chip">{TEAM_META[me.team].emoji} {TEAM_META[me.team].name}</span>
          {!me.alive && <span className="chip">👻 призрак</span>}
        </div>
        <p className={cn('mt-1 font-semibold opacity-90', full ? 'text-base' : 'text-xs')}>{meta.desc}</p>
        {full && <p className="mt-2 text-sm font-extrabold">🎯 {GOALS[me.team]}</p>}
        {me.mates.length > 0 && (
          <p className="mt-1 text-xs font-extrabold">🐈‍⬛ Банда: {me.mates.map(name).join(', ')}</p>
        )}
        {me.lover && <p className="mt-1 text-xs font-extrabold">💘 Возлюбленный: {name(me.lover)}</p>}
        {me.investigations.length > 0 && (
          <div className="mt-1 text-xs font-bold">
            🔎 Проверки:{' '}
            {me.investigations.map((i) => `${name(i.id)} ${i.result === 'mafia' ? '🙀' : '😻'}`).join(' · ')}
          </div>
        )}
      </div>
    </motion.div>
  );
}
