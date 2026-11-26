// ============================================================
// Игровое ядро «МУР-ФИЯ»: комнаты, фазы, роли, голосование, победа.
// Не зависит от Socket.IO: общается с игроками через «хаб»
//   hub.emit(socketId, event, payload)  — отправить событие одному сокету
//   hub.roomsChanged()                  — список комнат изменился
// Благодаря этому ядро целиком тестируется без сети (server/test/simulate.mjs).
// ============================================================
import { randomUUID } from 'node:crypto';
import {
  MIN_PLAYERS, MAX_PLAYERS, ROLE_META, TEAM_META, BOT_NAMES, AVATAR_IDS, DEFAULT_AVATAR, buildRoleList,
} from '../shared/constants.js';
import { DUR, SPEED, STEPS, STEP_ROLES, isMafia, teamOf } from './config.js';
import T, { pick } from './texts.js';
import { Bots } from './bots.js';

/** Ошибка, текст которой безопасно показать игроку */
export class GameError extends Error {}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

/** Чистка текста чата */
const cleanText = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const MEOW_RE = /^(мя|мяу|мур|мрр|мр|фыр|мау)/i;

function makePlayer(profile, isBot = false) {
  return {
    id: profile.id, name: profile.name, avatar: profile.avatar,
    isBot, left: false, autopilot: false,
    socketId: null, connected: isBot, dcTimer: null,
    role: null, alive: true, lover: null,
    investigations: [], stats: { saves: 0, catches: 0 }, lastChat: 0,
  };
}

const freshNight = () => ({ mafia: new Map(), maniac: null, doctor: null, detective: null, cupid: null, acted: new Set() });

