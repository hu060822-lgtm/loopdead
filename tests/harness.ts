import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT } from '../src/game/constants';
import { Room } from '../src/game/room';

/**
 * Tiny input-script language for scripted playthroughs.
 *   "R*40 RJ*12 .*30 L*5"   R=right L=left J=jump D=dash .=nothing, *n = hold n ticks
 */
export function parseScript(script: string): number[] {
  const out: number[] = [];
  for (const tok of script.trim().split(/\s+/)) {
    if (!tok) continue;
    const [keys, countStr] = tok.split('*');
    const count = countStr ? parseInt(countStr, 10) : 1;
    let bits = 0;
    for (const ch of keys) {
      if (ch === 'L') bits |= IN_LEFT;
      else if (ch === 'R') bits |= IN_RIGHT;
      else if (ch === 'J') bits |= IN_JUMP;
      else if (ch === 'D') bits |= IN_DASH;
      else if (ch !== '.') throw new Error(`bad key ${ch}`);
    }
    for (let i = 0; i < count; i++) out.push(bits);
  }
  return out;
}

export type LoopOutcome = { result: 'died' | 'complete' | 'stuck'; frames: number; cause?: string; x: number; y: number };

/** Plays one loop: script, then idles until the player dies or completes (or `maxIdle` ticks). */
export function playLoop(room: Room, script: string, maxIdle = 60 * 20): LoopOutcome {
  const inputs = parseScript(script);
  let i = 0;
  let idle = 0;
  while (room.status === 'PLAYING') {
    const input = i < inputs.length ? inputs[i] : 0;
    if (i >= inputs.length) idle++;
    if (idle > maxIdle) return { result: 'stuck', frames: room.frame, x: room.player.x, y: room.player.y };
    room.tick(input);
    i++;
  }
  const out: LoopOutcome = {
    result: room.status === 'COMPLETE' ? 'complete' : 'died',
    frames: room.frame,
    cause: room.player.deathCause ?? undefined,
    x: room.player.x, y: room.player.y,
  };
  // Advance through the death freeze into the next loop.
  while (room.status === 'DYING') room.tick(0);
  return out;
}
