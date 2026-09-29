import { describe, expect, it } from 'vitest';
import { Room } from '../src/game/room';
import { parseLevel, LevelError } from '../src/game/level';
import { LEVELS } from '../src/levels';
import { parseScript, playLoop } from './harness';
import { playBot } from './bot';
import { SOLUTIONS } from './solutions';

function room(id: string): Room {
  const entry = LEVELS.find((l) => l.id === id);
  if (!entry?.def) throw new Error(`missing level ${id}: ${entry?.error}`);
  return new Room(entry.def);
}

describe('levels', () => {
  it('all level JSON files parse', () => {
    for (const l of LEVELS) expect(l.error, l.id).toBeNull();
    expect(LEVELS.length).toBe(43);
  });

  for (const [id, loops] of Object.entries(SOLUTIONS)) {
    it(`${id} is solvable with ${loops.length} loop(s)`, () => {
      const r = room(id);
      loops.forEach((s, i) => {
        const out = playBot(r, s);
        const expected = i === loops.length - 1 ? 'complete' : 'died';
        expect(out.result, `${id} loop ${i + 1}`).toBe(expected);
      });
      expect(r.replays.length).toBe(loops.length - 1);
    });
  }

  it('level01 cannot be crossed without a corpse (best jump + dash from the edge)', () => {
    for (let run = 40; run <= 58; run += 2) {
      const r = room('level01');
      const out = playLoop(r, `R*${run} RJ*16 RJD*1 RJ*10 R*120`);
      expect(out.result).toBe('died');
    }
  });

  it('level03: the pit really is a trap (no way back up)', () => {
    const r = room('level03');
    const out = playLoop(r, 'R*80 .*40 LJ*30 L*5 LJ*30 L*5 LJ*30 L*60', 200);
    expect(out.result).toBe('stuck');
    expect(r.player.y).toBeGreaterThan(13 * 16 - 20);
  });

  it('level05: the door closes again when the bait leaves', () => {
    const r = room('level05');
    playLoop(r, 'R*84 .*60 L*200', 10);
    expect(r.doors[0].open).toBe(false);
  });
});

describe('no shortcuts', () => {
  it('paradox: the living cannot stand on the ground of the past, nor the past on the ground of the living', () => {
    // 37: the trench roof is past-only; walking right drops YOU in, the plate stays up
    const r = room('level37');
    playBot(r, [['keys', 'R*60']], 100);
    expect(r.plates[0].pressed).toBe(false);
    // 38: a replay that walks onto the trapdoor falls through it
    const t = room('level38');
    playBot(t, SOLUTIONS.level38[0]);
    for (let f = 0; f < 90; f++) t.tick(0);
    expect(t.characters[0].y).toBeGreaterThan(9 * 16);
  });

  it('level22: one self cannot darken both beams at once', () => {
    const r = room('level22');
    playBot(r, SOLUTIONS.level22[0]);
    const out = playBot(r, SOLUTIONS.level22[2], 120);
    expect(out.result).not.toBe('complete');
  });

  it('level42: without the self on the perch the plateau is out of reach', () => {
    const r = room('level42');
    const out = playBot(r, SOLUTIONS.level42[1], 120);
    expect(out.result).not.toBe('complete');
  });

  it('level08: the spring bed cannot be crossed while it works', () => {
    const r = room('level08');
    expect(playBot(r, [['to', 24.0]], 100).result).toBe('died');
    const r2 = room('level08');
    expect(playBot(r2, [['walk', 10.0], ['keys', 'RD*1 R*30']], 100).result).toBe('died');
  });

  it('level17: a body on the plate is a trap (the exit stays shut)', () => {
    const r = room('level17');
    // a past self that stays in the pocket for the whole loop
    playBot(r, [['until', (x) => x.player.vy < -5, 'L'], ['wait', 8], ['until', (x) => x.player.grounded, 'R'],
      ['until', (x) => x.plates[0].pressed, 'R'], ['wait', 900], ['keys', 'RJ*14 R*20'], ['to', 34.5]]);
    const last = SOLUTIONS.level17[1];
    const out = playBot(r, last as never, 200, 900);
    expect(out.result).not.toBe('complete');
  });

  it('level29: holding the plate the whole time shuts the way', () => {
    const r = room('level29');
    playBot(r, [['to', 2.9], ['idle']]);
    const out = playBot(r, [['walk', 9.6], ['keys', 'R*4 RJ*14 R*4'], ['to', 34.0]], 100);
    expect(out.result).not.toBe('complete');
    expect(r.player.x).toBeLessThan(24 * 16);
  });

  it('every room needs at least one past self (none can be finished in a single straight run)', () => {
    for (const [id, loops] of Object.entries(SOLUTIONS)) {
      if (loops.length === 1) continue; // tutorials for movement mechanics (lift, pulse)
      const r = room(id);
      const last = loops[loops.length - 1];
      const out = playBot(r, last, 120);
      expect(out.result, id).not.toBe('complete');
    }
  });
});

