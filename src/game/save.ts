import { ACTIONS, DEFAULT_BINDINGS, type Bindings } from './input';

export const SAVE_KEY = 'deadloop_save';

export type Settings = {
  masterVolume: number; // 0..1
  sfxVolume: number;
  musicVolume: number;
  screenShake: boolean;
  reducedEffects: boolean;
  bindings: Bindings;
};

export type LevelRecord = { completed: true; bestTime: number; bestLoops: number; bestDeaths: number };

export type SaveData = {
  version: 1;
  unlockedLevels: string[];
  completedLevels: Record<string, LevelRecord>;
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.45,
  screenShake: true,
  reducedEffects: false,
  bindings: DEFAULT_BINDINGS,
};

function freshSave(firstLevel: string): SaveData {
  return {
    version: 1,
    unlockedLevels: [firstLevel],
    completedLevels: {},
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

function clamp01(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
}

function cleanBindings(raw: unknown): Bindings {
  const out = structuredClone(DEFAULT_BINDINGS);
  if (typeof raw !== 'object' || raw === null) return out;
  for (const a of ACTIONS) {
    const v = (raw as Record<string, unknown>)[a];
    if (Array.isArray(v) && v.length > 0 && v.every((k) => typeof k === 'string')) out[a] = v as string[];
  }
  return out;
}

/** Loads the save, repairing or discarding anything malformed (never throws). */
export function loadSave(firstLevel: string): SaveData {
  let raw: unknown = null;
  try {
    const text = localStorage.getItem(SAVE_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  const save = freshSave(firstLevel);
  if (typeof raw !== 'object' || raw === null) return save;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.unlockedLevels)) {
    save.unlockedLevels = Array.from(new Set([firstLevel, ...r.unlockedLevels.filter((x): x is string => typeof x === 'string')]));
  }
  if (typeof r.completedLevels === 'object' && r.completedLevels !== null) {
    for (const [id, rec] of Object.entries(r.completedLevels as Record<string, unknown>)) {
      const x = rec as Record<string, unknown>;
      if (x && typeof x.bestTime === 'number' && typeof x.bestLoops === 'number' && typeof x.bestDeaths === 'number') {
        save.completedLevels[id] = { completed: true, bestTime: x.bestTime, bestLoops: x.bestLoops, bestDeaths: x.bestDeaths };
      }
    }
  }
  if (typeof r.settings === 'object' && r.settings !== null) {
    const s = r.settings as Record<string, unknown>;
    save.settings = {
      masterVolume: clamp01(s.masterVolume, DEFAULT_SETTINGS.masterVolume),
      sfxVolume: clamp01(s.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      musicVolume: clamp01(s.musicVolume, DEFAULT_SETTINGS.musicVolume),
      screenShake: typeof s.screenShake === 'boolean' ? s.screenShake : DEFAULT_SETTINGS.screenShake,
      reducedEffects: typeof s.reducedEffects === 'boolean' ? s.reducedEffects : DEFAULT_SETTINGS.reducedEffects,
      bindings: cleanBindings(s.bindings),
    };
  }
  return save;
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable (private mode, blocked): progress simply isn't persisted.
  }
}

export function recordCompletion(
  save: SaveData, levelId: string, nextLevelId: string | null, time: number, loops: number, deaths: number,
): SaveData {
  const prev = save.completedLevels[levelId];
  const rec: LevelRecord = prev
    ? { completed: true, bestTime: Math.min(prev.bestTime, time), bestLoops: Math.min(prev.bestLoops, loops), bestDeaths: Math.min(prev.bestDeaths, deaths) }
    : { completed: true, bestTime: time, bestLoops: loops, bestDeaths: deaths };
  const unlocked = new Set(save.unlockedLevels);
  if (nextLevelId) unlocked.add(nextLevelId);
  return { ...save, completedLevels: { ...save.completedLevels, [levelId]: rec }, unlockedLevels: [...unlocked] };
}
