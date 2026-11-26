// Аватар кота: «мордочка» с карточки породы. Для старых профилей с эмодзи — запасной вариант.
import { AVATARS } from '../../shared/constants';
import { cn } from '../lib/cn';

interface Props {
  id: string;
  size?: number;
  dead?: boolean;
  className?: string;
}

export default function Avatar({ id, size = 48, dead, className }: Props) {
  const breed = AVATARS.find((a) => a.id === id);
  if (!breed) {
    return (
      <span
        style={{ width: size, height: size, fontSize: size * 0.75, lineHeight: 1 }}
        className={cn('inline-flex shrink-0 items-center justify-center', dead && 'grayscale', className)}
      >
        {id}
      </span>
    );
  }
  return (
    <img
      src={`/cats/${breed.id}-face.jpg`}
      alt={breed.breed}
      title={breed.breed}
      width={size}
      height={size}
      draggable={false}
      style={{ width: size, height: size }}
      className={cn(
        'shrink-0 rounded-full object-cover ring-2 ring-gold shadow-md',
        dead && 'grayscale',
        className,
      )}
    />
  );
}
