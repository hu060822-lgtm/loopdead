import type { LevelDef } from '../game/types';
import { parseLevel } from '../game/level';

// Every src/levels/levelNN.json, in file-name order. Parsed lazily so one broken
// file can't take down the menu.
const modules = import.meta.glob('./level*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
export const RAW_LEVELS: unknown[] = Object.keys(modules).sort().map((k) => modules[k]);

export type LevelEntry = { index: number; id: string; name: string; world: string; def: LevelDef | null; error: string | null };

export const LEVELS: LevelEntry[] = RAW_LEVELS.map((raw, index) => {
  const r = raw as { id?: unknown; name?: unknown; world?: unknown };
  try {
    const def = parseLevel(raw);
    return { index, id: def.id, name: def.name, world: def.world, def, error: null };
  } catch (e) {
    return {
      index,
      id: typeof r.id === 'string' ? r.id : `level${index + 1}`,
      name: typeof r.name === 'string' ? r.name : 'Unknown',
      world: typeof r.world === 'string' ? r.world : '',
      def: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
});

/** '07' for main rooms, 'S2' for special rooms. */
export function roomLabel(l: LevelEntry): string {
  if (l.world === 'SPECIAL') {
    const first = LEVELS.findIndex((x) => x.world === 'SPECIAL');
    return `S${l.index - first + 1}`;
  }
  return String(l.index + 1).padStart(2, '0');
}
