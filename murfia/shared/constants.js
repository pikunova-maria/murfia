// ============================================================
// Общие константы игры «МУР-ФИЯ». Используются и сервером, и клиентом.
// Файл написан на чистом JS (чтобы сервер мог импортировать его без сборки),
// типы лежат рядом в constants.d.ts.
// ============================================================

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 12;

/** Все роли игры */
export const ROLES = ['civilian', 'mafia', 'godfather', 'doctor', 'detective', 'cupid', 'maniac'];

/** Описание ролей: название, эмодзи, команда, краткое правило */
export const ROLE_META = {
  civilian: {
    name: 'Мирный кот', emoji: '🐈', team: 'town',
    desc: 'Обычный житель Мурграда. Ночью спит, днём ищет Чёрных Котов и голосует.',
  },
  mafia: {
    name: 'Чёрный Кот', emoji: '🐈‍⬛', team: 'mafia',
    desc: 'Член банды. Ночью вместе с бандой выбирает жертву, днём притворяется мирным.',
  },
  godfather: {
    name: 'Дон Кото', emoji: '😼', team: 'mafia',
    desc: 'Главарь банды. Детектив видит его мирным. При ничьей в банде решает он.',
  },
  doctor: {
    name: 'Кот-Доктор', emoji: '🩺', team: 'town',
    desc: 'Каждую ночь лечит одного кота (можно себя), но не одного и того же две ночи подряд.',
  },
  detective: {
    name: 'Кот-Детектив', emoji: '🕵️', team: 'town',
    desc: 'Каждую ночь проверяет одного кота: мирный он или из банды. Дон Кото для него «мирный».',
  },
  cupid: {
    name: 'Кот-Купидон', emoji: '💘', team: 'town',
    desc: 'В первую ночь связывает любовью двух котов. Если один умрёт, второй умрёт от тоски.',
  },
  maniac: {
    name: 'Кот-Маньяк', emoji: '🧙', team: 'maniac',
    desc: 'Играет сам за себя. Убивает каждую ночь. Побеждает, если останется один.',
  },
};

/** Команды */
export const TEAM_META = {
  town: { name: 'Мирные пушистики', emoji: '😺' },
  mafia: { name: 'Чёрные Коты', emoji: '🐈‍⬛' },
  maniac: { name: 'Кот-Маньяк', emoji: '🧙' },
  draw: { name: 'Ничья', emoji: '🙀' },
};

/**
 * Аватары — карточки пород кошек. Файлы лежат в public/cats/:
 *   <id>.jpg      — вся карточка (для выбора в профиле)
 *   <id>-face.jpg — квадратная «мордочка» (для кружков за столом, в чате, голосовании)
 */
export const AVATARS = [
  { id: 'russian-blue', breed: 'Русская голубая' },
  { id: 'maine-coon', breed: 'Мэйн-кун' },
  { id: 'sphynx', breed: 'Сфинкс' },
  { id: 'abyssinian', breed: 'Абиссинская кошка' },
  { id: 'devon-rex', breed: 'Девон-рекс' },
  { id: 'exotic', breed: 'Экзот' },
  { id: 'bengal', breed: 'Бенгальская кошка' },
  { id: 'ragdoll', breed: 'Рэгдолл' },
];
export const AVATAR_IDS = AVATARS.map((a) => a.id);
export const DEFAULT_AVATAR = AVATAR_IDS[0];

/** Имена для ИИ-котов */
export const BOT_NAMES = [
  'Барсик', 'Мурка', 'Васька', 'Пушок', 'Снежок', 'Рыжик', 'Тимка', 'Багира',
  'Кузя', 'Мотя', 'Симба', 'Нюся', 'Леопольд', 'Матроскин', 'Бегемот', 'Бусинка',
];

/** Достижения профиля */
export const ACHIEVEMENTS = [
  { code: 'first_game', emoji: '🐾', title: 'Первые лапки', desc: 'Сыграть первую партию' },
  { code: 'first_win', emoji: '🏆', title: 'Первая сметана', desc: 'Выиграть первую партию' },
  { code: 'games_10', emoji: '😻', title: 'Завсегдатай', desc: 'Сыграть 10 партий' },
  { code: 'wins_5', emoji: '👑', title: 'Король крыш', desc: 'Одержать 5 побед' },
  { code: 'mafia_win', emoji: '🐈‍⬛', title: 'Тёмная сторона', desc: 'Победить за Чёрных Котов' },
  { code: 'maniac_win', emoji: '🧙', title: 'Кот, который гулял сам по себе', desc: 'Победить за Маньяка' },
  { code: 'doctor_save', emoji: '🩺', title: 'Девять жизней', desc: 'Спасти кота доктором' },
  { code: 'detective_catch', emoji: '🕵️', title: 'Острый нюх', desc: 'Найти Чёрного Кота детективом' },
];

/**
 * Набор ролей для партии из n игроков (6..12).
 * Баланс: мафия ≈ 1/4–1/3 стола (только Дон до 8 игроков), всегда есть доктор и детектив,
 * купидон с 8 игроков, маньяк с 9.
 * @param {number} n
 * @returns {string[]}
 */
export function buildRoleList(n) {
  const roles = ['godfather'];
  const extraMafia = n >= 11 ? 2 : n >= 9 ? 1 : 0;
  for (let i = 0; i < extraMafia; i++) roles.push('mafia');
  roles.push('doctor', 'detective');
  if (n >= 8) roles.push('cupid');
  if (n >= 9) roles.push('maniac');
  while (roles.length < n) roles.push('civilian');
  return roles.slice(0, n);
}
