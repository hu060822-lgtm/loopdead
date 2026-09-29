// "One fewer past self" check: for a room whose reference solution uses N loops, replay every
// combination of N-2 of the N-1 recorded past selves, then search for a finishing final loop.
// If one is found, the room can be done with fewer selves than intended.
//   npx tsx scripts/fewer.ts level24 [maxNodes]
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { playBot } from '../tests/bot';
import { SOLUTIONS } from '../tests/solutions';
import { searchSolo } from './solo';

const [, , id, maxArg] = process.argv;
const def = parseLevel(JSON.parse(readFileSync(`src/levels/${id}.json`, 'utf8')));
const loops = SOLUTIONS[id];
const past = loops.length - 1;
if (past < 2) {
  console.log(`${id}: ${past} past self — nothing to drop`);
  process.exit(0);
}
let any = false;
for (let drop = 0; drop < past; drop++) {
  const room = new Room(def);
  let ok = true;
  for (let k = 0; k < past; k++) {
    if (k === drop) continue;
    const out = playBot(room, loops[k] as never);
    if (out.result !== 'died') { ok = false; break; }
  }
  if (!ok) { console.log(`${id}: without self #${drop + 1}: the others no longer die as scripted (skipped)`); continue; }
  const res = searchSolo(room, Number(maxArg ?? 25000));
  if (res.found) { any = true; console.log(`${id}: SHORTCUT without self #${drop + 1} (${res.nodes} nodes)`); }
  else console.log(`${id}: self #${drop + 1} is needed (${res.nodes} nodes, closest ${(res.bestDist / 16).toFixed(1)} tiles)`);
}
if (!any) console.log(`${id}: every past self is needed`);
