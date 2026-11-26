// Звуки на Web Audio API — без аудиофайлов: мурчание, «мяу», звоночки.
type WinWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('murfia.muted') === '1'; } catch { /* приватный режим */ }

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    const Ctor = window.AudioContext || (window as WinWithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Браузер разрешает звук только после жеста пользователя
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { if (!muted) ac(); }, { once: true });
}

export const isMuted = () => muted;
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem('murfia.muted', v ? '1' : '0'); } catch { /* ignore */ }
}

/** Мурчание: шум, пропущенный через полосовой фильтр и «дрожащий» на ~25 Гц */
export function purr(duration = 1.1) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 140;
  band.Q.value = 1.2;

  const trem = c.createGain();
  trem.gain.value = 0.5;
  const lfo = c.createOscillator();
  lfo.frequency.value = 25;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(trem.gain);

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.5, t0 + 0.15);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  noise.connect(band).connect(trem).connect(env).connect(c.destination);
  noise.start(t0); lfo.start(t0);
  noise.stop(t0 + duration); lfo.stop(t0 + duration);
}

/** «Мяу»: пила с плавным подъёмом и спадом тона + формантный фильтр */
export function meow(pitch = 1) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = 0.7;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420 * pitch, t0);
  osc.frequency.linearRampToValueAtTime(820 * pitch, t0 + 0.22);
  osc.frequency.exponentialRampToValueAtTime(380 * pitch, t0 + dur);

  const formant = c.createBiquadFilter();
  formant.type = 'bandpass';
  formant.Q.value = 4;
  formant.frequency.setValueAtTime(700, t0);
  formant.frequency.linearRampToValueAtTime(1800, t0 + 0.25);
  formant.frequency.linearRampToValueAtTime(900, t0 + dur);

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.35, t0 + 0.08);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(formant).connect(env).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

/** Короткие звоночки: up — победа/радость, down — грусть */
export function chime(kind: 'up' | 'down' | 'soft' = 'soft') {
  const c = ac();
  if (!c) return;
  const notes = kind === 'up' ? [523, 659, 784, 1047] : kind === 'down' ? [392, 330, 262] : [660, 880];
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.14;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.4);
  });
}
