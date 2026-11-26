// ============================================================
// Симуляция полных партий без сети: люди-скрипты + ИИ-коты.
// Проверяет: игра доходит до конца, роли раскладываются по таблице,
// скрытая информация не утекает, победитель определён корректно.
//   node server/test/simulate.mjs [число партий]
// ============================================================
import assert from 'node:assert/strict';

process.env.MURFIA_SPEED = process.env.MURFIA_SPEED || '300';
const { RoomManager } = await import('../game.js');
const { createMemoryStore } = await import('../db.js');
const { buildRoleList } = await import('../../shared/constants.js');
const { isMafia, teamOf } = await import('../config.js');

process.on('uncaughtException', (e) => { console.error('❌ uncaughtException', e); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('❌ unhandledRejection', e); process.exit(1); });

const store = createMemoryStore();
const clients = new Map(); // socketId → клиент
const hub = {
  emit(socketId, event, ...args) { clients.get(socketId)?.onEvent(event, ...args); },
  roomsChanged() {},
};
const manager = new RoomManager({ store, hub, speed: Number(process.env.MURFIA_SPEED) });

let leaks = 0;
let actions = 0;
const sample = (a) => a[Math.floor(Math.random() * a.length)];

/** Скриптовый «человек»: реагирует на состояние как реальный клиент */
function makeClient(profile, socketId) {
  const c = {
    profile, socketId, view: null, events: [], chat: [],
    onEvent(event, ...args) {
      if (event === 'game:event') c.events.push(args[0]);
      if (event === 'chat:message') c.chat.push(args[0]);
      if (event === 'game:state') { c.view = args[0]; checkLeaks(c); setImmediate(() => c.react()); }
    },
    react() {
      const v = c.view;
      const room = manager.roomOf(profile.id);
      if (!v || !room || room.destroyed) return;
      try {
        if (v.me.canAct && !(v.me.acted && v.me.role !== 'mafia' && v.me.role !== 'godfather')) {
          const t = v.me.targets;
          if (v.me.actionKind === 'pick2') {
            const [a, b] = [...t].sort(() => Math.random() - 0.5);
            room.nightAction(profile.id, { targetId: a, targetId2: b });
          } else room.nightAction(profile.id, { targetId: sample(t) });
          actions++;
        }
        if (v.phase === 'vote' && v.me.alive && v.me.myVote === undefined) {
          const others = v.players.filter((p) => p.alive && p.id !== profile.id);
          room.vote(profile.id, sample(others).id);
          actions++;
        }
        if (v.phase === 'day' && v.me.alive && !v.me.skippedDay) room.skipDay(profile.id);
        if (v.phase === 'day' && v.me.alive && Math.random() < 0.2) room.chat(profile.id, 'мяу, подозреваю всех');
      } catch (err) {
        if (err.constructor.name !== 'GameError') throw err; // игровые ошибки (опоздал с ходом) допустимы
      }
    },
  };
  clients.set(socketId, c);
  return c;
}

/** Нельзя знать чужие роли раньше времени */
function checkLeaks(c) {
  const v = c.view;
  if (v.phase === 'lobby' || v.phase === 'ended') return;
  const me = v.me;
  for (const p of v.players) {
    if (p.id === me.id || !p.role) continue;
    const allowed = !p.alive || (isMafia(me.role) && isMafia(p.role));
    if (!allowed) { leaks++; console.error('УТЕЧКА роли', { viewer: me.role, target: p.role, phase: v.phase }); }
  }
  if (!isMafia(me.role) && Object.keys(me.mafiaVotes).length) { leaks++; console.error('УТЕЧКА голосов мафии'); }
}

