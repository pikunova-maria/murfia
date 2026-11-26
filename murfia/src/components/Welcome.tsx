// Первый экран: имя и аватар. Профиль сохраняется в localStorage (токен).
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { DEFAULT_AVATAR } from '../../shared/constants';
import { performLogin } from '../lib/session';
import { useGameStore } from '../store/gameStore';
import AvatarPicker from './AvatarPicker';

export default function Welcome() {
  const connected = useGameStore((s) => s.connected);
  const pushToast = useGameStore((s) => s.pushToast);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await performLogin({ name: name.trim() || 'Безымянный кот', avatar });
    } catch (err) {
      pushToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-5">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="relative mx-auto flex h-36 w-64 items-end justify-center">
          {[['maine-coon', -14, -62], ['bengal', 14, 62], ['russian-blue', 0, 0]].map(([id, rot, x]) => (
            <motion.img
              key={String(id)}
              src={`/cats/${id}.jpg`}
              alt=""
              draggable={false}
              initial={{ opacity: 0, y: 30, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: Number(rot), x: Number(x) }}
              transition={{ type: 'spring', stiffness: 90, damping: 12, delay: 0.1 }}
              className="absolute bottom-0 h-36 rounded-xl border-2 border-gold shadow-card"
              style={{ zIndex: Number(rot) === 0 ? 2 : 1 }}
            />
          ))}
        </div>
        <h1 className="hero-title mt-3 text-6xl font-bold">МУР-ФИЯ</h1>
        <p className="mt-1 text-lg font-extrabold text-paw-700 dark:text-moon">Кошачьи Разборки в городе Мурград</p>
      </motion.div>

      <form onSubmit={submit} className="card mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-black">Как тебя зовут, котик?</span>
          <input className="input" value={name} maxLength={16} placeholder="Барсик" onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div>
          <span className="mb-1 block text-sm font-black">Выбери породу</span>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        <button className="btn-primary w-full text-lg" disabled={busy || !connected}>
          {connected ? '🐾 Зайти в Мурград' : '⏳ Ищем сервер…'}
        </button>
      </form>
    </div>
  );
}
