import { GROUND_DECEL, IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT, TILE } from '../src/game/constants';
import type { Room } from '../src/game/room';
import { parseScript, type LoopOutcome } from './harness';

/**
 * A tiny closed-loop driver used to author reference solutions. It only ever produces
 * ordinary input bytes, so the resulting loop is recorded and replayed exactly like a human's.
 *
 *   ['to', 12.5]              walk until the body centre is at tile x=12.5 (auto-hops 1-2 tile steps)
 *   ['walk', 12.5]            same, but never jumps
 *   ['wait', 60]              idle n ticks
 *   ['keys', 'RJ*10 R*4']     raw input script (see harness.parseScript)
 *   ['until', fn, 'R']        hold keys until fn(room) is true
 *   ['idle']                  stop issuing input (let the loop run until death / completion)
 */
export type Step =
  | ['to', number]
  | ['walk', number]
  | ['wait', number]
  | ['keys', string]
  | ['until', (r: Room) => boolean, string?]
  | ['idle']
  /** Wall-climb a grip shaft: alternate walls (starting by pressing toward `side`) until above tile row `row`. */
  | ['climb', number, 1 | -1, number[]?, (1 | -1)?]
  /** Climb ONE grip wall on `side` (hold toward it, kick when touching) until the body top is above tile row `row`.
   *  If airborne and not touching, drifts toward that wall first (use it to switch walls). */
  | ['wall', 1 | -1, number];

function keyBits(keys: string): number {
  let b = 0;
  for (const ch of keys) {
    if (ch === 'L') b |= IN_LEFT;
    else if (ch === 'R') b |= IN_RIGHT;
    else if (ch === 'J') b |= IN_JUMP;
    else if (ch === 'D') b |= IN_DASH;
  }
  return b;
}

export function playBot(room: Room, steps: Step[] | string, maxIdle = 60 * 25, maxFrames = 60 * 90): LoopOutcome {
  if (typeof steps === 'string') steps = [['keys', steps]];
  let i = 0;
  let queue: number[] = [];
  let queueLoaded = false;
  let counter = 0;
  let hop = 0;
  let climbSide = 0;
  let climbHold = 0;
  let climbCount = 0;
  let climbWait = -1;
  let idle = 0;
  const startFrame = room.frame;

  const next = (): number => {
    const p = room.player;
    while (i < steps.length) {
      const s = steps[i];
      if (s[0] === 'keys') {
        if (!queueLoaded) { queue = parseScript(s[1]); queueLoaded = true; }
        if (queue.length) return queue.shift()!;
        queueLoaded = false; i++; continue;
      }
      if (s[0] === 'wait') {
        if (counter < s[1]) { counter++; return 0; }
        counter = 0; i++; continue;
      }
      if (s[0] === 'until') {
        if (!s[1](room)) return keyBits(s[2] ?? '');
        i++; continue;
      }
      if (s[0] === 'idle') return 0;
      if (s[0] === 'wall') {
        const side = s[1];
        const dirBit = side > 0 ? IN_RIGHT : IN_LEFT;
        if (p.y <= s[2] * TILE) { climbHold = 0; i++; continue; }
        const touch = side > 0 ? room.gripAt(p.x + p.w, p.y + 2, 3, p.h - 4) : room.gripAt(p.x - 3, p.y + 2, 3, p.h - 4);
        if (climbHold > 0) { climbHold--; return dirBit | (climbHold > 0 ? IN_JUMP : 0); }
        if (p.grounded) { climbHold = 12; return dirBit | IN_JUMP; }
        if (touch && p.vy > -1.5) { climbHold = 10; return dirBit | IN_JUMP; }
        // still on the other wall: kick off it toward this one
        const opp = side > 0 ? room.gripAt(p.x - 3, p.y + 2, 3, p.h - 4) : room.gripAt(p.x + p.w, p.y + 2, 3, p.h - 4);
        if (opp) { climbHold = 10; return dirBit | IN_JUMP; }
        return dirBit;
      }
      if (s[0] === 'climb') {
        if (climbSide === 0) { climbSide = s[2]; climbCount = 0; climbWait = -1; }
        if (p.y <= s[1] * TILE && !p.grounded && (s[4] === undefined || (climbSide === s[4] && climbHold > 0))) {
          climbSide = 0; climbHold = 0; i++; continue;
        }
        const dirBit = climbSide > 0 ? IN_RIGHT : IN_LEFT;
        const touching = climbSide > 0 ? room.gripAt(p.x + p.w, p.y + 2, 1, p.h - 4) : room.gripAt(p.x - 1, p.y + 2, 1, p.h - 4);
        if (climbHold > 0) { climbHold--; return (climbHold > 0 ? IN_JUMP : 0) | dirBit; }
        if (p.grounded) { climbHold = 14; return dirBit | IN_JUMP; }
        if (touching) {
          // optional per-contact delay (slide a little before kicking off)
          if (climbWait < 0) climbWait = s[3]?.[climbCount] ?? 0;
          if (climbWait > 0) { climbWait--; return dirBit; }
          climbWait = -1;
          climbCount++;
          climbSide = -climbSide; climbHold = 13; return IN_JUMP | (climbSide > 0 ? IN_RIGHT : IN_LEFT);
        }
        return dirBit;
      }
      // 'to' / 'walk'
      const target = s[1] * TILE;
      const c = p.x + p.w / 2;
      const dx = target - c;
      if (hop > 0) { hop--; return (dx > 0 ? IN_RIGHT : IN_LEFT) | IN_JUMP; }
      if (Math.abs(dx) <= 1.5 && Math.abs(p.vx) < 0.3 && p.grounded) { i++; continue; }
      const dir = dx > 0 ? IN_RIGHT : IN_LEFT;
      if (s[0] === 'to' && p.grounded && p.wallContact !== 0) { hop = 14; return dir | IN_JUMP; }
      if (!p.grounded) return dir;
      const stop = (p.vx * p.vx) / (2 * GROUND_DECEL);
      if (Math.sign(dx) === Math.sign(p.vx) && Math.abs(dx) <= stop + 0.6) return 0;
      if (Math.abs(dx) <= 1.5) return 0;
      return dir;
    }
    idle++;
    return 0;
  };

  while (room.status === 'PLAYING') {
    if (idle > maxIdle || room.frame - startFrame > maxFrames) {
      return { result: 'stuck', frames: room.frame, x: room.player.x, y: room.player.y };
    }
    room.tick(next());
  }
  const out: LoopOutcome = {
    result: room.status === 'COMPLETE' ? 'complete' : 'died',
    frames: room.frame,
    cause: room.player.deathCause ?? undefined,
    x: room.player.x, y: room.player.y,
  };
  while (room.status === 'DYING') room.tick(0);
  return out;
}
