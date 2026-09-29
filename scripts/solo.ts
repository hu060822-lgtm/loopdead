// Shortcut finder: can this room be finished in ONE loop, with no past selves?
// Best-first search over held inputs. Usage: npx tsx scripts/solo.ts level12 [maxNodes] [seedLoops]
//  - seedLoops: optional count of reference-solution loops to play first (then searches the next loop
//    with those past selves present) — useful to check "fewer selves than intended" shortcuts.
import { readFileSync } from 'node:fs';
import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT, TILE } from '../src/game/constants';
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { playBot } from '../tests/bot';
import { SOLUTIONS } from '../tests/solutions';

export type SoloResult = { found: boolean; nodes: number; inputs?: number[]; bestDist: number };

const L = IN_LEFT, R = IN_RIGHT, J = IN_JUMP, D = IN_DASH;
// Each macro: [input for the first tick, input for the rest]. Jump/dash macros release first so
// a fresh press is always registered.
const MACROS: [number, number, number][] = [
  // [first-tick input, hold input, ticks]
  [0, 0, 6], [L, L, 6], [R, R, 6],
  [J, J, 8], [L | J, L | J, 8], [R | J, R | J, 8],
  [L | J, L | J, 3], [R | J, R | J, 3], // short hops
  [L | D, L, 6], [R | D, R, 6], [L | J | D, L | J, 6], [R | J | D, R | J, 6],
  [L, L, 16], [R, R, 16],
];

function key(r: Room): string {
  const p = r.player;
  const parts: (string | number)[] = [
    Math.round(p.x / 3), Math.round(p.y / 3), Math.round(p.vx * 2), Math.round(p.vy), p.canDash ? 1 : 0, p.wallCoyote > 0 ? 1 : 0,
  ];
  for (const d of r.doors) parts.push(d.open ? 1 : 0);
  for (const pl of r.plates) parts.push(pl.pressed ? 1 : 0, pl.holdLeft > 0 ? 1 : 0);
  for (const pf of r.platforms) parts.push(Math.round(pf.x / 8), Math.round(pf.y / 8));
  for (const lz of r.lasers) parts.push(lz.on ? 1 : 0);
  for (const w of r.walkers) parts.push(w.alive ? Math.round(w.x / 8) : -1, Math.round(w.y / 8));
  for (const o of r.orbs) parts.push(o.respawnLeft > 0 ? 1 : 0);
  let cr = 0;
  for (let i = 0; i < r.crumble.length; i++) if (r.crumble[i] !== 0) cr = (cr * 31 + i * (r.crumble[i] < 0 ? 2 : 1)) | 0;
  parts.push(cr, r.corpses.length);
  for (const c of r.characters) if (c.kind === 'replay') parts.push(Math.round(c.x / 6), Math.round(c.y / 6), c.alive ? 1 : 0);
  if (r.timeLimitFrames !== null) parts.push(Math.floor(r.frame / 60));
  return parts.join(',');
}

function dist(r: Room): number {
  const p = r.player, e = r.exitRect;
  const dx = Math.max(0, e.x - (p.x + p.w), p.x - (e.x + e.w));
  const dy = Math.max(0, e.y - (p.y + p.h), p.y - (e.y + e.h));
  return dx + dy * 1.5;
}

// Binary heap on priority.
class Heap<T> {
  private a: { p: number; v: T }[] = [];
  get size() { return this.a.length; }
  push(p: number, v: T) {
    const a = this.a; a.push({ p, v }); let i = a.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (a[j].p <= a[i].p) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
  }
  pop(): T {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, rr = l + 1; let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (rr < a.length && a[rr].p < a[m].p) m = rr;
        if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top.v;
  }
}

type Node = { room: Room; inputs: number[] };

export function searchSolo(start: Room, maxNodes = 40000): SoloResult {
  const seen = new Set<string>();
  const heap = new Heap<Node>();
  heap.push(dist(start), { room: start, inputs: [] });
  let nodes = 0;
  let bestDist = Infinity;
  while (heap.size && nodes < maxNodes) {
    const n = heap.pop();
    nodes++;
    for (const [first, hold, ticks] of MACROS) {
      const r = n.room.clone();
      const seq: number[] = [];
      let dead = false;
      for (let t = 0; t < ticks; t++) {
        const inp = t === 0 ? first : hold;
        r.tick(inp);
        seq.push(inp);
        if (r.status === 'COMPLETE') {
          return { found: true, nodes, inputs: n.inputs.concat(seq), bestDist: 0 };
        }
        if (r.status !== 'PLAYING') { dead = true; break; }
      }
      if (dead) continue;
      const k = key(r);
      if (seen.has(k)) continue;
      seen.add(k);
      const d = dist(r);
      bestDist = Math.min(bestDist, d);
      // mostly greedy, with a small cost for time so equal-distance states expand breadth-first
      heap.push(d + (n.inputs.length + ticks) * 0.05, { room: r, inputs: n.inputs.concat(seq) });
    }
  }
  return { found: false, nodes, bestDist };
}

function toScript(inputs: number[]): string {
  const name = (b: number) => (b & L ? 'L' : '') + (b & R ? 'R' : '') + (b & J ? 'J' : '') + (b & D ? 'D' : '') || '.';
  const out: string[] = [];
  let i = 0;
  while (i < inputs.length) {
    let j = i; while (j < inputs.length && inputs[j] === inputs[i]) j++;
    out.push(`${name(inputs[i])}*${j - i}`); i = j;
  }
  return out.join(' ');
}

if (process.argv[1]?.endsWith('solo.ts')) {
  const [, , id, maxArg, seedArg] = process.argv;
  const room = new Room(parseLevel(JSON.parse(readFileSync(`src/levels/${id}.json`, 'utf8'))));
  const seed = Number(seedArg ?? 0);
  for (let k = 0; k < seed; k++) playBot(room, SOLUTIONS[id][k] as never);
  const t0 = Date.now();
  const res = searchSolo(room, Number(maxArg ?? 40000));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.found) console.log(`${id}: SHORTCUT with ${seed} past self(s) after ${res.nodes} nodes (${secs}s): ${toScript(res.inputs!)}`);
  else console.log(`${id}: no shortcut with ${seed} past self(s) (${res.nodes} nodes, ${secs}s, closest ${(res.bestDist / TILE).toFixed(1)} tiles)`);
}
