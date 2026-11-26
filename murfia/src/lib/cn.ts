/** Склейка CSS-классов: пропускает ложные значения */
export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
