// Панель ночи: что делает моя роль и подтверждение выбора.
import { useState } from 'react';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import type { GameView } from '../../shared/types';

const PROMPT: Record<string, string> = {
  cupid: '💘 Выбери ДВУХ котов — их свяжет любовь. Один умрёт — второй не переживёт.',
  mafia: '🐈‍⬛ Выберите жертву. При ничьей решает Дон Кото. Выбор можно менять.',
  godfather: '😼 Выберите жертву. При ничьей решает твой голос.',
  maniac: '🧙 Выбери, чью миску опустошишь этой ночью.',
  doctor: '🩺 Выбери, кого лечить. Одного и того же две ночи подряд нельзя.',
  detective: '🕵️ Выбери кота для проверки. Дон Кото ты увидишь «мирным».',
};

interface Props {
  view: GameView;
  picked: string[];
  clear: () => void;
}

export default function NightActionPanel({ view, picked, clear }: Props) {
  const pushToast = useGameStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const { me } = view;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '???';
  const mafia = me.role === 'mafia' || me.role === 'godfather';

  if (!me.alive) {
    return <div className="card"><h3 className="font-black">👻 Ты призрак</h3><p className="mt-1 text-sm font-semibold opacity-80">Наблюдай за ночью и шепчись с другими призраками в чате.</p></div>;
  }

  if (!me.canAct) {
    return (
      <div className="card text-center">
        <div className="relative mx-auto h-14 w-14 text-5xl">
          😴
          <span className="absolute -right-3 -top-1 animate-zzz text-lg font-black">z</span>
          <span className="absolute -right-6 -top-4 animate-zzz text-sm font-black [animation-delay:0.8s]">Z</span>
        </div>
        <p className="mt-2 font-black">
          {me.acted ? 'Выбор сделан. Жди утра…' : 'Ты спишь, котик'}
        </p>
        <p className="text-sm font-semibold opacity-80">{view.nightHint ?? 'Мур-мур… Мурград спит.'}</p>
      </div>
    );
  }

  const need = me.actionKind === 'pick2' ? 2 : 1;
  const ready = picked.length === need;
  const voted = me.mafiaVotes[me.id];

  const confirm = async () => {
    setBusy(true);
    try {
      await api.night(picked[0], picked[1]);
      clear();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card ring-2 ring-paw dark:ring-moon">
      <h3 className="font-black">✨ Твой ход!</h3>
      <p className="mt-1 text-sm font-semibold">{PROMPT[me.role ?? ''] ?? 'Сделай выбор.'}</p>
      <p className="mt-2 text-sm font-extrabold">
        {picked.length ? `Выбрано: ${picked.map(name).join(' + ')}` : 'Тыкни в кота на столе'}
      </p>
      {mafia && Object.keys(me.mafiaVotes).length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs font-bold opacity-90">
          {Object.entries(me.mafiaVotes).map(([voter, target]) => (
            <li key={voter}>🗳️ {name(voter)} → {name(target)}</li>
          ))}
        </ul>
      )}
      <button className="btn-primary mt-3 w-full" disabled={!ready || busy} onClick={confirm}>
        {mafia && voted ? '🔁 Изменить выбор' : '✅ Подтвердить'}
      </button>
    </div>
  );
}
