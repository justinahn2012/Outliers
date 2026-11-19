// Ground decals (environment.md Fix 6 + Appendix B): one 2048 x 1024 atlas of 32 cells painted in code, one InstancedMesh
// for the whole chapter (one draw call). Manholes, drains, patches, tar snakes, oil, skids, locate paint, road text,
// leaves, litter, cardboard, glass, weeds, moss, rust, chalk tallies, hazard hatch, bay marks, tree pits, floor drains,
// slab cracks, pallet ghosts, tread tracks, Census stencils, count-me stickers, ice, frost, fish water, ballast oil,
// rope coils, service covers. Placement per zone follows Appendix B2 (Harrow by hand, the rest scattered by rule).
import * as THREE from 'three';
import { drawLedger, drawTally } from './ledger.js';

const C = 256, COLS = 8, ROWS = 4;
// real size of each cell in metres [w, d]
export const DECAL_SIZE = [
  [0.7, 0.7], [0.9, 0.45], [2.0, 1.4], [3, 3], [1.4, 1.0], [4.5, 0.9], [1.6, 1.6], [2.4, 1.4],
  [1.6, 1.6], [1.2, 1.2], [1.0, 0.7], [1.0, 1.0], [0.8, 0.8], [2.0, 0.6], [0.8, 1.2], [1.0, 0.5],
  [2, 2], [1, 1], [1.2, 0.6], [1.2, 1.2], [0.5, 0.5], [3, 0.3], [1.2, 1.0], [4, 0.8],
  [2.6, 0.9], [0.6, 0.6], [1.2, 0.8], [3, 0.8], [1.5, 0.6], [3, 1.2], [0.9, 0.9], [0.6, 0.6],
];
export const D = { manhole: 0, drain: 1, patch: 2, tar: 3, oil: 4, skid: 5, locate: 6, slow: 7, leaves: 8, litter: 9, cardboard: 10, glass: 11, weeds: 12, moss: 13, rust: 14, chalk: 15, hazard: 16, bay: 17, codes: 18, treepit: 19, floordrain: 20, crack: 21, pallet: 22, tread: 23, stencil: 24, sticker: 25, ice: 26, frost: 27, fishwater: 28, ballast: 29, rope: 30, cover: 31 };

