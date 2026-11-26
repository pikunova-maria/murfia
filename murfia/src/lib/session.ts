// Сохранённый профиль (токен в localStorage) и вход на сервер. Благодаря токену игрок
// возвращается в свою комнату после обновления страницы или обрыва связи.
import { api } from './api';
import { useGameStore } from '../store/gameStore';

const KEY = 'murfia.session';
export interface Session { token: string; name: string; avatar: string }

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Войти (или зарегистрироваться) и применить результат к стору */
export async function performLogin(input: { token?: string; name: string; avatar: string }) {
  const r = await api.login(input);
  if (r.profile.token) saveSession({ token: r.profile.token, name: r.profile.name, avatar: r.profile.avatar });
  const st = useGameStore.getState();
  st.setProfile(r.profile);
  if (!r.roomCode) st.setView(null); // комната закрылась, пока нас не было
  return r;
}

/** Обновить имя/аватар в сохранённой сессии (токен остаётся) */
export function saveProfileLocal(name: string, avatar: string) {
  const s = loadSession();
  if (s) saveSession({ ...s, name, avatar });
}
