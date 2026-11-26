// Игровой стол: все коты, заголовок фазы и таймер.
import { motion } from 'framer-motion';
import type { GameView } from '../../shared/types';
import { useGameStore } from '../store/gameStore';
import PlayerCat from './PlayerCat';
import Timer from './Timer';

export const PHASE_TITLE: Record<GameView['phase'], string> = {
  lobby: '🐾 Лобби',
  reveal: '🎴 Раздача ролей',
  night: '🌙 Ночь',
  morning: '🌅 Утро',
  day: '☀️ День',
  vote: '🐾 Голосование',
  execution: '⚖️ Изгнание',
  ended: '🏁 Итоги',
};

interface Props {
  view: GameView;
  picked: string[];
  isSelectable: (id: string) => boolean;
  onCat: (id: string) => void;
}

export default function GameTable({ view, picked, isSelectable, onCat }: Props) {
  const bubbles = useGameStore((s) => s.bubbles);
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '???';
  const title =
    view.phase === 'night' ? `🌙 Ночь №${view.night}` : view.phase === 'day' ? `☀️ День ${view.day}` : PHASE_TITLE[view.phase];

  return (
    <div className="card !p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="text-sm font-bold opacity-70">
            {view.nightHint ?? (view.phase === 'vote' ? 'Тыкни в подозрительного кота — над ним появятся лапки' : `Живых котов: ${view.players.filter((p) => p.alive).length} из ${view.players.length}`)}
          </p>
        </div>
        <Timer />
      </div>

      <motion.div layout className="grid grid-cols-2 gap-x-3 gap-y-5 pt-3 sm:grid-cols-3 xl:grid-cols-4">
        {view.players.map((p) => (
          <PlayerCat
            key={p.id}
            player={p}
            isMe={p.id === view.me.id}
            isMate={view.me.mates.includes(p.id)}
            isLover={view.me.lover === p.id}
            selectable={isSelectable(p.id)}
            selected={picked.includes(p.id)}
            myVote={view.phase === 'vote' && view.me.myVote === p.id}
            bubble={bubbles[p.id]?.text}
            votedForName={p.votedFor === undefined ? undefined : p.votedFor === null ? null : nameOf(p.votedFor)}
            onClick={() => onCat(p.id)}
          />
        ))}
      </motion.div>
    </div>
  );
}
