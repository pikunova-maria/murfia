// ============================================================
// Настройки таймеров. MURFIA_SPEED=50 ускоряет всё в 50 раз (для тестов).
// ============================================================

export const SPEED = Number(process.env.MURFIA_SPEED) > 0 ? Number(process.env.MURFIA_SPEED) : 1;

/** Длительности фаз, секунды */
export const DUR = {
  reveal: 7,       // показ роли
  day: 120,        // дневное обсуждение
  vote: 30,        // голосование
  execution: 5,    // анимация изгнания
  morning: 7,      // утро: рассказ ведущего
  fakeStep: 4,     // «пустой» ночной шаг (роль мертва/отсутствует), чтобы не выдавать состав
  steps: {         // ночные шаги: время на действие
    cupid: 25,
    mafia: 25,
    maniac: 15,
    doctor: 15,
    detective: 15,
  },
};

/** Порядок пробуждения ролей ночью */
export const STEPS = ['cupid', 'mafia', 'maniac', 'doctor', 'detective'];

/** Какие роли действуют на каком шаге */
export const STEP_ROLES = {
  cupid: ['cupid'],
  mafia: ['mafia', 'godfather'],
  maniac: ['maniac'],
  doctor: ['doctor'],
  detective: ['detective'],
};

export const isMafia = (role) => role === 'mafia' || role === 'godfather';

/** Команда по роли */
export const teamOf = (role) =>
  role === 'mafia' || role === 'godfather' ? 'mafia' : role === 'maniac' ? 'maniac' : 'town';
