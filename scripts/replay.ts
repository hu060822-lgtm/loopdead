// Dev helper: play reference loops 1..k, then a raw input script as the final loop, with a trace.
//   npx tsx scripts/replay.ts level33 <k> "<script>" [every]
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { playBot } from '../tests/bot';
import { parseScript } from '../tests/harness';
import { SOLUTIONS } from '../tests/solutions';

const [, , id, kArg, script, everyArg] = process.argv;
const room = new Room(parseLevel(JSON.parse(readFileSync(`src/levels/${id}.json`, 'utf8'))));
for (let k = 0; k < Number(kArg); k++) playBot(room, SOLUTIONS[id][k] as never);
const every = Number(everyArg ?? 10);
const inp = parseScript(script);
for (let i = 0; i < inp.length + 60 && room.status === 'PLAYING'; i++) {
  room.tick(i < inp.length ? inp[i] : 0);
  if (room.frame % every === 0) {
    const p = room.player;
    console.log(`f${room.frame} P(${p.x},${p.y}) ${p.state} | g ${room.characters.filter((c) => c.kind === 'replay').map((c) => `${c.x},${c.y}${c.alive ? '' : 'x'}`).join(' ')}`
      + ` | k ${room.corpses.map((c) => `${c.x},${c.y}`).join(' ')} | d ${room.doors.map((d) => (d.open ? 'O' : 'C')).join('')} pl ${room.plates.map((q) => (q.pressed ? 1 : 0)).join('')}`
      + ` | m ${room.mimics.map((m) => `${m.x},${m.y}${m.alive ? '' : 'x'}`).join(' ')} | w ${room.walkers.map((w) => `${w.x},${w.y}${w.alive ? '' : 'x'}`).join(' ')}`);
  }
}
console.log('result', room.status, room.player.deathCause ?? '');
