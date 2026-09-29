// Dev helper: how would a PAST self move with this input script? (plays it as the player in a copy of
// the room where 'p' tiles are solid and 'n' tiles are air)
//   npx tsx scripts/ghost.ts level39 "<script>" [every]
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { parseScript } from '../tests/harness';

const [, , id, script, everyArg] = process.argv;
const raw = JSON.parse(readFileSync(`src/levels/${id}.json`, 'utf8'));
raw.tiles = raw.tiles.map((r: string) => r.replace(/p/g, '#').replace(/n/g, '.'));
const room = new Room(parseLevel(raw));
const inp = parseScript(script);
const every = Number(everyArg ?? 5);
for (let i = 0; i < inp.length && room.status === 'PLAYING'; i++) {
  room.tick(inp[i]);
  if (room.frame % every === 0) {
    const p = room.player;
    console.log(`f${room.frame} (${(p.x / 16).toFixed(2)},${(p.y / 16).toFixed(2)}) ${p.state} pl ${room.plates.map((q) => (q.pressed ? 1 : 0)).join('')}`);
  }
}
console.log('end', room.status, room.player.deathCause ?? '', (room.player.x / 16).toFixed(2), (room.player.y / 16).toFixed(2));
