import { createCharacter, stepCharacter, type Character } from './character';
import {
  CHAR_H, CHAR_W, CORPSE_H, CORPSE_W, CRUMBLE_TICKS, DEATH_FREEZE_FRAMES, GRAVITY, MAX_FALL, ORB_RESPAWN,
  OUT_OF_BOUNDS_MARGIN, SPRING_FORCE, CRAWLER_W, CRAWLER_H, CRAWLER_SPEED, BRUTE_W, BRUTE_H,
  BRUTE_PATROL_SPEED, BRUTE_CHASE_SPEED, CRUSHER_GRAVITY, CRUSHER_MAX_FALL, CRUSHER_WAIT, CRUSHER_RISE, PURSUE_SEARCH,
  REPLAY_CAP, TICK_RATE, TILE, WALKER_CHASE_SPEED, WALKER_DEFAULT_SIGHT, WALKER_H,
  WALKER_PATROL_SPEED, WALKER_SIGHT_Y, WALKER_W,
} from './constants';
import { plateTargets } from './level';
import { isGrounded, moveX, moveY, overlapsXYWH, type Body, type CollisionWorld } from './physics';
import type { DeathCause, GameEvent, GameStatus, LevelDef, ReplayData, Vector2 } from './types';

// ---------- Tiles ----------
export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_SPIKE_UP = 2;
export const T_SPIKE_DOWN = 3;
export const T_ONEWAY = 4;
export const T_CRUMBLE = 5;
export const T_GRIP = 6;
export const T_SPIKE_RIGHT = 7; // '>' mounted on a wall to its left, points right
export const T_SPIKE_LEFT = 8;  // '<' mounted on a wall to its right, points left
export const T_NOW = 9;         // 'n' solid only for the living you
export const T_PAST = 10;       // 'p' solid only for past selves

/** Spike hitbox inside its tile (px). Floor spikes: lower part. Ceiling spikes: upper part. */
export const SPIKE_INSET_X = 2;
export const SPIKE_DEPTH = 9;

// ---------- Entities ----------
export type Corpse = Body & { vy: number; source: number; bornFrame: number };

export type WalkerKind = 'walker' | 'crawler' | 'brute';

export type Walker = Body & {
  id: string;
  kind: WalkerKind;
  alive: boolean;
  patrolSpeed: number;
  chaseSpeed: number;
  /** Crawlers never chase. */
  chases: boolean;
  /** Brutes walk through light and block it. */
  laserProof: boolean;
  /** Pursuers keep walking to where they last saw their target (-1: nowhere). */
  pursue: boolean;
  lastSeenX: number;
  /** Ticks left standing and looking around where the target vanished. */
  searchLeft: number;
  vy: number;
  facing: 1 | -1;
  patrolMin: number | null;
  patrolMax: number | null;
  sight: number;
  sightY: number;
  chasing: boolean;
  grounded: boolean;
};

export type Plate = {
  id: string; x: number; y: number; w: number; targets: string[]; pressed: boolean;
  /** A latching switch stays pressed for the rest of the loop once anything touches it. */
  latch: boolean;
  /** A timed switch stays pressed for `hold` ticks after the last touch (0 = plain plate). */
  hold: number;
  holdLeft: number;
};

/** Anything plates can drive (doors, platforms, lasers). */
type Driven = { plates: Plate[]; require: 'any' | 'all'; invert: boolean };

export type Door = Driven & { id: string; x: number; y: number; w: number; h: number; open: boolean };

export const PLATFORM_H = 5;

export type Platform = Driven & {
  id: string;
  /** Top-left of the platform at the start and end of its track (px). */
  x0: number; y0: number; x1: number; y1: number;
  w: number;
  len: number;
  /** Progress along the track in px, 0..len. */
  t: number;
  dir: 1 | -1;
  speed: number;
  pause: number;
  pauseLeft: number;
  mode: 'loop' | 'plate';
  /** Integer pixel position used for all collisions. */
  x: number; y: number;
  active: boolean;
};

export type LaserDir = 'left' | 'right' | 'up' | 'down';

export type Laser = Driven & {
  id: string;
  /** Emitter tile (px, top-left). */
  tx: number; ty: number;
  dir: LaserDir;
  offset: number;
  mode: 'on' | 'plate' | 'pulse';
  pulseOn: number; pulseOff: number; phase: number;
  on: boolean;
  /** Pulse lasers glow faintly shortly before they fire (no unannounced hazards). */
  warn: boolean;
  /** Current beam rect (px). Empty when off. */
  bx: number; by: number; bw: number; bh: number;
};

export const LASER_WARN_FRAMES = 36;

function isActive(d: Driven): boolean {
  if (d.plates.length === 0) return false;
  return d.require === 'all' ? d.plates.every((p) => p.pressed) : d.plates.some((p) => p.pressed);
}

export type Hint = { x: number; y: number; text: string };

/** Launch pad set into the floor (surface `y` = floor top); anything living that stands on it is thrown upward. */
export type Spring = { x: number; y: number; w: number; fired: number; jammed: boolean };

/** Heavy block that slams down when something living passes under it, then slowly rises. */
export type Crusher = {
  id: string;
  x: number; y: number; w: number; h: number;
  restY: number;
  /** How far below its bottom edge it notices things (px). */
  sight: number;
  /** Rise speed (px/tick). */
  rise: number;
  state: 'idle' | 'fall' | 'wait' | 'rise';
  vy: number;
  ry: number;
  timer: number;
};

/** Belt on top of a row of solid tiles: moves whatever stands on it (people, corpses, walkers). */
export type Conveyor = Driven & { id: string; x: number; y: number; w: number; speed: number; active: boolean };

/** Dash refill. Consumed by whoever needs a dash first (past selves included). */
export type Orb = { x: number; y: number; respawn: number; respawnLeft: number };

/**
 * One room session. Owns all simulation state; the renderer and UI only read it.
 * Everything here must be deterministic: same level + same input bytes -> same result.
 */
export class Room implements CollisionWorld {
  readonly level: LevelDef;
  readonly pxW: number;
  readonly pxH: number;
  private readonly grid: Uint8Array;

