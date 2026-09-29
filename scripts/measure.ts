// Dev helper: measure the movement envelope on an empty test room.
import { parseLevel } from '../src/game/level';
import { Room } from '../src/game/room';
import { parseScript } from '../tests/harness';

function flat(extra: (g: string[][]) => void = () => {}, objects: unknown[] = []) {
  const W = 80, H = 40;
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (y === 0 || x === 0 || x === W - 1 || y >= 36 ? '#' : '.')));
  extra(g);
  return new Room(parseLevel({ id: 't', name: 't', width: W, height: H, tiles: g.map((r) => r.join('')), spawn: { x: 5, y: 35 }, exit: { x: 78, y: 35 }, objects }));
}

function run(label: string, script: string, room = flat()) {
  const inp = parseScript(script);
  const p = room.player;
  const x0 = p.x, y0 = p.y;
  let minY = y0, landX = 0, takeX = x0;
  let airborne = false;
  for (let i = 0; i < inp.length + 200; i++) {
    const wasG = p.grounded;
    room.tick(i < inp.length ? inp[i] : 0);
    minY = Math.min(minY, p.y);
    if (wasG && !p.grounded) takeX = p.x;
    if (!p.grounded) airborne = true;
    if (airborne && p.grounded) { landX = p.x; break; }
  }
  console.log(`${label.padEnd(28)} rise=${y0 - minY}px  flight=${landX - takeX}px (${((landX - takeX) / 16).toFixed(2)} tiles, +10px body => gap ${((landX - takeX - 10) / 16).toFixed(2)})`);
}

run('standing jump (held)', 'J*40');
run('running jump (held)', 'R*30 RJ*40 R*60');
run('running tap jump (4f)', 'R*30 RJ*4 R*60');
run('run jump + dash at apex', 'R*30 RJ*16 RJD*1 RJ*30 R*60');
run('run jump + dash at 8f', 'R*30 RJ*8 RJD*1 RJ*30 R*60');
run('ground dash then jump', 'R*30 RD*1 R*5 RJ*40 R*60');
// spring
{
  const r = flat(() => {}, [{ id: 's', type: 'spring', x: 8, y: 35 }]);
  const p = r.player; let minY = p.y; const y0 = p.y;
  for (let i = 0; i < 120; i++) { r.tick(i < 20 ? 2 : 0); minY = Math.min(minY, p.y); }
  console.log(`spring launch rise = ${y0 - minY}px (${((y0 - minY) / 16).toFixed(2)} tiles) above spring top`);
}
// wall jump: vertical grip shaft
{
  const r = flat((g) => { for (let y = 10; y < 36; y++) { g[y][12] = 'g'; g[y][16] = 'g'; } });
  const p = r.player;
  p.x = 13 * 16 + 3; p.y = 35 * 16 - 14; p.grounded = true;
  // alternate: hold toward the wall you are on, jump when touching
  const ys: number[] = [];
  let side = 1;
  for (let i = 0; i < 400; i++) {
    const touching = side > 0 ? r.gripAt(p.x + p.w, p.y + 2, 1, p.h - 4) : r.gripAt(p.x - 1, p.y + 2, 1, p.h - 4);
    let input = side > 0 ? 2 : 1;
    if (touching && !p.grounded && (r.player.prevInput & 4) === 0) { input |= 4; side = -side; }
    if (p.grounded && i < 3) input |= 4;
    r.tick(input); ys.push(p.y);
  }
  console.log(`grip shaft (3 wide) climb: start ${ys[0]} min ${Math.min(...ys)}  (gained ${(ys[0] - Math.min(...ys)) / 16} tiles)`);
  // single wall jump from a wall: horizontal reach
  const r2 = flat((g) => { for (let y = 20; y < 36; y++) g[y][12] = 'g'; });
  const q = r2.player; q.x = 12 * 16 - 10; q.y = 30 * 16; q.vy = 0; q.grounded = false; q.coyote = 0;
  let reach = 0; let hi = q.y;
  r2.tick(2);
  r2.tick(2 | 4); // jump off the right wall -> leftward
  const sx = q.x, sy = q.y;
  for (let i = 0; i < 80; i++) { r2.tick(i < 30 ? 4 : 0); hi = Math.min(hi, q.y); reach = Math.min(reach, q.x - sx); if (q.grounded) break; }
  console.log(`wall jump (no steering): rise ${sy - hi}px, back ${-reach}px`);
}
