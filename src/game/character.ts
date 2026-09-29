import {
  AIR_ACCEL, AIR_DECEL, CHAR_H, CHAR_W, COYOTE_FRAMES, DASH_COOLDOWN, DASH_FRAMES, DASH_SPEED,
  GRAVITY, GROUND_ACCEL, GROUND_DECEL, IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT, JUMP_BUFFER_FRAMES,
  GRIP_REACH, JUMP_CUT_GRAVITY, JUMP_FORCE, MAX_FALL, RUN_SPEED, WALL_CLIMB_LOCK, WALL_CLIMB_VX,
  WALL_COYOTE_FRAMES, WALL_JUMP_LOCK, WALL_JUMP_VX, WALL_JUMP_VY, WALL_SLIDE_MAX,
} from './constants';
import { isGrounded, moveX, moveY, type Body, type CollisionWorld } from './physics';
import type { CharacterStateName, DeathCause } from './types';

/**
 * The single character controller. The live player and every replay run through
 * exactly this code — replays differ only in where their input byte comes from.
 */
export type Character = Body & {
  kind: 'player' | 'replay' | 'mimic';
  /** For replays: index into the room's replay list. -1 for the player. */
  replayIndex: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  wallContact: 0 | 1 | -1;
  coyote: number;
  jumpBuffer: number;
  dashTimer: number;
  dashCooldown: number;
  canDash: boolean;
  prevInput: number;
  state: CharacterStateName;
  alive: boolean;
  deathCause: DeathCause | null;
  lastInput: number;
  /** Ticks left during which horizontal input is ignored (after a wall jump). */
  controlLock: number;
  /** Set by springs: the rise can't be cut short by releasing jump. */
  noCut: boolean;
  /** -1 / 1 while sliding down a grip wall on that side, else 0. */
  sliding: 0 | 1 | -1;
  /** Last grip side touched and ticks left in which a wall jump off it still works. */
  wallSide: 0 | 1 | -1;
  wallCoyote: number;
};

export function createCharacter(
  kind: Character['kind'], replayIndex: number, spawnX: number, spawnY: number,
): Character {
  return {
    kind, replayIndex,
    x: spawnX, y: spawnY, rx: 0, ry: 0, w: CHAR_W, h: CHAR_H,
    vx: 0, vy: 0, facing: 1,
    grounded: false, wallContact: 0,
    coyote: 0, jumpBuffer: 0, dashTimer: 0, dashCooldown: 0, canDash: true,
    prevInput: 0, state: 'IDLE', alive: true, deathCause: null, lastInput: 0,
    controlLock: 0, noCut: false, sliding: 0, wallSide: 0, wallCoyote: 0,
  };
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}

export type StepResult = { jumped: boolean; dashed: boolean; wallJumped: boolean };

