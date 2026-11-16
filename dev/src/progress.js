// Progression: XP -> levels -> skill points, spent as ink on Null's forearm.
// Saved to the phone (localStorage) together with the chapter checkpoint.

export const SKILLS = [
  { id: 'lift',   ink: 'HEAVY LIFTING',    what: 'Lifting and holding cost 15% less focus. Reach +8%.' },
  { id: 'throw',  ink: 'OVERWRITE',        what: 'Thrown things hit 15% harder and fly faster.' },
  { id: 'shield', ink: 'FIREWALL',         what: 'Anything you hold takes 15% less damage as a shield.' },
  { id: 'surge',  ink: 'SHOW ME THE GRID', what: 'Surge: +12% radius, +15% damage, 0.4s shorter cooldown.' },
  { id: 'root',   ink: 'ROOT ACCESS',      what: 'Root Access charges 15% faster and hits 15% harder.' },
  { id: 'catch',  ink: 'RETURN TO SENDER', what: 'Grenades you send back blow 25% bigger.' },
  { id: 'hp',     ink: 'BACKUPS',          what: '+15 max health. Heal faster out of combat.' },
  { id: 'focus',  ink: 'COOLANT',          what: '+15 max focus. Focus refills 15% faster.' },
];
export const MAX_RANK = 3, MAX_LEVEL = 20;
export const xpToNext = (lv) => 100 + (lv - 1) * 60;

const KEY = 'outliers.overclock.save.v1';
export const P = { level: 1, xp: 0, points: 0, ranks: {}, checkpoint: 0, done: false };
for (const s of SKILLS) P.ranks[s.id] = 0;

export function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return;
    const d = JSON.parse(raw);
    Object.assign(P, { level: d.level | 0 || 1, xp: d.xp | 0, points: d.points | 0, checkpoint: d.checkpoint | 0, done: !!d.done });
    for (const s of SKILLS) P.ranks[s.id] = Math.min(MAX_RANK, (d.ranks && d.ranks[s.id]) | 0);
  } catch (e) { /* private mode or blocked storage: play without saving */ }
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } }
export const rank = (id) => P.ranks[id] || 0;

// returns number of levels gained
export function addXP(n) {
  if (P.level >= MAX_LEVEL) return 0;
  P.xp += Math.round(n); let up = 0;
  while (P.level < MAX_LEVEL && P.xp >= xpToNext(P.level)) { P.xp -= xpToNext(P.level); P.level++; P.points++; up++; }
  if (up) save();
  return up;
}
export function buy(id) {
  if (P.points <= 0 || rank(id) >= MAX_RANK) return false;
  P.ranks[id]++; P.points--; save(); return true;
}
export function resetAll() { P.level = 1; P.xp = 0; P.points = 0; P.checkpoint = 0; P.done = false; for (const s of SKILLS) P.ranks[s.id] = 0; save(); }

// derived stats
export const stat = {
  maxHp: () => 100 + 15 * rank('hp') + 4 * (P.level - 1),
  maxFocus: () => 100 + 15 * rank('focus') + 3 * (P.level - 1),
  focusRegen: () => 1 + 0.15 * rank('focus'),
  regen: () => 1 + 0.5 * rank('hp'),
  liftCost: () => 1 - 0.15 * rank('lift'),
  reach: () => 1 + 0.08 * rank('lift'),
  throwDmg: () => 1 + 0.15 * rank('throw'),
  throwSpeed: () => 1 + 0.05 * rank('throw'),
  shield: () => 1 - 0.15 * rank('shield'),
  surgeR: () => 1 + 0.12 * rank('surge'),
  surgeDmg: () => 1 + 0.15 * rank('surge'),
  surgeCD: () => 3.2 - 0.4 * rank('surge'),
  ultGain: () => 1 + 0.15 * rank('root'),
  ultDmg: () => 1 + 0.15 * rank('root'),
  blast: () => 1 + 0.25 * rank('catch'),
};
