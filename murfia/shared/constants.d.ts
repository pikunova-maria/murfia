import type { Role, Team, Winner } from './types';

export const MIN_PLAYERS: number;
export const MAX_PLAYERS: number;
export const ROLES: Role[];
export const ROLE_META: Record<Role, { name: string; emoji: string; team: Team; desc: string }>;
export const TEAM_META: Record<Winner, { name: string; emoji: string }>;
export const AVATARS: { id: string; breed: string }[];
export const AVATAR_IDS: string[];
export const DEFAULT_AVATAR: string;
export const BOT_NAMES: string[];
export const ACHIEVEMENTS: { code: string; emoji: string; title: string; desc: string }[];
export function buildRoleList(n: number): Role[];