  /** When true, replays would collide with each other. Reserved for a later phase (GDD §16). */
  readonly replayCollisionEnabled = false;

  frame = 0;
  loop = 1;
  deaths = 0;
  /** Frames since last room reset (includes death freezes). */
  roomFrames = 0;
  /** Frames since entering the room — never reset by R or undo. The time shown in level select. */
  totalFrames = 0;
  /** Loops played since entering the room (including ones wiped by R). */
  totalLoops = 1;
  status: GameStatus = 'PLAYING';
  deathTimer = 0;
  lastDeath: { cause: DeathCause; x: number; y: number } | null = null;

  replays: ReplayData[] = [];
  characters: Character[] = [];
  player!: Character;
  corpses: Corpse[] = [];
  walkers: Walker[] = [];
  plates: Plate[] = [];
  doors: Door[] = [];
  platforms: Platform[] = [];
  lasers: Laser[] = [];
  hints: Hint[] = [];
  springs: Spring[] = [];
  conveyors: Conveyor[] = [];
  orbs: Orb[] = [];
  /** Enemies that repeat the living you's input this very tick (mirrored ones swap left/right). */
  mimics: Character[] = [];
  crushers: Crusher[] = [];
  /** Per-tile crumble state: 0 intact, >0 ticks until it falls, -1 gone (for the rest of the loop). */
  crumble: Int16Array;
  /** Which character is currently being stepped (echo rooms let only the player stand on ghosts). */
  private stepping: Character | null = null;
  private movingCrusher: Crusher | null = null;
  private preX: number[] = [];
  private preY: number[] = [];
  exitRect: { x: number; y: number; w: number; h: number };
  events: GameEvent[] = [];

  private rec = new Uint8Array(1024);
  private replaySerial = 0;