function atlas() {
  const cv = document.createElement('canvas'); cv.width = C * COLS; cv.height = C * ROWS; const x = cv.getContext('2d');
  let s = 4118; const R = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const cell = (i, draw) => { x.save(); x.translate((i % COLS) * C, Math.floor(i / COLS) * C); x.beginPath(); x.rect(0, 0, C, C); x.clip(); draw(); x.restore(); };
  // the cell is square in pixels but its real aspect is DECAL_SIZE: paint in a w x h box centred in the cell
  const box = (i) => { const [w, d] = DECAL_SIZE[i], k = Math.min(C / w, C / d) * 0.96; return [w * k, d * k, (C - w * k) / 2, (C - d * k) / 2]; };
  const specks = (n, col, X = 0, Y = 0, W = C, H = C, sz = 1) => { x.fillStyle = col; for (let k = 0; k < n; k++) x.fillRect(X + R() * W, Y + R() * H, sz, sz); };
  const blot = (cx, cy, r, col, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill(); };
  // 0 manhole
  cell(0, () => { const c = C / 2; x.fillStyle = '#0a0a0b'; x.beginPath(); x.arc(c, c, 124, 0, 6.3); x.fill(); x.fillStyle = '#45474b'; x.beginPath(); x.arc(c, c, 118, 0, 6.3); x.fill(); x.fillStyle = '#26272a'; x.beginPath(); x.arc(c, c, 108, 0, 6.3); x.fill();
    x.strokeStyle = '#3a3c40'; x.lineWidth = 3; for (const r of [30, 55, 80, 100]) { x.beginPath(); x.arc(c, c, r, 0, 6.3); x.stroke(); } for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; x.beginPath(); x.moveTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30); x.lineTo(c + Math.cos(a) * 100, c + Math.sin(a) * 100); x.stroke(); }
    x.fillStyle = '#4c4e52'; x.font = '700 22px Inter, Arial'; x.textAlign = 'center'; x.fillText('CS WATER', c, c + 8); specks(200, '#5a5c60', 20, 20, 216, 216); });
  // 1 storm drain
  cell(1, () => { const [w, h, ox, oy] = box(1); blot(C / 2, C / 2, 120, 'rgba(0,0,0,A)', 0.35); x.fillStyle = '#3e4044'; x.fillRect(ox, oy, w, h); for (let k = 0; k < 9; k++) { const sx = ox + 12 + k * (w - 24) / 9; x.fillStyle = '#050506'; x.fillRect(sx + 4, oy + 12, (w - 24) / 9 - 8, h - 24); x.fillStyle = '#4a4c50'; x.fillRect(sx + 4, oy + 12, (w - 24) / 9 - 8, 1); } });
  // 2 utility patch
  cell(2, () => { const [w, h, ox, oy] = box(2); x.fillStyle = 'rgba(30,30,32,0.85)'; x.fillRect(ox, oy, w, h); specks(300, '#2c2c2e', ox, oy, w, h); x.strokeStyle = '#0c0c0d'; x.lineWidth = 6; x.beginPath(); for (let k = 0; k <= 40; k++) { const t = k / 40, p = t * 4, e = p % 1, side = Math.floor(p); const px = side === 0 ? ox + e * w : side === 1 ? ox + w : side === 2 ? ox + w - e * w : ox, py = side === 0 ? oy : side === 1 ? oy + e * h : side === 2 ? oy + h : oy + h - e * h; k ? x.lineTo(px + (R() - 0.5) * 4, py + (R() - 0.5) * 4) : x.moveTo(px, py); } x.stroke(); });
  // 3 tar snakes
  cell(3, () => { x.lineJoin = x.lineCap = 'round'; for (let k = 0; k < 5; k++) { let px = 30 + R() * 196, py = 30 + R() * 196, a = R() * 6.3; const pts = [[px, py]]; for (let j = 0; j < 40; j++) { a += (R() - 0.5); px += Math.cos(a) * 6; py += Math.sin(a) * 6; pts.push([px, py]); } const w = 5 + R() * 3;
    x.strokeStyle = '#2a2a2c'; x.lineWidth = 1; x.beginPath(); pts.forEach(([a1, b1], j) => j ? x.lineTo(a1 - 1, b1 - 1) : x.moveTo(a1 - 1, b1 - 1)); x.stroke();
    x.strokeStyle = 'rgba(7,7,7,0.9)'; x.lineWidth = w; x.beginPath(); pts.forEach(([a1, b1], j) => j ? x.lineTo(a1, b1) : x.moveTo(a1, b1)); x.stroke(); } });
  // 4 oil stain
  cell(4, () => { const [w, h, ox, oy] = box(4); for (let k = 0; k < 6; k++) blot(ox + w * (0.3 + R() * 0.4), oy + h * (0.3 + R() * 0.4), 30 + R() * 50, 'rgba(10,9,8,A)', 0.5); x.fillStyle = 'rgba(10,9,8,0.6)'; for (let k = 0; k < 2; k++) { x.beginPath(); x.arc(ox + R() * w, oy + R() * h, 4, 0, 6.3); x.fill(); } });
  // 5 tyre skid
  cell(5, () => { const [w, h, ox, oy] = box(5); for (const b of [0.15, 0.6]) { const g = x.createLinearGradient(ox, 0, ox + w, 0); g.addColorStop(0, 'rgba(5,5,5,0.55)'); g.addColorStop(1, 'rgba(5,5,5,0)'); x.fillStyle = g; x.fillRect(ox, oy + h * b, w, h * 0.24); x.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 30; k++) x.fillRect(ox + R() * w * 0.8, oy + h * b + R() * h * 0.24, 6 + R() * 20, 1); } });
  // 6 locate paint
  cell(6, () => { x.shadowBlur = 3; x.lineWidth = 6; x.lineCap = 'round'; x.strokeStyle = x.shadowColor = '#2f7fd8'; x.beginPath(); x.moveTo(30, 200); x.lineTo(220, 180); x.stroke();
    x.font = '900 70px Inter, Arial'; x.fillStyle = '#2f7fd8'; x.fillText('W', 70, 140); x.strokeStyle = x.shadowColor = '#dedad0'; x.beginPath(); x.moveTo(160, 60); x.lineTo(200, 120); x.stroke(); x.fillStyle = '#dedad0'; x.beginPath(); x.arc(190, 160, 8, 0, 6.3); x.fill(); specks(120, 'rgba(47,127,216,0.5)', 20, 150, 200, 70, 2); });
  // 7 road text SLOW
  cell(7, () => { x.save(); x.translate(C / 2, C / 2); x.scale(1, 2.2); x.font = '900 64px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(216,212,200,0.8)'; x.fillText('SLOW', 0, 0); x.restore(); x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 120; k++) { x.beginPath(); x.arc(R() * C, R() * C, 2 + R() * 6, 0, 6.3); x.fill(); } x.globalCompositeOperation = 'source-over'; });
  // 8 leaves (drifted into one corner)
  cell(8, () => { const cols = ['#3a2e1a', '#5a4a22', '#2a2414', '#6a3a1a']; for (let k = 0; k < 45; k++) { const t = Math.pow(R(), 0.5); x.fillStyle = cols[k % 4]; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(20 + t * 200 * R(), 20 + t * 200 * R(), 6 + R() * 8, 3 + R() * 4, R() * 3, 0, 6.3); x.fill(); } x.globalAlpha = 1; });
  // 9 litter
  cell(9, () => { x.save(); x.translate(110, 100); x.rotate(0.3); x.fillStyle = '#b8b2a2'; x.fillRect(-60, -40, 120, 80); x.fillStyle = '#6a665e'; for (let k = 0; k < 8; k++) x.fillRect(-52, -32 + k * 9, 70 + R() * 30, 3); x.restore();
    for (let k = 0; k < 10; k++) { x.save(); x.translate(30 + R() * 200, 150 + R() * 90); x.rotate(R() * 6); x.fillStyle = '#d8cfb8'; x.fillRect(0, 0, 8, 3); x.fillStyle = '#c89060'; x.fillRect(6, 0, 3, 3); x.restore(); }
    for (let k = 0; k < 3; k++) { x.fillStyle = '#8a8a90'; x.beginPath(); x.arc(40 + R() * 180, 30 + R() * 200, 4, 0, 6.3); x.fill(); } x.fillStyle = '#e8e4dc'; x.beginPath(); x.ellipse(200, 200, 18, 12, 0.5, 0, 6.3); x.fill(); });
  // 10 cardboard
  cell(10, () => { const [w, h, ox, oy] = box(10); x.fillStyle = '#7a5c3c'; x.fillRect(ox, oy, w, h); x.strokeStyle = 'rgba(58,42,26,0.6)'; x.lineWidth = 20; x.strokeRect(ox + 10, oy + 10, w - 20, h - 20); x.fillStyle = '#5a4228'; x.fillRect(ox, oy + h / 2 - 1, w, 3); x.fillStyle = '#a89878'; x.fillRect(ox + w * 0.45, oy, w * 0.1, h); });
  // 11 glass
  cell(11, () => { for (let k = 0; k < 40; k++) { const r = Math.pow(R(), 1.5) * 100, a = R() * 6.3, cx = C / 2 + Math.cos(a) * r, cy = C / 2 + Math.sin(a) * r, sz = 3 + R() * 6; x.fillStyle = 'rgba(232,240,248,0.85)'; x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, cy - sz); x.lineTo(cx + sz, cy + sz * 0.6); x.lineTo(cx - sz * 0.7, cy + sz * 0.4); x.closePath(); x.fill(); x.stroke(); } });
  // 12 weed tufts
  cell(12, () => { for (let k = 0; k < 6; k++) { const cx = 40 + R() * 176, cy = 40 + R() * 176, n = 7 + Math.floor(R() * 5); for (let j = 0; j < n; j++) { const a = R() * 6.3, l = 10 + R() * 18; x.strokeStyle = j % 2 ? '#3a4a26' : '#56602e'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke(); } } });
  // 13 moss wash
  cell(13, () => { const [w, h, ox, oy] = box(13); const g = x.createLinearGradient(0, oy, 0, oy + h); g.addColorStop(0, 'rgba(30,42,24,0)'); g.addColorStop(0.4, 'rgba(30,42,24,0.5)'); g.addColorStop(1, 'rgba(30,42,24,0.5)'); x.fillStyle = g; x.beginPath(); x.moveTo(ox, oy + h); for (let k = 0; k <= 20; k++) x.lineTo(ox + k / 20 * w, oy + R() * h * 0.5); x.lineTo(ox + w, oy + h); x.fill(); });
  // 14 rust drip
  cell(14, () => { const [w, h, ox, oy] = box(14); blot(C / 2, oy + h * 0.3, 60, 'rgba(90,46,24,A)', 0.5); x.fillStyle = 'rgba(90,46,24,0.4)'; for (let k = 0; k < 5; k++) x.fillRect(C / 2 - 30 + R() * 60, oy + h * 0.3, 4 + R() * 6, h * (0.4 + R() * 0.3)); });
  // 15 chalk tally
  cell(15, () => { x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 4; x.lineCap = 'round'; for (let g = 0; g < 4; g++) { const bx = 24 + g * 56, by = 90; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(bx + k * 10, by + (R() - 0.5) * 4); x.lineTo(bx + k * 10 + (R() - 0.5) * 4, by + 70); x.stroke(); } x.beginPath(); x.moveTo(bx - 6, by + 56); x.lineTo(bx + 40, by + 12); x.stroke(); } x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 400; k++) x.fillRect(R() * C, R() * C, 2, 1); x.globalCompositeOperation = 'source-over'; });
  // 16 hazard hatch (tileable)
  cell(16, () => { x.fillStyle = 'rgba(17,17,17,0.85)'; x.fillRect(0, 0, C, C); x.fillStyle = 'rgba(200,162,50,0.85)'; for (let k = -C; k < C * 2; k += 51.2) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 25.6, 0); x.lineTo(k + 25.6 - C, C); x.lineTo(k - C, C); x.fill(); } x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 160; k++) { x.beginPath(); x.arc(R() * C, R() * C, 2 + R() * 7, 0, 6.3); x.fill(); } x.globalCompositeOperation = 'source-over'; });
  // 17 bay corner
  cell(17, () => { x.fillStyle = 'rgba(200,162,50,0.75)'; x.fillRect(8, 8, 31, 240); x.fillRect(8, 8, 240, 31); });
  // 18 bay codes
  cell(18, () => { x.font = '900 34px Inter, Arial'; x.fillStyle = 'rgba(216,212,200,0.8)'; x.textAlign = 'center'; [['A-07', 64, 116], ['B-14', 192, 116], ['C-03', 64, 172], ['D-11', 192, 172]].forEach(([t, a, b]) => x.fillText(t, a, b)); });
  // 19 tree-pit grate
  cell(19, () => { const c = C / 2; x.fillStyle = '#17120d'; x.fillRect(4, 4, 248, 248); x.strokeStyle = '#2e3034'; x.lineWidth = 8; x.beginPath(); x.arc(c, c, 110, 0, 6.3); x.stroke(); x.lineWidth = 4; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; x.beginPath(); x.moveTo(c + Math.cos(a) * 26, c + Math.sin(a) * 26); x.lineTo(c + Math.cos(a) * 106, c + Math.sin(a) * 106); x.stroke(); } x.fillStyle = '#0a0806'; x.beginPath(); x.arc(c, c, 18, 0, 6.3); x.fill(); });
  // 20 floor drain
  cell(20, () => { x.fillStyle = '#3a3c40'; x.fillRect(20, 20, 216, 216); for (let k = 0; k < 7; k++) { x.fillStyle = '#060607'; x.fillRect(40 + k * 26, 40, 14, 176); } });
  // 21 slab crack
  cell(21, () => { const [w, h, ox, oy] = box(21); x.strokeStyle = 'rgba(12,12,12,0.7)'; x.lineWidth = 2; let px = ox, py = C / 2; x.beginPath(); x.moveTo(px, py); while (px < ox + w) { px += 6 + R() * 8; py = C / 2 + (R() - 0.5) * h * 0.8; x.lineTo(px, py); if (R() < 0.15) { x.moveTo(px, py); x.lineTo(px + 10, py + (R() - 0.5) * 20); x.moveTo(px, py); } } x.stroke(); });
  // 22 pallet ghost
  cell(22, () => { const [w, h, ox, oy] = box(22); x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(ox, oy, w, h); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 5; k++) x.fillRect(ox, oy + k * h / 5 + 4, w, 6); });
  // 23 tread tracks
  cell(23, () => { const [w, h, ox, oy] = box(23); x.fillStyle = 'rgba(5,5,5,0.4)'; for (const b of [0.1, 0.62]) for (let k = 0; k < w; k += 10) { x.beginPath(); x.moveTo(ox + k, oy + h * b); x.lineTo(ox + k + 6, oy + h * (b + 0.14)); x.lineTo(ox + k, oy + h * (b + 0.28)); x.lineTo(ox + k + 3, oy + h * (b + 0.14)); x.fill(); } });
  // 24 Census stencil
  cell(24, () => { const [w, h, ox, oy] = box(24); x.fillStyle = 'rgba(232,130,30,0.75)'; for (let k = 0; k < 13; k++) x.fillRect(ox + 4 + k * 4, oy + h * 0.2, k % 3 ? 2 : 3, h * 0.6); drawLedger(x, 'COUNTED ZONE 4', ox + 64, oy + h * 0.3, h * 0.38, 'rgba(232,130,30,0.75)', { ghost: 0 });
    x.globalCompositeOperation = 'destination-out'; for (let k = ox; k < ox + w; k += 30) x.fillRect(k, 0, 3, C); for (let k = 0; k < 90; k++) { x.beginPath(); x.arc(R() * C, R() * C, 1 + R() * 4, 0, 6.3); x.fill(); } x.globalCompositeOperation = 'source-over'; });
  // 25 count-me sticker
  cell(25, () => { x.strokeStyle = '#e8821e'; x.lineWidth = 10; x.strokeRect(20, 20, 216, 216); x.fillStyle = '#e8821e'; x.font = '800 22px Inter, Arial'; x.textAlign = 'center'; ['STAND HERE', 'TO BE', 'COUNTED'].forEach((t, k) => x.fillText(t, C / 2, 80 + k * 28)); drawTally(x, '1', 104, 168, 40, '#e8821e'); });
  // 26 ice & scales
  cell(26, () => { const [w, h, ox, oy] = box(26); specks(150, '#e8f2ff', ox, oy, w, h, 2); for (let k = 0; k < 40; k++) { x.fillStyle = k % 2 ? '#c8d8e0' : '#b8c8d8'; x.beginPath(); x.ellipse(ox + R() * w, oy + R() * h, 3, 2, R() * 3, 0, 6.3); x.fill(); } });
  // 27 frost creep
  cell(27, () => { const [w, h, ox, oy] = box(27); const g = x.createLinearGradient(0, oy + h, 0, oy); g.addColorStop(0, 'rgba(232,242,255,0.35)'); g.addColorStop(1, 'rgba(232,242,255,0)'); x.fillStyle = g; x.fillRect(ox, oy, w, h); x.strokeStyle = 'rgba(232,242,255,0.3)'; x.lineWidth = 1; for (let k = 0; k < 30; k++) { let px = ox + R() * w, py = oy + h; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (R() - 0.5) * 12; py -= 4 + R() * 8; x.lineTo(px, py); } x.stroke(); } });
  // 28 fish-water sheen
  cell(28, () => { const [w, h, ox, oy] = box(28); x.fillStyle = 'rgba(10,12,14,0.4)'; x.beginPath(); x.ellipse(C / 2, C / 2, w / 2, h / 2, 0, 0, 6.3); x.fill(); });
  // 29 ballast oil
  cell(29, () => { const [w, h, ox, oy] = box(29); for (let k = 0; k < 8; k++) blot(ox + w * (0.1 + k * 0.11), C / 2 + (R() - 0.5) * h * 0.4, h * 0.4, 'rgba(6,6,6,A)', 0.5); });
  // 30 rope coil
  cell(30, () => { const c = C / 2; x.lineWidth = 10; for (let k = 0; k < 7; k++) { x.strokeStyle = k % 2 ? '#8a7a5a' : '#5a4e3a'; x.beginPath(); x.arc(c, c, 20 + k * 14, 0, 6.3); x.stroke(); } });
  // 31 square service cover
  cell(31, () => { x.fillStyle = '#3a3c40'; x.fillRect(10, 10, 236, 236); x.fillStyle = '#2a2c30'; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if ((i + j) % 2) x.fillRect(20 + i * 18, 20 + j * 18, 12, 4); x.fillStyle = '#5a5c60'; x.font = '800 30px Inter, Arial'; x.textAlign = 'center'; x.fillText('ELEC', C / 2, C / 2 + 10); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// zones: the ZONES list (rects); landmarks: { stacks: [[x,z]...] } extra anchors
export function makeDecals(scene, zones, extra = {}) {
  let s = 922; const R = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const list = [];   // [cell, x, z, yaw, scale]
  const add = (cell, x, z, yaw = R() * 6.283, sc = 0.85 + R() * 0.3) => list.push([cell, x, z, yaw, sc]);
  // ---- Harrow by hand (Appendix B2)
  for (const [x, z] of [[2, 20], [-2, 8.5], [2, -6], [-2, -19], [-5, 1]]) add(D.manhole, x, z);
  for (const [x, z] of extra.stacks || []) add(D.manhole, x + 1.2, z + 0.6);
  for (const [x, , z] of extra.trees || []) add(D.treepit, x, z, 0, 1);
  for (const sx of [-8.2, 8.2]) for (const z of [21, 9, -3, -15, -24]) add(D.drain, sx, z, Math.PI / 2, 1);
  for (const [x, z] of [[-3, 14], [4, 3], [-4, -10], [3, -21]]) add(D.tar, x, z);
  add(D.patch, 5.5, 16, 0, 1); add(D.patch, -6.5, -14, Math.PI / 2, 1.2); add(D.patch, 1, -12.8, 0, 1.1);
  for (const sx of [-7, 7]) for (const z of [18, 4, -8, -20]) add(D.oil, sx, z);
  add(D.oil, -6.6, 6); add(D.oil, 6.6, -12);
  add(D.skid, -2.5, -2, 0.08 + Math.PI / 2, 1); add(D.skid, 3, 12, -0.05 + Math.PI / 2, 1);
  add(D.locate, 6.9, 17.2, 0.3); add(D.locate, -5.2, -12.6, -0.2);
  add(D.stencil, -2.2, -10.8, 0.15, 1); add(D.stencil, 3.6, 1.2, 0, 1); add(D.stencil, 0, -24.5, 0, 1);
  add(D.slow, 4, 13.5, 0, 1); add(D.slow, -4, -18, Math.PI, 1);
  for (let k = 0; k < 16; k++) { const side = k % 2 ? 1 : -1, z = 22 - k * 3.0; add([D.litter, D.leaves, D.cardboard, D.glass][k % 4], side * (8.6 + R() * 1.6), z); }
  // ---- the other zones by rule: [cell, count, where] where = 'any' | 'edge' (within 1 m of a long edge) | 'mid' (near the long centreline)
  const RULES = {
    1: [[D.sticker, 12, 'any'], [D.drain, 6, 'edge'], [D.treepit, 4, 'edge'], [D.leaves, 4, 'edge'], [D.litter, 4, 'edge']],
    2: [[D.weeds, 6, 'any'], [D.litter, 3, 'edge'], [D.leaves, 3, 'edge'], [D.oil, 6, 'any'], [D.glass, 4, 'edge'], [D.moss, 4, 'edge'], [D.tar, 2, 'any']],
    3: [[D.ice, 10, 'edge'], [D.cardboard, 8, 'edge'], [D.fishwater, 6, 'mid'], [D.floordrain, 4, 'mid'], [D.litter, 6, 'edge'], [D.leaves, 3, 'edge'], [D.glass, 3, 'edge']],
    4: [[D.floordrain, 3, 'any'], [D.frost, 12, 'edge'], [D.pallet, 4, 'any'], [D.hazard, 2, 'any'], [D.tread, 3, 'any']],
    5: [[D.litter, 8, 'edge'], [D.cardboard, 6, 'edge'], [D.oil, 6, 'edge'], [D.leaves, 4, 'edge'], [D.weeds, 3, 'edge'], [D.glass, 3, 'edge']],
    6: [[D.ballast, 9, 'any'], [D.weeds, 6, 'edge'], [D.tar, 4, 'any'], [D.hazard, 3, 'any'], [D.litter, 4, 'edge'], [D.chalk, 4, 'edge']],
    7: [[D.rust, 12, 'any'], [D.tread, 8, 'any'], [D.oil, 6, 'any'], [D.litter, 6, 'edge'], [D.crack, 8, 'any']],
    8: [[D.rope, 6, 'edge'], [D.rust, 10, 'edge'], [D.oil, 8, 'any'], [D.tread, 6, 'any'], [D.moss, 4, 'edge'], [D.litter, 6, 'edge']],
    9: [[D.rope, 6, 'edge'], [D.litter, 6, 'any'], [D.rust, 4, 'edge'], [D.glass, 4, 'any'], [D.chalk, 4, 'edge']],
  };
  for (const zi in RULES) {
    const Z = zones[zi]; if (!Z) continue;
    const rects = Z.rects.map(r => ({ x0: r[0], x1: r[1], z0: r[2], z1: r[3], a: (r[1] - r[0]) * (r[3] - r[2]) }));
    const tot = rects.reduce((q, r) => q + r.a, 0);
    const pick = () => { let t = R() * tot; for (const r of rects) { if ((t -= r.a) <= 0) return r; } return rects[0]; };
    for (const [cell, n, where] of RULES[zi]) for (let k = 0; k < n; k++) {
      const r = pick(), alongX = (r.x1 - r.x0) >= (r.z1 - r.z0), m = 0.6;
      let x = r.x0 + m + R() * (r.x1 - r.x0 - 2 * m), z = r.z0 + m + R() * (r.z1 - r.z0 - 2 * m);
      if (where === 'edge') { const e = R() < 0.5 ? 0 : 1, off = m + R() * 0.9; if (alongX) z = e ? r.z1 - off : r.z0 + off; else x = e ? r.x1 - off : r.x0 + off; }
      else if (where === 'mid') { if (alongX) z = (r.z0 + r.z1) / 2 + (R() - 0.5) * 0.8; else x = (r.x0 + r.x1) / 2 + (R() - 0.5) * 0.8; }
      add(cell, x, z);
    }
  }
  // ---- one instanced draw
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const n = list.length, aCell = new Float32Array(n * 4);
  const mat = new THREE.MeshStandardMaterial({ map: atlas(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.4, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec4 aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = uv * aCell.zw + aCell.xy;');
  };
  mat.customProgramCacheKey = () => 'decalAtlas';
  const IM = new THREE.InstancedMesh(geo, mat, n);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  list.forEach(([cell, x, z, yaw, sc], i) => {
    const [w, d] = DECAL_SIZE[cell], k = Math.min(C / w, C / d) * 0.96 / C;   // the painted box inside the cell, in cell units
    M.compose(P.set(x, 0.008 + (i % 7) * 0.0004, z), Q.setFromAxisAngle(UP, yaw), S.set(w * sc, 1, d * sc)); IM.setMatrixAt(i, M);
    const du = w * k / COLS, dv = d * k / ROWS, u0 = (cell % COLS) / COLS + (1 / COLS - du) / 2, v0 = 1 - (Math.floor(cell / COLS) + 1) / ROWS + (1 / ROWS - dv) / 2;
    aCell.set([u0, v0, du, dv], i * 4);
  });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 4));
  IM.receiveShadow = true; IM.renderOrder = 1; IM.frustumCulled = false; scene.add(IM);
  return IM;
}
