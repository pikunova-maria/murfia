// Панель дня: кнопка «к голосованию» и сам вызов голосования.
import { useState } from 'react';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { useGameStore } from '../store/gameStore';
import type { GameView } from '../../shared/types';
import Avatar from './Avatar';

export default function VotePanel({ view }: { view: GameView }) {
  const pushToast = useGameStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const { me } = view;
  const alive = view.players.filter((p) => p.alive);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e) { pushToast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  if (view.phase === 'day') {
    return (
      <div className="card">
        <h3 className="font-black">☀️ Обсуждение</h3>
        <p className="mt-1 text-sm font-semibold opacity-80">
          Мяукайте в чате, делитесь подозрениями. Когда большинство людей согласны, голосование начнётся досрочно.
        </p>
        {me.alive && (
          <button className="btn-primary mt-3 w-full" disabled={busy || me.skippedDay} onClick={() => run(api.skipDay)}>
            {me.skippedDay ? '✅ Ты готов голосовать' : '⏭️ Готов к голосованию'}
          </button>
        )}
      </div>
    );
  }

  // фаза голосования
  const others = alive.filter((p) => p.id !== me.id);
  return (
    <div className="card">
      <h3 className="font-black">🐾 Суд лап</h3>
      {!me.alive ? (
        <p className="mt-1 text-sm font-semibold opacity-80">Призраки не голосуют, но видят всё 👻</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold opacity-80">
            Выбери кота, которого изгнать. Голос можно менять до конца таймера.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {others.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => run(() => api.vote(p.id))}
                className={cn(
                  'btn-ghost !justify-between !px-3 !py-2 text-sm',
                  me.myVote === p.id && '!bg-red-500 !text-white',
                )}
              >
                <span className="flex min-w-0 items-center gap-2"><Avatar id={p.avatar} size={30} /><span className="truncate">{p.name}</span></span>
                <span>{'🐾'.repeat(Math.min(p.votes, 4))}</span>
              </button>
            ))}
          </div>
          <button
            className={cn('btn-ghost mt-2 w-full', me.myVote === null && '!bg-paw !text-ink')}
            disabled={busy}
            onClick={() => run(() => api.vote(null))}
          >
            🙅 Воздержаться
          </button>
        </>
      )}
    </div>
  );
}
