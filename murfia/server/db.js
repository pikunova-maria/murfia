// ============================================================
// Хранилище профилей и статистики.
// Основное — SQLite (better-sqlite3). Если модуль не установлен
// или не собрался, сервер не падает, а переключается на хранилище в памяти
// (профили живут до перезапуска) и честно пишет об этом в консоль.
// ============================================================
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_AVATAR } from '../shared/constants.js';

/** Проверка достижений после партии. flags: { saves, catches } */
function computeUnlocked(profile, role, won, flags) {
  const u = [];
  if (profile.games >= 1) u.push('first_game');
  if (won && profile.wins >= 1) u.push('first_win');
  if (profile.games >= 10) u.push('games_10');
  if (profile.wins >= 5) u.push('wins_5');
  if (won && (role === 'mafia' || role === 'godfather')) u.push('mafia_win');
  if (won && role === 'maniac') u.push('maniac_win');
  if (flags.saves > 0) u.push('doctor_save');
  if (flags.catches > 0) u.push('detective_catch');
  return u;
}

/** Убираем токен из публичного представления профиля */
const publicProfile = (p, withToken = false) => ({
  id: p.id, name: p.name, avatar: p.avatar, games: p.games, wins: p.wins,
  achievements: [...p.achievements], ...(withToken ? { token: p.token } : {}),
});

const cleanName = (name) =>
  String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Безымянный кот';

// ---------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------
function createSqliteStore(Database, file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      games INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS achievements (
      profile_id TEXT NOT NULL,
      code TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      PRIMARY KEY (profile_id, code)
    );
    CREATE TABLE IF NOT EXISTS game_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      role TEXT NOT NULL,
      won INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    );
  `);

  const qByToken = db.prepare('SELECT * FROM profiles WHERE token = ?');
  const qById = db.prepare('SELECT * FROM profiles WHERE id = ?');
  const qAch = db.prepare('SELECT code FROM achievements WHERE profile_id = ?');
  const qInsert = db.prepare('INSERT INTO profiles (id, token, name, avatar, created_at) VALUES (?,?,?,?,?)');
  const qUpdate = db.prepare('UPDATE profiles SET name = ?, avatar = ? WHERE id = ?');
  const qStats = db.prepare('UPDATE profiles SET games = games + 1, wins = wins + ? WHERE id = ?');
  const qResult = db.prepare('INSERT INTO game_results (profile_id, role, won, finished_at) VALUES (?,?,?,?)');
  const qUnlock = db.prepare('INSERT OR IGNORE INTO achievements (profile_id, code, unlocked_at) VALUES (?,?,?)');

  const hydrate = (row) => row && { ...row, achievements: qAch.all(row.id).map((r) => r.code) };

  return {
    kind: 'sqlite',
    /** Вход по токену либо создание нового профиля */
    login({ token, name, avatar }) {
      let row = token ? qByToken.get(String(token)) : undefined;
      if (!row) {
        const id = randomUUID().slice(0, 8);
        const tk = randomBytes(24).toString('hex');
        qInsert.run(id, tk, cleanName(name), avatar || DEFAULT_AVATAR, Date.now());
        row = qById.get(id);
      }
      return publicProfile(hydrate(row), true);
    },
    get(id) {
      const row = qById.get(id);
      return row ? publicProfile(hydrate(row)) : null;
    },
    update(id, { name, avatar }) {
      qUpdate.run(cleanName(name), avatar || DEFAULT_AVATAR, id);
      return publicProfile(hydrate(qById.get(id)));
    },
    /** Запись итога партии + достижения. Возвращает { profile, unlocked } */
    recordGame(id, { role, won, saves = 0, catches = 0 }) {
      const tx = db.transaction(() => {
        qStats.run(won ? 1 : 0, id);
        qResult.run(id, role, won ? 1 : 0, Date.now());
        const p = hydrate(qById.get(id));
        const have = new Set(p.achievements);
        const unlocked = computeUnlocked(p, role, won, { saves, catches }).filter((c) => !have.has(c));
        for (const c of unlocked) qUnlock.run(id, c, Date.now());
        return { unlocked };
      });
      const { unlocked } = tx();
      return { profile: publicProfile(hydrate(qById.get(id))), unlocked };
    },
  };
}

// ---------------------------------------------------------------
// Хранилище в памяти (запасной вариант и для тестов)
// ---------------------------------------------------------------
export function createMemoryStore() {
  const byId = new Map();
  const byToken = new Map();
  return {
    kind: 'memory',
    login({ token, name, avatar }) {
      let p = token ? byToken.get(String(token)) : undefined;
      if (!p) {
        p = {
          id: randomUUID().slice(0, 8), token: randomBytes(24).toString('hex'),
          name: cleanName(name), avatar: avatar || DEFAULT_AVATAR, games: 0, wins: 0, achievements: [],
        };
        byId.set(p.id, p);
        byToken.set(p.token, p);
      }
      return publicProfile(p, true);
    },
    get: (id) => (byId.has(id) ? publicProfile(byId.get(id)) : null),
    update(id, { name, avatar }) {
      const p = byId.get(id);
      p.name = cleanName(name);
      p.avatar = avatar || DEFAULT_AVATAR;
      return publicProfile(p);
    },
    recordGame(id, { role, won, saves = 0, catches = 0 }) {
      const p = byId.get(id);
      p.games += 1;
      if (won) p.wins += 1;
      const unlocked = computeUnlocked(p, role, won, { saves, catches }).filter((c) => !p.achievements.includes(c));
      p.achievements.push(...unlocked);
      return { profile: publicProfile(p), unlocked };
    },
  };
}

/** Открыть основное хранилище (SQLite), при неудаче — память */
export async function openStore(file = 'data/murfia.db') {
  try {
    const mod = await import('better-sqlite3');
    const store = createSqliteStore(mod.default, file);
    console.log(`🗄️  SQLite готов: ${file}`);
    return store;
  } catch (err) {
    console.warn(`⚠️  better-sqlite3 недоступен (${err.message}). Профили хранятся в памяти до перезапуска.`);
    return createMemoryStore();
  }
}

export { cleanName };
