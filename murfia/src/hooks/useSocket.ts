// Подключение к серверу, подписка на события, автоматический вход и реконнект.
import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { loadSession, performLogin } from '../lib/session';
import { useGameStore } from '../store/gameStore';

export function useSocket() {
  useEffect(() => {
    const st = () => useGameStore.getState();

    const onConnect = async () => {
      st().setConnected(true);
      st().setServerDown(false);
      const saved = loadSession();
      if (saved) {
        try {
          await performLogin(saved);
        } catch (e) {
          st().pushToast((e as Error).message, 'error');
        }
      }
      st().setReady(true);
    };
    const onDisconnect = () => st().setConnected(false);
    // Сервер недоступен: не держим вечную заставку, а показываем экран с подсказкой
    const onConnectError = () => {
      st().setConnected(false);
      st().setServerDown(true);
      st().setReady(true);
    };

    socket.on('connect', () => void onConnect());
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('rooms:list', (rooms) => st().setRooms(rooms));
    socket.on('game:state', (view) => st().setView(view));
    socket.on('chat:history', (msgs) => st().setChat(msgs));
    socket.on('chat:message', (m) => st().addChat(m));
    socket.on('room:closed', (reason) => { st().setView(null); st().pushToast(reason, 'info'); });
    socket.on('profile:update', (profile) => st().setProfile({ ...st().profile, ...profile, token: st().profile?.token }));

    socket.connect();
    return () => {
      socket.off();
      socket.disconnect();
    };
  }, []);
}
