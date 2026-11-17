// The wired city: the art panel's cyberpunk layer (docs/art/cyberpunk_addendum.md).
//  Bones: the old brick city. Nerves: retrofit hardware (LED kerbs, cable canopies, drones, spinners).
//  Skin: the Consensus, the AR every chip renders. It exists by agreement, so it is real: it lights the street.
//  Ownership colours: city cyan/pink, Census amber, Null violet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ZONES } from './level.js';
import { G } from './state.js';

const CYAN = new THREE.Color(0x19d3e6), PINK = new THREE.Color(0xff2e7a), AMBER = new THREE.Color(0xff9a1f), CIVIC = new THREE.Color(0xbff6ff), VIOLET = new THREE.Color(0x9b7bff);
const CENSUS_ZONES = new Set([1, 6]);          // checkpoint plaza, rail yard: Census ground
const PINK_ZONES = new Set([3]);               // the market
let s0 = 777; const R = () => { s0 = (s0 * 16807) % 2147483647; return (s0 - 1) / 2147483646; };

// ------------------------------------------------------------------ the Consensus atlas (R mask tinted colA, G mask tinted colB)
const PLATES = [
  'HARROW ST · BLK 14 · COUNT 2,114', 'CHECKPOINT PLAZA · BLK 9 · COUNT 3,806', 'TRAM CUT · LINE 3 · BLK 11', 'PIER 9 MARKET · STALLS 1-40',
  'COLD STORAGE 4 · NO RECORD', 'GUT LANE · BLK 22 · COUNT 611', 'RAIL YARD · SIDING 2 · CENSUS GROUND', 'CONTAINER YARD · BAY C',
  'PIER 9 · QUAY 3', 'FERRY PIER · HALDEN LINE · SUSPENDED',
];
function buildAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 1024);
  x.globalCompositeOperation = 'lighter';
  const A = 'rgb(255,0,0)', B = 'rgb(0,255,0)';
  const font = (px) => `${px}px "Bebas Neue", Impact, sans-serif`;
  // block plates: 2 columns x 5 rows of 512 x 96
  PLATES.forEach((t, i) => {
    const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 96;
    x.strokeStyle = B; x.lineWidth = 3; x.strokeRect(ox + 8, oy + 10, 496, 76);
    x.fillStyle = B; x.fillRect(ox + 8, oy + 10, 26, 76);
    for (let k = 0; k < 4; k++) x.fillRect(ox + 470 - k * 9, oy + 70, 4, 10);              // tally ticks
    x.fillStyle = A; x.font = font(40); x.textBaseline = 'middle';
    let fs = 40; while (x.measureText(t).width > 440 && fs > 18) { fs -= 2; x.font = font(fs); }
    x.fillText(t, ox + 46, oy + 50);
  });
  // ads / PSAs: 4 x 2 cells of 256 at y 512
  const cell = (i, draw) => { const ox = (i % 4) * 256, oy = 512 + Math.floor(i / 4) * 256; x.save(); x.translate(ox, oy); draw(); x.restore(); };
  const frame = () => { x.strokeStyle = B; x.lineWidth = 4; x.strokeRect(10, 10, 236, 236); x.fillStyle = B; for (const [a, b] of [[10, 10], [228, 10], [10, 228], [228, 228]]) x.fillRect(a, b, 18, 18); };
  const lines = (arr, y0, px) => { x.fillStyle = A; x.textAlign = 'center'; x.textBaseline = 'middle'; arr.forEach((t, k) => { x.font = font(px[k]); x.fillText(t, 128, y0 + k * (px[k] + 6)); }); x.textAlign = 'left'; };
  cell(0, () => { frame(); x.strokeStyle = A; x.lineWidth = 6; x.beginPath(); x.arc(128, 100, 46, 0, Math.PI); x.stroke(); x.beginPath(); x.moveTo(70, 100); x.lineTo(186, 100); x.stroke(); for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(108 + k * 20, 40); x.bezierCurveTo(98 + k * 20, 60, 118 + k * 20, 70, 108 + k * 20, 88); x.stroke(); } lines(['NOODLE', 'NOW'], 170, [44, 34]); });
  cell(1, () => { frame(); for (let k = 0; k < 3; k++) { x.strokeStyle = A; x.lineWidth = 4; x.strokeRect(46 + k * 56, 50, 48, 70); } lines(['SLEEP PODS', '9 / HOUR'], 160, [38, 30]); });
  cell(2, () => { frame(); x.strokeStyle = A; x.lineWidth = 5; x.beginPath(); x.arc(128, 90, 42, 0, 6.3); x.stroke(); x.beginPath(); x.arc(128, 90, 20, 0, 6.3); x.stroke(); lines(['HALDEN', 'BE BETTER'], 168, [40, 28]); });
  cell(3, () => { frame(); x.fillStyle = A; x.beginPath(); x.moveTo(110, 40); x.lineTo(146, 40); x.lineTo(150, 130); x.lineTo(106, 130); x.closePath(); x.fill(); lines(['FIZZ', 'TASTE THE NOISE'], 170, [52, 24]); });
  cell(4, () => { frame(); x.fillStyle = A; for (let k = 0; k < 4; k++) x.fillRect(70 + k * 26, 44, 10, 70); x.save(); x.translate(128, 80); x.rotate(-0.5); x.fillRect(-70, -5, 140, 10); x.restore(); lines(['BE COUNTED'], 170, [44]); });
  cell(5, () => { frame(); lines(['99.97%', 'FINAL COUNT', 'IS COMING'], 80, [64, 30, 30]); });
  cell(6, () => { frame(); lines(['REPORT THE', 'UNCOUNTED', 'IT IS KIND'], 82, [38, 38, 26]); });
  cell(7, () => { x.strokeStyle = A; x.lineWidth = 3; for (let k = 0; k <= 256; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); } x.fillStyle = B; x.font = font(22); x.fillText('QUEUE · STAND ON A SQUARE', 22, 140); });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const plateRect = (i) => new THREE.Vector4((i % 2) * 0.5, 1 - (Math.floor(i / 2) * 96 + 96) / 1024, 0.5, 96 / 1024);
const adRect = (i) => new THREE.Vector4((i % 4) * 0.25, 1 - (512 + Math.floor(i / 4) * 256 + 256) / 1024, 0.25, 0.25);


