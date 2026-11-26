// Корень приложения. «Роутинг» вычисляется из состояния:
// нет профиля → Welcome; нет комнаты → Menu (лобби); лобби комнаты → RoomLobby;
// идёт партия → Game; партия окончена → Results.
import { useEffect, type ReactNode } from 'react';
import EventOverlay from './components/EventOverlay';
import Game from './components/Game';
import Menu from './components/Menu';
import NightSky from './components/NightSky';
import Results from './components/Results';
import RoomLobby from './components/RoomLobby';
import Toasts from './components/Toasts';
import Welcome from './components/Welcome';
import { useGameEvents } from './hooks/useGameEvents';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './store/gameStore';

export default function App() {
  useSocket();
  useGameEvents();

  const profile = useGameStore((s) => s.profile);
  const view = useGameStore((s) => s.view);
  const ready = useGameStore((s) => s.ready);
  const connected = useGameStore((s) => s.connected);
  const serverDown = useGameStore((s) => s.serverDown);

  // Ночная тема: класс dark на <html> (Tailwind) и night на <body> (фон)
  const night = view?.phase === 'night' || view?.phase === 'reveal';
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!night);
    document.body.classList.toggle('night', !!night);
  }, [night]);

  let screen: ReactNode;
  if (!ready) screen = <div className="flex min-h-screen items-center justify-center text-6xl animate-float">🐾</div>;
  else if (!profile) screen = <Welcome />;
  else if (!view) screen = <Menu />;
  else if (view.phase === 'lobby') screen = <RoomLobby view={view} />;
  else if (view.phase === 'ended') screen = <Results view={view} />;
  else screen = <Game view={view} />;

  return (
    <div className="min-h-screen">
      {night && <NightSky />}
      {!connected && ready && (
        <div className="sticky top-0 z-50 bg-red-500 px-3 py-1.5 text-center text-sm font-extrabold text-white">
          {serverDown
            ? '📡 Не удаётся подключиться к серверу. Он запущен? В папке проекта выполни npm run dev и проверь http://localhost:3001/health'
            : '📡 Связь потеряна — переподключаемся… Ты вернёшься в свою комнату автоматически.'}
        </div>
      )}
      {screen}
      <EventOverlay />
      <Toasts />
    </div>
  );
}