async function waitFor(cond, timeoutMs, label) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`таймаут: ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

const stats = { town: 0, mafia: 0, maniac: 0, draw: 0 };
const bySize = {};
const games = Number(process.argv[2]) || 36;

for (let g = 0; g < games; g++) {
  const size = 6 + (g % 7);            // 6..12
  const humans = 1 + (g % 3);          // 1..3 людей-скриптов
  const prof = Array.from({ length: humans }, (_, i) => store.login({ name: `Игрок${g}-${i}`, avatar: 'russian-blue' }));
  const cls = prof.map((p, i) => makeClient(p, `s${g}-${i}`));

  const room = manager.create(prof[0], { maxPlayers: 12, isPublic: true });
  for (let i = 1; i < humans; i++) manager.join(prof[i], room.code);
  cls.forEach((c) => room.connect(c.profile.id, c.socketId));
  while (room.players.size < size) room.addBot(prof[0].id);
  assert.equal(room.players.size, size);

  room.start(prof[0].id);

  // Роли раздались по таблице
  const roles = [...room.players.values()].map((p) => p.role).sort();
  assert.deepEqual(roles, [...buildRoleList(size)].sort(), `таблица ролей для ${size}`);

  await waitFor(() => room.phase === 'ended', 60_000, `конец партии #${g} (${size} игроков, фаза ${room.phase}, день ${room.day})`);

  // Итоги корректны
  assert.ok(['town', 'mafia', 'maniac', 'draw'].includes(room.winner));
  const alive = room.alive();
  const maf = alive.filter((p) => isMafia(p.role)).length;
  const man = alive.filter((p) => p.role === 'maniac').length;
  if (room.winner === 'town') assert.ok(maf === 0 && man === 0, 'мирные: мафии и маньяка нет');
  if (room.winner === 'mafia') assert.ok(maf >= alive.length - maf, 'мафия: ≥ остальных');
  if (room.winner === 'maniac') assert.ok(alive.length === 1 && man === 1, 'маньяк: остался один');
  for (const id of room.winners) assert.equal(teamOf(room.get(id).role), room.winner);

  // После игры все роли открыты
  const end = cls[0].view;
  assert.equal(end.phase, 'ended');
  assert.ok(end.players.every((p) => p.role), 'после игры роли видны всем');

  // Детектив: Дон Кото и Маньяк «мирные»
  for (const p of room.players.values()) {
    for (const inv of p.investigations) {
      const t = room.get(inv.id);
      assert.equal(inv.result, t.role === 'mafia' ? 'mafia' : 'civilian');
    }
  }
  // Любовники умирают вместе, если один из них мёртв, а погиб не от изгнания последним — проверим связь
  for (const p of room.players.values()) {
    if (p.lover) assert.equal(room.get(p.lover).lover, p.id, 'любовь взаимна');
  }
  // Статистика людей записана
  for (const pr of prof) assert.equal(store.get(pr.id).games, 1, 'партия засчитана');

  stats[room.winner]++;
  (bySize[size] ??= { town: 0, mafia: 0, maniac: 0, draw: 0 })[room.winner]++;
  for (const c of cls) clients.delete(c.socketId);
  manager.destroy(room.code);
}

assert.equal(leaks, 0, 'утечек скрытой информации быть не должно');
console.table(bySize);
console.log(`✅ Сыграно партий: ${games}. Победы:`, stats, `| действий людей: ${actions}`);

// --- Точечные проверки правил -----------------------------------
{
  // Доктор спасает цель мафии, детектив не видит Дона мафией, мафия не может бить своих
  const owner = store.login({ name: 'Хозяин', avatar: 'russian-blue' });
  const c = makeClient(owner, 'rules');
  const room = manager.create(owner, { maxPlayers: 8, isPublic: false });
  room.connect(owner.id, 'rules');
  while (room.players.size < 8) room.addBot(owner.id);
  room.start(owner.id);
  room.clearTimer(); room.bots.clear(); // вручную управляем фазами
  const byRole = (r) => [...room.players.values()].filter((p) => p.role === r);
  const don = byRole('godfather')[0], doc = byRole('doctor')[0], det = byRole('detective')[0];
  const victim = [...room.players.values()].find((p) => !isMafia(p.role) && p.role !== 'doctor');

  room.startNight(); room.clearTimer(); room.bots.clear();
  // шаг купидона пропускаем
  room.nextNightStep(); room.clearTimer(); room.bots.clear();
  room.step = 'cupid'; room.stepIdx = 0;
  room.nextNightStep(); room.clearTimer(); room.bots.clear();           // → mafia
  assert.equal(room.step, 'mafia');
  assert.throws(() => room.nightAction(don.id, { targetId: don.id }), /нельзя/i, 'мафия не бьёт своих');
  room.nightAction(don.id, { targetId: victim.id });
  room.clearTimer();
  room.stepIdx = 2; room.nextNightStep(); room.clearTimer(); room.bots.clear(); // → doctor (после maniac)
  assert.equal(room.step, 'doctor');
  room.nightAction(doc.id, { targetId: victim.id });
  room.clearTimer();
  room.nextNightStep(); room.clearTimer(); room.bots.clear();           // → detective
  assert.equal(room.step, 'detective');
  const r = room.nightAction(det.id, { targetId: don.id });
  assert.equal(r.result, 'civilian', 'Дон Кото для детектива мирный');
  assert.throws(() => room.nightAction(det.id, { targetId: victim.id }), /уже/i, 'одно действие за ночь');
  room.clearTimer();
  room.nextNightStep(); // → resolveNight
  room.clearTimer();
  assert.ok(victim.alive, 'доктор спас жертву');
  assert.equal(room.lastHealed, victim.id);
  console.log('✅ Правила ролей: доктор спасает, Дон «мирный», мафия не бьёт своих, одно действие за ночь');
  manager.destroy(room.code);
}

manager.shutdown();
process.exit(0);
