// Игровой экран: стол, моя роль, ночные действия/голосование и чат.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import type { GameView } from '../../shared/types';
import ChatBox from './ChatBox';
import GameTable from './GameTable';
import NightActionPanel from './NightActionPanel';
import RoleCard from './RoleCard';
import Timer from './Timer';
import VotePanel from './VotePanel';

export default function Game({ view }: { view: GameView }) {
  const pushToast = useGameStore((s) => s.pushToast);
  const setView = useGameStore((s) => s.setView);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const [picked, setPicked] = useState<string[]>([]);
  const { me, phase } = view;

  // Выбор сбрасывается при смене шага/фазы
  useEffect(() => { setPicked([]); }, [phase, view.step, view.night]);

  const isAlive = (id: string) => view.players.find((p) => p.id === id)?.alive ?? false;
  const isSelectable = (id: string) =>
    (phase === 'vote' && me.alive && id !== me.id && isAlive(id)) ||
    (phase === 'night' && me.canAct && me.targets.includes(id));

  const onCat = (id: string) => {
    if (!isSelectable(id)) return;
    if (phase === 'vote') {
      api.vote(id).catch((e: Error) => pushToast(e.message, 'error'));
      return;
    }
    const need = me.actionKind === 'pick2' ? 2 : 1;
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      return need === 1 ? [id] : [...cur, id].slice(-need);
    });
  };

  const leave = () => {
    if (!window.confirm('Выйти из партии? Твоё место займёт ИИ-кот.')) return;
    api.leaveRoom();
    setView(null);
  };

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-black opacity-80">🐾 МУР-ФИЯ · комната {view.code}</div>
        <div className="flex gap-2">
          <button className="btn-ghost !px-3 !py-1.5" onClick={toggleMute} aria-label="Звук" title="Звук">{muted ? '🔇' : '🔊'}</button>
          <button className="btn-ghost !px-3 !py-1.5" onClick={leave}>🚪</button>
        </div>
      </header>

      {phase === 'reveal' ? (
        <div className="card mx-auto max-w-lg !p-6 text-center">
          <h2 className="text-3xl font-black">🎴 Твоя роль</h2>
          <p className="mb-4 font-bold opacity-80">Запомни и никому не говори 🤫</p>
          <RoleCard view={view} variant="full" />
          <div className="mt-5 flex justify-center"><Timer /></div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <GameTable view={view} picked={picked} isSelectable={isSelectable} onCat={onCat} />
          <div className="flex min-h-0 flex-col gap-4">
            <RoleCard view={view} />
            {phase === 'night' && <NightActionPanel view={view} picked={picked} clear={() => setPicked([])} />}
            {(phase === 'day' || phase === 'vote') && <VotePanel view={view} />}
            <ChatBox className="h-80" />
          </div>
        </div>
      )}
    </div>
  );
}
