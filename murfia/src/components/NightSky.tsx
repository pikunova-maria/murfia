// Ночной фон: луна, мерцающие звёзды и коты, бредущие по крышам.
import { motion } from 'framer-motion';
import { useMemo } from 'react';

export default function NightSky() {
  const stars = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      id: i, left: Math.random() * 100, top: Math.random() * 70,
      size: 2 + Math.random() * 3, delay: Math.random() * 3,
    })),
    [],
  );
  const cats = [
    { emoji: '🐈‍⬛', y: 6, dur: 22, delay: 0 },
    { emoji: '🐈', y: 2, dur: 30, delay: 6 },
    { emoji: '😼', y: 10, dur: 26, delay: 12 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-night-950 via-night-900 to-night-800">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute animate-twinkle rounded-full bg-moon"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
        />
      ))}
      <div className="absolute right-[8%] top-[7%] h-24 w-24 rounded-full bg-moon shadow-glow">
        <div className="absolute left-5 top-6 h-5 w-5 rounded-full bg-amber-200/70" />
        <div className="absolute bottom-5 right-6 h-7 w-7 rounded-full bg-amber-200/60" />
      </div>
      {cats.map((c, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl"
          style={{ bottom: `${c.y}%` }}
          initial={{ x: '-12vw' }}
          animate={{ x: '112vw' }}
          transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }}
        >
          <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity }} className="inline-block">
            {c.emoji}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}
