// Итоги партии: победитель, раскрытые роли, кнопки «ещё раз» / «в меню».
import { motion } from 'framer-motion';
import { ROLE_META, TEAM_META } from '../../shared/constants';
import type { GameView } from '../../shared/types';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import Avatar from './Avatar';
import { useGameStore } from '../store/gameStore';
import ChatBox from './ChatBox';

export default function Results({ view }: { view: GameView }) {
  const pushToast = useGameStore((s) => s.pushToast);
  const setView = useGameStore((s) => s.setView);
  const profile = useGameStore((s) => s.profile);
  const winner = view.winner ?? 'draw';
  const iWon = view.winners.includes(view.me.id);
  const isHost = view.hostId === view.me.id;

  const menu = () => { api.leaveRoom(); setView(null); };
  const again = async () => {
    try { await api.rematch(); } catch (e) { pushToast((e as Error).message, 'error'); }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 12 }}
        className="card mb-4 text-center"
      >
        <div className="text-8xl">{TEAM_META[winner].emoji}</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          {winner === 'draw' ? 'Ничья, мяу!' : `Победили: ${TEAM_META[winner].name}`}
        </h1>
        <p className="mt-1 text-lg font-extrabold">
          {winner === 'draw' ? '🙀 В Мурграде никого не осталось' : iWon ? '🏆 Ты победил! Мур-мур-мур!' : '😿 В этот раз не повезло. Ничего, у кота девять жизней'}
        </p>
        {profile && <p className="mt-1 text-sm font-bold opacity-70">Твоя статистика: {profile.wins} побед из {profile.games} игр</p>}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card">
          <h3 className="mb-2 font-black">🎭 Кто был кем</h3>
          <ul className="space-y-2">
            {view.players.map((p, i) => {
              const r = p.role ? ROLE_META[p.role] : null;
              const won = view.winners.includes(p.id);
              return (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={cn('flex items-center gap-3 rounded-2xl p-2.5', won ? 'bg-paw/35' : 'bg-ink/5 dark:bg-white/10')}
                >
                  <Avatar id={p.avatar} size={52} dead={!p.alive} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black">
                      {p.name} {p.id === view.me.id && '(ты)'} {p.isBot && '🤖'} {!p.alive && '💀'}
                    </div>
                    <div className="text-sm font-bold opacity-80">{r ? `${r.emoji} ${r.name}` : '—'}</div>
                  </div>
                  {won && <span className="text-2xl">🏆</span>}
                </motion.li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {isHost ? (
              <button className="btn-primary flex-1" onClick={again}>🔁 Сыграть ещё</button>
            ) : (
              <div className="flex-1 rounded-2xl bg-ink/5 p-3 text-center text-sm font-extrabold dark:bg-white/10">Хозяин комнаты может начать новую партию</div>
            )}
            <button className="btn-ghost" onClick={menu}>🏠 В меню</button>
          </div>
        </div>
        <ChatBox className="h-96" />
      </div>
    </div>
  );
}
