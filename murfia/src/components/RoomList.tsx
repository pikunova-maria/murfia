// Список открытых комнат
import { useState } from 'react';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import Avatar from './Avatar';

export default function RoomList() {
  const rooms = useGameStore((s) => s.rooms);
  const setRooms = useGameStore((s) => s.setRooms);
  const pushToast = useGameStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setRooms((await api.listRooms()).rooms); } catch (e) { pushToast((e as Error).message, 'error'); }
  };
  const join = async (code: string) => {
    setBusy(true);
    try { await api.joinRoom(code); } catch (e) { pushToast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black">🏠 Открытые комнаты</h3>
        <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={refresh}>🔄</button>
      </div>
      {rooms.length === 0 ? (
        <p className="py-6 text-center font-bold opacity-70">Пока никого нет. Создай свою комнату — и позови друзей 😺</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((r) => (
            <li key={r.code} className="flex items-center gap-3 rounded-2xl bg-ink/5 p-3 dark:bg-white/10">
              <Avatar id={r.hostAvatar} size={46} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-black">Комната {r.hostName}</div>
                <div className="text-xs font-bold opacity-70">код {r.code} · {r.players}/{r.maxPlayers} котов</div>
              </div>
              <button className="btn-primary !py-1.5" disabled={busy} onClick={() => join(r.code)}>Войти</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
