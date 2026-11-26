// Комната ожидания: код, игроки, добавление ботов, старт.
import { useState } from 'react';
import { MIN_PLAYERS, ROLE_META, buildRoleList } from '../../shared/constants';
import type { GameView, Role } from '../../shared/types';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import ChatBox from './ChatBox';
import PlayerCat from './PlayerCat';

export default function RoomLobby({ view }: { view: GameView }) {
  const pushToast = useGameStore((s) => s.pushToast);
  const setView = useGameStore((s) => s.setView);
  const [busy, setBusy] = useState(false);
  const isHost = view.hostId === view.me.id;
  const count = Math.max(view.players.length, MIN_PLAYERS);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e) { pushToast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.code);
      pushToast('Код скопирован 🐾', 'good');
    } catch {
      pushToast(`Код комнаты: ${view.code}`);
    }
  };
  const leave = () => { api.leaveRoom(); setView(null); };

  // Состав ролей для текущего числа игроков
  const composition = buildRoleList(count).reduce<Record<string, number>>((m, r) => ({ ...m, [r]: (m[r] || 0) + 1 }), {});

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">🐾 Комната ожидания</h1>
          <p className="text-sm font-bold opacity-70">{view.isPublic ? 'Открытая' : 'Закрытая'} · {view.players.length}/{view.maxPlayers} котов</p>
        </div>
        <button onClick={copy} className="card !rounded-2xl !p-3 text-center transition hover:scale-105" title="Скопировать код">
          <div className="text-xs font-extrabold opacity-70">КОД КОМНАТЫ</div>
          <div className="text-3xl font-black tracking-[0.3em]">{view.code}</div>
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 pt-3 sm:grid-cols-3 xl:grid-cols-4">
              {view.players.map((p) => (
                <div key={p.id} className="relative">
                  <PlayerCat player={p} isMe={p.id === view.me.id} />
                  {isHost && p.isBot && (
                    <button
                      className="absolute right-1 top-1 z-10 rounded-full bg-red-500 px-2 text-xs font-black text-white"
                      onClick={() => run(() => api.kickBot(p.id))}
                      title="Выгнать бота"
                    >
                      ✖
                    </button>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, view.maxPlayers - view.players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex min-h-[8.5rem] items-center justify-center rounded-3xl border-2 border-dashed border-ink/20 text-3xl opacity-40 dark:border-white/20">
                  🐾
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-black">🎭 Роли в партии на {count} котов</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(composition).map(([role, n]) => (
                <span key={role} className="chip !px-3 !py-1 text-sm" title={ROLE_META[role as Role].desc}>
                  {ROLE_META[role as Role].emoji} {ROLE_META[role as Role].name} × {n}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isHost ? (
              <>
                <button className="btn-primary flex-1 text-lg" disabled={busy} onClick={() => run(api.start)}>
                  🚀 Начать партию
                </button>
                <button className="btn-ghost" disabled={busy || view.players.length >= view.maxPlayers} onClick={() => run(api.addBot)}>
                  🤖 + ИИ-кот
                </button>
              </>
            ) : (
              <div className="card flex-1 text-center font-extrabold">⏳ Ждём, пока хозяин начнёт партию…</div>
            )}
            <button className="btn-ghost" onClick={leave}>🚪 Выйти</button>
          </div>
          {isHost && view.players.length < MIN_PLAYERS && (
            <p className="text-sm font-bold opacity-70">
              Нужно минимум {MIN_PLAYERS} игроков: недостающих заменят ИИ-коты.
            </p>
          )}
        </div>

        <ChatBox className="h-[28rem]" />
      </div>
    </div>
  );
}