export class Room {
  constructor(manager, { code, hostId, maxPlayers, isPublic, speed = SPEED }) {
    this.manager = manager;
    this.code = code;
    this.hostId = hostId;
    this.maxPlayers = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayers | 0 || MAX_PLAYERS));
    this.isPublic = !!isPublic;
    this.speed = speed;

    /** @type {Map<string, any>} */
    this.players = new Map();
    this.phase = 'lobby';
    this.day = 0;
    this.night = 0;
    this.stepIdx = -1;
    this.step = null;
    this.stepActive = false;
    this.stepStartedAt = 0;
    this.phaseEndsAt = null;
    this.timer = null;
    this.earlyEnd = false;

    this.votes = new Map();      // voterId → targetId|null
    this.nightState = freshNight();
    this.skipVotes = new Set();  // кто хочет перейти к голосованию
    this.lastHealed = null;
    this.cupidUsed = false;

    this.chatLog = [];
    this.chatSeq = 0;
    this.winner = null;
    this.winners = [];
    this.emptySince = null;
    this.destroyed = false;
    this.bots = new Bots(this);
  }

  // ---------------------------------------------------------------
  // Вспомогательное
  // ---------------------------------------------------------------
  /** Секунды игрового времени → миллисекунды реальные (с учётом ускорения) */
  ms(sec) { return (sec * 1000) / this.speed; }
  get(id) { return this.players.get(id); }
  need(id) {
    const p = this.players.get(id);
    if (!p) throw new GameError('Тебя нет в этой комнате');
    return p;
  }
  alive() { return [...this.players.values()].filter((p) => p.alive); }
  humans() { return [...this.players.values()].filter((p) => !p.isBot); }
  connectedHumans() { return this.humans().filter((p) => p.connected); }
  isAuto(p) { return p.isBot || p.autopilot; }

  /** Выполнить функцию, не уронив процесс из таймера */
  guard(fn) {
    try { fn(); } catch (err) { console.error(`[комната ${this.code}]`, err); }
  }

  // ---------------------------------------------------------------
  // Таймеры
  // ---------------------------------------------------------------
  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.earlyEnd = false;
  }

  /** Запланировать переход через sec игровых секунд (или через ms реальных, если real=true) */
  schedule(sec, cb) {
    this.clearTimer();
    const delay = this.ms(sec);
    this.phaseEndsAt = Date.now() + delay;
    this.timer = setTimeout(() => { this.timer = null; if (!this.destroyed) this.guard(cb); }, delay);
  }

  /** Досрочное завершение: когда все сделали ход. Не раньше, чем через ~1.2с, и не раньше «минимума» шага */
  finishSoon(cb, minSinceMs = 0) {
    if (this.earlyEnd) return;
    const at = Math.max(Date.now() + this.ms(1.2), minSinceMs);
    if (this.phaseEndsAt && at >= this.phaseEndsAt) return; // и так скоро закончится
    this.earlyEnd = true;
    if (this.timer) clearTimeout(this.timer);
    this.phaseEndsAt = at;
    this.timer = setTimeout(() => { this.timer = null; this.earlyEnd = false; if (!this.destroyed) this.guard(cb); }, at - Date.now());
    this.broadcast();
  }

  setPhase(phase, seconds, cb) {
    this.clearTimer();
    this.bots.clear();
    this.phase = phase;
    if (phase !== 'night') { this.step = null; this.stepActive = false; }
    if (seconds) this.schedule(seconds, cb);
    else this.phaseEndsAt = null;
  }

  // ---------------------------------------------------------------
  // Подключение, выход, боты
  // ---------------------------------------------------------------
  addHuman(profile) {
    if (this.phase !== 'lobby') throw new GameError('Партия уже идёт, подожди следующую 🐾');
    if (this.players.size >= this.maxPlayers) throw new GameError('В комнате нет места: все подушки заняты 😿');
    const p = makePlayer(profile);
    this.players.set(p.id, p);
    this.systemMsg(`${p.name} запрыгнул в комнату 🐾`);
    return p;
  }

  addBot(requesterId) {
    if (requesterId !== this.hostId) throw new GameError('Ботов добавляет только хозяин комнаты');
    if (this.phase !== 'lobby') throw new GameError('Ботов можно позвать только в лобби');
    if (this.players.size >= this.maxPlayers) throw new GameError('В комнате нет места');
    this.spawnBot();
    this.broadcast();
    this.manager.roomsChanged();
  }

  spawnBot() {
    const used = new Set([...this.players.values()].map((p) => p.name));
    const free = BOT_NAMES.filter((n) => !used.has(n));
    const name = free.length ? pick(free) : `Кот-${Math.floor(Math.random() * 900 + 100)}`;
    const usedAv = new Set([...this.players.values()].map((p) => p.avatar));
    const freeAv = AVATAR_IDS.filter((x) => !usedAv.has(x)); // стараемся не повторять породы за столом
    const bot = makePlayer({ id: `bot_${randomUUID().slice(0, 6)}`, name, avatar: pick(freeAv.length ? freeAv : AVATAR_IDS) }, true);
    this.players.set(bot.id, bot);
    this.systemMsg(`${bot.name} 🤖 (ИИ-кот) присоединился к столу`);
    return bot;
  }

  kickBot(requesterId, botId) {
    if (requesterId !== this.hostId) throw new GameError('Только хозяин комнаты может выгнать бота');
    if (this.phase !== 'lobby') throw new GameError('Нельзя в разгар партии');
    const b = this.players.get(botId);
    if (!b || !b.isBot) throw new GameError('Такого бота нет');
    this.players.delete(botId);
    this.broadcast();
    this.manager.roomsChanged();
  }

  /** Сокет игрока (пере)подключился */
  connect(playerId, socketId) {
    const p = this.need(playerId);
    if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; }
    p.socketId = socketId;
    p.connected = true;
    p.autopilot = false;
    this.emptySince = null;
    this.hub.emit(socketId, 'chat:history', this.chatLog.filter((m) => this.canSee(p, m)));
    this.sendState(p);
  }

  /** Сокет отвалился. Если это уже не актуальный сокет игрока — игнорируем */
  disconnect(playerId, socketId) {
    const p = this.players.get(playerId);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    if (this.connectedHumans().length === 0) this.emptySince = Date.now();
    if (this.phase === 'lobby' || this.phase === 'ended') {
      // в лобби: если не вернулся за 30с — выбывает
      p.dcTimer = setTimeout(() => this.guard(() => this.leave(playerId)), 30_000);
    } else {
      // в игре: через 20с за него играет автопилот (ИИ), при возвращении он снова управляет сам
      p.dcTimer = setTimeout(() => this.guard(() => {
        const q = this.players.get(playerId);
        if (!q || q.connected) return;
        q.autopilot = true;
        this.systemMsg(`${q.name} потерял связь — за него мурлычет автопилот 🤖`);
        this.bots.onAutopilot(q);
      }), 20_000);
    }
    this.broadcast();
  }

  /** Игрок покинул комнату насовсем */
  leave(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; }
    this.manager.forget(playerId);

    if (this.phase === 'lobby' || this.phase === 'ended') {
      this.players.delete(playerId);
      if (this.phase === 'lobby') this.systemMsg(`${p.name} ушёл гулять сам по себе 🚪`);
    } else {
      // посреди партии: на его место встаёт ИИ-кот, чтобы партия не развалилась
      p.isBot = true; p.left = true; p.connected = true; p.socketId = null;
      this.systemMsg(`${p.name} сбежал со стола, и его место занял ИИ-кот 🤖`);
      this.bots.onAutopilot(p);
    }

    if (this.humans().filter((h) => !h.left).length === 0) return this.manager.destroy(this.code);
    if (this.hostId === playerId) {
      const next = this.humans().find((h) => !h.left);
      if (next) this.hostId = next.id;
    }
    if (this.connectedHumans().length === 0) this.emptySince = Date.now();
    this.broadcast();
    this.manager.roomsChanged();
  }

  destroy() {
    this.destroyed = true;
    this.clearTimer();
    this.bots.clear();
    for (const p of this.players.values()) if (p.dcTimer) clearTimeout(p.dcTimer);
  }

  // ---------------------------------------------------------------
  // Старт партии
  // ---------------------------------------------------------------
  start(requesterId) {
    if (requesterId !== this.hostId) throw new GameError('Начать партию может только хозяин комнаты');
    if (this.phase !== 'lobby') throw new GameError('Партия уже идёт');
    // Не хватает игроков — добавляем ИИ-котов до минимума
    while (this.players.size < MIN_PLAYERS) this.spawnBot();

    const roles = shuffle(buildRoleList(this.players.size));
    let i = 0;
    for (const p of this.players.values()) {
      Object.assign(p, {
        role: roles[i++], alive: true, lover: null, autopilot: false,
        investigations: [], stats: { saves: 0, catches: 0 },
      });
    }
    this.day = 0; this.night = 0; this.winner = null; this.winners = [];
    this.lastHealed = null; this.cupidUsed = false;
    this.votes.clear(); this.skipVotes.clear();
    this.bots.reset();

    this.systemMsg(pick(T.gameStart));
    this.setPhase('reveal', DUR.reveal, () => this.startNight());
    this.emit({ kind: 'phase', phase: 'reveal', text: 'Раздача ролей' });
    this.broadcast();
    this.manager.roomsChanged();
  }

  rematch(requesterId) {
    if (requesterId !== this.hostId) throw new GameError('Новую партию начинает хозяин комнаты');
    if (this.phase !== 'ended') throw new GameError('Партия ещё не закончилась');
    for (const [id, p] of this.players) if (p.left) this.players.delete(id);
    for (const p of this.players.values()) Object.assign(p, { role: null, alive: true, lover: null, investigations: [], autopilot: false });
    this.setPhase('lobby', 0);
    this.winner = null; this.winners = [];
    this.systemMsg('Все вернулись в лобби. Готовы к новой партии? 🐾');
    this.broadcast();
    this.manager.roomsChanged();
  }

  // ---------------------------------------------------------------
  // Ночь
  // ---------------------------------------------------------------
  startNight() {
    this.night += 1;
    this.nightState = freshNight();
    this.stepIdx = -1;
    this.setPhase('night', 0);
    this.systemMsg(T.nightStart(this.night));
    this.emit({ kind: 'phase', phase: 'night', text: T.nightStart(this.night) });
    this.nextNightStep();
  }

  actorsFor(step) {
    const roles = STEP_ROLES[step];
    return this.alive().filter((p) => roles.includes(p.role) && (step !== 'cupid' || !this.cupidUsed));
  }

  nextNightStep() {
    this.clearTimer();
    this.bots.clear();
    this.stepIdx += 1;
    if (this.stepIdx >= STEPS.length) return this.resolveNight();
    const step = STEPS[this.stepIdx];
    if (step === 'cupid' && this.night > 1) return this.nextNightStep(); // Купидон работает только в 1-ю ночь

    this.step = step;
    this.stepStartedAt = Date.now();
    const actors = this.actorsFor(step);
    this.stepActive = actors.length > 0;
    if (this.stepActive) {
      this.schedule(DUR.steps[step], () => this.nextNightStep());
      for (const a of actors) if (!this.isAuto(a)) this.systemMsg(T.yourTurn[step], { to: a.id });
      this.bots.onNightStep(step, actors);
    } else {
      // Роли нет в партии или она мертва — выдерживаем паузу, чтобы не выдать состав стола
      this.schedule(DUR.fakeStep, () => this.nextNightStep());
    }
    this.broadcast();
  }

  /** Допустимые цели ночного действия игрока */
  targetsFor(p) {
    const alive = this.alive();
    switch (p.role) {
      case 'cupid': return alive.map((x) => x.id);
      case 'mafia':
      case 'godfather': return alive.filter((x) => !isMafia(x.role)).map((x) => x.id);
      case 'maniac': return alive.filter((x) => x.id !== p.id).map((x) => x.id);
      case 'doctor': return alive.filter((x) => x.id !== this.lastHealed).map((x) => x.id);
      case 'detective': {
        const seen = new Set(p.investigations.map((i) => i.id));
        const others = alive.filter((x) => x.id !== p.id);
        const fresh = others.filter((x) => !seen.has(x.id));
        return (fresh.length ? fresh : others).map((x) => x.id);
      }
      default: return [];
    }
  }

  /** Ночное действие. Возвращает { result? } (результат проверки детектива) */
  nightAction(playerId, { targetId, targetId2 } = {}) {
    const p = this.need(playerId);
    if (this.phase !== 'night' || !this.stepActive) throw new GameError('Сейчас не время для ночных дел 🌙');
    if (!p.alive) throw new GameError('Призраки не действуют');
    if (!STEP_ROLES[this.step].includes(p.role)) throw new GameError('Сейчас просыпается не твоя роль');
    const ns = this.nightState;
    const mafiaMember = isMafia(p.role);
    if (!mafiaMember && ns.acted.has(p.id)) throw new GameError('Ты уже сделал выбор этой ночью');

    const allowed = this.targetsFor(p);
    if (!allowed.includes(targetId)) throw new GameError('Этого кота выбрать нельзя');
    let result;

    switch (p.role) {
      case 'cupid': {
        if (!targetId2 || targetId2 === targetId || !allowed.includes(targetId2)) {
          throw new GameError('Выбери двух разных котов');
        }
        const a = this.get(targetId); const b = this.get(targetId2);
        a.lover = b.id; b.lover = a.id;
        ns.cupid = [a.id, b.id];
        this.cupidUsed = true;
        this.systemMsg(T.fill(T.love, { name: b.name }), { to: a.id });
        this.systemMsg(T.fill(T.love, { name: a.name }), { to: b.id });
        this.systemMsg(T.fill(T.loveCupid, { a: a.name, b: b.name }), { to: p.id });
        this.sendEventTo(a, { kind: 'love', withId: b.id });
        this.sendEventTo(b, { kind: 'love', withId: a.id });
        break;
      }
      case 'mafia':
      case 'godfather':
        ns.mafia.set(p.id, targetId);
        break;
      case 'maniac':
        ns.maniac = targetId;
        break;
      case 'doctor':
        ns.doctor = targetId;
        break;
      case 'detective': {
        const t = this.get(targetId);
        // Дон Кото и Маньяк для детектива «мирные»
        result = t.role === 'mafia' ? 'mafia' : 'civilian';
        ns.detective = targetId;
        p.investigations.push({ id: t.id, result });
        if (result === 'mafia') p.stats.catches += 1;
        this.systemMsg(T.fill(result === 'mafia' ? T.detectiveBad : T.detectiveGood, { name: t.name }), { to: p.id });
        this.sendEventTo(p, { kind: 'detective', targetId: t.id, result });
        break;
      }
      default:
        throw new GameError('У твоей роли нет ночных действий');
    }

    ns.acted.add(p.id);
    // Все действующие сделали выбор — не ждём таймер
    const actors = this.actorsFor(this.step);
    if (actors.every((a) => ns.acted.has(a.id))) {
      this.finishSoon(() => this.nextNightStep(), this.stepStartedAt + this.ms(DUR.fakeStep));
    }
    this.broadcast();
    return { result };
  }

  /** Итоговая цель мафии: большинство голосов, при равенстве решает Дон */
  mafiaTarget() {
    const votes = [...this.nightState.mafia.entries()]
      .filter(([voter]) => this.get(voter)?.alive);
    if (!votes.length) return null;
    const count = new Map();
    for (const [, t] of votes) count.set(t, (count.get(t) || 0) + 1);
    const max = Math.max(...count.values());
    const tied = [...count.entries()].filter(([, c]) => c === max).map(([t]) => t);
    if (tied.length === 1) return tied[0];
    const don = votes.find(([voter]) => this.get(voter).role === 'godfather');
    if (don && tied.includes(don[1])) return don[1];
    return tied[0];
  }

  deathInfo(p, cause) {
    return { id: p.id, name: p.name, avatar: p.avatar, role: p.role, cause };
  }

  killPlayer(id, cause, deaths) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.alive = false;
    deaths.push(this.deathInfo(p, cause));
    if (p.lover) {
      const l = this.players.get(p.lover);
      if (l?.alive) this.killPlayer(l.id, 'love', deaths);
    }
  }

  resolveNight() {
    const ns = this.nightState;
    const mafiaT = this.mafiaTarget();
    const attacked = new Set([mafiaT, ns.maniac].filter(Boolean));
    const healed = ns.doctor;
    this.lastHealed = healed;

    let saved = false;
    const deaths = [];
    for (const t of attacked) {
      if (t === healed) {
        saved = true;
        const doc = this.alive().find((p) => p.role === 'doctor');
        if (doc) doc.stats.saves += 1;
      } else {
        this.killPlayer(t, 'night', deaths);
      }
    }

    this.setPhase('morning', DUR.morning, () => this.afterMorning());
    if (!deaths.length) this.systemMsg(pick(T.morningPeace));
    for (const d of deaths) {
      this.systemMsg(d.cause === 'love' ? T.fill(T.morningLove, d) : T.fill(pick(T.morningDeath), d));
      this.systemMsg(`${d.name} был(а) ${ROLE_META[d.role].emoji} ${ROLE_META[d.role].name}`);
    }
    if (saved) this.systemMsg(T.morningSaved);
    this.bots.observeDeaths(deaths);
    this.emit({ kind: 'morning', deaths, saved });
    this.broadcast();
  }

  afterMorning() {
    const w = this.checkWin();
    if (w) return this.endGame(w);
    this.startDay();
  }

  // ---------------------------------------------------------------
  // День и голосование
  // ---------------------------------------------------------------
  startDay() {
    this.day += 1;
    this.skipVotes.clear();
    this.setPhase('day', DUR.day, () => this.startVote());
    this.systemMsg(pick(T.dayStart));
    this.emit({ kind: 'phase', phase: 'day', text: pick(T.dayStart) });
    this.bots.onDay();
    this.broadcast();
  }

  /** Большинство живых людей хочет закончить обсуждение */
  skipDay(playerId) {
    const p = this.need(playerId);
    if (this.phase !== 'day') throw new GameError('Обсуждение сейчас не идёт');
    if (!p.alive) throw new GameError('Призраки не голосуют');
    this.skipVotes.add(p.id);
    const humansAlive = this.alive().filter((x) => !this.isAuto(x));
    if (humansAlive.length && this.skipVotes.size >= Math.ceil(humansAlive.length / 2 + 0.01)) {
      this.finishSoon(() => this.startVote());
    }
    this.broadcast();
  }

  startVote() {
    this.votes.clear();
    this.setPhase('vote', DUR.vote, () => this.endVote());
    this.systemMsg(pick(T.voteStart));
    this.emit({ kind: 'phase', phase: 'vote', text: pick(T.voteStart) });
    this.bots.onVote();
    this.broadcast();
  }

  vote(playerId, targetId) {
    const p = this.need(playerId);
    if (this.phase !== 'vote') throw new GameError('Сейчас не время голосовать 🐾');
    if (!p.alive) throw new GameError('Призраки не голосуют');
    if (targetId !== null) {
      const t = this.players.get(targetId);
      if (!t || !t.alive) throw new GameError('Этого кота нет среди живых');
      if (t.id === p.id) throw new GameError('За себя голосовать нельзя, хитрец 😼');
    }
    this.votes.set(p.id, targetId);
    if (this.alive().every((a) => this.votes.has(a.id))) this.finishSoon(() => this.endVote());
    this.broadcast();
  }

  /** Подсчёт голосов: id → число */
  tally() {
    const m = {};
    for (const t of this.votes.values()) if (t) m[t] = (m[t] || 0) + 1;
    return m;
  }

  endVote() {
    const tally = this.tally();
    const entries = Object.entries(tally);
    const max = entries.length ? Math.max(...entries.map(([, c]) => c)) : 0;
    const top = entries.filter(([, c]) => c === max).map(([id]) => id);
    const executedId = max > 0 && top.length === 1 ? top[0] : null;
    const snapshot = new Map(this.votes);

    this.setPhase('execution', DUR.execution, () => this.afterExecution(executedId, snapshot));
    if (executedId) {
      const p = this.get(executedId);
      const info = this.deathInfo(p, 'exile');
      this.systemMsg(T.fill(T.exile, { name: p.name, role: ROLE_META[p.role].name, emoji: ROLE_META[p.role].emoji }));
      this.emit({ kind: 'execution', player: info, votes: tally });
    } else {
      this.systemMsg(pick(T.noExile));
      this.emit({ kind: 'execution', player: null, votes: tally });
    }
    this.broadcast();
  }

  afterExecution(executedId, snapshot) {
    const deaths = [];
    if (executedId) {
      this.killPlayer(executedId, 'exile', deaths);
      for (const d of deaths.slice(1)) this.systemMsg(T.fill(T.morningLove, d));
      this.bots.observeExecution(deaths[0], snapshot);
    }
    const w = this.checkWin();
    if (w) return this.endGame(w);
    this.startNight();
  }

  // ---------------------------------------------------------------
  // Победа
  // ---------------------------------------------------------------
  checkWin() {
    const alive = this.alive();
    if (alive.length === 0) return 'draw';
    const maf = alive.filter((p) => isMafia(p.role)).length;
    const man = alive.filter((p) => p.role === 'maniac').length;
    if (alive.length === 1 && man === 1) return 'maniac';
    if (maf === 0 && man === 0) return 'town';
    if (maf > 0 && maf >= alive.length - maf) return 'mafia';
    return null;
  }

  endGame(winner) {
    this.clearTimer();
    this.bots.clear();
    this.setPhase('ended', 0);
    this.winner = winner;
    this.winners = [...this.players.values()].filter((p) => teamOf(p.role) === winner).map((p) => p.id);
    this.systemMsg(T.win[winner]);
    this.emit({ kind: 'gameover', winner });

    // Статистика и достижения — только для живых людей-игроков
    for (const p of this.players.values()) {
      if (p.isBot || p.left) continue;
      try {
        const won = this.winners.includes(p.id);
        const { profile, unlocked } = this.manager.store.recordGame(p.id, {
          role: p.role, won, saves: p.stats.saves, catches: p.stats.catches,
        });
        this.sendEventRaw(p, 'profile:update', profile, unlocked);
      } catch (err) {
        console.error('Не удалось сохранить статистику', err);
      }
    }
    this.broadcast();
    this.manager.roomsChanged();
  }

  // ---------------------------------------------------------------
  // Чат
  // ---------------------------------------------------------------
  canSee(p, m) {
    switch (m.channel) {
      case 'system': return !m.to || m.to === p.id;
      case 'day': return true;
      case 'mafia': return isMafia(p.role);
      case 'ghost': return !p.alive;
      default: return false;
    }
  }

  pushChat(msg) {
    const m = { id: ++this.chatSeq, ts: Date.now(), ...msg };
    this.chatLog.push(m);
    if (this.chatLog.length > 300) this.chatLog.shift();
    for (const p of this.players.values()) if (this.canSee(p, m)) this.sendEventRaw(p, 'chat:message', m);
    return m;
  }

  systemMsg(text, extra = {}) {
    return this.pushChat({ channel: 'system', text, ...extra });
  }

  /** Сообщение игрока. Канал определяется фазой и ролью */
  chat(playerId, rawText) {
    const p = this.need(playerId);
    const text = cleanText(rawText);
    if (!text) throw new GameError('Пустое мяу не засчитано');
    const now = Date.now();
    if (now - p.lastChat < this.ms(0.5)) throw new GameError('Не так быстро, котик 🐾');

    let channel;
    switch (this.phase) {
      case 'lobby':
      case 'ended':
        channel = 'day'; break;
      case 'day':
      case 'vote':
      case 'morning':
        channel = p.alive ? 'day' : 'ghost'; break;
      case 'night':
        if (!p.alive) channel = 'ghost';
        else if (isMafia(p.role)) channel = 'mafia';
        else throw new GameError('Ночью коты спят 😴');
        break;
      default:
        if (!p.alive) channel = 'ghost';
        else throw new GameError('Сейчас не время болтать');
    }
    p.lastChat = now;
    const words = text.toLowerCase().split(/\s+/);
    const meow = words.every((w) => MEOW_RE.test(w));
    return this.pushChat({ channel, text, meow, from: { id: p.id, name: p.name, avatar: p.avatar } });
  }

  // ---------------------------------------------------------------
  // Отправка состояния клиентам
  // ---------------------------------------------------------------
  get hub() { return this.manager.hub; }

  sendEventRaw(p, event, ...args) {
    if (p.isBot || !p.connected || !p.socketId) return;
    this.hub.emit(p.socketId, event, ...args);
  }

  sendEventTo(p, e) { this.sendEventRaw(p, 'game:event', e); }

  /** Игровое событие всем */
  emit(e) { for (const p of this.players.values()) this.sendEventTo(p, e); }

  sendState(p) { this.sendEventRaw(p, 'game:state', this.view(p.id)); }

  broadcast() {
    if (this.destroyed) return;
    for (const p of this.players.values()) this.sendState(p);
  }

  /** Персональное представление комнаты: что именно видит этот игрок */
  view(viewerId) {
    const me = this.players.get(viewerId);
    const showAll = this.phase === 'ended';
    const meMafia = !!me && isMafia(me.role);
    const votePhase = this.phase === 'vote' || this.phase === 'execution';
    const tally = this.tally();

    const players = [...this.players.values()].map((p) => {
      const revealRole = this.phase !== 'lobby' && (showAll || p.id === viewerId || (meMafia && isMafia(p.role)) || !p.alive);
      return {
        id: p.id, name: p.name, avatar: p.avatar, alive: p.alive,
        connected: p.isBot || p.connected, isBot: p.isBot, isHost: p.id === this.hostId,
        ...(revealRole && p.role ? { role: p.role } : {}),
        votes: votePhase ? tally[p.id] || 0 : 0,
        ...(votePhase && this.votes.has(p.id) ? { votedFor: this.votes.get(p.id) } : {}),
      };
    });

    const acting = !!me && this.phase === 'night' && this.stepActive && me.alive && STEP_ROLES[this.step]?.includes(me.role);
    const acted = !!me && this.nightState.acted.has(me.id);
    const canAct = acting && (isMafia(me.role) || !acted);
    const mafiaVotes = {};
    if (meMafia) for (const [v, t] of this.nightState.mafia) mafiaVotes[v] = t;

    return {
      code: this.code,
      phase: this.phase,
      day: this.day,
      night: this.night,
      step: this.phase === 'night' ? this.step : null,
      stepActive: this.stepActive,
      nightHint: this.phase === 'night' && this.step ? T.hints[this.step] : null,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      maxPlayers: this.maxPlayers,
      isPublic: this.isPublic,
      hostId: this.hostId,
      players,
      me: {
        id: viewerId,
        role: me?.role ?? null,
        team: me?.role ? teamOf(me.role) : null,
        alive: me?.alive ?? false,
        mates: meMafia ? [...this.players.values()].filter((p) => isMafia(p.role) && p.id !== viewerId).map((p) => p.id) : [],
        lover: me?.lover ?? null,
        canAct,
        acted,
        actionKind: canAct ? (me.role === 'cupid' ? 'pick2' : 'pick') : null,
        targets: canAct ? this.targetsFor(me) : [],
        mafiaVotes,
        investigations: me?.investigations ?? [],
        myVote: this.phase === 'vote' && me ? (this.votes.has(me.id) ? this.votes.get(me.id) : undefined) : undefined,
        skippedDay: !!me && this.skipVotes.has(me.id),
      },
      winner: this.winner,
      winners: this.winners,
    };
  }

  summary() {
    const host = this.players.get(this.hostId);
    return {
      code: this.code, hostName: host?.name ?? '—', hostAvatar: host?.avatar ?? DEFAULT_AVATAR,
      players: this.players.size, maxPlayers: this.maxPlayers,
    };
  }
}

