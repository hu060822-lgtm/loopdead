import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT } from './constants';
import type { InputFrame } from './types';

export type Action = 'left' | 'right' | 'jump' | 'dash';
export type Bindings = Record<Action, string[]>;

export const ACTIONS: Action[] = ['left', 'right', 'jump', 'dash'];

export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  dash: ['ShiftLeft', 'ShiftRight'],
};

const BIT: Record<Action, number> = { left: IN_LEFT, right: IN_RIGHT, jump: IN_JUMP, dash: IN_DASH };

export function decodeInput(bits: number): InputFrame {
  return {
    left: (bits & IN_LEFT) !== 0,
    right: (bits & IN_RIGHT) !== 0,
    jump: (bits & IN_JUMP) !== 0,
    dash: (bits & IN_DASH) !== 0,
  };
}

export function encodeInput(f: InputFrame): number {
  return (f.left ? IN_LEFT : 0) | (f.right ? IN_RIGHT : 0) | (f.jump ? IN_JUMP : 0) | (f.dash ? IN_DASH : 0);
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE',
    ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'CTRL', AltLeft: 'ALT', Enter: 'ENTER',
  };
  return map[code] ?? code.toUpperCase();
}

/**
 * Keyboard -> one input byte per simulation tick.
 * Taps shorter than a tick are latched so a quick jump press is never lost.
 */
export class InputManager {
  private held = new Set<string>();
  private latched = 0;
  bindings: Bindings;

  constructor(bindings: Bindings) {
    this.bindings = bindings;
  }

  private bitFor(code: string): number {
    let bits = 0;
    for (const a of ACTIONS) if (this.bindings[a].includes(code)) bits |= BIT[a];
    return bits;
  }

  isGameKey(code: string): boolean {
    return this.bitFor(code) !== 0;
  }

  keyDown(code: string): void {
    if (!this.held.has(code)) this.latched |= this.bitFor(code) & (IN_JUMP | IN_DASH);
    this.held.add(code);
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  clear(): void {
    this.held.clear();
    this.latched = 0;
  }

  /** Called exactly once per simulation tick. */
  sample(): number {
    let bits = 0;
    for (const code of this.held) bits |= this.bitFor(code);
    bits |= this.latched;
    this.latched = 0;
    return bits;
  }
}
