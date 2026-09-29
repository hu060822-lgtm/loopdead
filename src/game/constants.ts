// All physics values are expressed per simulation tick (1/60 s) in world pixels.
// Never derive gameplay from wall-clock time: replays depend on this being fixed.

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const TILE = 16;

// Character (player + replays share these exactly)
export const CHAR_W = 10;
export const CHAR_H = 14;
export const RUN_SPEED = 2.1;
export const GROUND_ACCEL = 0.45;
export const GROUND_DECEL = 0.55;
export const AIR_ACCEL = 0.3;
export const AIR_DECEL = 0.12;
export const GRAVITY = 0.36;
export const JUMP_CUT_GRAVITY = 0.85; // extra gravity while rising with jump released
export const JUMP_FORCE = 6.0;
export const MAX_FALL = 7;
export const DASH_SPEED = 4.6;
export const DASH_FRAMES = 10;
export const DASH_COOLDOWN = 18;
export const COYOTE_FRAMES = 5; // ≈ 80 ms
export const JUMP_BUFFER_FRAMES = 6; // ≈ 100 ms

// Corpse
export const CORPSE_W = 14;
export const CORPSE_H = 5;

// Walker enemy
export const WALKER_W = 12;
export const WALKER_H = 12;
export const WALKER_PATROL_SPEED = 0.6;
export const WALKER_CHASE_SPEED = 1.25;
export const WALKER_DEFAULT_SIGHT = 7; // tiles
export const WALKER_SIGHT_Y = 40; // px, vertical tolerance for noticing a target

// Loop flow
export const DEATH_FREEZE_FRAMES = 32; // death -> next loop ≈ 0.53 s
export const REPLAY_CAP = 50;
export const OUT_OF_BOUNDS_MARGIN = 48;

// Input bitmask (one byte per tick in replay recordings)
export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;
export const IN_DASH = 8;

// Grip walls (wall slide + wall jump, only on grip tiles)
export const WALL_SLIDE_MAX = 1.4;
export const WALL_JUMP_VX = 3.1;
export const WALL_JUMP_VY = 5.7;
export const WALL_JUMP_LOCK = 8; // ticks of no horizontal control after a wall jump
export const WALL_CLIMB_VX = 1.2; // wall jump while holding toward the wall: a steeper kick for climbing one wall
export const WALL_CLIMB_LOCK = 5;
export const GRIP_REACH = 3; // px: how far from a grip wall still counts as touching it
export const WALL_COYOTE_FRAMES = 7; // ticks after leaving a grip wall that a wall jump still works

// Springs and dash orbs
export const SPRING_FORCE = 9.4;
export const SPRING_H = 6;
export const ORB_RESPAWN = 150;

// Crumbling blocks
export const CRUMBLE_TICKS = 22;

// Enemy variants (w, h in px)
export const CRAWLER_W = 12;
export const CRAWLER_H = 7;
export const CRAWLER_SPEED = 0.5;
export const BRUTE_W = 14;
export const BRUTE_H = 38;
export const BRUTE_PATROL_SPEED = 0.45;
export const BRUTE_CHASE_SPEED = 0.85;

// Crusher
export const CRUSHER_GRAVITY = 0.5;
export const CRUSHER_MAX_FALL = 8;
export const CRUSHER_WAIT = 45;
export const CRUSHER_RISE = 0.9;

/** A pursuer stands this long where it lost its target before going back to its beat. */
export const PURSUE_SEARCH = 120;
