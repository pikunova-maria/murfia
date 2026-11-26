// Игровые события → оверлеи, тосты и звуки.
import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { chime, meow, purr } from '../lib/sound';
import { useGameStore } from '../store/gameStore';
import { ACHIEVEMENTS } from '../../shared/constants';
import type { GameEvent } from '../../shared/types';

export function useGameEvents() {
  useEffect(() => {
    const nameOf = (id: string) => useGameStore.getState().view?.players.find((p) => p.id === id)?.name ?? 'кот';

    const onEvent = (e: GameEvent) => {
      const st = useGameStore.getState();
      switch (e.kind) {
        case 'phase':
          if (e.phase === 'night' || e.phase === 'day' || e.phase === 'vote') {
            st.showOverlay(e, 2400);
            chime('soft');
          }
          break;
        case 'morning':
          st.showOverlay(e, 5500);
          if (e.deaths.length) meow(0.8); else chime('up');
          break;
        case 'execution':
          st.showOverlay(e, 4200);
          meow(e.player ? 0.7 : 1.2);
          break;
        case 'detective':
          st.pushToast(
            e.result === 'mafia'
              ? `🙀 ${nameOf(e.targetId)} — из банды Чёрных Котов!`
              : `😻 ${nameOf(e.targetId)} — мирный`,
            e.result === 'mafia' ? 'error' : 'good',
          );
          break;
        case 'love':
          st.pushToast(`💘 Тебя связали любовью с ${nameOf(e.withId)}`, 'good');
          break;
        case 'gameover': {
          const mine = st.view?.me.team;
          chime(e.winner === mine ? 'up' : 'down');
          break;
        }
      }
    };

    const onProfile = (_p: unknown, unlocked: string[]) => {
      for (const code of unlocked) {
        const a = ACHIEVEMENTS.find((x) => x.code === code);
        if (a) useGameStore.getState().pushToast(`${a.emoji} Достижение: «${a.title}»`, 'good');
      }
    };

    socket.on('game:event', onEvent);
    socket.on('profile:update', onProfile);

    // Мурчание при новых голосах и «мяу» при мяукающих репликах
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.view?.phase === 'vote' && prev.view?.phase === 'vote') {
        const total = (v: typeof s.view) => v?.players.reduce((n, p) => n + p.votes, 0) ?? 0;
        if (total(s.view) > total(prev.view)) purr();
      }
      if (s.chat.length > prev.chat.length) {
        const last = s.chat[s.chat.length - 1];
        if (last?.meow && last.channel !== 'system') meow(0.9 + Math.random() * 0.4);
      }
    });

    return () => {
      socket.off('game:event', onEvent);
      socket.off('profile:update', onProfile);
      unsub();
    };
  }, []);
}