export function stepCharacter(c: Character, input: number, world: CollisionWorld): StepResult {
  const result: StepResult = { jumped: false, dashed: false, wallJumped: false };
  c.lastInput = input;
  if (!c.alive || c.state === 'FINISHED') return result;

  const left = (input & IN_LEFT) !== 0;
  const right = (input & IN_RIGHT) !== 0;
  const jumpHeld = (input & IN_JUMP) !== 0;
  const jumpPressed = jumpHeld && (c.prevInput & IN_JUMP) === 0;
  const dashPressed = (input & IN_DASH) !== 0 && (c.prevInput & IN_DASH) === 0;
  let dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (c.controlLock > 0) { c.controlLock--; dir = 0; }

  // Timers
  if (jumpPressed) c.jumpBuffer = JUMP_BUFFER_FRAMES;
  else if (c.jumpBuffer > 0) c.jumpBuffer--;
  if (c.grounded) c.coyote = COYOTE_FRAMES;
  else if (c.coyote > 0) c.coyote--;
  if (c.dashCooldown > 0) c.dashCooldown--;

  if (dir !== 0 && c.dashTimer === 0) c.facing = dir as 1 | -1;

  // Grip walls: which side (if any) is a grip tile touching us right now?
  // (touching = within GRIP_REACH px; the wall coyote window keeps it for a few ticks after leaving)
  let grip: 0 | 1 | -1 = 0;
  let touching: 0 | 1 | -1 = 0;
  if (!c.grounded && world.gripAt) {
    if (world.gripAt(c.x - GRIP_REACH, c.y + 2, GRIP_REACH, c.h - 4)) touching = -1;
    else if (world.gripAt(c.x + c.w, c.y + 2, GRIP_REACH, c.h - 4)) touching = 1;
  }
  if (touching !== 0) { c.wallSide = touching; c.wallCoyote = WALL_COYOTE_FRAMES; }
  else if (c.wallCoyote > 0) c.wallCoyote--;
  if (c.grounded) c.wallCoyote = 0;
  grip = touching !== 0 ? touching : (c.wallCoyote > 0 ? c.wallSide : 0);

  // Jump (may cancel a dash when grounded / in coyote window)
  if (c.jumpBuffer > 0 && c.coyote > 0) {
    c.vy = -JUMP_FORCE;
    c.jumpBuffer = 0;
    c.coyote = 0;
    c.grounded = false;
    c.dashTimer = 0;
    c.noCut = false;
    result.jumped = true;
  } else if (c.jumpBuffer > 0 && grip !== 0) {
    // Wall jump: kick away from the grip wall. Holding toward the wall gives a steeper climbing kick.
    const climbing = dir === grip;
    c.vy = -WALL_JUMP_VY;
    c.vx = -grip * (climbing ? WALL_CLIMB_VX : WALL_JUMP_VX);
    c.facing = (-grip) as 1 | -1;
    c.controlLock = climbing ? WALL_CLIMB_LOCK : WALL_JUMP_LOCK;
    c.wallCoyote = 0;
    c.jumpBuffer = 0;
    c.dashTimer = 0;
    c.noCut = false;
    dir = 0;
    result.wallJumped = true;
  }

  // Dash start
  if (dashPressed && c.canDash && c.dashCooldown === 0 && c.dashTimer === 0) {
    c.dashTimer = DASH_FRAMES;
    c.dashCooldown = DASH_COOLDOWN;
    c.canDash = false;
    c.vy = 0;
    result.dashed = true;
  }

  if (c.dashTimer > 0) {
    c.dashTimer--;
    c.vx = c.facing * DASH_SPEED;
    c.vy = 0;
    if (c.dashTimer === 0) c.vx = c.facing * RUN_SPEED;
  } else {
    if (c.controlLock === 0) {
      const target = dir * RUN_SPEED;
      const accel = dir !== 0
        ? (c.grounded ? GROUND_ACCEL : AIR_ACCEL)
        : (c.grounded ? GROUND_DECEL : AIR_DECEL);
      c.vx = approach(c.vx, target, accel);
    }
    let g = GRAVITY;
    if (c.vy >= 0) c.noCut = false;
    if (c.vy < 0 && !jumpHeld && !c.noCut) g += JUMP_CUT_GRAVITY;
    c.vy = Math.min(c.vy + g, MAX_FALL);
    // Sliding: pressing into a grip wall while falling slows the fall.
    c.sliding = 0;
    if (touching !== 0 && dir === touching && c.vy > 0) {
      c.vy = Math.min(c.vy, WALL_SLIDE_MAX);
      c.sliding = touching;
    }
  }

  // Integrate with collision
  const hitX = moveX(c, c.vx, world);
  if (hitX) {
    c.wallContact = c.vx > 0 ? 1 : -1;
    c.vx = 0;
  } else {
    c.wallContact = 0;
  }
  const hitY = moveY(c, c.vy, world);
  if (hitY) c.vy = 0;

  c.grounded = isGrounded(c, world);
  if (c.grounded && c.vy > 0) { c.vy = 0; c.ry = 0; }
  if (c.grounded && c.dashTimer === 0) c.canDash = true;

  // State
  if (c.dashTimer > 0) c.state = 'DASH';
  else if (!c.grounded) c.state = c.vy < 0 ? 'JUMP' : 'FALL';
  else c.state = Math.abs(c.vx) > 0.2 ? 'RUN' : 'IDLE';

  c.prevInput = input;
  return result;
}