// =================================================================
// Менеджер комнат
// =================================================================
export class RoomManager {
  /**
   * @param {{ store: any, hub: { emit: Function, roomsChanged?: Function }, speed?: number }} opts
   */
  constructor({ store, hub, speed = SPEED }) {
    this.store = store;
    this.hub = hub;
    this.speed = speed;
    this.rooms = new Map();       // код → Room
    this.playerRoom = new Map();  // id игрока → код комнаты
    // Раз в 15с убираем комнаты, где давно нет живых людей
    this.cleaner = setInterval(() => {
      for (const room of this.rooms.values()) {
        if (room.emptySince && Date.now() - room.emptySince > 60_000) this.destroy(room.code);
      }
    }, 15_000);
    this.cleaner.unref?.();
  }

  roomsChanged() { this.hub.roomsChanged?.(); }
  roomOf(playerId) { return this.rooms.get(this.playerRoom.get(playerId)); }
  forget(playerId) { this.playerRoom.delete(playerId); }

  create(profile, { maxPlayers, isPublic }) {
    if (this.playerRoom.has(profile.id)) throw new GameError('Ты уже сидишь в комнате. Сначала выйди из неё');
    let code;
    do { code = genCode(); } while (this.rooms.has(code));
    const room = new Room(this, { code, hostId: profile.id, maxPlayers, isPublic, speed: this.speed });
    this.rooms.set(code, room);
    room.addHuman(profile);
    this.playerRoom.set(profile.id, code);
    this.roomsChanged();
    return room;
  }

  join(profile, rawCode) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    const existing = this.playerRoom.get(profile.id);
    if (existing && existing !== code) throw new GameError('Ты уже сидишь в другой комнате. Сначала выйди из неё');
    const room = this.rooms.get(code);
    if (!room) throw new GameError('Комнаты с таким кодом нет 🙀');
    if (!existing) {
      room.addHuman(profile);
      this.playerRoom.set(profile.id, code);
      this.roomsChanged();
    }
    return room;
  }

  destroy(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.destroy();
    for (const p of room.players.values()) {
      if (this.playerRoom.get(p.id) === code) this.playerRoom.delete(p.id);
      if (!p.isBot && p.socketId) this.hub.emit(p.socketId, 'room:closed', 'Комната закрыта');
    }
    this.rooms.delete(code);
    this.roomsChanged();
  }

  /** Публичные комнаты в лобби */
  list() {
    return [...this.rooms.values()]
      .filter((r) => r.isPublic && r.phase === 'lobby' && r.players.size < r.maxPlayers)
      .map((r) => r.summary());
  }

  shutdown() {
    clearInterval(this.cleaner);
    for (const code of [...this.rooms.keys()]) this.destroy(code);
  }
}

export { TEAM_META };
