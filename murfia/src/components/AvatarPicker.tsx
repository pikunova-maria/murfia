import { AVATARS } from '../../shared/constants';
import { cn } from '../lib/cn';

/** Выбор породы: карточки из колоды */
export default function AvatarPicker({ value, onChange }: { value: string; onChange: (a: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Порода">
      {AVATARS.map((a) => {
        const on = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={a.breed}
            onClick={() => onChange(a.id)}
            className={cn(
              'overflow-hidden rounded-xl border-2 transition duration-200',
              on
                ? 'z-10 scale-110 border-gold shadow-glow ring-2 ring-paw'
                : 'border-transparent opacity-75 hover:-translate-y-1 hover:scale-105 hover:opacity-100',
            )}
          >
            <img src={`/cats/${a.id}.jpg`} alt={a.breed} draggable={false} loading="lazy" className="block aspect-[2/3] w-full object-cover" />
          </button>
        );
      })}
    </div>
  );
}
