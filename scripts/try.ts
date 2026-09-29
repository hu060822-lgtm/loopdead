// Dev helper: run a room's reference solution with an optional trace.
//   npx tsx scripts/try.ts level12 [traceEvery]
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { playBot } from '../tests/bot';
import { SOLUTIONS } from '../tests/solutions';

const [, , id, traceArg] = process.argv;
const trace = traceArg ? parseInt(traceArg, 10) : 0;
const room = new Room(parseLevel(JSON.parse(readFileSync(`src/levels/${id}.json`, 'utf8'))));
const loops = SOLUTIONS[id] ?? [];
const origTick = room.tick.bind(room);
let li = 0;
room.tick = (input: number) => {
  origTick(input);
  const tl = process.env.LOOP ? Number(process.env.LOOP) - 1 : loops.length - 1;
  if (trace && li === tl && room.status === 'PLAYING' && room.frame % trace === 0) {
    const p = room.player;
    console.log(`  f${room.frame} P(${p.x},${p.y}) v(${p.vx.toFixed(1)},${p.vy.toFixed(1)}) ${p.state}`
      + ` | g ${room.characters.filter((c) => c.kind === 'replay').map((c) => `${c.x},${c.y}${c.alive ? '' : 'x'}`).join(' ')}`
      + ` | k ${room.corpses.map((c) => `${c.x},${c.y}`).join(' ')}`
      + ` | w ${room.walkers.filter((w) => w.alive).map((w) => `${w.x},${w.y}${w.chasing ? '!' : ''}`).join(' ')}`
      + ` | d ${room.doors.map((d) => (d.open ? 'O' : 'C')).join('')} pl ${room.plates.map((q) => (q.pressed ? '1' : '0')).join('')}`
      + ` | pf ${room.platforms.map((q) => `${q.x},${q.y}`).join(' ')} | z ${room.lasers.map((l) => (l.on ? '1' : '0')).join('')} | kr ${room.crushers.map((k) => k.y + k.state[0]).join(' ')} | m ${room.mimics.map((m) => `${m.x},${m.y}${m.alive ? '' : 'x'}`).join(' ')}`);
  }
};
for (li = 0; li < loops.length; li++) {
  const o = playBot(room, loops[li] as never);
  const p = room.player;
  console.log(`loop ${li + 1}: ${o.result} f=${o.frames} cause=${o.cause ?? ''} at (${o.x},${o.y}) tile(${(o.x / 16 + 0.3).toFixed(1)},${(o.y / 16).toFixed(1)}) state=${p.state}`);
  if (o.result !== 'died') break;
}
