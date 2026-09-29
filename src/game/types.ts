export type Vector2 = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

/** Readable form of one recorded tick. Stored compactly as a bitmask byte. */
export type InputFrame = {
  left: boolean;
  right: boolean;
  jump: boolean;
  dash: boolean;
};

export type CharacterStateName = 'IDLE' | 'RUN' | 'JUMP' | 'FALL' | 'DASH' | 'DEAD' | 'FINISHED';

export type DeathCause = 'spike' | 'fall' | 'enemy' | 'laser' | 'crush' | 'timeout';

export type ReplayData = {
  id: string;
  /** One bitmask byte per simulation tick, index = frame. */
  inputs: Uint8Array;
  deathFrame: number;
  deathPosition: Vector2;
  deathVelocity: Vector2;
  cause: DeathCause;
};

// ---------- Level data (JSON) ----------

export type LevelObjectType = 'plate' | 'door' | 'walker' | 'hint' | 'platform' | 'laser' | 'orb' | 'spring' | 'conveyor' | 'crawler' | 'brute' | 'mimic' | 'crusher';

/** Unified level object. Coordinates and sizes are in tiles. */
export type LevelObject = {
  id: string;
  type: LevelObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: Record<string, unknown>;
};

export type LevelDef = {
  id: string;
  name: string;
  world: string;
  width: number;
  height: number;
  /**
   * Tile rows (length = height, each row length = width).
   * '#' solid  '^' floor spike  'v' ceiling spike  '=' one-way platform  '.' empty
   * 'g' grip wall (solid, wall-jumpable)  'x' crumbling block (solid until stood on)
   * '<' '>' wall spikes   'n' NOW block (solid only for the living you)   'p' PAST block (solid only for past selves)
   */
  tiles: string[];
  spawn: Vector2;
  exit: Vector2;
  /** Optional per-loop time limit in seconds. */
  loopDuration?: number;
  /** Echo rooms: living past selves are solid from above — you can stand and ride on them. */
  solidGhosts?: boolean;
  objects: LevelObject[];
};

export type GameStatus = 'PLAYING' | 'DYING' | 'COMPLETE';

export type GameEvent =
  | { type: 'jump'; replay: boolean }
  | { type: 'dash'; replay: boolean }
  | { type: 'death'; replay: boolean; x: number; y: number; cause: DeathCause }
  | { type: 'plate'; on: boolean }
  | { type: 'door'; open: boolean }
  | { type: 'alert' }
  | { type: 'burn'; x: number; y: number }
  | { type: 'spring'; replay: boolean; x: number; y: number }
  | { type: 'orb'; replay: boolean; x: number; y: number }
  | { type: 'crumble'; x: number; y: number }
  | { type: 'walljump'; replay: boolean }
  | { type: 'slam'; x: number; y: number }
  | { type: 'loop' }
  | { type: 'complete' };
