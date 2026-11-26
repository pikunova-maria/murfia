// Типизированные обёртки над событиями «клиент → сервер» с промисами и таймаутом.
import { socket } from './socket';
import type { Ack, Profile, RoomSummary } from '../../shared/types';

type RawEmitter = { emit: (event: string, ...args: unknown[]) => void };

function call<T extends object = object>(event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Сервер не ответил, мяу 🙀')), 8000);
    const cb = (r: Ack<T>) => {
      clearTimeout(timer);
      if (r.ok) resolve(r as unknown as T);
      else reject(new Error(r.error));
    };
    const args = payload === undefined ? [cb] : [payload, cb];
    (socket as unknown as RawEmitter).emit(event, ...args);
  });
}

export const api = {
  login: (p: { token?: string; name: string; avatar: string }) =>
    call<{ profile: Profile; roomCode: string | null }>('profile:login', p),
  updateProfile: (p: { name: string; avatar: string }) => call<{ profile: Profile }>('profile:update', p),
  listRooms: () => call<{ rooms: RoomSummary[] }>('rooms:list'),
  createRoom: (maxPlayers: number, isPublic: boolean) => call<{ code: string }>('room:create', { maxPlayers, isPublic }),
  joinRoom: (code: string) => call<{ code: string }>('room:join', { code }),
  leaveRoom: () => socket.emit('room:leave'),
  addBot: () => call('room:addBot'),
  kickBot: (botId: string) => call('room:kickBot', { botId }),
  start: () => call('room:start'),
  rematch: () => call('room:rematch'),
  chat: (text: string) => call('chat:send', { text }),
  vote: (targetId: string | null) => call('vote:cast', { targetId }),
  night: (targetId: string, targetId2?: string) => call('night:action', { targetId, targetId2 }),
  skipDay: () => call('day:skip'),
};
