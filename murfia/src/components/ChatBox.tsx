// Чат: дневной (все), ночной (только банда), призрачный (мёртвые) и системные сообщения.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { useGameStore } from '../store/gameStore';
import type { ChatChannel } from '../../shared/types';
import Avatar from './Avatar';

const CHANNEL_LABEL: Record<ChatChannel, string> = {
  day: '', mafia: '🐈‍⬛ банда', ghost: '👻 призраки', system: '',
};

export default function ChatBox({ className }: { className?: string }) {
  const chat = useGameStore((s) => s.chat);
  const view = useGameStore((s) => s.view);
  const pushToast = useGameStore((s) => s.pushToast);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat.length]);

  if (!view) return null;
  const me = view.me;
  const phase = view.phase;
  const mafia = me.role === 'mafia' || me.role === 'godfather';

  let canType = true;
  let placeholder = 'Мяукни что-нибудь…';
  if (phase === 'night') {
    canType = !me.alive || mafia;
    placeholder = !me.alive ? 'Шепчем с призраками…' : mafia ? 'Шепни банде…' : 'Ночью коты спят 😴';
  } else if (phase === 'execution' || phase === 'reveal') {
    canType = !me.alive;
    placeholder = me.alive ? 'Тсс, сейчас не время' : 'Шепчем с призраками…';
  } else if (!me.alive && phase !== 'lobby' && phase !== 'ended') {
    placeholder = 'Призрак шепчет другим призракам…';
  }

  const send = async (t: string) => {
    const v = t.trim();
    if (!v) return;
    try {
      await api.chat(v);
      setText('');
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  return (
    <div className={cn('card flex min-h-0 flex-col', className)}>
      <div className="mb-2 text-sm font-black opacity-70">💬 Чат Мурграда</div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
        {chat.map((m) =>
          m.channel === 'system' ? (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-paw/25 px-3 py-1.5 text-center text-sm font-bold dark:bg-moon/10"
            >
              {m.text}
            </motion.div>
          ) : (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'rounded-2xl px-3 py-1.5 text-sm',
                m.channel === 'mafia' && 'bg-mafia/25 ring-1 ring-mafia/50',
                m.channel === 'ghost' && 'bg-ink/10 italic opacity-80 dark:bg-white/10',
                m.channel === 'day' && 'bg-white/70 dark:bg-night-900/60',
              )}
            >
              <span className="font-black">
                {m.from && <Avatar id={m.from.avatar} size={22} className="mr-1.5 inline-block align-text-bottom" />}{m.from?.name}
              </span>
              {CHANNEL_LABEL[m.channel] && <span className="chip ml-1.5">{CHANNEL_LABEL[m.channel]}</span>}
              <span className="font-semibold">: {m.meow ? <b>{m.text} 🐾</b> : m.text}</span>
            </motion.div>
          ),
        )}
        <div ref={endRef} />
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); void send(text); }}
      >
        <input
          className="input !py-2"
          value={text}
          maxLength={200}
          disabled={!canType}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="btn-ghost !px-3" disabled={!canType} onClick={() => void send('Мяу!')} title="Просто мяукнуть">
          🐾
        </button>
        <button type="submit" className="btn-primary" disabled={!canType || !text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