// ------------------------------------------------------------------ TAG atlas: 8 x 8 slots of 128 x 32, white on clear (tinted per instance)
const TAG = { census: { counter: 0, marksman: 1, lobber: 2, warden: 3, clerk: 4, auditor: 5, lamplighter: 6, informant: 11 }, null: 8, nullName: 9, out: 10, civ: 12, halden: 19, locked: 20, obj: 21 };
const PROP_SLOT = { trash: 21, trashR: 21, barrel: 22, drum: 22, crate: 23, box: 23, barrier: 24, car: 25, utility: 25, bag: 26, fire: 26, container: 27, chunk: 28, wallslab: 28, riotshield: 24, cagedoor: 24 };
function buildTagAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
  const slot = (i, draw) => { x.save(); x.translate((i % 8) * 128, Math.floor(i / 8) * 32); x.beginPath(); x.rect(0, 0, 128, 32); x.clip(); draw(); x.restore(); };
  const mono = (px) => `bold ${px}px "Courier New", Courier, monospace`;
  const id = () => `CS-${String(100 + Math.floor(R() * 899)).padStart(4, '0')}·${1000 + Math.floor(R() * 8999)}`;
  x.fillStyle = '#fff'; x.strokeStyle = '#fff';
  const glyph = (kind) => {           // the type glyph matches the ground ring's shape language
    x.lineWidth = 3; x.beginPath();
    if (kind === 'solid') { x.arc(15, 16, 9, 0, 6.3); x.fill(); }
    else if (kind === 'chevron') { x.moveTo(5, 9); x.lineTo(15, 21); x.lineTo(25, 9); x.stroke(); }
    else if (kind === 'dash') { for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(15, 16, 9, k * 1.05, k * 1.05 + 0.6); x.stroke(); } }
    else if (kind === 'double') { x.arc(15, 16, 10, 0, 6.3); x.stroke(); x.beginPath(); x.arc(15, 16, 5, 0, 6.3); x.stroke(); }
    else if (kind === 'diamond') { x.moveTo(15, 5); x.lineTo(26, 16); x.lineTo(15, 27); x.lineTo(4, 16); x.closePath(); x.fill(); }
    else if (kind === 'dial') { x.arc(15, 16, 10, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(15, 16); x.lineTo(22, 9); x.stroke(); }
    else if (kind === 'dots') { for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(15 + 9 * Math.cos(k * 1.256), 16 + 9 * Math.sin(k * 1.256), 2.2, 0, 6.3); x.fill(); } }
  };
  const census = (i, kind, label) => slot(i, () => { glyph(kind); x.font = mono(11); x.textBaseline = 'top'; x.fillText(label, 32, 1); x.font = mono(9); x.globalAlpha = 0.7; x.fillText(id(), 32, 12); x.globalAlpha = 1; });
  census(0, 'solid', 'COUNTER'); census(1, 'chevron', 'MARKSMAN'); census(2, 'dash', 'LOBBER'); census(3, 'double', 'WARDEN');
  census(4, 'diamond', 'CLERK'); census(5, 'dial', 'AUDITOR'); census(6, 'solid', 'LAMPLIGHTER');
  slot(8, () => { x.lineWidth = 3; for (const [a, b, sx, sy] of [[2, 2, 1, 1], [126, 2, -1, 1], [2, 30, 1, -1], [126, 30, -1, -1]]) { x.beginPath(); x.moveTo(a + sx * 14, b); x.lineTo(a, b); x.lineTo(a, b + sy * 9); x.stroke(); } });
  slot(9, () => { x.lineWidth = 3; for (const [a, b, sx, sy] of [[2, 2, 1, 1], [126, 2, -1, 1], [2, 30, 1, -1], [126, 30, -1, -1]]) { x.beginPath(); x.moveTo(a + sx * 14, b); x.lineTo(a, b); x.lineTo(a, b + sy * 9); x.stroke(); }
    // NULL in blocky pixels, with dropped cells
    const P5 = { N: ['10001', '11001', '10101', '10011', '10001'], U: ['10001', '10001', '10001', '10001', '01110'], L: ['10000', '10000', '10000', '10000', '11111'] };
    [...'NULL'].forEach((ch, k) => P5[ch].forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '1' && R() > 0.12) x.fillRect(30 + k * 18 + rx * 3, 8 + ry * 3, 3, 3); }))); });
  slot(10, () => { x.font = mono(14); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText('COUNTED OUT', 64, 16); x.fillRect(8, 26, 112, 2); });
  slot(11, () => { glyph('dots'); x.font = mono(10); x.textBaseline = 'top'; x.fillText('WITNESS ·', 32, 2); x.fillText('REPORTING', 32, 13); });
  for (let k = 0; k < 7; k++) slot(12 + k, () => { x.font = mono(10); x.textBaseline = 'middle'; x.globalAlpha = 0.9; x.fillText(`ID ${id().slice(3)}`, 8, 16); x.fillRect(8, 25, 30 + R() * 50, 1); });
  slot(19, () => { x.font = mono(10); x.textBaseline = 'top'; x.fillText('HALDEN · UNLISTED', 6, 4); x.globalAlpha = 0.6; x.fillText('NO CENSUS RECORD', 6, 17); });
  slot(20, () => { x.lineWidth = 2; x.strokeRect(2, 2, 124, 28); x.font = mono(11); x.textBaseline = 'top'; x.fillText('LOCKED · ORD 7781', 8, 5); });
  const objs = ['BIN', 'DRUM', 'CRATE', 'BARRIER', 'VEHICLE', 'BAG', 'CONTAINER', 'DEBRIS'];
  objs.forEach((o, k) => slot(21 + k, () => { x.font = mono(11); x.textBaseline = 'middle'; x.fillText(`OBJ ${44 + k}-${110 + k * 7} · ${o}`, 6, 16); }));
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t;
}
const tagRect = (i) => [(i % 8) / 8, 1 - (Math.floor(i / 8) + 1) / 8, 1 / 8, 1 / 8];

const TAG_VS = `
attribute vec3 aPos; attribute vec2 aSize; attribute vec4 aCell; attribute vec4 aCol; attribute vec2 aHp;
varying vec2 vUv; varying vec2 vQ; varying vec4 vCol; varying vec2 vHp;
void main(){
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 w = aPos + right * position.x * aSize.x + up * position.y * aSize.y;
  vQ = uv; vUv = aCell.xy + uv * aCell.zw; vCol = aCol; vHp = aHp;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const TAG_FS = `