describe('determinism (GDD §82)', () => {
  it('identical input produces an identical simulation', () => {
    for (const [id, loops] of Object.entries(SOLUTIONS)) {
      const a = room(id);
      const b = room(id);
      const tickA = a.tick.bind(a);
      let mismatch = '';
      a.tick = (input: number) => {
        tickA(input);
        b.tick(input);
        if (!mismatch && a.snapshot() !== b.snapshot()) mismatch = `${id} frame ${a.frame}`;
      };
      for (const s of loops) playBot(a, s);
      expect(mismatch).toBe('');
      expect(a.status).toBe('COMPLETE');
      expect(b.status).toBe('COMPLETE');
    }
  });

  it('a replay reproduces its own death frame and position when the world is unchanged', () => {
    for (const [id, loops] of Object.entries(SOLUTIONS)) {
      if (loops.length < 2) continue;
      const r = room(id);
      // Phase ground (n/p) is different ground for the past: there a replay is *meant* to diverge.
      if (r.level.tiles.some((row) => /[np]/.test(row))) continue;
      playBot(r, loops[0]);
      const rec = r.replays[0];
      if (rec.cause === 'timeout') {
        // Nothing kills a replay at the time limit (the loop just ends), so compare where it stands.
        for (let f = 0; f < rec.deathFrame; f++) r.tick(0);
        expect(r.characters[0].x, id).toBe(rec.deathPosition.x);
        expect(r.characters[0].y, id).toBe(rec.deathPosition.y);
        continue;
      }
      // Next loop: the player idles at spawn; the replay must die exactly as recorded.
      let died = -1;
      for (let f = 0; f < rec.deathFrame + 5 && r.status === 'PLAYING'; f++) {
        r.tick(0);
        const ghost = r.characters[0];
        if (!ghost.alive && died < 0) {
          died = r.frame - 1;
          expect(ghost.x, id).toBe(rec.deathPosition.x);
          expect(ghost.y, id).toBe(rec.deathPosition.y);
        }
      }
      expect(died, id).toBe(rec.deathFrame);
    }
  });

  it('replays stay in sync regardless of how many render frames happen (tick-driven)', () => {
    // The simulation has no notion of wall time: running the same ticks in bursts gives the same state.
    const a = room('level02');
    const b = room('level02');
    const inputs = parseScript('R*22 .*100 R*80');
    inputs.forEach((i) => a.tick(i));
    let k = 0;
    while (k < inputs.length) {
      const burst = Math.min(1 + (k % 5), inputs.length - k); // uneven "frames"
      for (let j = 0; j < burst; j++) b.tick(inputs[k + j]);
      k += burst;
    }
    expect(a.snapshot()).toBe(b.snapshot());
  });
});

describe('room lifecycle', () => {
  it('death creates a replay and a new loop in under a second', () => {
    const r = room('level01');
    const out = playLoop(r, 'R*50 RJ*20 R*40');
    expect(out.result).toBe('died');
    expect(r.replays.length).toBe(1);
    expect(r.loop).toBe(2);
    expect(r.deaths).toBe(1);
    expect(r.characters.length).toBe(2);
  });

  it('R resets everything', () => {
    const r = room('level04');
    playLoop(r, 'L*85 .*30 J*10');
    playLoop(r, 'R*85 .*40 R*60');
    for (let i = 0; i < 30; i++) r.tick(0);
    r.resetRoom();
    expect(r.replays.length).toBe(0);
    expect(r.corpses.length).toBe(0);
    expect(r.frame).toBe(0);
    expect(r.loop).toBe(1);
    expect(r.characters.length).toBe(1);
    expect(r.doors.every((d) => !d.open)).toBe(true);
    expect(r.plates.every((p) => !p.pressed)).toBe(true);
  });

  it('rapid repeated resets are safe', () => {
    const r = room('level05');
    for (let i = 0; i < 50; i++) {
      r.tick(2);
      r.resetRoom();
    }
    expect(r.walkers[0].x).toBe(new Room(r.level).walkers[0].x);
  });

  it('undo removes only the latest replay', () => {
    const r = room('level04');
    playLoop(r, 'L*85 .*30 J*10');
    playLoop(r, 'R*85 .*40 R*60');
    expect(r.replays.length).toBe(2);
    r.undoLastLoop();
    expect(r.replays.length).toBe(1);
    expect(r.loop).toBe(2);
  });

  it('replay count is capped at 50', () => {
    const r = room('level01');
    for (let i = 0; i < 55; i++) playLoop(r, 'R*50 RJ*20 R*40');
    expect(r.replays.length).toBe(50);
  });

  it('a replay that dies off screen still leaves its corpse (simulation never culls)', () => {
    const r = room('level06');
    playLoop(r, 'R*22 RJ*20 R*40');
    // player walks the other way; the replay's death is far away
    for (let i = 0; i < 80; i++) r.tick(1);
    expect(r.corpses.length).toBe(1);
  });

  it('20 simultaneous replays simulate quickly', () => {
    const r = room('level06');
    for (let i = 0; i < 20; i++) playLoop(r, `R*${10 + i} RJ*20 R*40 .*200 L*10`);
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) r.tick(0);
    const ms = (performance.now() - t0) / 600;
    expect(ms).toBeLessThan(2); // well under one 16.7 ms frame
  });
});

describe('level validation', () => {
  it('rejects broken level data with a readable error', () => {
    expect(() => parseLevel(null)).toThrow(LevelError);
    expect(() => parseLevel({ id: 'x', name: 'x', width: 10, height: 6, tiles: ['#'], spawn: { x: 1, y: 1 }, exit: { x: 2, y: 2 }, objects: [] })).toThrow(/rows/);
    const bad = JSON.parse(JSON.stringify(LEVELS[1].def));
    bad.objects.push({ id: 'pX', type: 'plate', x: 1, y: 1, properties: { target: 'nope' } });
    expect(() => parseLevel(bad)).toThrow(/unknown door/);
  });
});
