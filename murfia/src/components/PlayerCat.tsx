// Кот за столом: аватар, имя, значки, «лапки» голосов над головой и «мяу»-пузырь.
import { AnimatePresence, motion } from 'framer-motion';
import { ROLE_META } from '../../shared/constants';
import type { PublicPlayer } from '../../shared/types';
import { cn } from '../lib/cn';
import Avatar from './Avatar';

interface Props {
  player: PublicPlayer;
  isMe: boolean;
  isMate?: boolean;
  isLover?: boolean;
  selectable?: boolean;
  selected?: boolean;
  myVote?: boolean;
  bubble?: string;
  votedForName?: string | null;
  onClick?: () => void;
}

const MAX_PAWS = 6;

export default function PlayerCat({
  player, isMe, isMate, isLover, selectable, selected, myVote, bubble, votedForName, onClick,
}: Props) {
  const paws = Math.min(player.votes, MAX_PAWS);
  const role = player.role ? ROLE_META[player.role] : null;

  return (
    <motion.button
      type="button"
      layout
      disabled={!selectable}
      onClick={onClick}
      whileHover={selectable ? { y: -5, scale: 1.04 } : undefined}
      whileTap={selectable ? { scale: 0.96 } : undefined}
      className={cn(
        'relative flex min-h-[8.5rem] w-full flex-col items-center rounded-3xl px-2 pb-2 pt-7 text-center ring-2 transition-colors',
        'bg-gradient-to-b from-cream-200/90 to-cream-300/60 shadow-card dark:from-night-700/80 dark:to-night-800/80 dark:shadow-none',
        !(selectable || selected || myVote) && 'ring-gold/50 dark:ring-gold/30',
        selectable && 'ring-paw/80 hover:bg-paw/20 dark:ring-moon/60 dark:hover:bg-night-600',
        selected && 'bg-paw/40 ring-4 ring-paw dark:bg-night-600 dark:ring-moon',
        myVote && 'ring-4 ring-red-500',
        isMe && 'outline outline-2 outline-offset-2 outline-paw-600 dark:outline-moon',
        !player.alive && 'opacity-60',
      )}
      aria-label={player.name}
    >
      {/* Лапки над головой = голоса против */}
      <div className="pointer-events-none absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5">
        <AnimatePresence>
          {Array.from({ length: paws }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, y: -18, rotate: -40 }}
              animate={{ scale: 1, y: 0, rotate: (i % 2 ? 1 : -1) * 12 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="text-xl drop-shadow"
            >
              🐾
            </motion.span>
          ))}
        </AnimatePresence>
        {player.votes > MAX_PAWS && <span className="chip">+{player.votes - MAX_PAWS}</span>}
      </div>

      {/* Пузырь с репликой */}
      <AnimatePresence>
        {bubble && player.alive && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-9 left-1/2 z-10 max-w-[10rem] -translate-x-1/2 truncate rounded-2xl bg-white px-3 py-1 text-xs font-extrabold text-ink shadow-lg ring-1 ring-ink/10"
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('leading-none', player.alive && 'animate-float')}>
        <Avatar id={player.avatar} size={76} dead={!player.alive} className="ring-4" />
      </div>
      {!player.alive && <div className="absolute right-2 top-5 text-2xl">💀</div>}

      <div className="mt-1.5 flex max-w-full items-center gap-1 text-sm font-extrabold">
        <span className="truncate">{player.name}</span>
        {isMe && <span className="chip !px-1.5">ты</span>}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
        {player.isHost && <span title="Хозяин комнаты" className="text-sm">👑</span>}
        {player.isBot && <span title="ИИ-кот" className="text-sm">🤖</span>}
        {!player.connected && <span title="Нет связи" className="text-sm">📡</span>}
        {isMate && <span title="Сообщник" className="text-sm">🐈‍⬛</span>}
        {isLover && <span title="Возлюбленный" className="text-sm">💘</span>}
        {role && (
          <span className="chip">
            {role.emoji} {role.name}
          </span>
        )}
      </div>

      {votedForName !== undefined && (
        <div className="mt-1 truncate text-[11px] font-bold opacity-70">
          {votedForName === null ? '🙅 воздержался' : `→ ${votedForName}`}
        </div>
      )}
    </motion.button>
  );
}
