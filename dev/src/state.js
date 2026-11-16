// Shared game state, collision groups and tuning values.
export const G = {
  t: 0,            // game time (scaled)
  rt: 0,           // real time
  dt: 0,
  hitStopT: 0,
  slowT: 0,
  slowScale: 1,
  paused: false,
  mode: 'title',   // title | intro | play | break | win | dead
  props: [],
  enemies: [],
  bolts: [],
  grenades: [],
  holds: new Map(), // pointerId -> hold
  pending: [],      // actions queued during physics step
  trauma: 0,
  combo: 0,
  comboT: 0,
  ult: 0,
  ultState: null,
  surgeCD: 0,
  wave: 0,
  waveQueue: [],
  stats: { throws: 0, hits: 0, kills: 0, maxCombo: 0, time: 0, blocks: 0, catches: 0 },
  tutorial: { moved: false, grabbed: false, thrown: false, hit: false },
  W: 1, H: 1, dpr: 1,
};

export const GRP = {
  GROUND: 1,
  HERO: 2,
  ENEMY: 4,
  PROP: 8,
  HELD: 16,   // held or thrown by Iris: ignores Iris
  STATIC: 32,
};
export const ALL = 0xffff;
export const NO_HERO = ALL & ~GRP.HERO;

export const TUNE = {
  GRAV: 22,
  HERO_SPEED: 6.4,
  GRAB_RANGE: 21,      // how far away Iris can seize something
  HOLD_MAX: 9.5,       // held objects stay within this radius of Iris
  HOLD_MIN: 1.5,
  FLICK_MIN: 360,      // css px / s
  AIM_CONE: 0.5,       // radians (~29 deg)
  FOCUS_REGEN: 22,
  ARENA: { x0: -12.6, x1: 12.6, z0: -26.4, z1: 24.4 },
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
