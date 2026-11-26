// Главное меню (лобби): профиль, создание комнаты, вход по коду, список комнат.
import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../shared/constants';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import ProfileCard from './ProfileCard';
import RoomList from './RoomList';

export default function Menu() {
  const pushToast = useGameStore((s) => s.pushToast);
  const [max, setMax] = useState(10);
  const [isPublic, setPublic] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e) { pushToast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-5 text-center">
        <h1 className="hero-title text-5xl font-bold sm:text-6xl">МУР-ФИЯ</h1>
        <p className="font-extrabold text-paw-700">Кошачьи Разборки в городе Мурград</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <ProfileCard />
          <div className="card space-y-3">
            <h3 className="text-lg font-black">🚪 Войти по коду</h3>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => api.joinRoom(code)); }}>
              <input
                className="input text-center text-xl uppercase tracking-[0.3em]"
                value={code}
                maxLength={5}
                placeholder="КОД"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button className="btn-primary" disabled={busy || code.length < 5}>Войти</button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="text-lg font-black">✨ Создать комнату</h3>
            <label className="block text-sm font-extrabold">
              Мест за столом: <span className="text-xl font-black">{max}</span>
              <input
                type="range" min={MIN_PLAYERS} max={MAX_PLAYERS} value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                className="mt-1 w-full accent-paw-600"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} className="h-5 w-5 accent-paw-600" />
              Показывать в списке открытых комнат
            </label>
            <button className="btn-primary w-full" disabled={busy} onClick={() => run(() => api.createRoom(max, isPublic))}>
              🐈 Создать комнату
            </button>
            <p className="text-xs font-bold opacity-70">
              Не хватает котов? ИИ-коты займут свободные места: игра начинается от {MIN_PLAYERS} игроков.
            </p>
          </div>
          <RoomList />
        </div>
      </div>
    </div>
  );
}
