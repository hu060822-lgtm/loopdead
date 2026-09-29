// Dev helper: search per-contact slide delays that get a wall climb past wall spikes.
//   npx tsx scripts/search-climb.ts level07 <loopIndex(0-based)>
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { playBot, type Step } from '../tests/bot';
import { SOLUTIONS } from '../tests/solutions';

const [, , id, loopArg] = process.argv;
const li = Number(loopArg ?? 0);
const def = parseLevel(JSON.parse(readFileSync(`src/levels/${id}.json`, 'utf8')));
const loops = SOLUTIONS[id];

/** Returns [finished climb?, number of wall jumps before death]. */
function sim(delays: number[]): [boolean, number] {
  const room = new Room(def);
  for (let k = 0; k < li; k++) playBot(room, loops[k] as never);
  const steps = (loops[li] as Step[]).map((s) => (s[0] === 'climb' ? (['climb', s[1], s[2], delays] as Step) : s));
  const ci = steps.findIndex((s) => s[0] === 'climb');
  let jumps = 0;
  let minY = Infinity;
  const target = (steps[ci] as [string, number])[1] * 16;
  const tick = room.tick.bind(room);
  room.tick = (i: number) => {
    tick(i);
    if (room.player.alive) minY = Math.min(minY, room.player.y);
    for (const e of room.events) if (e.type === 'walljump' && !e.replay) jumps++;
  };
  playBot(room, steps.slice(0, ci + 1).concat([['idle']]), 1, 1500);
  return [minY <= target, jumps];
}

function dfs(prefix: number[], budget: { n: number }): number[] | null {
  if (budget.n-- <= 0 || prefix.length > 30) return null;
  for (let d = 0; d <= 12; d++) {
    const cand = [...prefix, d];
    const [ok, jumps] = sim(cand);
    if (ok) return cand;
    if (jumps > cand.length) {
      const r = dfs(cand, budget);
      if (r) return r;
    }
  }
  return null;
}

const [ok0] = sim([]);
if (ok0) { console.log('OK []'); process.exit(0); }
const res = dfs([], { n: 4000 });
console.log(res ? `OK ${JSON.stringify(res)}` : 'no solution');
