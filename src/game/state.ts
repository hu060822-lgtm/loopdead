import type { Room } from './room';

/** The one place that decides which top-level state the game is in (GDD §60). */
export type GameState = 'MENU' | 'LEVEL_SELECT' | 'PLAYING' | 'PAUSED' | 'DEAD' | 'LEVEL_COMPLETE';

export type Screen = 'MENU' | 'LEVEL_SELECT' | 'GAME';

export function deriveGameState(screen: Screen, room: Room | null, paused: boolean): GameState {
  if (screen === 'MENU') return 'MENU';
  if (screen === 'LEVEL_SELECT' || !room) return 'LEVEL_SELECT';
  if (room.status === 'COMPLETE') return 'LEVEL_COMPLETE';
  if (paused) return 'PAUSED';
  if (room.status === 'DYING') return 'DEAD';
  return 'PLAYING';
}
