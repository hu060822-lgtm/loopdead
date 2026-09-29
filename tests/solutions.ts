import type { Step } from './bot';

/** Keep running right and take off once the body centre passes tile x (a running jump). */
function jumpAt(x: number, keys = 'RJ*16 R*4'): Step[] {
  return [['until', (r) => r.player.grounded && r.player.x + 5 >= x * 16, 'R'], ['keys', keys]];
}

/**
 * Reference solutions, one entry per room. Each element is one loop: either a raw input
 * script (see harness.parseScript) or a list of bot steps (see bot.ts). Every loop but the
 * last must end in the player's death (it becomes a replay); the last must reach the exit.
 */
export const SOLUTIONS: Record<string, (string | Step[])[]> = {
  level01: [
    'R*50 RJ*20 R*40', // die in the spikes -> corpse becomes a stepping stone
    '.*40 R*50 RJ*18 .*10 RJ*16 RJD*1 RJ*10 R*34 RJ*20 R*60',
  ],
  level02: [
    'R*22 .*240 R*80', // stand on the plate for 4 s, then walk into spikes
    'R*70 RJ*20 R*300',
  ],
  level03: [
    'R*100 .*20 J*10', // trapped in the pit: jump into the ceiling spikes above the plate
    '.*140 L*90',
  ],
  level04: [
    'L*85 .*30 J*10', // left pit: corpse on plate A
    'R*85 .*400 R*60', // right pit: stand on plate B, then walk into spikes
    'R*50 RJ*10 R*20 RJ*14 RJD*1 RJ*12 R*60',
  ],
  level05: [
    'R*84 .*420 R*30', // bait the walker onto the plate from the walkway above
    '.*120 L*120',
  ],
  level06: [
    'R*22 RJ*20 R*40', // A: stepping stone in the spike bed
    '.*50 R*22 RJ*18 R*13 RJ*14 RJD*1 RJ*10 R*50 .*700 L*200', // B: cross, bait the walker, hold
    'L*110 .*20 J*10', // C: corpse on the pit plate
    '.*150 LJ*4 J*16 .*10 LJ*20 .*10 LJ*20 L*120', // YOU
  ],
  level07: [
    [['to', 4.0], ['climb', 3.2, -1, [10, 12, 9]], ['keys', 'R*24'], ['to', 9.0], ['keys', 'J*10']],
    [['wait', 10], ['to', 16.0], ['keys', 'R*10 RJ*18 R*6'], ['to', 24.0], ['keys', 'RJ*16 RJD*1 RJ*10 R*6'], ['to', 32.5]],
  ],
  level08: [
    // walk onto the spring bed: it throws you into the spikes, and your body falls back and jams it
    [['to', 13.5]],
    // YOU: walk over the jammed bed, then take the second spring over the pit onto the wall
    [['until', (r) => r.springs[0].jammed, ''], ['to', 25.0], ['until', (r) => r.player.vy < -5, 'R'], ['until', (r) => r.player.grounded, 'R'], ['to', 35.5]],
  ],
  level09: [
    // the crystal chain; the spring throws you onto the perch; jump into its spikes (corpse holds the plate)
    [['keys', 'R*34 RJ*14 RJD*1 RJ*9 R*1 RD*1 R*9 R*7 RD*1 R*9 R*2 RD*1 R*9 R*10 RD*1 R*9 R*3 RD*1 R*9 R*6 RD*1 R*9'], ['until', (r) => r.player.grounded, 'R'], ['until', (r) => r.player.vy < -5, 'R'],
      ['wait', 10], ['until', (r) => r.player.grounded, 'L'], ['to', 33.0], ['keys', 'J*10']],
    // YOU: let the crystals grow back first (your past self just used them)
    [['wait', 160], ['keys', 'R*34 RJ*14 RJD*1 RJ*9 R*1 RD*1 R*9 R*7 RD*1 R*9 R*2 RD*1 R*9 R*10 RD*1 R*9 R*3 RD*1 R*9 R*6 RD*1 R*9'], ['until', (r) => r.player.grounded, 'R'], ['to', 34.3], ['keys', 'RJ*14 R*4'], ['to', 38.5]],
  ],
  level10: [
    [['walk', 11.3], ['keys', 'RJ*16 R*4'], ['walk', 19.3], ['keys', 'RJ*14 RJD*1 RJ*8 R*4'], ['to', 29.9], ['keys', 'J*10']],
    [['wait', 8], ['walk', 11.3], ['keys', 'RJ*16 R*4'], ['walk', 19.3], ['keys', 'RJ*14 RJD*1 RJ*8 R*4'], ['until', (r) => r.doors[0].open, 'R'], ['to', 34.5]],
  ],
  level11: [
    // ground run, climb the shaft, stand on the brittle floor until it drops you onto the switch, then the spikes
    [['walk', 7.6], ['keys', 'R*6 RJ*18 R*4'], ['to', 14.2], ['keys', 'RJ*16 R*4'], ['to', 16.0], ['keys', 'R*4 RJ*16 RJD*1 RJ*8 R*4'],
      ['to', 23.0], ['keys', 'RJ*16 R*6'], ['to', 31.5], ['climb', 1.6, 1, []], ['keys', '.*1 LJ*14'], ['until', (r) => r.player.grounded, 'L'], ['to', 17.0], ['wait', 60], ['to', 18.3]],
    // YOU: same climb, then clear the hole your past self left
    [['walk', 7.6], ['keys', 'R*6 RJ*18 R*4'], ['to', 14.2], ['keys', 'RJ*16 R*4'], ['to', 16.0], ['keys', 'R*4 RJ*16 RJD*1 RJ*8 R*4'],
      ['to', 23.0], ['keys', 'RJ*16 R*6'], ['to', 31.5], ['climb', 1.6, 1, []], ['keys', '.*1 LJ*14'], ['until', (r) => r.player.grounded, 'L'], ['to', 21.0],
      ['keys', 'L*6 LJ*14 LJD*1 LJ*10 L*4'], ['to', 2.5]],
  ],
  level12: [
    // A: wait at the edge until YOU have crossed, then drop through the bridge onto the timed switch
    [['to', 10.3], ['until', (r) => r.frame >= 150, ''], ['to', 12.0], ['until', (r) => r.player.grounded && r.player.y > 22 * 16, ''],
      ['wait', 10], ['keys', 'R*40']],
    // YOU: cross first, wait under the shaft, climb through the hatch while it is open
    [['to', 31.5], ['until', (r) => r.plates[0].pressed, ''], ['wall', 1, 9.6], ['wall', -1, 2.0], ['keys', 'R*30'], ['to', 37.5]],
  ],
  level13: [
    // past self: same route, but only steps on the lift plate (and dies there) once YOU are aboard
    [['to', 3.8], ['to', 6.3], ['until', (r) => r.platforms[0].x >= 13 * 16, ''], ['keys', 'RJ*14 R*6'], ['to', 17.9],
      ['until', (r) => r.platforms[1].y >= 10 * 16 && r.platforms[1].y <= 11 * 16 && r.platforms[1].dir === -1, ''], ['keys', 'RJ*12 R*6 .*4'],
      ['until', (r) => r.platforms[1].y === 6 * 16, ''], ['keys', 'RJ*12 R*6'], ['to', 23.6], ['until', (r) => r.frame >= 560, ''], ['to', 25.9], ['keys', 'J*10']],
    // YOU: ride, climb, drop onto the lift, wait to be carried up
    [['to', 3.8], ['to', 6.3], ['until', (r) => r.platforms[0].x >= 13 * 16, ''], ['keys', 'RJ*14 R*6'], ['to', 17.9],
      ['until', (r) => r.platforms[1].y >= 10 * 16 && r.platforms[1].y <= 11 * 16 && r.platforms[1].dir === -1, ''], ['keys', 'RJ*12 R*6 .*4'],
      ['until', (r) => r.platforms[1].y === 6 * 16, ''], ['keys', 'RJ*12 R*6'], ['to', 27.4], ['keys', 'R*20'], ['until', (r) => r.player.grounded, ''], ['until', (r) => r.platforms[2].y <= 3 * 16 + 1, ''], ['to', 37.5]],
  ],
  level14: [
    // spring onto the shelf, die under its spikes: the belt delivers the body into the pocket, onto the plate
    [['to', 21.0], ['until', (r) => r.player.vy < -5, 'R'], ['wait', 6], ['until', (r) => r.player.grounded, 'L'], ['until', (r) => r.player.x + 5 <= 11.3 * 16, 'L'], ['keys', 'J*10']],
    // YOU: hop the spring, fight the belt, hop + dash the spikes under the low ceiling
    [['to', 20.8], ['keys', 'RJ*14 R*6'], ['until', (r) => r.player.x + 5 >= 24.6 * 16, 'R'], ['keys', 'RJ*5 R*2 RD*1 R*14'], ['until', (r) => r.doors[0].open, 'R'], ['to', 35.5]],
  ],
  level15: [
    // ride the lift to the brittle perch and touch the timed switch as it collapses
    [['to', 6.0], ['until', (r) => r.platforms[0].y === 14 * 16 && r.frame > 100, ''], ['keys', 'J*12 .*4'],
      ['until', (r) => r.platforms[0].y === 5 * 16, ''], ['keys', 'L*30'], ['idle']],
    // YOU: leave late enough that the door is open when you arrive
    [['until', (r) => r.frame >= 330, ''], ['keys', 'R*6 RJ*14 RJD*1 RJ*8 R*15 RJ*5 R*2 RD*1 R*9 R*1 RD*1 R*9 R*1 RD*1 R*10'], ['until', (r) => r.doors[0].open, 'R'], ['to', 38.5]],
  ],
  level16: [
    // spring onto the walkway, stand over the pit: the walker follows onto the belt and is carried off
    [['until', (r) => r.player.vy < -5, 'L'], ['wait', 8], ['until', (r) => r.player.grounded, 'R'], ['to', 28.6],
      ['until', (r) => r.walkers[0].y > 17 * 16, ''], ['keys', 'J*10']],
    // YOU: ride the belt, hop + dash the pit before the belt throws you in
    [['until', (r) => r.walkers[0].y > 17 * 16, ''], ['until', (r) => r.player.x + 5 >= 27.5 * 16, 'R'], ['keys', 'RD*1 R*14'], ['to', 35.5]],
  ],
  level17: [
    // A: jump into the low spikes over the belt
    [['walk', 7.2], ['keys', 'RJ*12 R*4'], ['until', (r) => r.player.x + 5 >= 15 * 16, 'R'], ['keys', 'RJ*10']],
    // YOU: turn the belt around until the body has ridden under the slot onto the plate, then climb out
    [['to', 3.9], ['until', (r) => r.plates[1].pressed, ''], ['walk', 7.2], ['keys', 'RJ*12 R*4'], ['until', (r) => r.player.x + 5 >= 22.4 * 16, 'R'], ['wall', 1, 7.0], ['wall', -1, 2.2], ['keys', 'R*20'], ['to', 37.5]],
  ],
  level18: [
    // A: spring onto the belt shelf, die under its spikes -> the body reverses the long belt
    [['until', (r) => r.player.vy < -5, 'R'], ['until', (r) => r.player.grounded, 'R'], ['until', (r) => r.player.x + 5 >= 16 * 16, 'R'], ['keys', 'J*10']],
    // B: lift to the brittle perch; touch the timed switch as it collapses
    [['to', 6.0], ['until', (r) => r.platforms[0].y === 18 * 16 && r.frame > 200, ''], ['keys', 'J*12 .*4'],
      ['until', (r) => r.platforms[0].y === 6 * 16, ''], ['keys', 'L*30'], ['idle']],
    // YOU
    [['until', (r) => r.frame >= 300, ''], ['walk', 8.8], ['keys', 'RJ*14 R*4'], ['until', (r) => r.player.x + 5 >= 13.3 * 16, 'R'],
      ['keys', 'RJ*5 R*2 RD*1 R*10'], ['until', (r) => r.player.grounded && r.player.x + 5 >= 18.2 * 16, 'R'],
      ['keys', 'RJ*5 R*2 RD*1 R*10'], ['until', (r) => r.player.grounded && r.player.x + 5 >= 23.2 * 16, 'R'],
      ['keys', 'RJ*5 R*2 RD*1 R*10'], ['until', (r) => r.doors[0].open, 'R'], ['to', 33.6],
      ['climb', 2.2, 1, [], -1], ['keys', '.*1 RJ*14'], ['until', (r) => r.player.grounded, 'R'], ['to', 37.5]],
  ],
  level19: [
    [['to', 2.9], ['wait', 900], ['to', 9.6]],
    [['walk', 8.0], ['keys', 'RJ*16 R*4'], ['to', 14.5], ['climb', 1.9, -1, [], 1], ['keys', 'R*10'], ['until', (r) => r.player.grounded, 'R'],
      ['until', (r) => !r.lasers[2].on, ''], ['to', 33.5]],
  ],
  level20: [
    [['to', 6.6]], // drop into the corridor: the beam kills, the body blocks it
    [['walk', 4.9], ['keys', 'RJ*12 R*4'], ['until', (r) => r.player.grounded, 'R'], ['until', (r) => r.player.x + 5 >= 9.4 * 16, 'R'], ['keys', 'RJ*14 R*16 RJ*14 R*6'], ['to', 19.6],
      ['until', (r) => r.player.grounded && r.player.y > 10 * 16, ''], ['to', 24.8],
      ['until', (r) => !r.lasers[1].on && !r.lasers[1].warn, ''], ['to', 29.8], ['until', (r) => !r.lasers[2].on && !r.lasers[2].warn, ''], ['to', 37.5]],
  ],
  level21: [
    // A: once the first walker has burned, hold the plate (beam 1 off, beam 2 on) until the second has burned too
    [['to', 11.6], ['until', (r) => !r.walkers[0].alive, ''], ['to', 2.9], ['until', (r) => r.frame >= 420, ''], ['to', 14.5]],
    // YOU: draw the first walker into beam 1, pass it while it is off, draw the second into beam 2, wait for it to go dark
    [['to', 11.6], ['until', (r) => !r.walkers[0].alive && !r.lasers[0].on, ''], ['to', 24.6],
      ['until', (r) => !r.walkers[1].alive && !r.lasers[1].on, ''], ['to', 38.5]],
  ],
  level22: [
    // B: hold the far-left plate (first beam dark), then step back onto the spike so the far door reopens
    [['to', 2.9], ['until', (r) => r.frame >= 150, ''], ['keys', 'L*30']],
    // A: hold the other plate (second beam dark), then walk off onto the spike so the first door reopens
    [['to', 8.9], ['until', (r) => r.frame >= 150, ''], ['keys', 'R*40']],
    // YOU: both beams must be dark during one jump across the pit
    [['walk', 10.1], ['keys', 'RJ*14 R*4'], ['walk', 15.3], ['keys', 'R*2 RJ*14 RD*1 R*20'], ['until', (r) => r.doors[0].open, ''],
      ['walk', 26.1], ['keys', 'RJ*16 R*4'], ['to', 29.8], ['until', (r) => r.doors[1].open, ''], ['to', 37.5]],
  ],
  level23: [
    // hold the plate: the platform slides right along the emitters, shading one beam at a time
    [['to', 2.9], ['wait', 1300], ['to', 8.5]],
    // YOU: walk in its shadow
    [['walk', 7.0], ['keys', 'RJ*12 R*4'],
      ['until', (r) => r.platforms[0].x >= 11 * 16 + 2, ''], ['to', 14.2], ['walk', 14.6], ['keys', 'R*4 RJ*14 R*4'],
      ['until', (r) => r.platforms[0].x >= 19 * 16 + 2, ''], ['to', 22.3], ['walk', 22.6], ['keys', 'R*4 RJ*14 R*4'],
      ['until', (r) => r.platforms[0].x >= 27 * 16 + 2, ''], ['to', 30.2], ['walk', 30.6], ['keys', 'R*4 RJ*14 R*4'], ['to', 37.5]],
  ],
  level24: [
    // A: drop in first: the floor beam kills you and your body shields the corridor
    [['to', 6.6]],
    // C: run the spike strips to the shutter plate and hold it (the exit beam is shaded) for a long time
    [['walk', 4.8], ['keys', 'RJ*12 R*4'], ...jumpAt(11.2), ...jumpAt(18.2), ...jumpAt(25.2), ['to', 33.9], ['wait', 1200], ['keys', 'L*80']],
    // B: drop in, stand left of the pulse beam until the walker has chased you into it
    [['until', (r) => r.frame >= 60, ''], ['to', 6.6], ['until', (r) => r.player.grounded, ''], ['to', 17.5],
      ['until', (r) => !r.walkers[0].alive, ''], ['until', (r) => r.lasers[1].on, ''], ['keys', 'R*40']],
    // YOU
    [['until', (r) => r.frame >= 90, ''], ['to', 6.6], ['until', (r) => r.player.grounded, ''], ['to', 17.5],
      ['until', (r) => !r.walkers[0].alive && !r.lasers[1].on && !r.lasers[1].warn, ''], ['to', 38.5]],
  ],
  level25: [
    // A: be the stool at the foot of the step
    [['to', 9.4], ['wait', 1500], ['to', 1.4]],
    // B: climb A, walk to the wall and jump at a fixed time: YOU will be riding on your head
    [['to', 6.4], ['until', (r) => r.frame >= 70, ''], ['keys', 'RJ*16 R*3 .*6'], ['keys', 'RJ*14 R*8'], ['walk', 17.6], ['keys', 'R*4 RJ*12 R*4'], ['to', 24.2], ['until', (r) => r.frame >= 400, ''], ['keys', 'J*20'],
      ['until', (r) => r.player.grounded, ''], ['to', 19.4]],
    // YOU: climb A, stand on B, jump off at the top of B's jump
    [['to', 6.4], ['until', (r) => r.frame >= 70, ''], ['keys', 'RJ*16 R*3 .*6'], ['keys', 'RJ*14 R*8'], ['walk', 17.6], ['keys', 'R*4 RJ*12 R*4'], ['to', 23.2], ['keys', 'RJ*10 R*3 .*6'],
      ['until', (r) => r.frame >= 400 + 15, ''], ['keys', 'RJ*16 R*20'], ['to', 37.5]],
  ],
  level26: [
    // A: jump twice at the foot of the first ledge (once for B, once for YOU), then walk into the spikes
    [['to', 10.6], ['until', (r) => r.frame >= 200, ''], ['keys', 'J*20'], ['until', (r) => r.frame >= 420, ''], ['keys', 'J*20'],
      ['wait', 40], ['to', 1.5]],
    // B: board A, jump off at the top of its jump onto the ledge; walk to the edge, jump for YOU at a fixed time
    [['to', 8.6], ['keys', 'RJ*12 R*3 .*8'], ['until', (r) => r.frame >= 200 + 14, ''], ['keys', 'RJ*16 R*20'],
      ['until', (r) => r.player.grounded, 'R'], ['to', 20.3], ['until', (r) => r.frame >= 640, ''], ['keys', 'J*20'],
      ['until', (r) => r.player.grounded, ''], ['to', 17.9], ['keys', 'J*10']],
    // YOU: same ride on A's second jump, then stand on B and ride its jump onto the top
    [['to', 8.6], ['until', (r) => r.frame >= 330, ''], ['keys', 'RJ*12 R*3 .*8'], ['until', (r) => r.frame >= 420 + 14, ''], ['keys', 'RJ*16 R*20'],
      ['until', (r) => r.player.grounded, 'R'], ['to', 19.2], ['keys', 'RJ*6 R*2 .*12'], ['until', (r) => r.frame >= 640 + 14, ''], ['keys', 'RJ*16 R*20'],
      ['to', 37.5]],
  ],
  level27: [
    // A: run left over both spike strips and be the step under the ledge until time runs out
    [['walk', 18.3], ['keys', 'L*6 LJ*14 L*4'], ['walk', 13.6], ['keys', 'L*4 LJ*16 L*4'], ['to', 7.4], ['idle']],
    // B: same run, climb A, hold the ledge plate
    [['walk', 18.3], ['keys', 'L*6 LJ*14 L*4'], ['walk', 13.6], ['keys', 'L*4 LJ*16 L*4'], ['to', 9.3], ['keys', 'LJ*12 L*3 .*6'],
      ['keys', 'LJ*14 L*6'], ['to', 3.9], ['idle']],
    // C: hold the pit plate
    [['to', 23.9], ['idle']],
    // YOU
    [['to', 27.0], ['until', (r) => r.doors[0].open, ''], ['walk', 29.6], ['keys', 'R*6 RJ*14 RJD*1 RJ*8 R*6'], ['to', 37.5]],
  ],
  level28: [
    // B: cross the brittle bridge and step on the spring, then steer back into the pit
    [['wait', 90], ['walk', 11.4], ['keys', 'R*4 RJ*12 R*4'], ['walk', 17.4], ['keys', 'R*4 RJ*12 R*4'], ['to', 26.6],
      ['until', (r) => r.frame >= 330, ''], ['until', (r) => r.player.vy < -5, 'R'], ['wait', 20], ['until', (r) => r.player.y > 20 * 16, 'L']],
    // YOU: ride B's head the whole way; jump off at the top of its launch
    [['keys', 'J*10 .*30'], ['until', (r) => r.characters[0].x > 26 * 16 && r.characters[0].vy < -5, ''], ['until', (r) => r.characters[0].vy > -1.5, ''],
      ['keys', 'RJ*16 R*20'], ['to', 37.5]],
  ],
  level29: [
    // A: work the plate twice: on while each traveller crosses the beam, off again before they reach the door
    [['to', 2.9], ['until', (r) => r.frame >= 120, ''], ['to', 6.5],
      ['until', (r) => r.frame >= 230, ''], ['to', 2.9], ['until', (r) => r.frame >= 330, ''], ['to', 6.5], ['idle']],
    // B: cross the beam in the first window, the door after it reopens, be the stool under the shelf and jump for YOU
    [['walk', 9.6], ['keys', 'R*4 RJ*14 R*4'], ['until', (r) => !r.lasers[0].on, ''], ['to', 22.0], ['until', (r) => r.doors[0].open, ''],
      ['walk', 26.6], ['keys', 'R*4 RJ*14 R*4'], ['to', 33.5], ['until', (r) => r.frame >= 560, ''], ['keys', 'J*20'], ['idle']],
    // YOU: the same, in the second window, then ride B's jump onto the shelf
    [['until', (r) => r.frame >= 150, ''], ['walk', 9.6], ['keys', 'R*4 RJ*14 R*4'], ['until', (r) => !r.lasers[0].on, ''], ['to', 22.0],
      ['until', (r) => r.doors[0].open, ''], ['walk', 26.6], ['keys', 'R*4 RJ*14 R*4'], ['walk', 31.0], ['keys', 'RJ*10 R*2 .*8'],
      ['until', (r) => r.frame >= 560 + 14, ''], ['keys', 'RJ*16 R*20'], ['to', 37.5]],
  ],
  level30: [
    // A: bait the walker into the pulsing beam, then be the step at the foot of the plateau until time runs out
    [['to', 7.3], ['until', (r) => !r.walkers[0].alive, ''], ['until', (r) => !r.lasers[0].on && !r.lasers[0].warn, ''], ['to', 23.4], ['idle']],
    // B: over A, up the shaft, across the brittle bridge (it falls behind you) to the last wall; jump at a fixed time
    [['until', (r) => !r.walkers[0].alive, ''], ['to', 7.6], ['until', (r) => !r.lasers[0].on && !r.lasers[0].warn, ''], ['to', 22.3],
      ['keys', 'RJ*12 R*2 .*8'], ['keys', 'RJ*14 R*8'], ['to', 28.4], ['climb', 6.2, -1, [], -1], ['keys', '.*1 LJ*14'], ['until', (r) => r.player.grounded, 'L'], ['walk', 5.9], ['until', (r) => r.frame >= 1150, ''], ['keys', 'J*20'], ['idle']],
    // YOU
    [['until', (r) => !r.walkers[0].alive, ''], ['to', 7.6], ['until', (r) => !r.lasers[0].on && !r.lasers[0].warn, ''], ['to', 22.3],
      ['keys', 'RJ*12 R*2 .*8'], ['keys', 'RJ*14 R*8'], ['to', 28.4], ['climb', 6.2, -1, [], -1], ['keys', '.*1 LJ*14'], ['until', (r) => r.player.grounded, 'L'],
      ['walk', 7.4], ['keys', 'LJ*10 L*3 .*8'], ['until', (r) => r.frame >= 1150 + 14, ''], ['keys', 'LJ*16 L*20'], ['to', 2.5]],
  ],
  level31: [
    // A: hold the plate: every door opens, the beam is loosed, and so is the brute
    [['to', 2.9], ['wait', 1400], ['to', 10.5], ['until', (r) => r.player.grounded, ''], ['to', 30]],
    // YOU: drop in ahead of the brute and keep it between you and the beam; hop the crawlers
    [['wait', 60], ['to', 10.5], ['until', (r) => r.player.grounded && r.player.y > 16 * 16, ''], ['keys', 'R*20'],
      ['until', (r) => r.player.x + 5 >= r.walkers[1].x - 30, 'R'], ['keys', 'RJ*12 R*4'],
      ['until', (r) => r.player.grounded, 'R'], ['until', (r) => r.player.x + 5 >= r.walkers[2].x - 30, 'R'], ['keys', 'RJ*12 R*4'],
      ['to', 38.5]],
  ],
  level32: [
    // A: jump out under the crusher and fall into the pit: it slams down after you
    [['walk', 11.0], ['keys', 'RJ*16 RJD*1 RJ*10 R*20']],
    // YOU: once it has landed, jump onto its back and ride it up; hop across to the shelf
    [['until', (r) => r.frame >= 75, ''], ['walk', 11.2], ['keys', 'RJ*16 RJD*1 RJ*10 R*6'],
      ['until', (r) => r.player.grounded, 'R'], ['until', (r) => r.crushers[0].state === 'idle', ''], ['to', 21.0], ['keys', 'RJ*14 R*10'], ['to', 36.5]],
  ],
  level33: [
    // A: hold the plate at the far left for a long while, then jump into the spiked roof
    [['to', 2.9], ['wait', 1200], ['to', 11.0], ['keys', 'J*10']],
    // YOU: walk left into the wall so the mimic, pinned by its own wall, ends up far ahead of you;
    //      jump in the open exactly when it reaches its pit, then walk under the spiked roof to the door
    [['keys', 'L*80'], ['until', (r) => r.mimics[0].x + 5 >= 13.2 * 16, 'R'], ['keys', 'RJ*16 R*10'],
      ['until', (r) => r.player.grounded, 'R'], ['to', 37.5]],
  ],
  level34: [
    // YOU, alone: lean into the left wall until the mirror has run all the way right (you stay put, it doesn't);
    // jump+dash in the first bay as the mimic reaches its pit; jump+dash in the second as the mirror reaches its own;
    // then lean on the last door until the mirror settles on its plate
    [['until', (r) => r.mimics[1].x >= 598, 'L'],
      ['until', (r) => r.mimics[0].x + 10 >= 200, 'R'], ['keys', 'RJ*10 RJD*1 RJ*8'], ['until', (r) => r.player.grounded, 'R'],
      ['until', (r) => r.mimics[1].x <= 228, 'R'], ['keys', 'RJ*10 RJD*1 RJ*8'], ['until', (r) => r.player.grounded, 'R'],
      ['until', (r) => r.player.x >= 600, 'R'], ['to', 41.5]],
  ],
  level35: [
    // A: wait at the brink, then drop into the shaft: the crusher takes you
    [['walk', 10.8], ['keys', 'R*4 RJ*14 R*4'], ['to', 32.4], ['until', (r) => r.frame >= 100, ''], ['keys', 'R*30']],
    // YOU: walk to the left wall first (the mimic is already pinned against its own), so that you are in the open
    //      when it stands on its plate; jump: it dies on the spikes above, its body holds the plate for good.
    //      Then drop into the shaft as the crusher lifts clear of the ledge, and run.
    [['keys', 'L*60'], ['walk', 10.8], ['keys', 'R*4 RJ*14 R*4'], ['until', (r) => r.mimics[0].x + 5 >= 22.6 * 16, 'R'], ['keys', 'J*10'],
      ['to', 32.4], ['until', (r) => r.crushers[0].state === 'rise' && r.crushers[0].y + r.crushers[0].h <= 188, ''], ['keys', 'R*30'],
      ['until', (r) => r.player.grounded, 'R'], ['to', 44.5]],
  ],
  level36: [
    // A: drop into the shaft: the brute sees you land and walks to where you fell, under the crusher
    [['walk', 8.8], ['keys', 'R*4 RJ*14 R*4'], ['to', 26.4], ['keys', 'R*30']],
    // YOU: walk left first, then right until the mirror stands on its plate; stop, jump straight up (it dies there).
    //      Walk to the brink and drop in as the crusher lifts off the brute.
    [['keys', 'L*50'], ['walk', 8.8], ['keys', 'R*4 RJ*14 R*4'], ['until', (r) => r.mimics[0].x <= 80, 'R'], ['keys', '.*12 J*12'],
      ['until', (r) => r.player.grounded, ''], ['to', 26.4],
      ['until', (r) => !r.walkers[0].alive && r.crushers[0].state === 'rise' && r.crushers[0].y + r.crushers[0].h <= 205, ''],
      ['keys', 'R*30'], ['until', (r) => r.player.grounded, 'R'], ['to', 47.5]],
  ],
  level37: [
    // walk the trench into its spike: replayed, the same steps cross the roof and stop on the plate
    [['keys', 'R*200']],
    [['walk', 14.5], ['keys', 'RJ*14 R*10'], ['to', 37.5]],
  ],
  level38: [
    // A: land on the far end of the first trapdoor (the past falls straight through, onto the plate)
    [['walk', 8.3], ['keys', 'RJ*14 R*70']],
    // B: clear the first trapdoor entirely, then land on the far end of the second
    [['walk', 8.3], ['keys', 'RJ*12 RD*1 R*12'], ['until', (r) => r.player.grounded, 'R'], ['walk', 15.1], ['keys', 'RJ*18 R*6'],
      ['walk', 20.6], ['keys', 'RJ*12 RD*1 R*80']],
    // YOU
    [['walk', 15.1], ['keys', 'RJ*18 R*6'], ['walk', 28.8], ['keys', 'RJ*12 R*4'], ['to', 37.5]],
  ],
  level39: [
    // climb the stair you cannot stand on, blind: replayed, the same inputs land on every step
    [['keys', 'L*6 LJ*14 L*2 .*14 R*4 RJ*16 R*4 .*12 R*6 RJ*16 R*6 .*12 L*4 LJ*16 L*6 .*12 L*4 LJ*14 L*4 .*12 L*3 R*3 RJ*10 RD*1 R*200']],
    // YOU: through the held door, up the steps only the living can use
    [['until', (r) => r.doors[0].open, ''], ['walk', 10.6], ['keys', 'RJ*14'], ['until', (r) => r.player.grounded, 'R'], ['keys', 'RJ*16 R*2'], ['until', (r) => r.player.grounded, 'R'], ['keys', 'R*6 RJ*16 R*4'], ['until', (r) => r.player.grounded, 'R'],
      ['keys', 'R*6 RJ*16 R*4'], ['until', (r) => r.player.grounded, 'R'], ['keys', 'R*6 RJ*16 R*4'], ['until', (r) => r.player.grounded, 'R'],
      ['keys', 'R*6 RJ*16 R*4'], ['to', 37.5]],
  ],
  level40: [
    // A: over the wall you cannot see, up the stair you cannot stand on
    [['keys', 'R*18 RJ*16 R*6 .*12 R*3 RJ*12 R*3 .*30 R*3 RJ*14 R*2 .*30 R*3 RJ*14 R*2 .*30 R*3 RJ*14 R*2 .*30 R*3 RJ*14 R*2 .*30 R*300']],
    // B: over the wall again (or the past gets stuck behind it), then land on the far end of the trapdoor
    [['keys', 'R*18 RJ*16 R*174 RJ*14 R*80']],
    // YOU
    [['walk', 34.2], ['keys', 'RJ*16 R*4'], ['until', (r) => r.doors[0].open, ''], ['to', 42.5]],
  ],
  level41: [
    // A: the whole climb and the first leap, then off the island: replayed, it drops through onto the plate
    [['to', 14.6], ['climb', 4.5, 1, [0, 0, 0, 0, 16]], ['until', (r) => r.player.grounded, 'R'], ['walk', 18.4], ['keys', 'RJ*20 RD*1 R*14'],
      ['until', (r) => r.player.grounded, 'R'], ['keys', 'R*60']],
    // YOU: all of it again
    [['to', 14.6], ['climb', 4.5, 1, [0, 0, 0, 0, 16]], ['until', (r) => r.player.grounded, 'R'], ['walk', 18.4], ['keys', 'RJ*20 RD*1 R*14'],
      ['until', (r) => r.player.grounded, 'R'], ['walk', 26.4], ['keys', 'RJ*20 RD*1 R*14'], ['until', (r) => r.player.grounded, 'R'], ['to', 37.5]],
  ],
  level42: [
    // A: climb the stair you cannot stand on, blind, and wait on the perch for the clock
    [['keys', 'R*26 RJ*14 R*3 .*10' + ' R*4 RJ*14 R*4 .*8'.repeat(5) + ' R*40'], ['idle']],
    // YOU: climb your own stair, step off A's head
    [['walk', 5.6], ['keys', 'RJ*14 R*2'], ['until', (r) => r.player.grounded, 'R'], ['walk', 8.6], ['keys', 'RJ*14 R*2'], ['until', (r) => r.player.grounded, 'R'],
      ['walk', 11.6], ['keys', 'RJ*14 R*2'], ['until', (r) => r.player.grounded, 'R'], ['walk', 14.6], ['keys', 'RJ*14 R*2'], ['until', (r) => r.player.grounded, 'R'],
      ['walk', 17.6], ['keys', 'RJ*14 R*2'], ['until', (r) => r.player.grounded, 'R'], ['until', (r) => r.player.x >= 20.3 * 16, 'R'], ['keys', 'RJ*18 R*6'], ['until', (r) => r.player.grounded, 'R'],
      ['walk', 26.4], ['keys', 'RJ*14 R*4'], ['until', (r) => r.player.grounded, 'R'], ['keys', 'RJ*14 R*10'], ['to', 37.5]],
  ],
  level43: [
    // B: both leaps, then straight on over the trapdoor into the spike: replayed, it drops into the cell, onto the plate
    [['walk', 7.4], ['keys', 'RJ*20 RD*1 R*14'], ['until', (r) => r.player.grounded, 'R'], ['walk', 15.4], ['keys', 'RJ*20 RD*1 R*14'],
      ['until', (r) => r.player.grounded, 'R'], ['keys', 'R*60']],
    // A: both leaps, leap the trapdoor too, through the door, down the shaft: the crusher gets A, the brute comes looking
    [['walk', 7.4], ['keys', 'RJ*20 RD*1 R*14'], ['until', (r) => r.player.grounded, 'R'], ['walk', 15.4], ['keys', 'RJ*20 RD*1 R*14'],
      ['until', (r) => r.player.grounded, 'R'], ['walk', 21.9], ['keys', 'RJ*20 RD*1 R*14'], ['until', (r) => r.player.grounded, 'R'], ['keys', 'R*200']],
    // YOU: all of it, then wait for the crusher to take the brute and start back up, and drop
    [['walk', 7.4], ['keys', 'RJ*20 RD*1 R*14'], ['until', (r) => r.player.grounded, 'R'], ['walk', 15.4], ['keys', 'RJ*20 RD*1 R*14'],
      ['until', (r) => r.player.grounded, 'R'], ['walk', 21.9], ['keys', 'RJ*20 RD*1 R*14'], ['until', (r) => r.player.grounded, 'R'], ['to', 28.3],
      ['until', (r) => !r.walkers[0].alive && r.crushers[0].state === 'rise' && r.crushers[0].y + r.crushers[0].h <= 185, ''],
      ['keys', 'R*30'], ['until', (r) => r.player.grounded, 'R'], ['to', 46.5]],
  ],
};
