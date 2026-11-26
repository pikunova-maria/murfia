import { useEffect, useState } from 'react';

/** Секунды до конца фазы (с поправкой на разницу часов клиента и сервера) */
export function useCountdown(endsAt: number | null, clockOffset: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + clockOffset)) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, clockOffset]);
  return left;
}
