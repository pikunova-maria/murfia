// Полноэкранные сцены: ночь/день, утренний рассказ ведущего, изгнание кота.
import { AnimatePresence, motion } from 'framer-motion';
import { ROLE_META } from '../../shared/constants';
import type { DeathInfo, GameEvent } from '../../shared/types';
import { useGameStore } from '../store/gameStore';
import Avatar from './Avatar';

const PHASE_SCENE: Record<string, { emoji: string; title: string }> = {
  night: { emoji: '🌙', title: 'Наступает ночь' },
  day: { emoji: '☀️', title: 'Дневное собрание' },
  vote: { emoji: '🐾', title: 'Суд лап' },
};

function Dead({ d }: { d: DeathInfo }) {
  const r = ROLE_META[d.role];
  return (
    <motion.div
      initial={{ y: 0, rotate: 0, opacity: 1 }}
      animate={{ y: [0, -14, 40], rotate: [0, -8, 20], opacity: [1, 1, 0.55] }}
      transition={{ duration: 1.6 }}
      className="flex flex-col items-center"
    >
      <Avatar id={d.avatar} size={112} dead className="ring-4" />
      <div className="mt-1 text-lg font-black">{d.name} 💀</div>
      <div className="chip">{r.emoji} {r.name}</div>
    </motion.div>
  );
}

function Scene({ event }: { event: GameEvent }) {
  if (event.kind === 'phase') {
    const s = PHASE_SCENE[event.phase];
    if (!s) return null;
    return (
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.2, rotate: -40, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 140, damping: 12 }}
          className="text-9xl drop-shadow-[0_0_30px_rgba(253,242,184,0.7)]"
        >
          {s.emoji}
        </motion.div>
        <div className="mt-3 text-3xl font-black">{s.title}</div>
        <p className="mx-auto mt-2 max-w-md text-base font-bold opacity-90">{event.text}</p>
      </div>
    );
  }

  if (event.kind === 'morning') {
    return (
      <div className="text-center">
        <div className="text-7xl">🌅</div>
        <h2 className="mt-2 text-3xl font-black">Утро в Мурграде</h2>
        {event.deaths.length === 0 ? (
          <motion.p initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="mt-4 text-xl font-extrabold">
            Этой ночью все живы 😻
          </motion.p>
        ) : (
          <div className="mt-5 flex flex-wrap items-end justify-center gap-6">
            {event.deaths.map((d) => <Dead key={d.id} d={d} />)}
          </div>
        )}
        {event.saved && (
          <p className="mt-4 text-base font-extrabold">🩺 Кого-то спас Кот-Доктор — нападение не удалось!</p>
        )}
      </div>
    );
  }

  if (event.kind === 'execution') {
    const p = event.player;
    if (!p) {
      return (
        <div className="text-center">
          <div className="text-8xl">🤷‍♂️</div>
          <h2 className="mt-3 text-3xl font-black">Никого не изгнали</h2>
          <p className="mt-2 font-bold opacity-90">Голоса разделились. Коты разбежались по крышам 🐾</p>
        </div>
      );
    }
    const r = ROLE_META[p.role];
    return (
      <div className="relative overflow-hidden text-center">
        <motion.div
          initial={{ x: 0, rotate: 0, opacity: 1 }}
          animate={{ x: [0, 0, 700], rotate: [0, -10, 40], opacity: [1, 1, 0] }}
          transition={{ duration: 3, times: [0, 0.35, 1] }}
          className="mx-auto w-fit"
        >
          <Avatar id={p.avatar} size={176} className="ring-8" />
        </motion.div>
        <h2 className="mt-3 text-3xl font-black">Кот {p.name} изгнан из Мурграда 🐾</h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-3 text-xl font-extrabold"
        >
          Им оказался {r.emoji} {r.name}
        </motion.p>
      </div>
    );
  }
  return null;
}

export default function EventOverlay() {
  const overlay = useGameStore((s) => s.overlay);
  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          key={overlay.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-night-950/75 p-6 text-cream backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-xl"
          >
            <Scene event={overlay.event} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
