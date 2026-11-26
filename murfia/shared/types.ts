// ============================================================
// Типы Socket.IO-протокола «МУР-ФИЯ».
// Импортируются клиентом (TypeScript) и используются сервером через JSDoc.
// ============================================================

export type Role = 'civilian' | 'mafia' | 'godfather' | 'doctor' | 'detective' | 'cupid' | 'maniac';
export type Team = 'town' | 'mafia' | 'maniac';
export type Winner = Team | 'draw';

/** Фазы партии */
export type Phase =
  | 'lobby'      // ожидание игроков
  | 'reveal'     // показ роли
  | 'night'      // ночь (роли просыпаются по очереди)
  | 'morning'    // утро: объявление жертв
  | 'day'        // дневное обсуждение
  | 'vote'       // голосование
  | 'execution'  // изгнание
  | 'ended';     // итоги

/** Шаги ночи (в порядке пробуждения) */
export type NightStep = 'cupid' | 'mafia' | 'maniac' | 'doctor' | 'detective';

export type ChatChannel = 'day' | 'mafia' | 'ghost' | 'system';
export type ActionKind = 'pick' | 'pick2';
export type CheckResult = 'mafia' | 'civilian';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  games: number;
  wins: number;
  achievements: string[];
  /** Секретный токен — приходит только владельцу при входе */
  token?: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  alive: boolean;
  connected: boolean;
  isBot: boolean;
  isHost: boolean;
  /** Роль видна: себе, сообщникам-мафии, мёртвым и всем после игры */
  role?: Role;
  /** Сколько «лапок» над головой (голоса против) */
  votes: number;
  /** Кого выбрал (видно всем в фазу голосования). null = воздержался */
  votedFor?: string | null;
}

export interface MeView {
  id: string;
  role: Role | null;
  team: Team | null;
  alive: boolean;
  /** Сообщники по банде (id) */
  mates: string[];
  /** Возлюбленный (id) */
  lover: string | null;
  /** Можно ли прямо сейчас сделать ночное действие */
  canAct: boolean;
  acted: boolean;
  actionKind: ActionKind | null;
  /** Допустимые цели ночного действия */
  targets: string[];
  /** Голоса мафии (voterId → targetId), видны только банде */
  mafiaVotes: Record<string, string>;
  investigations: { id: string; result: CheckResult }[];
  /** Мой голос: undefined = ещё не голосовал, null = воздержался */
  myVote: string | null | undefined;
  skippedDay: boolean;
}

export interface GameView {
  code: string;
  phase: Phase;
  day: number;
  night: number;
  step: NightStep | null;
  stepActive: boolean;
  nightHint: string | null;
  phaseEndsAt: number | null;
  serverNow: number;
  maxPlayers: number;
  isPublic: boolean;
  hostId: string;
  players: PublicPlayer[];
  me: MeView;
  winner: Winner | null;
  winners: string[];
}

export interface ChatMessage {
  id: number;
  channel: ChatChannel;
  from?: { id: string; name: string; avatar: string };
  text: string;
  ts: number;
  /** Адресат (для личных системных сообщений) */
  to?: string;
  /** Сообщение состоит только из «мяу» */
  meow?: boolean;
}

export interface RoomSummary {
  code: string;
  hostName: string;
  hostAvatar: string;
  players: number;
  maxPlayers: number;
}

export interface DeathInfo {
  id: string;
  name: string;
  avatar: string;
  role: Role;
  cause: 'night' | 'love' | 'exile';
}

export type GameEvent =
  | { kind: 'phase'; phase: Phase; text: string }
  | { kind: 'morning'; deaths: DeathInfo[]; saved: boolean }
  | { kind: 'execution'; player: DeathInfo | null; votes: Record<string, number> }
  | { kind: 'detective'; targetId: string; result: CheckResult }
  | { kind: 'love'; withId: string }
  | { kind: 'gameover'; winner: Winner };

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServerEvents {
  'profile:login': (
    p: { token?: string; name: string; avatar: string },
    ack: (r: Ack<{ profile: Profile; roomCode: string | null }>) => void,
  ) => void;
  'profile:update': (p: { name: string; avatar: string }, ack: (r: Ack<{ profile: Profile }>) => void) => void;
  'rooms:list': (ack: (r: Ack<{ rooms: RoomSummary[] }>) => void) => void;
  'room:create': (p: { maxPlayers: number; isPublic: boolean }, ack: (r: Ack<{ code: string }>) => void) => void;
  'room:join': (p: { code: string }, ack: (r: Ack<{ code: string }>) => void) => void;
  'room:leave': () => void;
  'room:addBot': (ack?: (r: Ack) => void) => void;
  'room:kickBot': (p: { botId: string }, ack?: (r: Ack) => void) => void;
  'room:start': (ack?: (r: Ack) => void) => void;
  'room:rematch': (ack?: (r: Ack) => void) => void;
  'chat:send': (p: { text: string }, ack?: (r: Ack) => void) => void;
  'vote:cast': (p: { targetId: string | null }, ack?: (r: Ack) => void) => void;
  'night:action': (p: { targetId: string; targetId2?: string }, ack?: (r: Ack) => void) => void;
  'day:skip': (ack?: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'rooms:list': (rooms: RoomSummary[]) => void;
  'game:state': (view: GameView) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'game:event': (e: GameEvent) => void;
  'profile:update': (p: Profile, unlocked: string[]) => void;
  'room:closed': (reason: string) => void;
}
