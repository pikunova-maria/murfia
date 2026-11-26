// Глобальное состояние клиента (Zustand).
import { create } from 'zustand';
import type { ChatMessage, GameEvent, GameView, Profile, RoomSummary } from '../../shared/types';
import { isMuted, setMuted } from '../lib/sound';

export interface Overlay { id: number; event: GameEvent }
export interface Toast { id: number; text: string; tone: 'info' | 'error' | 'good' }
export interface Bubble { text: string; ts: number }

interface GameStore {
  connected: boolean;
  serverDown: boolean;                  // не удалось подключиться к серверу
  ready: boolean;                       // попытка входа по сохранённому токену завершена
  profile: Profile | null;
  rooms: RoomSummary[];
  view: GameView | null;
  chat: ChatMessage[];
  bubbles: Record<string, Bubble>;      // «мяу»-пузыри над котами
  overlay: Overlay | null;
  toasts: Toast[];
  clockOffset: number;                  // серверное время − клиентское
  phaseTotal: number;                   // длительность текущей фазы, мс (для полоски таймера)
  phaseKey: string;
  muted: boolean;

  setConnected: (v: boolean) => void;
  setReady: (v: boolean) => void;
  setServerDown: (v: boolean) => void;
  setProfile: (p: Profile | null) => void;
  setRooms: (r: RoomSummary[]) => void;
  setView: (v: GameView | null) => void;
  setChat: (m: ChatMessage[]) => void;
  addChat: (m: ChatMessage) => void;
  showOverlay: (event: GameEvent, ms: number) => void;
  pushToast: (text: string, tone?: Toast['tone']) => void;
  toggleMute: () => void;
}

let seq = 1;
const bubbleTimers = new Map<string, ReturnType<typeof setTimeout>>();
let overlayTimer: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = create<GameStore>()((set, get) => ({
  connected: false,
  ready: false,
  serverDown: false,
  profile: null,
  rooms: [],
  view: null,
  chat: [],
  bubbles: {},
  overlay: null,
  toasts: [],
  clockOffset: 0,
  phaseTotal: 0,
  phaseKey: '',
  muted: isMuted(),

  setConnected: (connected) => set({ connected }),
  setReady: (ready) => set({ ready }),
  setServerDown: (serverDown) => set({ serverDown }),
  setProfile: (profile) => set({ profile }),
  setRooms: (rooms) => set({ rooms }),

  setView: (view) => {
    if (!view) {
      set({ view: null, chat: [], bubbles: {}, overlay: null, phaseKey: '' });
      return;
    }
    const key = `${view.phase}|${view.step}|${view.day}|${view.night}`;
    const patch: Partial<GameStore> = { view, clockOffset: view.serverNow - Date.now() };
    if (key !== get().phaseKey) {
      patch.phaseKey = key;
      patch.phaseTotal = view.phaseEndsAt ? Math.max(1, view.phaseEndsAt - view.serverNow) : 0;
    }
    set(patch);
  },

  setChat: (chat) => set({ chat }),

  addChat: (m) => {
    set((s) => ({ chat: [...s.chat.slice(-299), m] }));
    // Реплики дневного чата показываем пузырём над головой кота
    if (m.channel === 'day' && m.from) {
      const id = m.from.id;
      set((s) => ({ bubbles: { ...s.bubbles, [id]: { text: m.text, ts: m.ts } } }));
      const old = bubbleTimers.get(id);
      if (old) clearTimeout(old);
      bubbleTimers.set(id, setTimeout(() => {
        set((s) => {
          const { [id]: _gone, ...rest } = s.bubbles;
          void _gone;
          return { bubbles: rest };
        });
      }, 5000));
    }
  },

  showOverlay: (event, ms) => {
    const id = seq++;
    if (overlayTimer) clearTimeout(overlayTimer);
    set({ overlay: { id, event } });
    overlayTimer = setTimeout(() => set((s) => (s.overlay?.id === id ? { overlay: null } : s)), ms);
  },

  pushToast: (text, tone = 'info') => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },

  toggleMute: () => {
    const next = !get().muted;
    setMuted(next);
    set({ muted: next });
  },
}));
