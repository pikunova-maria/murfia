// ============================================================
// 🐾 МУР-ФИЯ: Кошачьи Разборки — сервер (Express + Socket.IO)
// Запуск: npm run dev (разработка) или npm run build && npm start (прод)
// ============================================================
import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

import { openStore, cleanName } from './db.js';
import { RoomManager, GameError } from './game.js';
import { AVATAR_IDS, DEFAULT_AVATAR } from '../shared/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const DIST = join(__dirname, '..', 'dist');

const app = express();
const httpServer = createServer(app);

/** @type {import('socket.io').Server<import('../shared/types').ClientToServerEvents, import('../shared/types').ServerToClientEvents>} */
const io = new Server(httpServer, {
  cors: { origin: true },        // в dev клиент на другом порту (Vite)
  pingInterval: 10_000,
  pingTimeout: 15_000,
});

const store = await openStore(process.env.MURFIA_DB || join(__dirname, '..', 'data', 'murfia.db'));

// Хаб — мост между игровым ядром и сокетами
const hub = {
  emit: (socketId, event, ...args) => io.to(socketId).emit(event, ...args),
  roomsChanged: (() => {
    let t = null;
    return () => {
      if (t) return;
      t = setTimeout(() => { t = null; io.emit('rooms:list', manager.list()); }, 150); // небольшой дебаунс
    };
  })(),
};
const manager = new RoomManager({ store, hub });

// ---------------- HTTP ----------------
app.get('/health', (_req, res) => res.json({ ok: true, rooms: manager.rooms.size, db: store.kind }));
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));
}

// ---------------- Socket.IO ----------------
/** Обёртка обработчика: ловит ошибки и отвечает через ack, ничего не роняя */
const handle = (socket, fn) => (...args) => {
  const ack = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
  try {
    const res = fn(...args.filter((a) => typeof a !== 'function')) || {};
    ack?.({ ok: true, ...res });
  } catch (err) {
    if (!(err instanceof GameError)) console.error('Ошибка обработчика:', err);
    ack?.({ ok: false, error: err instanceof GameError ? err.message : 'Мяу?! Что-то пошло не так 🙀' });
  }
};

io.on('connection', (socket) => {
  /** Профиль и комната текущего сокета */
  const me = () => {
    const id = socket.data.profileId;
    if (!id) throw new GameError('Сначала представься, котик 🐾');
    return id;
  };
  const room = () => {
    const r = manager.roomOf(me());
    if (!r) throw new GameError('Ты не в комнате');
    return r;
  };

  // Вход / регистрация (по токену из localStorage — это и есть реконнект)
  socket.on('profile:login', handle(socket, ({ token, name, avatar } = {}) => {
    const av = AVATAR_IDS.includes(avatar) ? avatar : DEFAULT_AVATAR;
    const profile = store.login({ token, name: cleanName(name), avatar: av });
    socket.data.profileId = profile.id;
    const r = manager.roomOf(profile.id);
    if (r) r.connect(profile.id, socket.id); // вернулся в свою партию
    return { profile, roomCode: r?.code ?? null };
  }));

  socket.on('profile:update', handle(socket, ({ name, avatar } = {}) => {
    const av = AVATAR_IDS.includes(avatar) ? avatar : DEFAULT_AVATAR;
    return { profile: store.update(me(), { name: cleanName(name), avatar: av }) };
  }));

  socket.on('rooms:list', handle(socket, () => ({ rooms: manager.list() })));

  socket.on('room:create', handle(socket, ({ maxPlayers, isPublic } = {}) => {
    const profile = store.get(me());
    const r = manager.create(profile, { maxPlayers: Number(maxPlayers), isPublic: !!isPublic });
    r.connect(profile.id, socket.id);
    return { code: r.code };
  }));

  socket.on('room:join', handle(socket, ({ code } = {}) => {
    const profile = store.get(me());
    const r = manager.join(profile, code);
    r.connect(profile.id, socket.id);
    r.broadcast();
    return { code: r.code };
  }));

  socket.on('room:leave', handle(socket, () => { manager.roomOf(me())?.leave(me()); }));
  socket.on('room:addBot', handle(socket, () => { room().addBot(me()); }));
  socket.on('room:kickBot', handle(socket, ({ botId } = {}) => { room().kickBot(me(), botId); }));
  socket.on('room:start', handle(socket, () => { room().start(me()); }));
  socket.on('room:rematch', handle(socket, () => { room().rematch(me()); }));
  socket.on('chat:send', handle(socket, ({ text } = {}) => { room().chat(me(), text); }));
  socket.on('vote:cast', handle(socket, ({ targetId } = {}) => { room().vote(me(), targetId ?? null); }));
  socket.on('night:action', handle(socket, ({ targetId, targetId2 } = {}) => { room().nightAction(me(), { targetId, targetId2 }); }));
  socket.on('day:skip', handle(socket, () => { room().skipDay(me()); }));

  socket.on('disconnect', () => {
    const id = socket.data.profileId;
    if (id) manager.roomOf(id)?.disconnect(id, socket.id);
  });

  socket.emit('rooms:list', manager.list());
});

httpServer.listen(PORT, () => {
  console.log(`🐾 МУР-ФИЯ слушает порт ${PORT}${existsSync(DIST) ? ' (раздаёт собранный клиент)' : ' (клиент — через Vite, npm run dev)'}`);
});

// Аккуратное завершение
const shutdown = () => { manager.shutdown(); io.close(); httpServer.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
