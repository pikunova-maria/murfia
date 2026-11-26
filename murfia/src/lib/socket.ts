// Единственное соединение с сервером. Типизировано событиями из shared/types.
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';

const url = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
});
