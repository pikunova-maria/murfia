// Профиль: аватар, имя, статистика и достижения.
import { useState } from 'react';
import { ACHIEVEMENTS, DEFAULT_AVATAR } from '../../shared/constants';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { saveProfileLocal } from '../lib/session';
import { useGameStore } from '../store/gameStore';
import AvatarPicker from './AvatarPicker';
import Avatar from './Avatar';

export default function ProfileCard() {
  const profile = useGameStore((s) => s.profile);
  const setProfile = useGameStore((s) => s.setProfile);
  const pushToast = useGameStore((s) => s.pushToast);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  if (!profile) return null;

  const startEdit = () => { setName(profile.name); setAvatar(profile.avatar); setEditing(true); };
  const save = async () => {
    try {
      const r = await api.updateProfile({ name, avatar });
      setProfile({ ...r.profile, token: profile.token });
      saveProfileLocal(r.profile.name, r.profile.avatar);
      setEditing(false);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };
  const rate = profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;

  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <Avatar id={profile.avatar} size={88} className="ring-4" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-black">{profile.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="chip">🎮 Игр: {profile.games}</span>
            <span className="chip">🏆 Побед: {profile.wins}</span>
            <span className="chip">📈 {rate}%</span>
          </div>
        </div>
        <button className="btn-ghost !px-3" onClick={editing ? () => setEditing(false) : startEdit} aria-label="Редактировать профиль">
          {editing ? '✖' : '✏️'}
        </button>
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          <AvatarPicker value={avatar} onChange={setAvatar} />
          <button className="btn-primary w-full" onClick={save}>💾 Сохранить</button>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-sm font-black opacity-70">Достижения</div>
        <div className="grid grid-cols-4 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = profile.achievements.includes(a.code);
            return (
              <div
                key={a.code}
                title={`${a.title}: ${a.desc}`}
                className={cn(
                  'flex flex-col items-center rounded-2xl p-2 text-center text-[11px] font-extrabold leading-tight',
                  got ? 'bg-paw/40' : 'bg-ink/5 opacity-50 grayscale dark:bg-white/10',
                )}
              >
                <span className="text-2xl">{a.emoji}</span>
                {a.title}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
