import type { Rect } from './types';

/** Anything that moves through the world pixel by pixel (Celeste-style remainder stepping). */
export type Body = {
  x: number; // integer pixel position (top-left)
  y: number;
  rx: number; // sub-pixel remainder
  ry: number;
  w: number;
  h: number;
};

export interface CollisionWorld {
  /** True if the rect overlaps any solid (tiles, closed doors). */
  solidAt(x: number, y: number, w: number, h: number): boolean;
  /**
   * True if a one-way surface (one-way tiles, corpse tops, …) has its top exactly at `bottom`
   * and overlaps [x, x+w) horizontally. `self` lets a corpse ignore itself.
   */
  platformAt(x: number, bottom: number, w: number, self?: unknown): boolean;
  /** True if the rect touches a grip (wall-jumpable) tile. Optional: worlds without grip walls omit it. */
  gripAt?(x: number, y: number, w: number, h: number): boolean;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function overlapsXYWH(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Moves horizontally. Returns true if blocked. */
export function moveX(b: Body, amount: number, world: CollisionWorld): boolean {
  b.rx += amount;
  let move = Math.round(b.rx);
  if (move === 0) return false;
  b.rx -= move;
  const sign = move > 0 ? 1 : -1;
  while (move !== 0) {
    if (world.solidAt(b.x + sign, b.y, b.w, b.h)) {
      b.rx = 0;
      return true;
    }
    b.x += sign;
    move -= sign;
  }
  return false;
}

/** Moves vertically. Returns true if blocked. One-way surfaces only block downward motion. */
export function moveY(b: Body, amount: number, world: CollisionWorld, self?: unknown): boolean {
  b.ry += amount;
  let move = Math.round(b.ry);
  if (move === 0) return false;
  b.ry -= move;
  const sign = move > 0 ? 1 : -1;
  while (move !== 0) {
    if (world.solidAt(b.x, b.y + sign, b.w, b.h)) {
      b.ry = 0;
      return true;
    }
    if (sign > 0 && world.platformAt(b.x, b.y + b.h, b.w, self)) {
      b.ry = 0;
      return true;
    }
    b.y += sign;
    move -= sign;
  }
  return false;
}

export function isGrounded(b: Body, world: CollisionWorld, self?: unknown): boolean {
  return world.solidAt(b.x, b.y + 1, b.w, b.h) || world.platformAt(b.x, b.y + b.h, b.w, self);
}