  constructor(level: LevelDef) {
    this.level = level;
    this.pxW = level.width * TILE;
    this.pxH = level.height * TILE;
    this.grid = new Uint8Array(level.width * level.height);
    level.tiles.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        this.grid[ty * level.width + tx] =
          ch === '#' ? T_SOLID : ch === '^' ? T_SPIKE_UP : ch === 'v' ? T_SPIKE_DOWN : ch === '=' ? T_ONEWAY
            : ch === 'x' ? T_CRUMBLE : ch === 'g' ? T_GRIP : ch === '>' ? T_SPIKE_RIGHT : ch === '<' ? T_SPIKE_LEFT
              : ch === 'n' ? T_NOW : ch === 'p' ? T_PAST : T_EMPTY;
      }
    });
    this.crumble = new Int16Array(level.width * level.height);
    // Exit is 1 tile wide, 2 tall, standing on the tile row given by exit.y
    this.exitRect = { x: level.exit.x * TILE + 3, y: (level.exit.y - 1) * TILE, w: TILE - 6, h: TILE * 2 };
    this.startLoop();
  }

  // ---------- Queries ----------
  tileAt(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.level.width) return T_SOLID; // side walls
    if (ty < 0 || ty >= this.level.height) return T_EMPTY; // open top / bottomless pit
    return this.grid[ty * this.level.width + tx];
  }

  /** Solid right now (crumbling blocks stop being solid once they fall). */
  isSolidTile(tx: number, ty: number): boolean {
    const t = this.tileAt(tx, ty);
    if (t === T_SOLID || t === T_GRIP) return true;
    if (t === T_CRUMBLE) return this.crumble[ty * this.level.width + tx] >= 0;
    if (t === T_NOW) return this.stepping?.kind === 'player';
    if (t === T_PAST) return this.stepping?.kind === 'replay';
    return false;
  }

  gripAt(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (this.tileAt(tx, ty) === T_GRIP) return true;
    }
    return false;
  }

  solidAt(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolidTile(tx, ty)) return true;
      }
    }
    for (const d of this.doors) {
      if (!d.open && overlapsXYWH(x, y, w, h, d.x, d.y, d.w, d.h)) return true;
    }
    for (const k of this.crushers) {
      if (k !== this.movingCrusher && overlapsXYWH(x, y, w, h, k.x, k.y, k.w, k.h)) return true;
    }
    return false;
  }

  platformAt(x: number, bottom: number, w: number, self?: unknown): boolean {
    if (bottom % TILE === 0) {
      const ty = bottom / TILE;
      const x0 = Math.floor(x / TILE);
      const x1 = Math.floor((x + w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) if (this.tileAt(tx, ty) === T_ONEWAY) return true;
    }
    for (const c of this.corpses) {
      if (c !== self && c.y === bottom && x < c.x + c.w && x + w > c.x) return true;
    }
    for (const p of this.platforms) {
      if (p.y === bottom && x < p.x + p.w && x + w > p.x) return true;
    }
    for (const sp of this.springs) {
      if (sp.y === bottom && x < sp.x + sp.w && x + w > sp.x) return true;
    }
    // Echo rooms: a self can stand on living older selves.
    if (this.level.solidGhosts && this.stepping && self === undefined) {
      const rank = this.stepping.kind === 'player' ? this.replays.length : this.stepping.replayIndex;
      for (const c of this.characters) {
        if (c.kind === 'replay' && c.replayIndex < rank && c.alive && c.y === bottom && x < c.x + c.w && x + w > c.x) return true;
      }
    }
    // Corpses (and only corpses) come to rest on top of floor spikes, covering them.
    if (self !== undefined) {
      const top = bottom - (TILE - SPIKE_DEPTH);
      if (top % TILE === 0) {
        const ty = top / TILE;
        const x0 = Math.floor(x / TILE);
        const x1 = Math.floor((x + w - 1) / TILE);
        for (let tx = x0; tx <= x1; tx++) if (this.tileAt(tx, ty) === T_SPIKE_UP) return true;
      }
    }
    return false;
  }

  touchesSpike(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (t === T_SPIKE_UP) {
          if (overlapsXYWH(x, y, w, h, tx * TILE + SPIKE_INSET_X, ty * TILE + TILE - SPIKE_DEPTH, TILE - SPIKE_INSET_X * 2, SPIKE_DEPTH)) return true;
        } else if (t === T_SPIKE_DOWN) {
          if (overlapsXYWH(x, y, w, h, tx * TILE + SPIKE_INSET_X, ty * TILE, TILE - SPIKE_INSET_X * 2, SPIKE_DEPTH)) return true;
        } else if (t === T_SPIKE_RIGHT) {
          if (overlapsXYWH(x, y, w, h, tx * TILE, ty * TILE + SPIKE_INSET_X, SPIKE_DEPTH, TILE - SPIKE_INSET_X * 2)) return true;
        } else if (t === T_SPIKE_LEFT) {
          if (overlapsXYWH(x, y, w, h, tx * TILE + TILE - SPIKE_DEPTH, ty * TILE + SPIKE_INSET_X, SPIKE_DEPTH, TILE - SPIKE_INSET_X * 2)) return true;
        }
      }
    }
    return false;
  }

  get ghostCount(): number {
    return this.replays.length;
  }

  get loopSeconds(): number {
    return this.frame / TICK_RATE;
  }

  get timeLimitFrames(): number | null {
    return this.level.loopDuration ? Math.round(this.level.loopDuration * TICK_RATE) : null;
  }

  // ---------- Loop lifecycle ----------
  private spawnPos(): Vector2 {
    const sx = this.level.spawn.x * TILE + Math.floor((TILE - CHAR_W) / 2);
    const sy = (this.level.spawn.y + 1) * TILE - CHAR_H;
    return { x: sx, y: sy };
  }

  private resetEntities(): void {
    const L = this.level;
    this.corpses = [];
    this.plates = [];
    this.doors = [];
    this.walkers = [];
    this.platforms = [];
    this.lasers = [];
    this.hints = [];
    this.springs = [];
    this.conveyors = [];
    this.orbs = [];
    this.mimics = [];
    this.crushers = [];
    this.crumble.fill(0);
    for (const o of L.objects) {
      if (o.type === 'plate') {
        this.plates.push({
          id: o.id, x: o.x * TILE, y: (o.y + 1) * TILE - 3, w: o.width * TILE, targets: plateTargets(o),
          pressed: false, latch: o.properties?.latch === true,
          hold: typeof o.properties?.hold === 'number' ? Math.round(o.properties.hold * TICK_RATE) : 0, holdLeft: 0,
        });
      }
    }
    const driven = (id: string, p: Record<string, unknown>): Driven => ({
      plates: this.plates.filter((pl) => pl.targets.includes(id)),
      require: p.require === 'all' ? 'all' : 'any',
      invert: p.invert === true,
    });
    for (const o of L.objects) {
      const p = o.properties ?? {};
      if (o.type === 'door') {
        const dv = driven(o.id, p);
        this.doors.push({ ...dv, id: o.id, x: o.x * TILE, y: o.y * TILE, w: o.width * TILE, h: o.height * TILE, open: dv.invert });
      } else if (o.type === 'platform') {
        const to = p.to as { x: number; y: number };
        const x0 = o.x * TILE, y0 = o.y * TILE, x1 = to.x * TILE, y1 = to.y * TILE;
        const len = Math.hypot(x1 - x0, y1 - y0);
        this.platforms.push({
          ...driven(o.id, p), id: o.id, x0, y0, x1, y1, w: o.width * TILE, len,
          t: 0, dir: 1,
          speed: typeof p.speed === 'number' ? p.speed : 0.75,
          pause: typeof p.pause === 'number' ? p.pause : 30,
          pauseLeft: typeof p.delay === 'number' ? p.delay : 0,
          mode: p.mode === 'plate' ? 'plate' : 'loop',
          x: x0, y: y0, active: false,
        });
      } else if (o.type === 'laser') {
        const dir = p.dir as LaserDir;
        const pulse = p.pulse as { on?: number; off?: number; phase?: number } | undefined;
        const dv = driven(o.id, p);
        const mode = pulse ? 'pulse' : dv.plates.length > 0 ? 'plate' : 'on';
        this.lasers.push({
          ...dv, id: o.id, tx: o.x * TILE, ty: o.y * TILE, dir,
          offset: typeof p.offset === 'number' ? p.offset : 8,
          mode,
          pulseOn: pulse?.on ?? 90, pulseOff: pulse?.off ?? 90, phase: pulse?.phase ?? 0,
          on: mode === 'plate' ? !dv.invert : true, warn: false,
          bx: 0, by: 0, bw: 0, bh: 0,
        });
      } else if (o.type === 'walker' || o.type === 'crawler' || o.type === 'brute') {
        const patrol = Array.isArray(p.patrol) && p.patrol.length === 2 ? p.patrol as number[] : null;
        const kind: WalkerKind = o.type;
        const ww = kind === 'crawler' ? CRAWLER_W : kind === 'brute' ? BRUTE_W : WALKER_W;
        const wh = kind === 'crawler' ? CRAWLER_H : kind === 'brute' ? BRUTE_H : WALKER_H;
        this.walkers.push({
          id: o.id, kind, alive: true,
          patrolSpeed: kind === 'crawler' ? CRAWLER_SPEED : kind === 'brute' ? BRUTE_PATROL_SPEED : WALKER_PATROL_SPEED,
          chaseSpeed: kind === 'brute' ? BRUTE_CHASE_SPEED : WALKER_CHASE_SPEED,
          chases: kind !== 'crawler' && p.chase !== false,
          laserProof: kind === 'brute',
          pursue: p.pursue === true, lastSeenX: -1, searchLeft: 0,
          x: o.x * TILE + Math.floor((TILE - ww) / 2), y: (o.y + 1) * TILE - wh, rx: 0, ry: 0,
          w: ww, h: wh, vy: 0,
          facing: p.dir === -1 ? -1 : 1,
          patrolMin: patrol ? patrol[0] * TILE : null,
          patrolMax: patrol ? (patrol[1] + 1) * TILE : null,
          sight: (typeof p.sight === 'number' ? p.sight : WALKER_DEFAULT_SIGHT) * TILE,
          sightY: typeof p.sightY === 'number' ? p.sightY * TILE : WALKER_SIGHT_Y,
          chasing: false, grounded: false,
        });
      } else if (o.type === 'conveyor') {
        this.conveyors.push({
          ...driven(o.id, p), id: o.id, x: o.x * TILE, y: o.y * TILE, w: o.width * TILE,
          speed: typeof p.speed === 'number' ? p.speed : 1, active: false,
        });
      } else if (o.type === 'spring') {
        this.springs.push({ x: o.x * TILE, y: (o.y + 1) * TILE, w: o.width * TILE, fired: 0, jammed: false });
      } else if (o.type === 'orb') {
        this.orbs.push({
          x: o.x * TILE + TILE / 2, y: o.y * TILE + TILE / 2,
          respawn: typeof p.respawn === 'number' ? Math.round(p.respawn * TICK_RATE) : ORB_RESPAWN, respawnLeft: 0,
        });
      } else if (o.type === 'mimic') {
        const m = createCharacter('mimic', p.mirror === true ? 1 : 0, o.x * TILE + Math.floor((TILE - CHAR_W) / 2), (o.y + 1) * TILE - CHAR_H);
        m.facing = p.mirror === true ? -1 : 1;
        this.mimics.push(m);
      } else if (o.type === 'crusher') {
        this.crushers.push({
          id: o.id, x: o.x * TILE, y: o.y * TILE, w: o.width * TILE, h: o.height * TILE, restY: o.y * TILE,
          sight: (typeof p.sight === 'number' ? p.sight : 30) * TILE,
          rise: typeof p.rise === 'number' ? p.rise : CRUSHER_RISE,
          state: 'idle', vy: 0, ry: 0, timer: 0,
        });
      } else if (o.type === 'hint') {
        this.hints.push({ x: o.x * TILE, y: o.y * TILE, text: String(p.text ?? '') });
      }
    }
  }

  private startLoop(): void {
    this.frame = 0;
    this.status = 'PLAYING';
    this.deathTimer = 0;
    this.resetEntities();
    const s = this.spawnPos();
    this.characters = this.replays.map((_, i) => createCharacter('replay', i, s.x, s.y));
    this.player = createCharacter('player', -1, s.x, s.y);
    this.characters.push(this.player);
    for (const c of this.characters) { this.stepping = c; c.grounded = isGrounded(c, this); }
    for (const m of this.mimics) { this.stepping = m; m.grounded = isGrounded(m, this); }
    this.stepping = null;
  }

  /** R: wipe every replay and corpse and start clean (GDD §39). */
  resetRoom(): void {
    this.replays = [];
    this.loop = 1;
    this.roomFrames = 0;
    this.lastDeath = null;
    this.startLoop();
  }

  /** A fresh attempt at the whole room (after completing it): clears the totals as well. */
  newAttempt(): void {
    this.totalFrames = 0;
    this.totalLoops = 1;
    this.deaths = 0;
    this.resetRoom();
  }

  /** Remove the most recent replay and restart the loop (does not count as a death). */
  undoLastLoop(): void {
    if (this.replays.length === 0) return;
    this.replays.pop();
    this.loop = this.replays.length + 1;
    this.startLoop();
  }

  private finishPlayerDeath(): void {
    const p = this.player;
    const inputs = this.rec.slice(0, this.frame + 1);
    const replay: ReplayData = {
      id: `r${++this.replaySerial}`,
      inputs,
      deathFrame: this.frame,
      deathPosition: { x: p.x, y: p.y },
      deathVelocity: { x: p.vx, y: p.vy },
      cause: p.deathCause ?? 'fall',
    };
    if (this.replays.length >= REPLAY_CAP) this.replays.shift();
    this.replays.push(replay);
    this.loop = this.replays.length + 1;
  }

  // ---------- Simulation ----------
  tick(playerInput: number): void {
    this.events = [];
    if (this.status === 'COMPLETE') return;
    this.roomFrames++;
    this.totalFrames++;
    if (this.status === 'DYING') {
      this.deathTimer--;
      if (this.deathTimer <= 0) {
        this.startLoop();
        this.totalLoops++;
        this.events.push({ type: 'loop' });
      }
      return;
    }

    // 1. Record the live input for this tick.
    if (this.frame >= this.rec.length) {
      const bigger = new Uint8Array(this.rec.length * 2);
      bigger.set(this.rec);
      this.rec = bigger;
    }
    this.rec[this.frame] = playerInput;

    // 1b. Moving platforms and belts carry whatever stands on them.
    for (const pf of this.platforms) this.stepPlatform(pf);
    if (this.conveyors.length) this.stepConveyors();

    // 2. Characters: every one reads the world as it was at the end of the previous tick.
    //    In echo rooms each self can stand on any *older* self (lower index; the player is the newest),
    //    and is carried by it. Older selves always step first, so a recording always reproduces.
    const echo = this.level.solidGhosts === true;
    const n = this.characters.length;
    if (echo) {
      if (this.preX.length < n) { this.preX = new Array(n); this.preY = new Array(n); }
      for (let k = 0; k < n; k++) { this.preX[k] = this.characters[k].x; this.preY[k] = this.characters[k].y; }
    }
    for (let k = 0; k < n; k++) {
      const c = this.characters[k];
      if (!c.alive) continue;
      let input: number;
      if (c.kind === 'replay') {
        const data = this.replays[c.replayIndex];
        input = this.frame < data.inputs.length ? data.inputs[this.frame] : 0;
      } else {
        input = playerInput;
      }
      if (echo) {
        // Ride whichever older self we were standing on at the start of the tick.
        for (let j = 0; j < k; j++) {
          const g = this.characters[j];
          if (!g.alive) continue;
          if (c.y + c.h === this.preY[j] && c.x < this.preX[j] + g.w && c.x + c.w > this.preX[j]) {
            const dx = g.x - this.preX[j], dy = g.y - this.preY[j];
            this.stepping = c;
            if (dx !== 0) { const keep = c.rx; c.rx = 0; moveX(c, dx, this); c.rx = keep; }
            if (dy !== 0) { c.ry = 0; moveY(c, dy, this); }
            this.stepping = null;
            break;
          }
        }
      }
      this.stepping = c;
      const r = stepCharacter(c, input, this);
      this.stepping = null;
      const isReplay = c.kind === 'replay';
      if (r.jumped) this.events.push({ type: 'jump', replay: isReplay });
      if (r.wallJumped) this.events.push({ type: 'walljump', replay: isReplay });
      if (r.dashed) this.events.push({ type: 'dash', replay: isReplay });
    }

    // 2a. Mimics repeat what the living you pressed this tick (mirrored ones swap left and right).
    for (const m of this.mimics) {
      if (!m.alive) continue;
      let input = playerInput;
      if (m.replayIndex === 1) input = (input & ~3) | ((input & 1) << 1) | ((input & 2) >> 1);
      this.stepping = m;
      stepCharacter(m, input, this);
      this.stepping = null;
    }

    // 2b. Springs, dash orbs, crumbling blocks.
    this.stepPads();

    // 3. Enemies and corpses.
    for (const w of this.walkers) if (w.alive) this.stepWalker(w);
    for (const k of this.crushers) this.stepCrusher(k);
    this.stepCorpses();

    // 3b. Laser beams (traced against the world as it stands now).
    for (const lz of this.lasers) this.traceLaser(lz);
    for (const w of this.walkers) {
      if (!w.alive || w.laserProof) continue;
      for (const lz of this.lasers) {
        if (lz.on && overlapsXYWH(w.x, w.y, w.w, w.h, lz.bx, lz.by, lz.bw, lz.bh)) {
          w.alive = false;
          this.events.push({ type: 'burn', x: w.x + w.w / 2, y: w.y + w.h / 2 });
          break;
        }
      }
    }

    // 4. Hazards.
    for (const c of this.characters.concat(this.mimics)) {
      if (!c.alive) continue;
      let cause: DeathCause | null = null;
      if (c.y > this.pxH + OUT_OF_BOUNDS_MARGIN) cause = 'fall';
      else if (this.touchesSpike(c.x, c.y, c.w, c.h)) cause = 'spike';
      else {
        if (c.kind !== 'mimic') {
          for (const w of this.walkers) {
            if (w.alive && overlapsXYWH(c.x, c.y, c.w, c.h, w.x + 1, w.y + 1, w.w - 2, w.h - 1)) { cause = 'enemy'; break; }
          }
          if (!cause) {
            for (const m of this.mimics) {
              if (m.alive && overlapsXYWH(c.x, c.y, c.w, c.h, m.x + 1, m.y + 1, m.w - 2, m.h - 2)) { cause = 'enemy'; break; }
            }
          }
        }
        if (!cause) {
          for (const lz of this.lasers) {
            if (lz.on && overlapsXYWH(c.x, c.y, c.w, c.h, lz.bx, lz.by, lz.bw, lz.bh)) { cause = 'laser'; break; }
          }
        }
      }
      if (cause) this.kill(c, cause);
    }

    // 5. Time limit.
    const limit = this.timeLimitFrames;
    if (limit !== null && this.player.alive && this.frame + 1 >= limit) this.kill(this.player, 'timeout');

    // 6. Plates and doors.
    this.updateMechanisms();

    // 7. Exit.
    const p = this.player;
    const e = this.exitRect;
    if (p.alive && overlapsXYWH(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
      p.state = 'FINISHED';
      this.status = 'COMPLETE';
      this.events.push({ type: 'complete' });
    }

    this.frame++;
  }

  private kill(c: Character, cause: DeathCause): void {
    c.alive = false;
    c.state = 'DEAD';
    c.deathCause = cause;
    if (cause !== 'fall') this.spawnCorpse(c);
    this.events.push({ type: 'death', replay: c.kind !== 'player', x: c.x + c.w / 2, y: c.y + c.h / 2, cause });
    if (c.kind === 'player') {
      this.deaths++;
      this.lastDeath = { cause, x: c.x + c.w / 2, y: c.y + c.h / 2 };
      this.finishPlayerDeath();
      this.status = 'DYING';
      this.deathTimer = DEATH_FREEZE_FRAMES;
    }
  }

  private spawnCorpse(c: Character): void {
    const corpse: Corpse = {
      x: c.x + Math.floor((c.w - CORPSE_W) / 2), y: c.y + c.h - CORPSE_H, rx: 0, ry: 0,
      w: CORPSE_W, h: CORPSE_H, vy: 0, source: c.replayIndex, bornFrame: this.frame,
    };
    if (this.solidAt(corpse.x, corpse.y, corpse.w, corpse.h)) {
      // Nudge out of walls (a 14px corpse from a 10px body can clip a wall).
      for (const dx of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (!this.solidAt(corpse.x + dx, corpse.y, corpse.w, corpse.h)) { corpse.x += dx; break; }
      }
    }
    // A corpse that dies inside a spike bed rests on the spike tips, covering them.
    const bottom = corpse.y + corpse.h;
    const ty = Math.floor((bottom - 1) / TILE);
    const spikeTop = ty * TILE + (TILE - SPIKE_DEPTH);
    if (bottom > spikeTop) {
      const x0 = Math.floor(corpse.x / TILE);
      const x1 = Math.floor((corpse.x + corpse.w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) === T_SPIKE_UP) { corpse.y = spikeTop - corpse.h; break; }
      }
    }
    this.corpses.push(corpse);
  }

  private stepCorpses(): void {
    for (const c of this.corpses) {
      c.vy = Math.min(c.vy + GRAVITY, MAX_FALL);
      if (moveY(c, c.vy, this, c)) c.vy = 0;
    }
    if (this.corpses.some((c) => c.y > this.pxH + OUT_OF_BOUNDS_MARGIN)) {
      this.corpses = this.corpses.filter((c) => c.y <= this.pxH + OUT_OF_BOUNDS_MARGIN);
    }
  }

  private stepWalker(w: Walker): void {
    // Vertical
    w.vy = Math.min(w.vy + GRAVITY, MAX_FALL);
    if (moveY(w, w.vy, this)) w.vy = 0;
    w.grounded = isGrounded(w, this);
    if (w.y > this.pxH + OUT_OF_BOUNDS_MARGIN) return;
    if (!w.grounded) return;

    // Target: nearest living character in sight (ties -> earliest in fixed order).
    const wcx = w.x + w.w / 2;
    const wcy = w.y + w.h / 2;
    let target: Character | null = null;
    let best = Infinity;
    for (const c of this.characters) {
      if (!c.alive) continue;
      const dx = c.x + c.w / 2 - wcx;
      const dy = c.y + c.h / 2 - wcy;
      if (Math.abs(dy) > w.sightY || Math.abs(dx) > w.sight) continue;
      if (Math.abs(dx) < best) { best = Math.abs(dx); target = c; }
    }

    let dir: number = w.facing;
    let speed = w.patrolSpeed;
    if (!w.chases) target = null;
    if (target) {
      if (!w.chasing) this.events.push({ type: 'alert' });
      w.chasing = true;
      w.lastSeenX = target.x + target.w / 2;
      const dx = target.x + target.w / 2 - wcx;
      if (Math.abs(dx) <= 2) speed = 0;
      else { dir = dx > 0 ? 1 : -1; w.facing = dir as 1 | -1; speed = w.chaseSpeed; }
    } else if (w.pursue && w.lastSeenX >= 0) {
      // walk on to where the target was last seen
      w.chasing = true;
      const dx = w.lastSeenX - wcx;
      if (Math.abs(dx) <= 2) { w.lastSeenX = -1; w.searchLeft = PURSUE_SEARCH; speed = 0; }
      else { dir = dx > 0 ? 1 : -1; w.facing = dir as 1 | -1; speed = w.chaseSpeed; }
    } else if (w.searchLeft > 0) {
      w.searchLeft--;
      w.chasing = false;
      speed = 0;
    } else {
      w.chasing = false;
      if (w.patrolMin !== null && w.x <= w.patrolMin && w.facing < 0) w.facing = 1;
      if (w.patrolMax !== null && w.x + w.w >= w.patrolMax && w.facing > 0) w.facing = -1;
      dir = w.facing;
    }
    if (speed === 0) return;

    // Never walk off a ledge.
    const aheadX = dir > 0 ? w.x + w.w : w.x - 1;
    const floorAhead = this.solidAt(aheadX, w.y + w.h, 1, 1) || this.platformAt(aheadX, w.y + w.h, 1);
    if (!floorAhead) {
      if (!w.chasing) w.facing = (-w.facing) as 1 | -1;
      return;
    }
    if (moveX(w, dir * speed, this) && !w.chasing) w.facing = (-w.facing) as 1 | -1;
  }

  private updateMechanisms(): void {
    for (const pl of this.plates) {
      const was = pl.pressed;
      const weight = this.plateHasWeight(pl);
      if (weight) pl.holdLeft = pl.hold;
      else if (pl.holdLeft > 0) pl.holdLeft--;
      pl.pressed = (pl.latch && was) || weight || pl.holdLeft > 0;
      if (pl.pressed !== was) this.events.push({ type: 'plate', on: pl.pressed });
    }
    for (const pf of this.platforms) pf.active = pf.invert ? !isActive(pf) : isActive(pf);
    for (const cv of this.conveyors) cv.active = cv.invert ? !isActive(cv) : isActive(cv);
    for (const lz of this.lasers) {
      if (lz.mode === 'plate') lz.on = lz.invert ? isActive(lz) : !isActive(lz);
    }
    for (const d of this.doors) {
      const active = isActive(d);
      const want = d.invert ? !active : active;
      if (want === d.open) continue;
      if (!want && this.doorOccupied(d)) continue; // never crush: stays open until clear
      d.open = want;
      this.events.push({ type: 'door', open: want });
    }
  }

  private plateHasWeight(pl: Plate): boolean {
    const x = pl.x, y = pl.y - 1, w = pl.w, h = 4;
    for (const c of this.characters) if (c.alive && overlapsXYWH(c.x, c.y, c.w, c.h, x, y, w, h)) return true;
    for (const c of this.corpses) if (overlapsXYWH(c.x, c.y, c.w, c.h, x, y, w, h)) return true;
    for (const k of this.walkers) if (k.alive && overlapsXYWH(k.x, k.y, k.w, k.h, x, y, w, h)) return true;
    for (const m of this.mimics) if (m.alive && overlapsXYWH(m.x, m.y, m.w, m.h, x, y, w, h)) return true;
    return false;
  }

  private doorOccupied(d: Door): boolean {
    for (const c of this.characters) if (c.alive && overlapsXYWH(c.x, c.y, c.w, c.h, d.x, d.y, d.w, d.h)) return true;
    for (const c of this.corpses) if (overlapsXYWH(c.x, c.y, c.w, c.h, d.x, d.y, d.w, d.h)) return true;
    for (const k of this.walkers) if (k.alive && overlapsXYWH(k.x, k.y, k.w, k.h, d.x, d.y, d.w, d.h)) return true;
    for (const m of this.mimics) if (m.alive && overlapsXYWH(m.x, m.y, m.w, m.h, d.x, d.y, d.w, d.h)) return true;
    return false;
  }

  private stepCrusher(k: Crusher): void {
    const living = (): Body[] => {
      const out: Body[] = [];
      for (const c of this.characters) if (c.alive) out.push(c);
      for (const m of this.mimics) if (m.alive) out.push(m);
      for (const w of this.walkers) if (w.alive) out.push(w);
      return out;
    };
    if (k.state === 'idle') {
      const bottom = k.y + k.h;
      for (const b of living()) {
        if (b.x < k.x + k.w && b.x + b.w > k.x && b.y >= bottom - 2 && b.y < bottom + k.sight) { k.state = 'fall'; k.vy = 0; break; }
      }
      return;
    }
    if (k.state === 'fall') {
      k.vy = Math.min(k.vy + CRUSHER_GRAVITY, CRUSHER_MAX_FALL);
      k.ry += k.vy;
      let move = Math.floor(k.ry);
      k.ry -= move;
      this.movingCrusher = k;
      while (move > 0) {
        const bottom = k.y + k.h;
        // stops on floors, closed doors, corpses and platforms: a body underneath jams it
        let blocked = this.solidAt(k.x, k.y + 1, k.w, k.h);
        if (!blocked) {
          for (const c of this.corpses) if (c.y === bottom && c.x < k.x + k.w && c.x + c.w > k.x) { blocked = true; break; }
        }
        if (!blocked) {
          for (const pf of this.platforms) if (pf.y === bottom && pf.x < k.x + k.w && pf.x + pf.w > k.x) { blocked = true; break; }
        }
        if (!blocked && bottom % TILE === 0) {
          const ty = bottom / TILE;
          for (let tx = Math.floor(k.x / TILE); tx <= Math.floor((k.x + k.w - 1) / TILE); tx++) {
            if (this.tileAt(tx, ty) === T_ONEWAY || this.tileAt(tx, ty) === T_SPIKE_UP) { blocked = true; break; }
          }
        }
        if (blocked) {
          k.state = 'wait'; k.timer = CRUSHER_WAIT; k.vy = 0; k.ry = 0;
          this.events.push({ type: 'slam', x: k.x + k.w / 2, y: k.y + k.h });
          break;
        }
        k.y++;
        move--;
        for (const c of this.characters.concat(this.mimics)) {
          if (c.alive && overlapsXYWH(c.x, c.y, c.w, c.h, k.x, k.y, k.w, k.h)) this.kill(c, 'crush');
        }
        for (const w of this.walkers) {
          if (w.alive && overlapsXYWH(w.x, w.y, w.w, w.h, k.x, k.y, k.w, k.h)) {
            w.alive = false;
            this.events.push({ type: 'burn', x: w.x + w.w / 2, y: w.y + w.h / 2 });
          }
        }
      }
      this.movingCrusher = null;
      return;
    }
    if (k.state === 'wait') {
      if (--k.timer <= 0) k.state = 'rise';
      return;
    }
    // rise slowly, carrying whatever stands on top
    k.ry += k.rise;
    let move = Math.floor(k.ry);
    k.ry -= move;
    while (move-- > 0 && k.y > k.restY) {
      const top = k.y;
      const riders: Body[] = [];
      for (const b of living()) if (b.y + b.h === top && b.x < k.x + k.w && b.x + b.w > k.x) riders.push(b);
      for (const c of this.corpses) if (c.y + c.h === top && c.x < k.x + k.w && c.x + c.w > k.x) riders.push(c);
      k.y--;
      for (const r of riders) {
        this.stepping = 'kind' in r ? r as Character : null;
        r.ry = 0;
        moveY(r, -1, this, r);
        this.stepping = null;
      }
    }
    if (k.y <= k.restY) { k.y = k.restY; k.ry = 0; k.state = 'idle'; }
  }

  private stepConveyors(): void {
    const carry = (b: Body) => {
      for (const cv of this.conveyors) {
        if (b.y + b.h === cv.y && b.x < cv.x + cv.w && b.x + b.w > cv.x) {
          this.stepping = 'kind' in b ? b as Character : null;
          moveX(b, cv.active ? -cv.speed : cv.speed, this);
          this.stepping = null;
          return;
        }
      }
    };
    for (const c of this.characters) if (c.alive) carry(c);
    for (const c of this.mimics) if (c.alive) carry(c);
    for (const c of this.corpses) carry(c);
    for (const w of this.walkers) if (w.alive) carry(w);
  }

  private stepPads(): void {
    for (const sp of this.springs) {
      if (sp.fired > 0) sp.fired--;
      // A body lying on a spring jams it: it becomes ordinary floor.
      sp.jammed = this.corpses.some((k) => k.y + k.h === sp.y && k.x < sp.x + sp.w && k.x + k.w > sp.x);
    }
    for (const o of this.orbs) if (o.respawnLeft > 0) o.respawnLeft--;
    const W = this.level.width;
    // Crumbling blocks count down and fall.
    for (let i = 0; i < this.crumble.length; i++) {
      if (this.crumble[i] > 0) {
        this.crumble[i]--;
        if (this.crumble[i] === 0) {
          this.crumble[i] = -1;
          this.events.push({ type: 'crumble', x: (i % W) * TILE + TILE / 2, y: Math.floor(i / W) * TILE + TILE / 2 });
        }
      }
    }
    // Standing on a crumbling block (anything alive: past selves, you, walkers) starts its fall.
    const press = (b: Body) => {
      const bottom = b.y + b.h;
      if (bottom % TILE !== 0) return;
      const ty = bottom / TILE;
      const x0 = Math.floor(b.x / TILE);
      const x1 = Math.floor((b.x + b.w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) === T_CRUMBLE && this.crumble[ty * W + tx] === 0) this.crumble[ty * W + tx] = CRUMBLE_TICKS;
      }
    };
    for (const w of this.walkers) if (w.alive && w.grounded) press(w);
    for (const c of this.characters.concat(this.mimics)) {
      if (!c.alive) continue;
      const bottom = c.y + c.h;
      if (c.grounded) press(c);
      for (const sp of this.springs) {
        if (!sp.jammed && bottom === sp.y && c.x < sp.x + sp.w && c.x + c.w > sp.x && c.vy >= 0) {
          c.vy = -SPRING_FORCE;
          c.ry = 0;
          c.noCut = true;
          c.grounded = false;
          c.coyote = 0;
          c.canDash = true;
          c.dashCooldown = Math.max(c.dashCooldown, 12); // no dashing out of a launch on the same beat
          c.dashTimer = 0;
          sp.fired = 12;
          this.events.push({ type: 'spring', replay: c.kind === 'replay', x: sp.x + sp.w / 2, y: sp.y });
        }
      }
      if (!c.canDash) {
        for (const o of this.orbs) {
          if (o.respawnLeft === 0 && overlapsXYWH(c.x, c.y, c.w, c.h, o.x - 5, o.y - 5, 10, 10)) {
            c.canDash = true;
            c.dashCooldown = 0;
            o.respawnLeft = o.respawn;
            this.events.push({ type: 'orb', replay: c.kind === 'replay', x: o.x, y: o.y });
            break;
          }
        }
      }
    }
  }

  private stepPlatform(pf: Platform): void {
    if (pf.len <= 0) return;
    if (pf.mode === 'loop') {
      if (pf.pauseLeft > 0) {
        pf.pauseLeft--;
      } else {
        pf.t += pf.speed * pf.dir;
        if (pf.t >= pf.len) { pf.t = pf.len; pf.dir = -1; pf.pauseLeft = pf.pause; }
        else if (pf.t <= 0) { pf.t = 0; pf.dir = 1; pf.pauseLeft = pf.pause; }
      }
    } else {
      pf.t = pf.active ? Math.min(pf.len, pf.t + pf.speed) : Math.max(0, pf.t - pf.speed);
    }
    const k = pf.t / pf.len;
    const nx = Math.round(pf.x0 + (pf.x1 - pf.x0) * k);
    const ny = Math.round(pf.y0 + (pf.y1 - pf.y0) * k);
    const dx = nx - pf.x;
    const dy = ny - pf.y;
    if (dx === 0 && dy === 0) return;
    // Riders: anything whose feet rest exactly on the platform top before it moves.
    const riders: Body[] = [];
    const onTop = (b: Body) => b.y + b.h === pf.y && b.x < pf.x + pf.w && b.x + b.w > pf.x;
    for (const c of this.characters) if (c.alive && onTop(c)) riders.push(c);
    for (const c of this.mimics) if (c.alive && onTop(c)) riders.push(c);
    for (const c of this.corpses) if (onTop(c)) riders.push(c);
    for (const w of this.walkers) if (w.alive && onTop(w)) riders.push(w);
    pf.x = nx;
    pf.y = ny;
    for (const r of riders) {
      this.stepping = 'kind' in r ? r as Character : null;
      if (dx !== 0) { const keep = r.rx; r.rx = 0; moveX(r, dx, this); r.rx = keep; }
      if (dy !== 0) { r.ry = 0; moveY(r, dy, this, r); }
      this.stepping = null;
    }
  }

  /** Beam starts at the emitter and stops at the first solid, closed door, corpse or platform. */
  private traceLaser(lz: Laser): void {
    if (lz.mode === 'pulse') {
      const period = lz.pulseOn + lz.pulseOff;
      const ph = (this.frame + lz.phase) % period;
      lz.on = ph < lz.pulseOn;
      lz.warn = !lz.on && period - ph <= LASER_WARN_FRAMES;
    } else {
      lz.warn = false;
    }
    const horizontal = lz.dir === 'left' || lz.dir === 'right';
    const sign = lz.dir === 'right' || lz.dir === 'down' ? 1 : -1;
    // Beam line position on the cross axis, and start on the main axis (emitter centre).
    const line = horizontal ? lz.ty + lz.offset : lz.tx + lz.offset;
    // The beam starts at the emitter tile's back edge, so nothing slips between housing and beam.
    const start = horizontal ? (sign > 0 ? lz.tx : lz.tx + TILE) : (sign > 0 ? lz.ty : lz.ty + TILE);
    const tLine = Math.floor(line / TILE);
    let end = start;
    // March tiles.
    let t = Math.floor(start / TILE) + sign;
    const limit = horizontal ? this.level.width : this.level.height;
    for (; t >= -1 && t <= limit; t += sign) {
      const solid = horizontal ? this.isSolidTile(t, tLine) : this.isSolidTile(tLine, t);
      if (solid || t < 0 || t >= limit) break;
    }
    end = sign > 0 ? t * TILE : (t + 1) * TILE;
    // Dynamic blockers.
    const consider = (x: number, y: number, w: number, h: number) => {
      if (horizontal) {
        if (line < y || line >= y + h) return;
        if (sign > 0 && x + w > start && x < end) end = Math.max(start, x);
        if (sign < 0 && x < start && x + w > end) end = Math.min(start, x + w);
      } else {
        if (line < x || line >= x + w) return;
        if (sign > 0 && y + h > start && y < end) end = Math.max(start, y);
        if (sign < 0 && y < start && y + h > end) end = Math.min(start, y + h);
      }
    };
    for (const d of this.doors) if (!d.open) consider(d.x, d.y, d.w, d.h);
    for (const c of this.corpses) consider(c.x, c.y, c.w, c.h);
    for (const p of this.platforms) consider(p.x, p.y, p.w, PLATFORM_H);
    for (const w of this.walkers) if (w.alive && w.laserProof) consider(w.x, w.y, w.w, w.h);
    for (const k of this.crushers) consider(k.x, k.y, k.w, k.h);
    const a = Math.min(start, end);
    const len = Math.abs(end - start);
    if (horizontal) { lz.bx = a; lz.by = line - 1; lz.bw = len; lz.bh = 2; }
    else { lz.bx = line - 1; lz.by = a; lz.bw = 2; lz.bh = len; }
  }

  /** Deep copy of the whole simulation (for search tools). Static level data is shared. */
  clone(): Room {
    const { level, grid, ...state } = this as unknown as Record<string, unknown>;
    const copy = Object.create(Room.prototype) as Room;
    Object.assign(copy, structuredClone(state), { level, grid });
    return copy;
  }

  /** Compact fingerprint of the simulation, used by determinism tests. */
  snapshot(): string {
    const parts: string[] = [`f${this.frame}`, `l${this.loop}`, this.status];
    for (const c of this.characters) parts.push(`${c.kind}${c.replayIndex}:${c.x},${c.y},${c.vx.toFixed(4)},${c.vy.toFixed(4)},${c.alive ? 1 : 0}`);
    for (const c of this.corpses) parts.push(`k${c.x},${c.y}`);
    for (const w of this.walkers) parts.push(`w${w.x},${w.y},${w.facing}`);
    for (const d of this.doors) parts.push(`d${d.open ? 1 : 0}`);
    for (const p of this.platforms) parts.push(`p${p.x},${p.y}`);
    for (const l of this.lasers) parts.push(`z${l.on ? 1 : 0}:${l.bw},${l.bh}`);
    for (const o of this.orbs) parts.push(`o${o.respawnLeft}`);
    for (const m of this.mimics) parts.push(`m${m.x},${m.y},${m.alive ? 1 : 0}`);
    for (const k of this.crushers) parts.push(`k${k.y}${k.state}`);
    let cr = 0;
    for (let i = 0; i < this.crumble.length; i++) cr = (cr * 31 + this.crumble[i] + 2) | 0;
    parts.push(`c${cr}`);
    return parts.join('|');
  }
}