uniform sampler2D tTag; uniform float uTime;
varying vec2 vUv; varying vec2 vQ; varying vec4 vCol; varying vec2 vHp;
void main(){
  // vHp.x: health 0..1 (<0: no bar); vHp.y: scan-wipe reveal 0..1 from the top
  if (1.0 - vQ.y > vHp.y) discard;
  float a = texture2D(tTag, vUv).a;
  float wipe = smoothstep(0.12, 0.0, abs((1.0 - vQ.y) - vHp.y)) * step(vHp.y, 0.99);
  if (vHp.x >= 0.0 && vQ.x > 0.25 && vQ.y < 0.3) {          // ten-segment health bar under the ID line
    float u = (vQ.x - 0.25) / 0.73; float seg = floor(u * 10.0);
    float gapm = step(0.14, fract(u * 10.0)) * step(u, 1.0);
    a = max(a, gapm * (seg < ceil(vHp.x * 10.0 - 0.001) ? 1.0 : 0.22));
  }
  float scan = 0.8 + 0.2 * step(0.5, fract(gl_FragCoord.y / 3.0));
  gl_FragColor = vec4(vCol.rgb * (a * scan + wipe * 1.5), 1.0) * vCol.a;
}`;

// one shader for every piece of AR: two-tone mask, screen scanlines, flicker, violet interference near Null
const HOLO_VS = `
attribute vec4 aCell; attribute vec3 aColA; attribute vec3 aColB; attribute float aPhase;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vPh; varying vec3 vW;
void main(){ vUv = aCell.xy + uv * aCell.zw; vA = aColA; vB = aColB; vPh = aPhase;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const HOLO_FS = `
uniform sampler2D tAtlas; uniform float uTime; uniform vec3 uHero; uniform float uGain;
varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vPh; varying vec3 vW;
float hs(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  vec4 m = texture2D(tAtlas, vUv);
  vec3 col = m.r * vA + m.g * vB;
  float scan = 0.72 + 0.28 * step(0.5, fract(gl_FragCoord.y / 3.0));
  float fl = 0.92 + 0.08 * hs(floor(uTime * 12.0) + vPh * 17.0);
  float glitch = step(0.985, hs(floor(uTime * 8.0) + vPh * 31.0));
  float near = 1.0 - smoothstep(1.5, 3.2, distance(vW.xz, uHero.xz));
  col = mix(col, vec3(0.61, 0.48, 1.0) * max(m.r, m.g) * 1.3, near * 0.5 * (0.5 + 0.5 * sin(uTime * 9.0 + vW.x * 3.0)));
  col *= scan * fl * uGain * (1.0 - glitch * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;


// fold a group's static child meshes into one mesh per material (draw calls matter on a phone)
function mergeByMaterial(g, keep = []) {
  const by = new Map();
  for (const c of [...g.children]) {
    if (!c.isMesh || keep.includes(c)) continue;
    c.updateMatrix(); const geo = c.geometry.clone().applyMatrix4(c.matrix);
    if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(geo); g.remove(c);
  }
  for (const [mat, geos] of by) g.add(new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], mat));
  return g;
}

export function makeCyber(scene, level, wet, world) {
  const C = { mats: [], update: null, stats: {} };
  // walls (tall static boxes) — strips and cables only go where there's a facade to fix them to
  const walls = (world ? world.bodies : []).filter(b => b.mass === 0 && b.shapes[0] && b.shapes[0].halfExtents && b.shapes[0].halfExtents.y >= 1.2)
    .map(b => { const h = b.shapes[0].halfExtents; return [b.position.x - h.x, b.position.x + h.x, b.position.z - h.z, b.position.z + h.z]; });
  const wallAt = (x, z, pad = 0.45) => walls.find(w => x > w[0] - pad && x < w[1] + pad && z > w[2] - pad && z < w[3] + pad);
  const atlas = buildAtlas();
  const holoMat = (gain) => { const m = new THREE.ShaderMaterial({ uniforms: { tAtlas: { value: atlas }, uTime: { value: 0 }, uHero: { value: new THREE.Vector3() }, uGain: { value: gain } }, vertexShader: HOLO_VS, fragmentShader: HOLO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); C.mats.push(m); return m; };
  const holoIM = (n, gain, geo = new THREE.PlaneGeometry(1, 1)) => {
    geo = geo.clone();
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
    geo.setAttribute('aColA', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    const im = new THREE.InstancedMesh(geo, holoMat(gain), n); im.count = 0; im.frustumCulled = false; im.renderOrder = 5; scene.add(im); return im;
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const put = (im, pos, euler, sx, sy, cellV, a, b, ph) => {
    const i = im.count++; Q.setFromEuler(euler); M.compose(pos, Q, S.set(sx, sy, 1)); im.setMatrixAt(i, M);
    const g = im.geometry.attributes; g.aCell.setXYZW(i, cellV.x, cellV.y, cellV.z, cellV.w); g.aColA.setXYZ(i, a.r, a.g, a.b); g.aColB.setXYZ(i, b.r, b.g, b.b); g.aPhase.setX(i, ph ?? R());
  };
  const allRects = []; ZONES.forEach((Z, zi) => Z.rects.forEach(r => allRects.push({ zi, x0: r[0], x1: r[1], z0: r[2], z1: r[3], o: r[4] || {} })));
  const inAny = (x, z, pad = 0) => allRects.some(r => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad);
  const zoneCol = (zi) => CENSUS_ZONES.has(zi) ? AMBER : PINK_ZONES.has(zi) ? PINK : CYAN;

  // soft additive light pools: how the AR and the LEDs reach the ground without real lights
  const GLOW_N = 96, glowGeo = new THREE.CircleGeometry(1, 20); glowGeo.rotateX(-Math.PI / 2);
  glowGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(GLOW_N * 3), 3));
  const glowIM = new THREE.InstancedMesh(glowGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aCol; varying vec3 vC; varying vec2 vP; void main(){ vC = aCol; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(vC * pow(1.0 - r, 2.2), 1.0); }' }), GLOW_N);
  glowIM.count = 0; glowIM.frustumCulled = false; glowIM.renderOrder = 2; scene.add(glowIM); wet.hide.push(glowIM);
  const glow = (x, y, z, r, col, k) => { if (glowIM.count >= GLOW_N) return; const i = glowIM.count++; M.compose(P.set(x, y, z), Q.identity(), S.set(r, 1, r)); glowIM.setMatrixAt(i, M); glowIM.geometry.attributes.aCol.setXYZ(i, col.r * k, col.g * k, col.b * k); };

  // ---------------- 1. LED kerb and base strips: every playable edge, with data pulses running along them
  {
    const ledFS = `uniform float uTime; uniform vec3 uHero; varying vec3 vC; varying float vD; varying float vK; varying vec3 vW; varying vec2 vUv;
      void main(){
        float pulse = smoothstep(0.5, 0.0, abs(mod(vD - uTime * 6.0, 4.0) - 0.25));
        float near = 1.0 - smoothstep(1.2, 2.6, distance(vW.xz, uHero.xz));
        vec3 c = mix(vC, vec3(0.61, 0.48, 1.0), near * (0.5 + 0.5 * sin(uTime * 23.0 + vD * 5.0)));
        float a = vK < 0.5 ? (1.1 + 0.9 * pulse) : vUv.y * vUv.y * 0.18 * (1.0 + pulse);
        gl_FragColor = vec4(c * a, 1.0); }`;
    const ledVS = `attribute vec3 aC; attribute float aD; attribute float aK; varying vec3 vC; varying float vD; varying float vK; varying vec3 vW; varying vec2 vUv;
      void main(){ vC = aC; vD = aD; vK = aK; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
    const ledMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uHero: { value: new THREE.Vector3() } }, vertexShader: ledVS, fragmentShader: ledFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    C.mats.push(ledMat);
    const perZone = new Map();
    for (const r of allRects) {
      const col = zoneCol(r.zi);
      const edges = [[r.x0, r.z0, r.x1, r.z0, 0, 1], [r.x1, r.z0, r.x1, r.z1, -1, 0], [r.x1, r.z1, r.x0, r.z1, 0, -1], [r.x0, r.z1, r.x0, r.z0, 1, 0]];   // [a, b, inward normal]
      let dist = 0;
      for (const [ax, az, bx, bz, nx, nz] of edges) {
        const len = Math.hypot(bx - ax, bz - az), segs = Math.max(1, Math.round(len / 2));
        for (let k = 0; k < segs; k++) {
          const t0 = k / segs, t1 = (k + 1) / segs;
          const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
          const mx = (x0 + x1) / 2 - nx * 0.6, mz = (z0 + z1) / 2 - nz * 0.6;        // just outside this edge
          const open = (r.o.openN && nz === 1) || (r.o.openS && nz === -1) || (r.o.openW && nx === 1);   // water edges have invisible walls: no facade there
          const wb = !open && !inAny(mx, mz) && wallAt(mx, mz);
          if (!wb) { dist += len / segs; continue; }
          // snap onto the actual facade (the walk rect stops a little short of it)
          const face = nx === -1 ? wb[0] : nx === 1 ? wb[1] : nz === -1 ? wb[2] : wb[3];
          const edge = nx ? ax : az, fo = Math.abs(face - edge) < 1.5 ? (face - edge) * -(nx || nz) : 0;
          const ox = -nx * fo, oz = -nz * fo;
          const sl = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
          // an L of light on the facade's foot: a band up the wall face plus a ribbon on the ledge (readable from above), and a ground wash
          const strip = new THREE.PlaneGeometry(sl, 0.07); strip.rotateY(ang); strip.translate((x0 + x1) / 2 + ox + nx * 0.03, 0.1, (z0 + z1) / 2 + oz + nz * 0.03);
          const lip = new THREE.PlaneGeometry(sl, 0.09); lip.rotateX(-Math.PI / 2); lip.rotateY(ang); lip.translate((x0 + x1) / 2 + ox + nx * 0.075, 0.135, (z0 + z1) / 2 + oz + nz * 0.075);
          const wash = new THREE.PlaneGeometry(sl, 0.5); wash.rotateX(-Math.PI / 2); wash.rotateY(ang); wash.translate((x0 + x1) / 2 + ox + nx * 0.3, 0.013, (z0 + z1) / 2 + oz + nz * 0.3);
          for (const [g, kind] of [[strip, 0], [lip, 0], [wash, 1]]) {
            const n = g.attributes.position.count, aC = new Float32Array(n * 3), aD = new Float32Array(n), aK = new Float32Array(n).fill(kind);
            const pos = g.attributes.position;
            for (let v = 0; v < n; v++) { aC.set([col.r * 1.3, col.g * 1.3, col.b * 1.3], v * 3); const px = pos.getX(v), pz = pos.getZ(v); aD[v] = dist + Math.hypot(px - x0, pz - z0); }
            g.setAttribute('aC', new THREE.BufferAttribute(aC, 3)); g.setAttribute('aD', new THREE.BufferAttribute(aD, 1)); g.setAttribute('aK', new THREE.BufferAttribute(aK, 1));
            if (!perZone.has(r.zi)) perZone.set(r.zi, []); perZone.get(r.zi).push(g);
          }
          dist += sl;
        }
      }
    }
    for (const [, gs] of perZone) { const m = new THREE.Mesh(mergeGeometries(gs), ledMat); m.renderOrder = 2; scene.add(m); }
  }

  // ---------------- 2. Consensus floor projections: a block plate per zone (location only), floor ads, Census queue grids
  {
    const floor = holoIM(40, 0.34);
    ZONES.forEach((Z, zi) => {
      const r = Z.rects[Z.rects.length - 1], cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2, w = r[1] - r[0], d = r[3] - r[2];
      const census = CENSUS_ZONES.has(zi), a = census ? AMBER : CIVIC, b = census ? new THREE.Color(0xffd9a0) : zoneCol(zi);
      // the plate lies across the street, readable from the camera (south)
      const pw = Math.min(7, Math.max(w, d) * 0.5);
      put(floor, P.set(cx, 0.017, cz + d * 0.22), E.set(-Math.PI / 2, 0, 0), pw, pw / 5, plateRect(zi), a, b);
      if (w > 12 && d > 12) {
        if (census) put(floor, P.set(cx - w * 0.22, 0.017, cz - d * 0.18), E.set(-Math.PI / 2, 0, 0), 6, 6, adRect(7), AMBER, new THREE.Color(0xffd9a0));
        else put(floor, P.set(cx + w * 0.2, 0.017, cz - d * 0.2), E.set(-Math.PI / 2, 0, 0.0), 4, 4, adRect([0, 1, 3][zi % 3]), zoneCol(zi), zi % 2 ? CYAN : PINK);
      }
    });
    for (const k of ['aCell', 'aColA', 'aColB', 'aPhase']) floor.geometry.attributes[k].needsUpdate = true;
    wet.hide.push(floor);
  }

  // ---------------- 3. roof holo-billboards tilted at the sky (and so at our camera); one in four is a Census PSA
  {
    const bill = holoIM(64, 0.62);
    const postGeo = [];
    const panel = (rf, cx, cz, bw, bh) => {
      const y = rf.h + 1.2 + bh * 0.5 * Math.sin(20 * Math.PI / 180);
      const census = R() < 0.25, cell = census ? adRect(4 + Math.floor(R() * 3)) : adRect(Math.floor(R() * 4));
      const a = census ? AMBER : (R() < 0.5 ? CYAN : PINK), b = census ? new THREE.Color(0xffd9a0) : (a === CYAN ? PINK : CYAN);
      put(bill, P.set(cx, y, cz), E.set(-(70 * Math.PI / 180), 0, 0), bw, bh, cell, a, b);
      for (const sx of [-1, 1]) { const g = new THREE.BoxGeometry(0.15, 1.25, 0.15); g.translate(cx + sx * bw * 0.42, rf.h + 0.62, cz); postGeo.push(g); }
      glow(cx, rf.h + 0.04, cz + 0.6, 4, a, 0.12);
    };
    for (const rf of level.roofs || []) {
      const w = rf.x1 - rf.x0, d = rf.z1 - rf.z0; if (w * d < 30) continue;
      // a roof just south of a lane is what fills the bottom of the phone frame there: always give it a row of panels on its lane side
      const lane = allRects.find(r => Math.abs(r.z1 - rf.z0) < 1.5 && Math.min(r.x1, rf.x1) - Math.max(r.x0, rf.x0) > 4);
      if (lane && d > 4) {
        const x0 = Math.max(lane.x0, rf.x0) + 1, x1 = Math.min(lane.x1, rf.x1) - 1, n = Math.max(1, Math.round((x1 - x0) / 11));
        for (let k = 0; k < n; k++) { const bw = R() < 0.5 ? 4.2 : 3.0; panel(rf, x0 + (k + 0.5) / n * (x1 - x0) + (R() - 0.5) * 2, rf.z0 + 2.2 + R() * 0.8, bw, bw * 0.58); }
        continue;
      }
      if (R() > 0.7) continue;
      const big = w > 7 && d > 5, bw = big ? 6 : 3, bh = big ? 3.5 : 2;
      panel(rf, rf.x0 + w * (0.3 + R() * 0.4), rf.z0 + d * (0.3 + R() * 0.4), bw, bh);
    }
    for (const k of ['aCell', 'aColA', 'aColB', 'aPhase']) bill.geometry.attributes[k].needsUpdate = true;
    C.stats.bill = bill.count; C.stats.roofs = (level.roofs || []).length; C.bill = bill;
    if (postGeo.length) { const m = new THREE.Mesh(mergeGeometries(postGeo), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.6 })); scene.add(m); }
  }

  // ---------------- 5. overhead cable canopy across the lanes; one cable in three is fibre with light pulses running along it
  {
    const rubber = [], fibre = [];
    const span = (ax, az, bx, bz, y, sag, rad, fib, col) => {
      const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(ax + (bx - ax) * t, y - sag * (1 - (2 * t - 1) ** 2), az + (bz - az) * t)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rad, 5, false);
      const len = Math.hypot(bx - ax, bz - az);
      if (fib) { const n = g.attributes.position.count, aD = new Float32Array(n), aC = new Float32Array(n * 3); const uv = g.attributes.uv; for (let v = 0; v < n; v++) { aD[v] = uv.getX(v) * len + R() * 0.0; aC.set([col.r, col.g, col.b], v * 3); } g.setAttribute('aD', new THREE.BufferAttribute(aD, 1)); g.setAttribute('aC', new THREE.BufferAttribute(aC, 3)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); fibre.push(g); }
      else rubber.push(g);
    };
    for (const r of allRects) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0, col = zoneCol(r.zi);
      const narrowX = w <= d;                       // cables cross the short way
      const crossLen = narrowX ? w : d, along = narrowX ? d : w;
      if (crossLen > 26 || r.zi === 3 || r.zi >= 8) continue;   // market has its own canopy; docks/ferry are open water
      // spans skew across the lane (never neat rungs), sparser over wide streets so the canopy frames the play instead of barring it
      const gap = 7 + crossLen * 0.45;
      for (let s = 2 + R() * gap * 0.6; s < along - 2; s += gap * (0.7 + R() * 0.6)) {
        const n = 2 + Math.floor(R() * 3), base = 5.4 + R() * 1.2, skew = (R() - 0.5) * crossLen * 0.9;
        for (let k = 0; k < n; k++) {
          const off = (k - n / 2) * 0.18, y = base + (R() - 0.5) * 0.3, sag = 0.4 + R() * 0.6, fib = k === 1, rad = fib ? 0.02 : 0.026 + R() * 0.018;
          const s0 = Math.max(0.5, Math.min(along - 0.5, s + off)), s1 = Math.max(0.5, Math.min(along - 0.5, s + off + skew));
          // both ends must bite into a facade
          if (narrowX) { if (wallAt(r.x0 - 0.6, r.z0 + s0) && wallAt(r.x1 + 0.6, r.z0 + s1)) span(r.x0 - 0.4, r.z0 + s0, r.x1 + 0.4, r.z0 + s1, y, sag, rad, fib, col); }
          else if (wallAt(r.x0 + s0, r.z0 - 0.6) && wallAt(r.x0 + s1, r.z1 + 0.6)) span(r.x0 + s0, r.z0 - 0.4, r.x0 + s1, r.z1 + 0.4, y, sag, rad, fib, col);
        }
      }
    }
    if (rubber.length) scene.add(new THREE.Mesh(mergeGeometries(rubber), new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.38, metalness: 0.3 })));
    if (fibre.length) {
      const fm = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: 'attribute float aD; attribute vec3 aC; varying float vD; varying vec3 vC; void main(){ vD = aD; vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uTime; varying float vD; varying vec3 vC; void main(){ float p = smoothstep(0.35, 0.0, abs(mod(vD - uTime * 10.0, 9.0) - 0.2)); gl_FragColor = vec4(vC * (0.22 + 1.8 * p), 1.0); }' });
      C.mats.push(fm); scene.add(new THREE.Mesh(mergeGeometries(fibre), fm));
    }
  }


  // ---------------- 4. ID tags over people, and 10. prop records: one instanced call for every overlay
  const tags = (() => {
    const N = 48, geo = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1); geo.index = q.index; geo.setAttribute('position', q.attributes.position); geo.setAttribute('uv', q.attributes.uv);
    const at = { aPos: 3, aSize: 2, aCell: 4, aCol: 4, aHp: 2 }, A = {};
    for (const k in at) { A[k] = new THREE.InstancedBufferAttribute(new Float32Array(N * at[k]), at[k]); A[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, A[k]); }
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ uniforms: { tTag: { value: buildTagAtlas() }, uTime: { value: 0 } }, vertexShader: TAG_VS, fragmentShader: TAG_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    C.mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 30; scene.add(mesh);
    let n = 0;
    const add = (x, y, z, w, h, slot, col, alpha, hp = -1, reveal = 1) => {
      if (n >= N) return; const r = tagRect(slot);
      A.aPos.setXYZ(n, x, y, z); A.aSize.setXY(n, w, h); A.aCell.setXYZW(n, r[0], r[1], r[2], r[3]); A.aCol.setXYZW(n, col.r, col.g, col.b, alpha); A.aHp.setXY(n, hp, reveal); n++;
    };
    const state = new WeakMap();
    const CEN = new THREE.Color(0xff9a1f).multiplyScalar(1.6), CIV = new THREE.Color(0xbff6ff), WIT = new THREE.Color(0xf4f4f4).multiplyScalar(1.2), NUL = new THREE.Color(0xb39bff).multiplyScalar(1.3), AUD = new THREE.Color(0xff3a2a).multiplyScalar(1.6);
    const update = (dt) => {
      n = 0; const t = G.rt || 0;
      for (const e of G.enemies || []) {
        let st = state.get(e); if (!st) { st = { rev: 0, out: 0 }; state.set(e, st); }
        if (e.state === 'spawn') { st.rev = 0; continue; }
        const b = e.body.position, sc = e.def.scale || 1, boss = e.def.boss || e.type === 'auditor';
        const y = e.def.drone ? b.y + (boss ? 2.2 : 0.75) : b.y + 1.35 * sc;
        if (e.dead || !e.alive) {                                       // "counted out", then gone with the body
          if (st.out > 0.8) continue; st.out += dt;
          add(b.x, y, b.z, 1.5, 0.375, TAG.out, CEN, Math.max(0, 1 - Math.max(0, st.out - 0.4) / 0.4)); continue;
        }
        st.rev = Math.min(1, st.rev + dt / 0.25);
        const bob = Math.sin(t * 2.2 + b.x) * 0.03, hit = e.hpShow > 0 ? 1.25 : 1;
        if (e.type === 'informant') { add(b.x, y + bob, b.z, 1.5, 0.375, TAG.census.informant, WIT, 0.9, e.hp / e.maxHp, st.rev); continue; }
        const w = boss ? 3.2 : 1.5;
        add(b.x, y + bob, b.z, w, w / 4, TAG.census[e.type] ?? 0, e.type === 'auditor' ? AUD : CEN, 0.85 * hit, Math.max(0, e.hp / e.maxHp), st.rev);
      }
      for (const v of G.civs || []) {                                  // Moth's uncounted carry no Census record: a Halden tag instead
        if (v.fade <= 0.01) continue; const p = v.root.position;
        add(p.x, p.y + (v.state === 'caged' ? 1.5 : 2.2), p.z, 1.3, 0.325, TAG.halden, CIV, 0.45 * v.fade);
      }
      const hero = G.hero;
      if (hero && hero.body) {                                         // Null: an empty record, brackets around nothing
        const p = hero.body.position, heat = hero.maxFocus ? 1 - hero.focus / hero.maxFocus : 0;
        const glitch = heat > 0.7 && Math.random() < 0.6, jit = Math.random() < 0.06 ? 0.02 : 0;
        add(p.x + jit, p.y + 1.2, p.z, 0.9, 0.225, glitch ? TAG.nullName : TAG.null, NUL, 0.8);
        // prop records: what she holds, and the nearest liftable thing within 6 m
        let near = null, nd = 6;
        for (const o of G.props || []) {
          if (!o.alive && o.alive !== undefined) continue;
          const op = o.body.position;
          if (o.lockT > 0) { add(op.x, op.y + (o.size ? o.size.y * 0.5 : 0.5) + 0.45, op.z, 1.3, 0.325, TAG.locked, CEN, 0.85, Math.min(1, o.lockT / 9)); continue; }
          const d = Math.hypot(op.x - p.x, op.z - p.z);
          if (o.held) add(op.x, op.y + (o.size ? o.size.y * 0.5 : 0.5) + 0.4, op.z, 1.2, 0.3, PROP_SLOT[o.type] ?? TAG.obj, NUL, 0.9);
          else if (d < nd) { nd = d; near = o; }
        }
        if (near && !(G.holds && G.holds.size)) {
          let st = state.get(near); if (!st) { st = { rev: 0 }; state.set(near, st); }
          st.rev = Math.min(1, st.rev + dt / 0.2);
          const op = near.body.position; add(op.x, op.y + (near.size ? near.size.y * 0.5 : 0.5) + 0.4, op.z, 1.2, 0.3, PROP_SLOT[near.type] ?? TAG.obj, NUL, 0.55, -1, st.rev);
        }
      }
      geo.instanceCount = n;
      for (const k in A) { A[k].needsUpdate = true; A[k].clearUpdateRanges(); A[k].addUpdateRange(0, n * A[k].itemSize); }
    };
    return { update, mesh };
  })();


  // ---------------- 8. write / agree-back: violet pixel borders when she edits, an amber re-render sweep when the city agrees it back
  const fx = (() => {
    const N = 360, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), N);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.renderOrder = 7; im.count = 0; scene.add(im);
    im.setColorAt(0, new THREE.Color()); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const cells = [], lines = [], later = [];
    const VIO = new THREE.Color(0x9b7bff).multiplyScalar(2.0), AMB = new THREE.Color(0xff9a1f).multiplyScalar(2.5), _c = new THREE.Color();
    // a frame of 0.25 m cells around a w x h rectangle standing at (x, y0..y0+h, z), facing yaw
    const border = (x, y0, z, w, h, yaw, col = VIO) => {
      const c = Math.cos(yaw), sn = Math.sin(yaw), cell = 0.25;
      const at = (u, v) => cells.push({ x: x + c * u, y: y0 + v, z: z - sn * u, t: -Math.random() * 0.12, life: 0.5 + Math.random() * 0.25, col, s: cell * (0.7 + Math.random() * 0.4) });
      for (let u = -w / 2; u <= w / 2 + 1e-3; u += cell) { if (Math.random() < 0.85) at(u, 0); if (Math.random() < 0.85) at(u, h); if (Math.random() < 0.35) at(u, cell * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : h)); }
      for (let v = cell; v < h; v += cell) { if (Math.random() < 0.85) at(-w / 2, v); if (Math.random() < 0.85) at(w / 2, v); }
    };
    // a line ring around a w x d footprint rising from y0 to y1 over 0.4 s: below it the record is whole again
    const sweep = (x, z, w, d, yaw, y0, y1, col = AMB) => { lines.push({ x, z, w, d, yaw, y0, y1, t: 0, col }); };
    const M2 = new THREE.Matrix4(), Q2 = new THREE.Quaternion(), S2 = new THREE.Vector3(), P2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const update = (dt) => {
      let n = 0;
      for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { later[i].fn(); later.splice(i, 1); } }
      for (let i = cells.length - 1; i >= 0; i--) {
        const c = cells[i]; c.t += dt; if (c.t > c.life) { cells.splice(i, 1); continue; } if (c.t < 0 || n >= N) continue;
        const k = 1 - c.t / c.life, blink = Math.random() < 0.12 ? 0.3 : 1;
        M2.compose(P2.set(c.x, c.y, c.z), Q2.identity(), S2.setScalar(c.s * (0.6 + 0.4 * k))); im.setMatrixAt(n, M2); im.setColorAt(n, _c.copy(c.col).multiplyScalar(k * blink)); n++;
      }
      for (let i = lines.length - 1; i >= 0; i--) {
        const L = lines[i]; L.t += dt; const k = L.t / 0.4; if (k > 1.15) { lines.splice(i, 1); continue; }
        const y = L.y0 + (L.y1 - L.y0) * Math.min(1, k), a = k > 1 ? 1 - (k - 1) / 0.15 : 1, c = Math.cos(L.yaw), sn = Math.sin(L.yaw);
        Q2.setFromAxisAngle(up, L.yaw);
        for (const [u, v, sx, sz] of [[0, L.d / 2, L.w + 0.06, 0.06], [0, -L.d / 2, L.w + 0.06, 0.06], [L.w / 2, 0, 0.06, L.d], [-L.w / 2, 0, 0.06, L.d]]) {
          if (n >= N) break;
          M2.compose(P2.set(L.x + c * u + sn * v, y, L.z - sn * u + c * v), Q2, S2.set(sx, 0.06, sz)); im.setMatrixAt(n, M2); im.setColorAt(n, _c.copy(L.col).multiplyScalar(a)); n++;
        }
        if (Math.random() < 0.7 && n < N) { const u = (Math.random() - 0.5) * L.w; cells.push({ x: L.x + c * u + sn * L.d / 2, y, z: L.z - sn * u + c * L.d / 2, t: 0, life: 0.3, col: L.col, s: 0.14 }); }
      }
      im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    };
    return { border, sweep, update, later: (t, fn) => later.push({ t, fn }) };
  })();
  C.writeBorder = fx.border; C.healSweep = fx.sweep; C.later = fx.later;

  // ---------------- 7. lapse: where agreement thins (Gut Lane, the waterfront) the street under-renders in 0.25 m cells
  {
    const spots = [];
    const pick = (zi, k) => { const r = ZONES[zi].rects[0]; for (let i = 0; i < k; i++) spots.push([r[0] + (r[1] - r[0]) * (0.2 + R() * 0.6), r[2] + (r[3] - r[2]) * (0.15 + R() * 0.7), 1.4 + R() * 1.2]); };
    pick(5, 3); pick(8, 2); pick(9, 2);
    const cellsAt = []; for (const [cx, cz, rad] of spots) for (let x = -rad; x <= rad; x += 0.25) for (let z = -rad; z <= rad; z += 0.25) { const d = Math.hypot(x, z) / rad; if (d < 1 && R() < 0.9) cellsAt.push([Math.round((cx + x) * 4) / 4 + 0.125, Math.round((cz + z) * 4) / 4 + 0.125, 1 - d]); }
    const n = cellsAt.length, g = new THREE.PlaneGeometry(0.25, 0.25); g.rotateX(-Math.PI / 2);
    const aS = new Float32Array(n * 2); cellsAt.forEach((c, i) => { aS[i * 2] = R() * 100; aS[i * 2 + 1] = c[2]; });
    g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 2));
    const vs = `attribute vec2 aS; uniform float uTime; varying float vMode; varying vec2 vUv;
      float hs(float n){ return fract(sin(n) * 43758.5453); }
      void main(){ float amt = 0.15 + 0.5 * aS.y; float h = hs(aS.x + floor(uTime * 4.0) * 1.37);
        vMode = h < amt * 0.6 ? 1.0 : (h < amt ? 2.0 : 0.0); vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
    const holes = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: vs, depthWrite: false, transparent: true,
      fragmentShader: 'varying float vMode; void main(){ if (vMode != 1.0) discard; gl_FragColor = vec4(0.012, 0.014, 0.02, 0.96); }' }), n);
    const rims = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: vs, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
      fragmentShader: 'varying float vMode; varying vec2 vUv; void main(){ if (vMode != 2.0) discard; vec2 e = min(vUv, 1.0 - vUv); float b = step(min(e.x, e.y), 0.12); gl_FragColor = vec4(vec3(1.0, 0.6, 0.12) * 1.5 * b, 1.0); }' }), n);
    cellsAt.forEach(([x, z], i) => { M.makeTranslation(x, 0.011, z); holes.setMatrixAt(i, M); M.makeTranslation(x, 0.012, z); rims.setMatrixAt(i, M); });
    for (const m of [holes, rims]) { m.frustumCulled = false; m.renderOrder = 3; scene.add(m); wet.hide.push(m); C.mats.push(m.material); }
    C.stats.lapse = n;
  }

  // ---------------- 9. the edge of the counted city: past the quays the sea is a still grid (it never ripples)
  {
    const rects = allRects.map(r => new THREE.Vector4(r.x0, r.x1, r.z0, r.z1));
    while (rects.length < 16) rects.push(new THREE.Vector4(1e5, 1e5, 1e5, 1e5));
    const mat = new THREE.ShaderMaterial({ uniforms: { uR: { value: rects.slice(0, 16) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec4 uR[16]; uniform float uTime; varying vec3 vW;
        float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float d = 1e5; for (int i = 0; i < 16; i++) { vec4 r = uR[i]; vec2 q = max(vec2(r.x - vW.x, vW.x - r.y), 0.0); vec2 q2 = max(vec2(r.z - vW.z, vW.z - r.w), 0.0); d = min(d, length(vec2(max(q.x, q.y), max(q2.x, q2.y)))); }
          float fade = smoothstep(6.0, 12.0, d);
          vec2 c = floor(vW.xz / 2.0), f = fract(vW.xz / 2.0);
          float drop = step(0.92, hs(c + floor(uTime / 2.0) * 7.0));
          float ln = max(step(f.x, 0.015), step(f.y, 0.015));
          gl_FragColor = vec4(vec3(0.75, 0.96, 1.0) * 0.1 * ln * fade * (1.0 - drop), 1.0);
        }` });
    C.mats.push(mat);
    for (const [cx, cz, w, d] of [[-50, -170, 260, 200], [0, 65, 160, 80]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(cx, -1.07, cz); m.renderOrder = 2; scene.add(m); wet.hide.push(m); }
  }

  // ---------------- 6. flying traffic under the camera: delivery drones (cyan/pink, never amber) and spinners
  const fliers = [];
  {
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.6 });
    const parcel = new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a0f14, metalness: 0.9, roughness: 0.1, envMapIntensity: 1.5 });
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0x6a7078, transparent: true, opacity: 0.12, depthWrite: false });
    const mkDrone = (col) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), dark); g.add(b);
      for (const [x, z] of [[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12), rotorMat); r.position.set(x, 0.07, z); g.add(r); }
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), parcel); p.position.y = -0.3; g.add(p);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2), toneMapped: false })); led.position.set(0, 0.08, 0.32); g.add(led);
      const led2 = led.clone(); led2.position.z = -0.32; g.add(led2);
      g.userData = { led: [led, led2], kind: 'drone' }; return mergeByMaterial(g, [led, led2]);
    };
    const mkSpinner = (census) => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 3.6), dark); g.add(hull);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.8), dark); nose.position.set(0, -0.05, 2.0); g.add(nose);
      const can = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.6), glass); can.position.set(0, 0.5, 0.3); g.add(can);
      const under = new THREE.MeshBasicMaterial({ color: (census ? AMBER : CYAN).clone().multiplyScalar(2.0), toneMapped: false });
      for (const [x, z] of [[0.95, 1.2], [-0.95, 1.2], [0.95, -1.2], [-0.95, -1.2]]) { const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12), dark); pod.position.set(x, -0.2, z); g.add(pod); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), under); gl.rotation.x = Math.PI / 2; gl.position.set(x, -0.36, z); g.add(gl); }
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.25, 0.2), toneMapped: false })); tail.position.set(0, 0.1, -1.82); g.add(tail);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.7), toneMapped: false })); head.position.set(0, 0.0, 2.42); g.add(head);
      // from above you see its roof: lit seams down both flanks, a roof marker, glints in the canopy
      const seam = new THREE.MeshBasicMaterial({ color: (census ? AMBER : CYAN).clone().multiplyScalar(1.5), toneMapped: false });
      for (const sx of [-0.79, 0.79]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), seam); st.position.set(sx, 0.36, 0); g.add(st); }
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.6), toneMapped: false })); mark.position.set(0, 0.76, -0.4); g.add(mark);
      // the light it throws on the street below, sweeping as it passes
      const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.ShaderMaterial({ uniforms: { uC: { value: (census ? AMBER : CYAN).clone().multiplyScalar(0.2) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy / 3.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uC; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(uC * pow(max(0.0, 1.0 - r), 2.0), 1.0); }' }));
      pool.rotation.x = -Math.PI / 2; scene.add(pool); wet.hide.push(pool);
      g.userData.mark = mark;
      g.userData = { ...g.userData, kind: 'spinner', pool }; return mergeByMaterial(g, [mark]);
    };
    for (let i = 0; i < 3; i++) { const d = mkDrone(i % 2 ? PINK : CYAN); d.visible = false; scene.add(d); fliers.push({ o: d, on: false, t: 0, v: new THREE.Vector3(), cd: R() * 3 }); }
    for (let i = 0; i < 2; i++) { const s = mkSpinner(false); s.visible = false; s.userData.pool.visible = false; scene.add(s); fliers.push({ o: s, on: false, t: 0, v: new THREE.Vector3(), cd: 4 + R() * 6 }); }
  }
  const flyUpdate = (dt, center) => {
    const calm = !G.enemies || !G.enemies.some(e => e.alive && !e.dead);
    for (const f of fliers) {
      const o = f.o, u = o.userData;
      if (!f.on) {
        f.cd -= dt; if (f.cd > 0) continue;
        if (u.kind === 'spinner' && !calm) { f.cd = 3; continue; }
        // enter from beyond the view, cross it, leave
        const ang = u.kind === 'drone' ? Math.random() * Math.PI * 2 : (Math.random() < 0.5 ? 0 : Math.PI);
        const dx = Math.sin(ang), dz = Math.cos(ang), side = u.kind === 'drone' ? (Math.random() - 0.5) * 9 : (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 2.5);   // a portrait frame is narrow: height magnifies their offset ~1.7x
        o.position.set(center.x - dx * 26 + dz * side, u.kind === 'drone' ? 6.2 + Math.random() : 7.2 + Math.random() * 1.2, center.z - dz * 26 - dx * side);
        f.v.set(dx, 0, dz).multiplyScalar(u.kind === 'drone' ? 6 + Math.random() * 3 : 13 + Math.random() * 3);
        o.rotation.set(0, ang, 0); f.on = true; f.t = 0; o.visible = true; if (u.pool) u.pool.visible = true;
        continue;
      }
      f.t += dt; o.position.addScaledVector(f.v, dt);
      if (u.kind === 'drone') { o.position.y += Math.sin(f.t * 3) * 0.004; const on = Math.floor(f.t * 2) % 2 === 0; u.led[0].visible = on; u.led[1].visible = !on; }
      else { o.rotation.z = Math.sin(f.t * 1.3) * 0.08; u.pool.position.set(o.position.x + f.v.x * 0.22, 0.02, o.position.z + f.v.z * 0.22); u.mark.visible = (f.t % 1) < 0.12; }
      if (Math.hypot(o.position.x - center.x, o.position.z - center.z) > 32 && f.t > 1) { f.on = false; o.visible = false; if (u.pool) u.pool.visible = false; f.cd = u.kind === 'drone' ? 1 + Math.random() * 4 : 8 + Math.random() * 6; }
    }
  };

  C.fliers = fliers; C.fly = (i) => { const f = fliers[i]; if (f && !f.on) f.cd = 0; };
  C.update = (dt, center, hero) => {
    const t = G.rt || 0;
    for (const m of C.mats) { if (m.uniforms.uTime) m.uniforms.uTime.value = t; if (m.uniforms.uHero && hero) m.uniforms.uHero.value.copy(hero); }
    flyUpdate(dt, center);
    tags.update(dt);
    fx.update(dt);
  };
  return C;
}
