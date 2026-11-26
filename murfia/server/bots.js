// ============================================================
// ИИ-коты. Простая логика: случайность + базовые стратегии.
// Боты действуют через те же методы комнаты, что и люди
// (nightAction / vote / chat), поэтому не могут «читерить».
// Автопилот (потерявший связь человек) использует тот же мозг.
// ============================================================
import { DUR, STEP_ROLES, isMafia, teamOf } from './config.js';
import T, { pick } from './texts.js';

const rand = (min, max) => min + Math.random() * (max - min);
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Рулетка: выбрать элемент с вероятностью, пропорциональной весу */
function roulette(items, weightOf) {
  const weights = items.map((i) => Math.max(0.01, weightOf(i)));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export class Bots {
  constructor(room) {
    this.room = room;
    this.timers = new Set();
    this.mem = new Map(); // id бота → память
  }

  reset() { this.clear(); this.mem.clear(); }

  clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  /** Отложенное действие: ms — «игровые» миллисекунды (ускоряются вместе с игрой) */
  later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.room.destroyed) this.room.guard(fn);
    }, ms / this.room.speed);
    this.timers.add(t);
  }

  memOf(id) {
    let m = this.mem.get(id);
    if (!m) {
      m = { suspicion: new Map(), knownMafia: new Set(), knownTown: new Set() };
      this.mem.set(id, m);
    }
    return m;
  }

  auto(p) { return p && p.alive && (p.isBot || p.autopilot); }

  // ---------------------------------------------------------------
  // Ночь
  // ---------------------------------------------------------------
  onNightStep(step, actors) {
    for (const a of actors) {
      if (!this.auto(a)) continue;
      this.later(rand(2500, Math.max(3500, DUR.steps[step] * 1000 * 0.6)), () => this.doNight(a.id, step));
    }
  }

  doNight(id, step) {
    const room = this.room;
    const p = room.get(id);
    if (!this.auto(p) || room.phase !== 'night' || room.step !== step || !room.stepActive) return;
    const targets = room.targetsFor(p);
    if (!targets.length) return;
    const mem = this.memOf(id);

    try {
      switch (p.role) {
        case 'mafia':
        case 'godfather': {
          // Банда стремится к согласию: чаще присоединяется к уже выбранной жертве
          const votes = [...room.nightState.mafia.values()].filter((t) => targets.includes(t));
          let target;
          if (votes.length && Math.random() < 0.75 && p.role !== 'godfather') target = sample(votes);
          else target = sample(targets);
          if (Math.random() < 0.6) {
            try { room.chat(id, T.fill(pick(T.mafiaChatter), { name: room.get(target).name })); } catch { /* антиспам */ }
          }
          room.nightAction(id, { targetId: target });
          break;
        }
        case 'maniac':
          room.nightAction(id, { targetId: sample(targets) });
          break;
        case 'doctor': {
          const self = targets.includes(id) && Math.random() < 0.25;
          room.nightAction(id, { targetId: self ? id : sample(targets) });
          break;
        }
        case 'detective': {
          const { result } = room.nightAction(id, { targetId: sample(targets) });
          const last = p.investigations[p.investigations.length - 1];
          if (last) (result === 'mafia' ? mem.knownMafia : mem.knownTown).add(last.id);
          break;
        }
        case 'cupid': {
          const [a, b] = [...targets].sort(() => Math.random() - 0.5);
          room.nightAction(id, { targetId: a, targetId2: b });
          break;
        }
        default:
      }
    } catch { /* ход мог стать недопустимым — это нормально */ }
  }

  // ---------------------------------------------------------------
  // День: болтовня и голосование
  // ---------------------------------------------------------------
  onDay() {
    for (const p of this.room.alive()) {
      if (!this.auto(p) || p.autopilot) continue; // автопилот молчит: не выдаём себя за человека
      const count = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < count; i++) this.later(rand(6000, DUR.day * 1000 * 0.8), () => this.chatter(p.id));
    }
  }

  chatter(id) {
    const room = this.room;
    const p = room.get(id);
    if (!this.auto(p) || (room.phase !== 'day' && room.phase !== 'vote')) return;
    const others = room.alive().filter((x) => x.id !== id);
    if (!others.length) return;
    const r = Math.random();
    let text;
    if (r < 0.5) text = T.fill(pick(T.botChatter.accuse), { name: this.suspectOf(p, others).name });
    else if (r < 0.75) text = pick(T.botChatter.defend);
    else text = pick(T.botChatter.meow);
    try { room.chat(id, text); } catch { /* антиспам: пропускаем реплику */ }
  }

  /** Самый подозрительный для этого бота кот (с лёгкой случайностью) */
  suspectOf(me, others) {
    const mem = this.memOf(me.id);
    if (!isMafia(me.role)) {
      const known = others.find((o) => mem.knownMafia.has(o.id));
      if (known) return known;
    }
    return roulette(others, (o) => this.weight(me, mem, o));
  }

  weight(me, mem, o) {
    let w = 1 + (mem.suspicion.get(o.id) || 0);
    if (mem.knownTown.has(o.id)) w *= 0.1;
    if (isMafia(me.role) && isMafia(o.role)) w = 0; // мафия не голосует против своих
    // Эффект толпы: присоединяемся к тому, кого уже много хотят изгнать
    const crowd = this.room.tally()[o.id] || 0;
    w += crowd * 0.8;
    return w;
  }

  onVote() {
    for (const p of this.room.alive()) {
      if (!this.auto(p)) continue;
      this.later(rand(3000, (DUR.vote - 8) * 1000), () => this.doVote(p.id));
    }
  }

  doVote(id) {
    const room = this.room;
    const p = room.get(id);
    if (!this.auto(p) || room.phase !== 'vote') return;
    const others = room.alive().filter((x) => x.id !== id && !(isMafia(p.role) && isMafia(x.role)));
    if (!others.length) return;
    try {
      if (Math.random() < 0.06) return room.vote(id, null); // иногда воздерживаются
      room.vote(id, this.suspectOf(p, others).id);
    } catch { /* фаза могла смениться */ }
  }

  /** Человек потерял связь/ушёл посреди партии: подключаем мозг к текущей фазе */
  onAutopilot(p) {
    const room = this.room;
    if (!p.alive) return;
    if (room.phase === 'night' && room.stepActive && STEP_ROLES[room.step].includes(p.role) && !room.nightState.acted.has(p.id)) {
      this.later(rand(2000, 6000), () => this.doNight(p.id, room.step));
    } else if (room.phase === 'vote' && !room.votes.has(p.id)) {
      this.later(rand(2000, 8000), () => this.doVote(p.id));
    }
  }

  // ---------------------------------------------------------------
  // Наблюдения за ходом партии (для стратегии)
  // ---------------------------------------------------------------
  /** Изгнан кот: его роль раскрыта. Кто голосовал за мирного — подозрителен, за мафию — вероятно честен */
  observeExecution(dead, votes) {
    const team = teamOf(dead.role);
    for (const p of this.room.players.values()) {
      if (!p.isBot && !p.autopilot) continue;
      const mem = this.memOf(p.id);
      mem.knownMafia.delete(dead.id);
      for (const [voter, target] of votes) {
        if (target !== dead.id || voter === p.id) continue;
        mem.suspicion.set(voter, (mem.suspicion.get(voter) || 0) + (team === 'town' ? 1.5 : -0.7));
      }
    }
  }

  /** Погибшие ночью: роль раскрыта — убираем их из списка известных мафиози */
  observeDeaths(deaths) {
    for (const d of deaths) for (const mem of this.mem.values()) mem.knownMafia.delete(d.id);
  }
}
