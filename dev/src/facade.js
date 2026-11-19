// Facades that hold up close.
//  - Shopfronts: real mullions, door, kickplate, lit fascia, and an interior-mapped room behind the glass
//    (a shader that ray-casts a box room per pixel, so a flat plane reads as a lit shop 3.5 m deep).
//  - Upper windows: instanced interior mapping from a room atlas, with curtains, blinds and people at different depths.
//  - Glass that breaks: every pane is registered; thrown things, ragdolls, Surge, explosions and bullets crack or shatter it,
//    leaving jagged remains and shards that fall, bounce and glint on the pavement.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawLedger, drawTally, ledgerFit } from './ledger.js';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
let s0 = 12345; const R = () => { s0 = (s0 * 16807) % 2147483647; return (s0 - 1) / 2147483646; };

// ------------------------------------------------------------------ interior mapping shader
const INT_VS = /* glsl */`
#include <common>
#include <fog_pars_vertex>
#ifdef USE_INSTANCING
attribute vec4 aRoom;
#else
uniform vec4 uRoom;
#endif
varying vec3 vP; varying vec3 vD; varying vec4 vR;
void main() {
#ifdef USE_INSTANCING
  mat4 M = modelMatrix * instanceMatrix; vR = aRoom;
#else
  mat4 M = modelMatrix; vR = uRoom;
#endif
  vec4 wp = M * vec4(position, 1.0);
  vD = (wp.xyz - cameraPosition) * mat3(M);
  vP = position;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const INT_FS = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D tBack; uniform sampler2D tMid; uniform vec2 uCells; uniform vec2 uSize; uniform float uDepth;
uniform vec3 uWall; uniform vec3 uFloorA; uniform vec3 uFloorB; uniform vec3 uLight; uniform float uShop; uniform float uTime; uniform float uMidZ;
uniform sampler2D tScreen;
varying vec3 vP; varying vec3 vD; varying vec4 vR;
vec2 cellUV(vec2 uv, float idx) { float cx = mod(idx, uCells.x); float cy = floor(idx / uCells.x); return (vec2(cx, uCells.y - 1.0 - cy) + clamp(uv, 0.003, 0.997)) / uCells; }
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // ad screens (aRoom.y < 0): a flat emissive panel on the glass, a 4-frame flipbook every 1.5 s
  if (vR.y < -0.5) {
    vec2 uv = vP.xy / uSize + 0.5;
    float mn = floor(uTime / 60.0), ph = fract(uTime / 60.0), seam = step(hsh(vec2(mn, vR.z * 97.0)), 0.02) * step(abs(ph - fract(vR.z * 13.0)), 0.003);
    float band = seam * step(abs(uv.y - fract(vR.z * 7.0) * 0.7 - 0.15), 0.1);
    uv.x = fract(uv.x + band * 0.23);
    float fr = mod(floor(uTime / 0.375 + vR.z * 4.0), 4.0);
    vec3 sc = texture2D(tScreen, (vec2(vR.x, 3.0 - fr) + clamp(uv, 0.004, 0.996)) / vec2(8.0, 4.0)).rgb;
    sc *= 0.8 + 0.2 * step(0.28, fract(uv.x * 64.0)) * step(0.28, fract(uv.y * 89.0));
    sc *= 0.92 + 0.08 * sin(uv.y * 300.0 - uTime * 12.0);
    vec3 col = sc * 1.2 * (1.0 - 0.25 * smoothstep(0.42, 0.5, max(abs(uv.x - 0.5), abs(uv.y - 0.5))));
    col = mix(col, vec3(1.0, 0.95, 0.9) * (0.6 + 0.4 * hsh(floor(uv * vec2(40.0, 6.0)) + uTime)), band * 0.7);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    return;
  }
  vec3 d = normalize(vD); d.z = min(d.z, -0.002);
  vec3 hs = vec3(uSize * 0.5, uDepth);
  vec3 p = vP;
  float tx = d.x > 0.0 ? (hs.x - p.x) / d.x : (d.x < 0.0 ? (-hs.x - p.x) / d.x : 1e5);
  float ty = d.y > 0.0 ? (hs.y - p.y) / d.y : (d.y < 0.0 ? (-hs.y - p.y) / d.y : 1e5);
  float tz = (-hs.z - p.z) / d.z;
  float t = min(min(tx, ty), tz);
  vec3 h = p + d * t;
  float lit = vR.y, depthK = clamp(-h.z / uDepth, 0.0, 1.0);
  vec3 col;
  if (t == tz) {
    col = texture2D(tBack, cellUV(h.xy / uSize + 0.5, vR.x)).rgb;
  } else if (t == tx) {
    float yy = (h.y + hs.y) / uSize.y;
    col = uWall * (0.8 + 0.4 * vR.z);
    col *= yy < 0.07 ? 0.4 : 1.0;
    col *= 0.85 + 0.15 * hsh(floor(vec2(h.z * 2.0, yy * 3.0)));
    col *= 0.75 + 0.25 * depthK;
  } else if (h.y < 0.0) {
    vec2 f = h.xz;
    if (uShop > 0.5) { vec2 g = floor(f * 2.2); col = mix(uFloorA, uFloorB, mod(g.x + g.y, 2.0)); }
    else { float row = floor(f.x * 5.0); col = uFloorA * (0.7 + 0.35 * hsh(vec2(row, floor(f.y * 0.9 + hsh(vec2(row, 1.0)) * 3.0)))); }
    col *= 0.75 + 0.6 * exp(-dot(h.xz - vec2(0.0, -uDepth * 0.45), h.xz - vec2(0.0, -uDepth * 0.45)) * 0.6);
  } else {
    col = uWall * 0.3;
    float fit = uShop > 0.5 ? smoothstep(0.06, 0.0, abs(h.z + uDepth * 0.45)) * step(abs(h.x), hs.x * 0.85)
                            : smoothstep(0.22, 0.0, length(h.xz - vec2(0.0, -uDepth * 0.5)));
    col += fit * 1.6 * step(0.05, lit);
  }
  // unlit rooms aren't black holes: a dim blue-grey room tint (lighting Fix 6)
  vec3 L = (uLight * 0.95 * lit + mix(vec3(0.106, 0.145, 0.188), uLight, 0.3) * 0.08) * (1.0 - 0.45 * depthK);
  if (vR.z > 0.86 && uShop < 0.5) L = mix(L, vec3(0.30, 0.62, 0.95) * (0.55 + 0.45 * sin(uTime * 17.0 + vR.z * 90.0) * sin(uTime * 5.3 + vR.z * 7.0)) * lit, 0.65);
  col *= L;
  // midground: curtains just behind the glass, people and counters further in
  if (vR.w >= 0.0) {
    float mz = uShop > 0.5 ? uDepth * uMidZ : ((vR.w > 2.5 && vR.w < 4.5) ? uDepth * 0.42 : 0.06);
    float tm = (-mz - p.z) / d.z;
    if (tm < t) {
      vec3 hm = p + d * tm; vec2 muv = hm.xy / uSize + 0.5;
      if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
        vec4 m = texture2D(tMid, cellUV(muv, vR.w));
        col = mix(col, m.rgb * L * 1.1, m.a);
      }
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
function interiorMaterial(o) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tBack: { value: o.back }, tMid: { value: o.mid }, uCells: { value: new THREE.Vector2(...(o.cells || [1, 1])) },
      uSize: { value: new THREE.Vector2(o.w, o.h) }, uDepth: { value: o.depth }, uMidZ: { value: o.midZ ?? 0.35 },
      uWall: { value: new THREE.Color(o.wall) }, uFloorA: { value: new THREE.Color(o.floorA) }, uFloorB: { value: new THREE.Color(o.floorB || o.floorA) },
      uLight: { value: o.light.clone() }, uShop: { value: o.shop ? 1 : 0 }, uTime: { value: 0 }, tScreen: { value: o.screen || null }, uRoom: { value: new THREE.Vector4(0, 1, 0.5, o.mid ? 0 : -1) },
    }]),
    vertexShader: INT_VS, fragmentShader: INT_FS,
  });
}

// ------------------------------------------------------------------ ad screen atlas: 8 ads x 4 flipbook frames, cells 128 x 178 (window aspect)
// city colours only (cyan / pink / white); 3 and 6 are Census PSAs in amber LEDGER. Never violet: that is hers.
export const SCREEN_ADS = { city: [0, 1, 2, 4, 5, 7], census: [3, 6] };
function screenAtlas() {
  const W = 128, H = 178, [c, x] = cv(W * 8, H * 4);
  const CY = '#19d3e6', PK = '#ff2e7a', WH = '#dcebff', AM = '#ff9a1f';
  const bebas = (px) => `${px}px 'Bebas Neue', Impact, 'Arial Narrow', sans-serif`;
  const txt = (t, X, Y, px, col, al = 'center') => { x.font = bebas(px); x.textAlign = al; x.textBaseline = 'alphabetic'; x.fillStyle = col; x.fillText(t, X, Y); };
  const bg = (a, b) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  const ads = [
    (f) => { bg('#2a0614', '#08020a'); x.strokeStyle = PK; x.lineWidth = 5; x.beginPath(); x.arc(64, 96, 34, 0, Math.PI); x.stroke(); x.fillStyle = PK; x.fillRect(26, 92, 76, 5);
      x.strokeStyle = WH; x.lineWidth = 2; for (let k = 0; k < 3; k++) { x.beginPath(); const yy = 84 - ((f * 6 + k * 9) % 26); x.moveTo(48 + k * 16, yy); x.bezierCurveTo(42 + k * 16, yy - 8, 56 + k * 16, yy - 14, 48 + k * 16, yy - 22); x.stroke(); }
      txt('NOODLE', 64, 40, 34, PK); txt(f % 2 ? '24 H' : 'OPEN', 64, 162, 30, f % 2 ? CY : WH); },
    (f) => { bg('#04101e', '#020408'); txt('HALDEN', 64, 38, 36, WH); x.fillStyle = CY; for (let k = 0; k < 5; k++) { const hh = 12 + k * 14 + (k <= f + 1 ? 10 : 0); x.fillRect(16 + k * 21, 140 - hh, 15, hh); }
      x.fillStyle = WH; x.fillRect(12, 142, 104, 2); x.font = '9px Inter, sans-serif'; x.textAlign = 'center'; x.fillText('YOUR FUTURE, SECURED', 64, 162); },
    (f) => { bg('#03303a', '#011014'); x.fillStyle = CY; x.beginPath(); x.roundRect(40, 50, 48, 86, 10); x.fill(); x.fillStyle = '#011014'; x.fillRect(40, 80, 48, 22); txt('KAIRO', 64, 98, 22, CY);
      x.strokeStyle = WH; x.lineWidth = 1.5; for (let k = 0; k < 8; k++) { const bx = 14 + ((k * 37) % 100), by = 150 - ((f * 22 + k * 19) % 140); x.beginPath(); x.arc(bx, by, 2 + (k % 3), 0, 6.3); x.stroke(); }
      txt('SODA', 64, 30, 30, WH); txt('ICE COLD', 64, 166, 22, CY); },
    (f) => { x.fillStyle = '#0c0602'; x.fillRect(0, 0, W, H); x.strokeStyle = AM; x.lineWidth = 2; if (f % 2 === 0) x.strokeRect(5, 5, W - 10, H - 10);
      drawLedger(x, 'BE', 64, 26, 34, AM, { ghost: 0.1, align: 'center' }); drawLedger(x, 'COUNTED', 64, 72, ledgerFit('COUNTED', 112, 22), AM, { ghost: 0.1, align: 'center' });
      x.fillStyle = AM; for (let k = 0; k <= f; k++) { const bx = 22 + k * 22; for (let j = 0; j < 4; j++) x.fillRect(bx + j * 4, 112, 2, 22); x.save(); x.translate(bx + 7, 123); x.rotate(-0.5); x.fillRect(-11, -1, 22, 2); x.restore(); }
      drawLedger(x, 'ORD 7781', 64, 152, 11, AM, { ghost: 0.1, align: 'center' }); },
    (f) => { bg('#1c0414', '#030c18'); x.lineWidth = 3; for (const [col, off, amp] of [[PK, 0, 16], [CY, 1.7, 11]]) { x.strokeStyle = col; x.beginPath(); for (let X = 0; X <= W; X += 4) { const Y = 92 + Math.sin(X * 0.07 + f * 1.57 + off) * amp; X ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
      txt('SYNTH', 64, 42, 36, WH); txt('SLEEP', 64, 150, 36, f % 2 ? PK : CY); },
    (f) => { x.fillStyle = '#020a0c'; x.fillRect(0, 0, W, H); txt('TRAM 7', 64, 30, 28, CY); x.fillStyle = CY; x.fillRect(10, 36, 108, 2);
      x.font = 'bold 11px "Courier New", monospace'; x.textAlign = 'left'; const rows = [['PIER 9', '02'], ['MARKET', '05'], ['RAIL YD', '09'], ['FERRY', '14']];
      rows.forEach(([a, b], k) => { x.fillStyle = k === f ? WH : CY; x.fillText(a, 12, 62 + k * 24); x.textAlign = 'right'; x.fillText(b + ' MIN', 116, 62 + k * 24); x.textAlign = 'left'; });
      if (f % 2) { x.fillStyle = WH; x.fillRect(12, 156, 8, 12); } },
    (f) => { x.fillStyle = '#0c0602'; x.fillRect(0, 0, W, H); x.strokeStyle = AM; x.lineWidth = 3; x.beginPath(); x.arc(64, 56, 26, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(64, 56); const a = -1.2 + f * 0.6; x.lineTo(64 + Math.cos(a) * 20, 56 + Math.sin(a) * 20); x.stroke();
      drawLedger(x, 'REPORT', 64, 98, ledgerFit('REPORT', 108, 18), AM, { ghost: 0.1, align: 'center' }); drawLedger(x, 'THE UNLISTED', 64, 124, ledgerFit('THE UNLISTED', 112, 12), AM, { ghost: 0.1, align: 'center' });
      x.globalAlpha = 0.7; drawTally(x, '2114', 40, 150, 12, AM); x.globalAlpha = 1; },
    (f) => { bg('#22020c', '#060106'); x.fillStyle = PK; x.beginPath(); x.arc(64, 78, 30, 0, 6.3); x.fill(); x.fillRect(30, 110, 68, 40); x.fillStyle = '#060106'; x.fillRect(34 + (f * 13) % 50, 60, 22, 4);
      for (let k = 0; k < 3; k++) { x.fillStyle = k % 2 ? CY : WH; x.fillRect(0, 40 + ((f * 29 + k * 47) % 120), W, 2 + k); }
      txt('VOX', 52, 34, 32, WH); if (f % 2 === 0) { x.fillStyle = '#ff2a2a'; x.beginPath(); x.arc(92, 24, 5, 0, 6.3); x.fill(); } txt('LIVE', 64, 170, 26, PK); },
  ];
  for (let a = 0; a < 8; a++) for (let f = 0; f < 4; f++) { x.save(); x.translate(a * W, f * H); x.beginPath(); x.rect(0, 0, W, H); x.clip(); ads[a](f); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ------------------------------------------------------------------ apartment room atlas (4 x 2 cells) + curtains/people (4 x 2)
function apartmentAtlas() {
  const S = 256, [c, x] = cv(S * 4, S * 2);
  const walls = ['#8a7058', '#6f7a86', '#9a8a70', '#5d6a5a', '#7b6a7e', '#8d7b66', '#6a6560', '#7e8a8e'];
  const at = (i) => [(i % 4) * S, Math.floor(i / 4) * S];
  const r = (i, X, Y, W, H, col) => { const [ox, oy] = at(i); x.fillStyle = col; x.fillRect(ox + X * S, oy + Y * S, W * S, H * S); };
  for (let i = 0; i < 8; i++) {
    const [ox, oy] = at(i);
    x.fillStyle = walls[i]; x.fillRect(ox, oy, S, S);
    for (let k = 0; k < 200; k++) { x.fillStyle = `rgba(0,0,0,${R() * 0.05})`; x.fillRect(ox + R() * S, oy + R() * S, 2 + R() * 8, 2 + R() * 8); }
    r(i, 0, 0.93, 1, 0.07, 'rgba(30,22,16,0.8)');                                  // skirting
  }
  // 0 living room: sofa, lamp, pictures, TV glow
  r(0, 0.12, 0.62, 0.6, 0.31, '#3c2f2a'); r(0, 0.1, 0.55, 0.64, 0.1, '#4a3a33'); r(0, 0.78, 0.4, 0.03, 0.53, '#222'); r(0, 0.72, 0.32, 0.15, 0.1, '#f3d9a0');
  r(0, 0.2, 0.18, 0.18, 0.14, '#2a2420'); r(0, 0.22, 0.2, 0.14, 0.1, '#b0907a'); r(0, 0.45, 0.2, 0.12, 0.16, '#2a2420'); r(0, 0.47, 0.22, 0.08, 0.12, '#7c8fa0');
  // 1 bedroom: bed + headboard + poster
  r(1, 0.1, 0.55, 0.8, 0.15, '#3a3440'); r(1, 0.08, 0.7, 0.84, 0.23, '#d8d0c8'); r(1, 0.12, 0.66, 0.2, 0.08, '#efe8e0'); r(1, 0.55, 0.15, 0.25, 0.32, '#1c1c24'); r(1, 0.57, 0.17, 0.21, 0.28, '#b04a5a');
  // 2 kitchen: cabinets, fridge, hanging pan
  r(2, 0.0, 0.12, 0.65, 0.22, '#d8d4c8'); r(2, 0.0, 0.58, 0.65, 0.35, '#c8c4b8'); r(2, 0.0, 0.55, 0.65, 0.04, '#5a524a'); r(2, 0.7, 0.2, 0.25, 0.73, '#e8e8ea'); r(2, 0.71, 0.45, 0.23, 0.01, '#999');
  for (let k = 0; k < 4; k++) r(2, 0.03 + k * 0.16, 0.2, 0.002, 0.12, '#888');
  // 3 study: bookshelf + armchair
  r(3, 0.08, 0.1, 0.45, 0.83, '#3a2a1e'); for (let s = 0; s < 5; s++) { r(3, 0.1, 0.13 + s * 0.16, 0.41, 0.015, '#2a1c12'); for (let k = 0; k < 12; k++) r(3, 0.1 + k * 0.034, 0.15 + s * 0.16 - 0.002, 0.026, 0.12, `hsl(${R() * 360},35%,${25 + R() * 25}%)`); }
  r(3, 0.62, 0.6, 0.3, 0.33, '#5a3a2a'); r(3, 0.6, 0.48, 0.06, 0.45, '#4a2e22'); r(3, 0.88, 0.48, 0.06, 0.45, '#4a2e22');
  // 4 desk + monitor glow + plant
  r(4, 0.15, 0.6, 0.6, 0.04, '#3a3028'); r(4, 0.18, 0.64, 0.04, 0.29, '#2a2420'); r(4, 0.68, 0.64, 0.04, 0.29, '#2a2420'); r(4, 0.32, 0.38, 0.28, 0.2, '#111'); r(4, 0.335, 0.395, 0.25, 0.17, '#5fa8ff');
  { const [ox, oy] = at(4); x.fillStyle = '#2f5a2a'; x.beginPath(); x.ellipse(ox + 0.86 * S, oy + 0.55 * S, 22, 34, 0, 0, 6.3); x.fill(); }
  // 5 bare room: peeling paper, bare bulb on a cord
  for (let k = 0; k < 14; k++) r(5, R(), R() * 0.8, 0.05 + R() * 0.1, 0.03 + R() * 0.1, 'rgba(60,40,30,0.5)'); r(5, 0.5, 0.0, 0.004, 0.3, '#222'); r(5, 0.485, 0.3, 0.035, 0.04, '#fff2c0');
  // 6 storage: boxes and a clothes rack
  for (let k = 0; k < 7; k++) r(6, 0.05 + (k % 4) * 0.12, 0.93 - 0.13 * (1 + Math.floor(k / 4)), 0.11, 0.12, '#8a6a46'); r(6, 0.58, 0.25, 0.38, 0.015, '#333');
  for (let k = 0; k < 7; k++) r(6, 0.6 + k * 0.05, 0.26, 0.04, 0.3 + R() * 0.15, `hsl(${R() * 360},30%,30%)`);
  // 7 office: filing cabinets + calendar
  for (let k = 0; k < 3; k++) { r(7, 0.08 + k * 0.17, 0.45, 0.15, 0.48, '#6a7078'); for (let q = 0; q < 3; q++) r(7, 0.1 + k * 0.17, 0.5 + q * 0.14, 0.11, 0.005, '#333'); }
  r(7, 0.68, 0.2, 0.2, 0.26, '#f0ece2'); r(7, 0.68, 0.2, 0.2, 0.06, '#b03030');
  const back = tex(c);
  // midground cells: 0-2 curtains/blinds (near glass), 3-4 people (deeper), 5 plant on the sill, 6 empty, 7 sheer
  const [m, y] = cv(S * 4, S * 2); y.clearRect(0, 0, S * 4, S * 2);
  const mc = (i) => [(i % 4) * S, Math.floor(i / 4) * S];
  const curtain = (i, l, rr, col) => { const [ox, oy] = mc(i); y.fillStyle = col; for (const [a, b] of [[0, l], [1 - rr, 1]]) { y.fillRect(ox + a * S, oy, (b - a) * S, S); for (let k = 0; k < 8; k++) { y.fillStyle = 'rgba(0,0,0,0.18)'; y.fillRect(ox + (a + (b - a) * k / 8) * S, oy, 3, S); y.fillStyle = col; } } y.fillStyle = 'rgba(30,25,20,1)'; y.fillRect(ox, oy, S, 8); };
  curtain(0, 0.28, 0.24, '#8a3a3a'); curtain(1, 0.46, 0.42, '#3d5a7a');
  { const [ox, oy] = mc(2); const drop = 0.55; for (let k = 0; k < drop * S; k += 10) { y.fillStyle = 'rgba(210,200,180,1)'; y.fillRect(ox, oy + k, S, 6); } }
  const person = (i, sit) => {
    const [ox, oy] = mc(i); y.fillStyle = 'rgba(12,10,10,0.95)';
    const cx = ox + S * (0.35 + R() * 0.3), base = oy + S * (sit ? 0.98 : 1.0);
    y.beginPath(); y.ellipse(cx, base - S * (sit ? 0.5 : 0.78), S * 0.07, S * 0.085, 0, 0, 6.3); y.fill();                    // head
    y.beginPath(); y.moveTo(cx - S * 0.16, base); y.lineTo(cx - S * 0.13, base - S * (sit ? 0.36 : 0.62)); y.quadraticCurveTo(cx, base - S * (sit ? 0.44 : 0.7), cx + S * 0.13, base - S * (sit ? 0.36 : 0.62)); y.lineTo(cx + S * 0.16, base); y.fill();
    if (sit) { y.fillRect(cx - S * 0.3, base - S * 0.3, S * 0.6, S * 0.04); }
  };
  person(3, false); person(4, true);
  { const [ox, oy] = mc(5); y.fillStyle = '#5a3a28'; y.fillRect(ox + S * 0.1, oy + S * 0.86, S * 0.16, S * 0.14); y.fillStyle = '#2c5a28'; for (let k = 0; k < 9; k++) { y.beginPath(); y.ellipse(ox + S * (0.18 + (R() - 0.5) * 0.18), oy + S * (0.72 + R() * 0.12), 10, 18, R() * 3, 0, 6.3); y.fill(); } }
  { const [ox, oy] = mc(7); y.fillStyle = 'rgba(230,225,215,0.55)'; y.fillRect(ox, oy, S, S); for (let k = 0; k < 16; k++) { y.fillStyle = 'rgba(255,255,255,0.12)'; y.fillRect(ox + k * 16, oy, 5, S); } }
  return { back, mid: tex(m) };
}

// ------------------------------------------------------------------ skylights: rooms seen from above (environment.md Fix 8)
// back = the floor of the room below (4 x 2 cells, 384 x 256 each), mid = ceiling fan blades (0-3) or a hanging bulb (4-7)
function skylightAtlas() {
  const CW = 384, CH = 256, [c, x] = cv(CW * 4, CH * 2), [m, y] = cv(CW * 4, CH * 2); y.clearRect(0, 0, CW * 4, CH * 2);
  const at = (i) => [(i % 4) * CW, Math.floor(i / 4) * CH];
  const floor = (i, kind) => { const [ox, oy] = at(i);
    if (kind === 'wood') { x.fillStyle = '#5a3e2a'; x.fillRect(ox, oy, CW, CH); for (let k = 0; k < CH; k += 18) { x.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.15})`; x.fillRect(ox, oy + k, CW, 2); } }
    else if (kind === 'tile') { x.fillStyle = '#9aa4a6'; x.fillRect(ox, oy, CW, CH); x.strokeStyle = 'rgba(40,50,52,0.5)'; for (let k = 0; k <= CW; k += 32) { x.beginPath(); x.moveTo(ox + k, oy); x.lineTo(ox + k, oy + CH); x.stroke(); } for (let k = 0; k <= CH; k += 32) { x.beginPath(); x.moveTo(ox, oy + k); x.lineTo(ox + CW, oy + k); x.stroke(); } }
    else if (kind === 'carpet') { x.fillStyle = '#3a4250'; x.fillRect(ox, oy, CW, CH); }
    else { x.fillStyle = '#6a6862'; x.fillRect(ox, oy, CW, CH); for (let k = 0; k < 30; k++) { x.fillStyle = 'rgba(0,0,0,0.08)'; x.beginPath(); x.ellipse(ox + R() * CW, oy + R() * CH, 10 + R() * 30, 6 + R() * 16, 0, 0, 6.3); x.fill(); } }
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(ox, oy, CW, 10); x.fillRect(ox, oy + CH - 10, CW, 10); x.fillRect(ox, oy, 10, CH); x.fillRect(ox + CW - 10, oy, 10, CH); };
  const rect = (i, X, Y, W, H, col) => { const [ox, oy] = at(i); x.fillStyle = col; x.fillRect(ox + X * CW, oy + Y * CH, W * CW, H * CH); };
  const circ = (i, X, Y, r, col) => { const [ox, oy] = at(i); x.fillStyle = col; x.beginPath(); x.arc(ox + X * CW, oy + Y * CH, r, 0, 6.3); x.fill(); };
  floor(0, 'wood'); rect(0, 0.06, 0.08, 0.88, 0.22, '#3a2a1c'); for (let k = 0; k < 9; k++) rect(0, 0.1 + R() * 0.75, 0.1 + R() * 0.16, 0.03 + R() * 0.05, 0.02 + R() * 0.03, ['#8a8a8a', '#b03020', '#d0b030'][k % 3]); rect(0, 0.4, 0.55, 0.2, 0.2, '#2a2a2a');
  floor(1, 'tile'); for (let k = 0; k < 6; k++) { const X = 0.14 + (k % 3) * 0.3, Y = 0.3 + Math.floor(k / 3) * 0.42; rect(1, X - 0.11, Y - 0.17, 0.22, 0.34, '#e8ecec'); circ(1, X, Y, 26, '#7a8a90'); circ(1, X, Y, 18, '#2a3438'); }
  floor(2, 'wood'); circ(2, 0.55, 0.55, 70, '#7a2a2a'); rect(2, 0.08, 0.1, 0.36, 0.62, '#d8d0c0'); rect(2, 0.1, 0.12, 0.32, 0.12, '#f0ece4'); rect(2, 0.08, 0.36, 0.36, 0.36, '#3a5a7a'); rect(2, 0.74, 0.62, 0.12, 0.18, '#4a3020');
  floor(3, 'conc'); circ(3, 0.5, 0.52, 30, '#2a4a7a'); circ(3, 0.5, 0.52, 22, '#1a2a3a'); { const [ox, oy] = at(3); x.strokeStyle = 'rgba(160,180,200,0.5)'; x.lineWidth = 3; for (const r of [44, 62, 80]) { x.beginPath(); x.arc(ox + 0.5 * CW, oy + 0.52 * CH, r, 0, 6.3); x.stroke(); } }
  floor(4, 'carpet'); for (const X of [0.1, 0.56]) { rect(4, X, 0.2, 0.34, 0.26, '#6a5440'); for (let k = 0; k < 4; k++) rect(4, X + 0.02 + R() * 0.26, 0.22 + R() * 0.18, 0.06, 0.08, '#f0ece2'); rect(4, X + 0.12, 0.52, 0.1, 0.12, '#1a1a1a'); }
  floor(5, 'conc'); for (let k = 0; k < 9; k++) { const X = 0.1 + (k % 3) * 0.16 + R() * 0.03, Y = 0.15 + Math.floor(k / 3) * 0.22; rect(5, X, Y, 0.14, 0.2, ['#8a6a46', '#7a5a3a', '#9a7a52'][k % 3]); rect(5, X + 0.065, Y, 0.01, 0.2, 'rgba(0,0,0,0.3)'); }
  floor(6, 'wood'); rect(6, 0.32, 0.3, 0.36, 0.4, '#3a2618'); for (const [X, Y] of [[0.24, 0.42], [0.7, 0.42], [0.44, 0.18], [0.44, 0.74]]) rect(6, X, Y, 0.08, 0.12, '#5a3a22');
  floor(7, 'carpet'); for (const [X, Y] of [[0.22, 0.3], [0.5, 0.62], [0.78, 0.3], [0.22, 0.78]]) { circ(7, X, Y, 26, '#2a1a12'); for (let k = 0; k < 3; k++) { const a = k * 2.1; circ(7, X + Math.cos(a) * 0.11, Y + Math.sin(a) * 0.16, 9, '#5a3a22'); } }
  for (let i = 0; i < 8; i++) { const [ox, oy] = at(i); const cx = ox + CW / 2, cy = oy + CH / 2;
    if (i < 4) { y.fillStyle = 'rgba(20,16,14,0.95)'; for (let k = 0; k < 4; k++) { y.save(); y.translate(cx, cy); y.rotate(k * Math.PI / 2 + i * 0.4); y.fillRect(8, -9, 74, 18); y.restore(); } y.beginPath(); y.arc(cx, cy, 14, 0, 6.3); y.fill(); }
    else { y.strokeStyle = 'rgba(20,16,14,0.9)'; y.lineWidth = 2; y.beginPath(); y.moveTo(cx, oy); y.lineTo(cx, cy); y.stroke(); const g = y.createRadialGradient(cx, cy, 0, cx, cy, 22); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,200,120,0)'); y.fillStyle = g; y.beginPath(); y.arc(cx, cy, 22, 0, 6.3); y.fill(); } }
  return { back: tex(c), mid: tex(m) };
}

// ------------------------------------------------------------------ shops
// back wall (512 x 256) and a midground layer with alpha (counters, aisles, customers)
const SHOPS = {
  noodles: { names: ['LUCKY NOODLE', 'KAIJU RAMEN', 'NIGHT BOWL'], sub: 'OPEN LATE · HAND-PULLED', sign: '#ff2a8a', light: [1.5, 1.05, 0.62], wall: 0x5a3a28, floorA: 0x2a2018, floorB: 0x3a2c20 },
  mart: { names: ['24/7 MART', 'QUIKSTOP', 'CORNER STORE'], sub: 'COLD DRINKS · LOTTO · ATM', sign: '#ff4040', light: [1.05, 1.2, 1.15], wall: 0xc9d2d4, floorA: 0xb8b8b0, floorB: 0x8c8c86 },
  laundry: { names: ['SUDS & SPIN', 'COIN LAUNDRY'], sub: 'WASH · DRY · FOLD', sign: '#48e0ff', light: [1.0, 1.35, 1.5], wall: 0x8fc0c0, floorA: 0x9aa4a6, floorB: 0x6c7476 },
  pawn: { names: ['PIER PAWN', 'CASH 4 GOLD'], sub: 'WE BUY · WE SELL · NO QUESTIONS', sign: '#7dffb0', light: [1.5, 1.2, 0.8], wall: 0x6a2a24, floorA: 0x3a2a22, floorB: 0x2a1e18 },
  bar: { names: ['THE LOW TIDE', 'ANCHOR BAR', 'LAST CALL'], sub: 'COLD BEER · NO CHIPS SCANNED', sign: '#ff2a8a', light: [1.4, 0.75, 0.5], wall: 0x2a1418, floorA: 0x2a1a14, floorB: 0x1c120e },
  pharmacy: { names: ['FARMACIA', 'DRUGS 24H'], sub: 'PRESCRIPTIONS · FIRST AID', sign: '#40ff90', light: [1.3, 1.5, 1.35], wall: 0xe8eee8, floorA: 0xd0d6d0, floorB: 0xa8b0a8 },
  repair: { names: ['CHIP REPAIR', 'SIGNAL SHOP', 'FIXIT'], sub: 'IMPLANTS FLASHED · CASH ONLY', sign: '#3fd0ff', light: [0.9, 0.95, 1.6], wall: 0x24283a, floorA: 0x202430, floorB: 0x2c3040 },
};
const KIND_LIST = ['noodles', 'mart', 'laundry', 'pawn', 'bar', 'pharmacy', 'repair'];
const glowRect = (x, X, Y, W, H, col, blur = 14) => { x.save(); x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.fillRect(X, Y, W, H); x.restore(); };
const silhouette = (y, cx, base, sc, sit) => {
  y.fillStyle = 'rgba(10,8,8,0.97)';
  y.beginPath(); y.ellipse(cx, base - sc * (sit ? 1.0 : 1.55), sc * 0.15, sc * 0.18, 0, 0, 6.3); y.fill();
  y.beginPath(); y.moveTo(cx - sc * 0.32, base - (sit ? sc * 0.25 : 0)); y.lineTo(cx - sc * 0.26, base - sc * (sit ? 0.72 : 1.25)); y.quadraticCurveTo(cx, base - sc * (sit ? 0.9 : 1.42), cx + sc * 0.26, base - sc * (sit ? 0.72 : 1.25)); y.lineTo(cx + sc * 0.32, base - (sit ? sc * 0.25 : 0)); y.fill();
};
function paintShop(kind) {
  const W = 512, H = 256, [c, x] = cv(W, H), [m, y] = cv(W, H); y.clearRect(0, 0, W, H);
  const K = SHOPS[kind];
  x.fillStyle = '#' + K.wall.toString(16).padStart(6, '0'); x.fillRect(0, 0, W, H);
  if (kind === 'noodles') {
    x.fillStyle = '#d8d0c0'; x.fillRect(0, 140, W, 116); x.strokeStyle = 'rgba(90,80,70,0.6)'; for (let k = 0; k < W; k += 14) { x.beginPath(); x.moveTo(k, 140); x.lineTo(k, 256); x.stroke(); } for (let k = 140; k < 256; k += 14) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); }
    for (let i = 0; i < 3; i++) { x.fillStyle = '#141010'; x.fillRect(40 + i * 150, 22, 120, 80); x.font = 'bold 15px monospace'; x.fillStyle = '#ffd890'; ['RAMEN 9', 'UDON  8', 'GYOZA 6', 'TEA   2'].forEach((t, k) => x.fillText(t, 52 + i * 150, 42 + k * 17)); }
    glowRect(x, 180, 112, 150, 30, '#fff2d0', 20); for (let k = 0; k < 4; k++) { x.save(); x.shadowColor = '#ff3020'; x.shadowBlur = 16; x.fillStyle = '#e03020'; x.beginPath(); x.ellipse(30 + k * 150, 12, 14, 16, 0, 0, 6.3); x.fill(); x.restore(); }
    y.fillStyle = '#4a2e1c'; y.fillRect(0, 150, W, 106); y.fillStyle = '#7a4e30'; y.fillRect(0, 144, W, 10);
    silhouette(y, 140, 210, 70, true); silhouette(y, 330, 214, 66, true);
    for (let k = 0; k < 5; k++) { y.fillStyle = '#1a1210'; y.fillRect(50 + k * 100, 200, 8, 56); y.beginPath(); y.ellipse(54 + k * 100, 198, 20, 6, 0, 0, 6.3); y.fill(); }
  } else if (kind === 'mart') {
    for (let d = 0; d < 4; d++) { const X = 20 + d * 122; x.fillStyle = '#e8f6ff'; x.fillRect(X, 20, 112, 236); for (let s = 0; s < 5; s++) { x.fillStyle = '#7a8a90'; x.fillRect(X, 60 + s * 40, 112, 3); for (let k = 0; k < 9; k++) { x.fillStyle = `hsl(${[0, 30, 120, 200, 160, 50][(k + s + d) % 6]},38%,${30 + R() * 12}%)`; x.fillRect(X + 4 + k * 12, 40 + s * 40, 8, 20); } } x.fillStyle = '#22282c'; x.fillRect(X + 108, 20, 6, 236); }
    x.fillStyle = '#c02020'; x.fillRect(0, 0, W, 18); x.font = 'bold 13px sans-serif'; x.fillStyle = '#fff'; x.fillText('COLD DRINKS   ·   ICE   ·   ENERGY   ·   COLD DRINKS', 16, 14);
    for (const X0 of [30, 300]) { y.fillStyle = '#d0d4d4'; y.fillRect(X0, 90, 170, 166); for (let s = 0; s < 4; s++) { y.fillStyle = '#8a9094'; y.fillRect(X0, 96 + s * 40, 170, 4); for (let k = 0; k < 10; k++) { y.fillStyle = `hsl(${R() * 360},40%,38%)`; y.fillRect(X0 + 4 + k * 16.5, 100 + s * 40, 13, 30); } } }
    silhouette(y, 250, 256, 78, false);
  } else if (kind === 'laundry') {
    for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) { const X = 14 + k * 82, Y = 20 + row * 116; x.fillStyle = '#eef2f2'; x.fillRect(X, Y, 74, 108); x.fillStyle = '#2a3236'; x.beginPath(); x.arc(X + 37, Y + 60, 26, 0, 6.3); x.fill(); x.fillStyle = row ? `rgba(80,170,255,${0.4 + R() * 0.4})` : 'rgba(40,40,44,1)'; x.beginPath(); x.arc(X + 37, Y + 60, 20, 0, 6.3); x.fill(); x.fillStyle = '#aab'; x.fillRect(X + 8, Y + 8, 30, 8); }
    y.fillStyle = '#c8c8c0'; y.fillRect(60, 170, 220, 10); y.fillStyle = '#5a5a5a'; y.fillRect(70, 180, 8, 76); y.fillRect(262, 180, 8, 76);
    for (let k = 0; k < 4; k++) { y.fillStyle = `hsl(${R() * 360},40%,60%)`; y.fillRect(80 + k * 45, 150, 38, 20); }
    silhouette(y, 380, 256, 80, false); y.save(); y.shadowColor = '#9ff'; y.shadowBlur = 12; y.fillStyle = '#bff'; y.fillRect(392, 150, 10, 14); y.restore();
  } else if (kind === 'pawn') {
    for (let k = 0; k < 5; k++) { const X = 30 + k * 60; x.fillStyle = ['#a0522d', '#222', '#d2691e', '#800', '#333'][k]; x.beginPath(); x.ellipse(X, 150, 22, 28, 0, 0, 6.3); x.fill(); x.fillRect(X - 4, 40, 8, 112); }
    for (let k = 0; k < 3; k++) { x.fillStyle = '#111'; x.fillRect(340 + k * 54, 40, 48, 40); x.fillStyle = `rgba(${150 + R() * 100},${150 + R() * 100},255,0.6)`; x.fillRect(344 + k * 54, 44, 40, 32); }
    x.font = 'bold 26px sans-serif'; x.save(); x.shadowColor = '#ffd040'; x.shadowBlur = 12; x.fillStyle = '#ffe080'; x.fillText('WE BUY GOLD', 320, 130); x.restore();
    y.fillStyle = 'rgba(120,200,220,0.55)'; y.fillRect(20, 150, 470, 70); y.fillStyle = '#2a1a12'; y.fillRect(20, 220, 470, 36); y.fillStyle = '#c8a040'; y.fillRect(20, 148, 470, 4);
    for (let k = 0; k < 14; k++) { y.fillStyle = `hsl(${40 + R() * 20},80%,${50 + R() * 20}%)`; y.fillRect(36 + k * 32, 190, 14, 8); }
  } else if (kind === 'bar') {
    x.fillStyle = '#181012'; x.fillRect(40, 30, 432, 140); x.fillStyle = 'rgba(120,140,160,0.25)'; x.fillRect(60, 40, 392, 120);
    for (let s = 0; s < 3; s++) { glowRect(x, 40, 66 + s * 40, 432, 4, '#ffb060', 18); for (let k = 0; k < 22; k++) { x.fillStyle = `hsla(${20 + R() * 120},60%,${35 + R() * 25}%,0.95)`; x.fillRect(48 + k * 19, 44 + s * 40, 10, 22); } }
    x.save(); x.shadowColor = '#ff2a8a'; x.shadowBlur = 16; x.strokeStyle = '#ff6ab0'; x.lineWidth = 4; x.font = 'bold 30px sans-serif'; x.strokeText('OPEN', 205, 205); x.restore();
    y.fillStyle = '#2a1410'; y.fillRect(0, 158, W, 98); y.fillStyle = '#5a3020'; y.fillRect(0, 150, W, 12); y.fillStyle = '#d0a040'; y.fillRect(0, 196, W, 3);
    silhouette(y, 100, 214, 66, true); silhouette(y, 250, 210, 70, true); silhouette(y, 410, 214, 64, true);
  } else if (kind === 'pharmacy') {
    for (let s = 0; s < 4; s++) { x.fillStyle = '#c8d0c8'; x.fillRect(0, 50 + s * 50, W, 5); for (let k = 0; k < 30; k++) { x.fillStyle = `hsl(${R() * 360},35%,${70 + R() * 15}%)`; x.fillRect(6 + k * 17, 28 + s * 50, 13, 22); } }
    x.save(); x.shadowColor = '#40ff90'; x.shadowBlur = 20; x.fillStyle = '#50ff98'; x.fillRect(236, 6, 40, 14); x.fillRect(249, -7, 14, 40); x.restore();
    y.fillStyle = '#f0f4f0'; y.fillRect(110, 160, 300, 96); y.fillStyle = '#40c080'; y.fillRect(110, 156, 300, 6);
    silhouette(y, 260, 190, 60, false);
  } else if (kind === 'repair') {
    for (let r2 = 0; r2 < 3; r2++) for (let k = 0; k < 7; k++) { const X = 20 + k * 68, Y = 20 + r2 * 62; x.fillStyle = '#0c0d12'; x.fillRect(X, Y, 62, 56); const hue = R() < 0.5 ? 'rgba(63,208,255,' : 'rgba(80,220,255,'; /* cyan only: violet is hers */ x.fillStyle = hue + (0.5 + R() * 0.4) + ')'; x.fillRect(X + 5, Y + 5, 52, 42); for (let l = 0; l < 42; l += 3) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X + 5, Y + 5 + l, 52, 1); } if (R() < 0.3) { x.fillStyle = 'rgba(255,255,255,0.9)'; x.font = 'bold 13px monospace'; x.fillText('||||', X + 16, Y + 32); } }
    for (let k = 0; k < 8; k++) { x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath(); x.moveTo(R() * W, 200); x.bezierCurveTo(R() * W, 260, R() * W, 230, R() * W, 256); x.stroke(); }
    y.fillStyle = '#3a3440'; y.fillRect(40, 168, 420, 12); y.fillStyle = '#222'; y.fillRect(50, 180, 10, 76); y.fillRect(440, 180, 10, 76);
    y.save(); y.shadowColor = '#fff6d0'; y.shadowBlur = 18; y.fillStyle = '#fff2c0'; y.fillRect(150, 140, 30, 10); y.restore();
    for (let k = 0; k < 10; k++) { y.fillStyle = `hsl(${R() * 360},20%,${20 + R() * 30}%)`; y.fillRect(70 + R() * 360, 150 + R() * 14, 10 + R() * 20, 6 + R() * 10); }
    silhouette(y, 300, 214, 64, true);
  }
  return { back: tex(c), mid: tex(m) };
}
function shutterTexture() {
  const [c, x] = cv(512, 256);
  x.fillStyle = '#5a5e62'; x.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 256; k += 8) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, k, 512, 2); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, k + 3, 512, 1); }
  for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(90,50,30,${R() * 0.25})`; x.fillRect(R() * 512, R() * 256, 4 + R() * 30, 2 + R() * 40); }
  // tags, a stencil and the Census notice: everyone here knows what the notice means
  const tags = ['UNCOUNTED', 'NULL WAS HERE', 'COUNT: 1', 'NOT A CRIME', '0447'];
  for (let k = 0; k < 3; k++) { x.save(); x.translate(40 + R() * 300, 70 + R() * 150); x.rotate((R() - 0.5) * 0.3); x.font = `bold ${24 + R() * 22}px sans-serif`; x.lineWidth = 5; x.strokeStyle = '#111'; const t = tags[Math.floor(R() * tags.length)]; x.strokeText(t, 0, 0); x.fillStyle = ['#ff2a8a', '#ffd040', '#7dffb0', '#40e0ff'][k % 4]; x.fillText(t, 0, 0); x.restore(); }
  x.fillStyle = '#f0ece0'; x.fillRect(380, 40, 100, 70); x.fillStyle = '#b02020'; x.fillRect(380, 40, 100, 14); x.fillStyle = '#222'; x.font = 'bold 10px sans-serif'; x.fillText('CENSUS NOTICE', 388, 51); x.font = '9px sans-serif';
  ['PREMISES CLOSED', 'OWNER UNCOUNTED', 'DO NOT ENTER', '|||| ||'].forEach((t, i) => x.fillText(t, 388, 68 + i * 11));
  return tex(c);
}
function awningTexture(h) {
  const [c, x] = cv(256, 64);
  for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? `hsl(${h},45%,30%)` : `hsl(${h},20%,78%)`; x.fillRect(k * 32, 0, 32, 64); }
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 64);
  return tex(c);
}

// ------------------------------------------------------------------ broken glass textures
function remnantTexture(seed) {
  s0 = seed;
  const S = 256, [c, x] = cv(S, S);
  x.fillStyle = 'rgba(190,210,230,0.55)'; x.fillRect(0, 0, S, S);
  // knock the middle out with a jagged hole
  const n = 16, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = S * (0.28 + R() * 0.24); pts.push([S / 2 + Math.cos(a) * r * (1.0 + R() * 0.2), S / 2 + Math.sin(a) * r]); }
  x.globalCompositeOperation = 'destination-out'; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1.3;
  for (const [px, py] of pts) { x.beginPath(); x.moveTo(px, py); const a = Math.atan2(py - S / 2, px - S / 2); x.lineTo(px + Math.cos(a + (R() - 0.5) * 0.6) * S, py + Math.sin(a + (R() - 0.5) * 0.6) * S); x.stroke(); }
  return tex(c);
}
// a bullet crack (lighting Fix 10): an impact core, jagged radial cracks that thin out, a few partial rings. Not a web.
function crackTexture() {
  const S = 256, [c, x] = cv(S, S); x.clearRect(0, 0, S, S); const C = S / 2;
  const arms = 8 + Math.floor(R() * 4); x.lineWidth = 1; x.lineCap = 'round';
  for (let i = 0; i < arms; i++) {
    let a = i / arms * Math.PI * 2 + (R() - 0.5) * 0.4, px = C, py = C, r = 0;
    const len = (0.35 + R() * 0.65) * C * 0.96;
    while (r < len) {
      const step = 8 + R() * 6; a += (R() - 0.5) * 0.7; const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
      r = Math.hypot(nx - C, ny - C); x.strokeStyle = `rgba(255,255,255,${(0.9 - 0.55 * Math.min(1, r / len)).toFixed(3)})`;
      x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny;
    }
  }
  x.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let k = 0, n = 2 + Math.floor(R() * 3); k < n; k++) { const rr = (0.25 + R() * 0.25) * C, a0 = R() * 6.3; x.beginPath(); x.arc(C, C, rr, a0, a0 + 0.6 + R() * 1.4); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(C, C, 2.5, 0, 6.3); x.fill();
  return tex(c);
}

// ------------------------------------------------------------------ the kit
export function makeFacadeKit(scene, opts) {
  const { rnd, signTexture } = opts;
  const kit = { panes: [], grid: new Map(), shops: [], mats: [], time: 0 };
  const cell = (x, z) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
  const addPane = (p) => { kit.panes.push(p); const k = cell(p.c.x, p.c.z); if (!kit.grid.has(k)) kit.grid.set(k, []); kit.grid.get(k).push(p); };

  // shared materials
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.5, metalness: 0.7 });
  const kickMat = new THREE.MeshStandardMaterial({ color: 0x23201d, roughness: 0.6, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x8aa0b8, metalness: 1.0, roughness: 0.04, envMapIntensity: 1.5, transparent: true, opacity: 0.22, depthWrite: false });
  const remnantMats = [101, 202, 303].map(sd => new THREE.MeshStandardMaterial({ map: remnantTexture(sd), metalness: 0.9, roughness: 0.05, envMapIntensity: 2, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0.8, depthWrite: false, color: new THREE.Color(1.1, 1.15, 1.25) });
  const shutterMat = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.55, metalness: 0.6 });

  // pane instances: all glass in the city is one InstancedMesh (+ one for jagged remains)
  const MAXP = 900;
  const unit = new THREE.PlaneGeometry(1, 1);
  const glassIM = new THREE.InstancedMesh(unit, glassMat, MAXP); glassIM.count = 0; glassIM.renderOrder = 3; glassIM.frustumCulled = false; scene.add(glassIM);
  const remIM = remnantMats.map(m => { const im = new THREE.InstancedMesh(unit, m, 200); im.count = 0; im.renderOrder = 3; im.frustumCulled = false; scene.add(im); return im; });
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), Z0 = new THREE.Matrix4().makeScale(0, 0, 0), UP = new THREE.Vector3(0, 1, 0);
  const pane = (c, ry, w, h, kind) => {
    if (glassIM.count >= MAXP) return;
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), r = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const i = glassIM.count++;
    Q.setFromAxisAngle(UP, ry); M4.compose(c, Q, S3.set(w, h, 1)); glassIM.setMatrixAt(i, M4);
    addPane({ c: c.clone(), n, r, ry, w, h, i, kind, broken: false, cracks: 0, lastCrack: -9, mat: M4.clone() });
  };

  // ---------------- shopfronts
  const shopCache = {};
  kit.storefront = (cx, cz, ry, sw, o = {}) => {
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), rgt = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const at = (u, y, out) => new THREE.Vector3(cx + rgt.x * u + n.x * out, y, cz + rgt.z * u + n.z * out);
    const closed = o.closed ?? rnd() < 0.18;
    const kind = o.kind || KIND_LIST[Math.floor(rnd() * KIND_LIST.length)];
    const K = SHOPS[kind];
    const G0 = 0.55, G1 = 2.85, gh = G1 - G0, gy = (G0 + G1) / 2;
    const parts = [];
    const box = (u, y, out, bw, bh, bd) => { const g = new THREE.BoxGeometry(bw, bh, bd); g.rotateY(ry); const p = at(u, y, out); g.translate(p.x, p.y, p.z); parts.push(g); };
    // frame: kickplate, head, jambs, mullions; a door at one end
    box(0, G0 / 2, 0.06, sw + 0.3, G0, 0.14);
    box(0, G1 + 0.06, 0.08, sw + 0.3, 0.12, 0.18);
    box(-sw / 2 - 0.07, gy, 0.08, 0.14, gh + 0.1, 0.18); box(sw / 2 + 0.07, gy, 0.08, 0.14, gh + 0.1, 0.18);
    const nP = Math.max(2, Math.round(sw / 1.55)), pw = sw / nP;
    for (let k = 1; k < nP; k++) box(-sw / 2 + k * pw, gy, 0.08, 0.07, gh, 0.12);
    box(0, G0 + 0.03, 0.12, sw, 0.05, 0.12);                                   // sill bar
    const doorAt = rnd() < 0.5 ? 0 : nP - 1;
    if (!closed) {
      const du = -sw / 2 + (doorAt + 0.5) * pw;
      box(du, G0 + gh * 0.5, 0.16, pw * 0.7, 0.04, 0.05);                     // push bar
      box(du, G0 + 0.02, 0.05, pw - 0.04, 0.1, 0.06);                          // door kick
    }
    const frame = new THREE.Mesh(mergeGeometries(parts), frameMat); frame.castShadow = true; frame.receiveShadow = true; scene.add(frame);
    if (closed) {
      // roller shutter pulled down, tagged, with the Census notice
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(sw, gh + 0.2), shutterMat); sh.position.copy(at(0, gy, 0.05)); sh.rotation.y = ry; scene.add(sh);
      const boxTop = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.3, 0.32, 0.3), frameMat); boxTop.position.copy(at(0, G1 + 0.28, 0.15)); boxTop.rotation.y = ry; scene.add(boxTop);
    } else {
      if (!shopCache[kind]) shopCache[kind] = paintShop(kind);
      const P = shopCache[kind];
      const im = interiorMaterial({ back: P.back, mid: P.mid, w: sw, h: gh, depth: 3.6, wall: K.wall, floorA: K.floorA, floorB: K.floorB, light: new THREE.Color(...K.light).multiplyScalar(o.bright ?? 1), shop: true, midZ: 0.38 });
      im.uniforms.uRoom.value.set(0, 1, rnd(), 0);
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(sw, gh), im); inside.position.copy(at(0, gy, 0.03)); inside.rotation.y = ry; scene.add(inside);
      kit.mats.push(im);
      for (let k = 0; k < nP; k++) pane(at(-sw / 2 + (k + 0.5) * pw, gy, 0.075), ry, pw - 0.05, gh - 0.04, 'shop');
      kit.shops.push({ p: at(0, 0, 0.1), n, light: new THREE.Color(...K.light), w: sw, kind });
    }
    // fascia: a lightbox with the shop's name
    const fasciaH = 0.62, name = closed ? 'CLOSED' : K.names[Math.floor(rnd() * K.names.length)];
    const fb = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.3, fasciaH + 0.12, 0.22), frameMat); fb.position.copy(at(0, G1 + 0.5, 0.11)); fb.rotation.y = ry; scene.add(fb);
    const ft = signTexture(name, closed ? '#8a8a8a' : K.sign, false, closed ? 'BY ORDER OF THE CENSUS' : K.sub);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(sw + 0.1, fasciaH), new THREE.MeshBasicMaterial({ map: ft, color: closed ? new THREE.Color(0.5, 0.5, 0.5) : new THREE.Color(1.2, 1.2, 1.2), toneMapped: false }));
    face.position.copy(at(0, G1 + 0.5, 0.225)); face.rotation.y = ry; scene.add(face);
    // a striped awning on some shops (shallow, so the camera still sees in)
    if (!closed && rnd() < 0.4) {
      const ad = 0.85, aw = sw + 0.2, drop = 0.35;
      const g = new THREE.PlaneGeometry(aw, Math.hypot(ad, drop)); const aw2 = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: awningTexture(Math.floor(rnd() * 360)), roughness: 0.85, side: THREE.DoubleSide }));
      aw2.position.copy(at(0, G1 + 0.08 - drop / 2, ad / 2 + 0.05)); aw2.rotation.order = 'YXZ'; aw2.rotation.y = ry; aw2.rotation.x = -Math.PI / 2 + Math.atan2(drop, ad); aw2.castShadow = true; scene.add(aw2);
      const val = new THREE.Mesh(new THREE.PlaneGeometry(aw, 0.2), aw2.material); val.position.copy(at(0, G1 + 0.08 - drop - 0.1, ad + 0.05)); val.rotation.y = ry; scene.add(val);
    }
  };

  // ---------------- set dressing on a facade: fire escape, drainpipes, window AC units (merged: two draw calls a face)
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55, metalness: 0.65 });
  const acMat2 = new THREE.MeshStandardMaterial({ color: 0x9a9c98, roughness: 0.5, metalness: 0.5 });
  kit.dress = (cx, cz, ry, fw, h, floors, cols) => {
    const iron = [], ac = [];
    const Mf = new THREE.Matrix4().compose(new THREE.Vector3(cx, 0, cz), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(1, 1, 1));
    const put = (list, g, x, y, z, rz = 0, rx = 0) => { if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); g.translate(x, y, z); g.applyMatrix4(Mf); list.push(g); };
    const colU = (c) => (c + 0.5) / cols * fw - fw / 2;
    // fire escape over two window columns, only on faces the camera sees from the front
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    if (floors >= 2 && cols >= 3 && n.z > -0.3 && rnd() < 0.55) {
      const c0 = Math.floor(rnd() * (cols - 1)), u0 = colU(c0) - 0.9, u1 = colU(c0 + 1) + 0.9, span = u1 - u0, um = (u0 + u1) / 2;
      for (let f = 0; f < floors; f++) {
        const y = 5.2 + f * 3.4 - 0.95;
        put(iron, new THREE.BoxGeometry(span, 0.05, 1.05), um, y, 0.55);
        for (let k = 0; k <= Math.round(span / 0.55); k++) put(iron, new THREE.BoxGeometry(0.025, 0.9, 0.025), u0 + k * span / Math.round(span / 0.55), y + 0.45, 1.05);
        put(iron, new THREE.BoxGeometry(span, 0.04, 0.04), um, y + 0.9, 1.06); put(iron, new THREE.BoxGeometry(span, 0.025, 0.025), um, y + 0.45, 1.06);
        for (const ue of [u0, u1]) { put(iron, new THREE.BoxGeometry(0.04, 0.04, 1.0), ue, y + 0.9, 0.56); put(iron, new THREE.BoxGeometry(0.025, 0.9, 0.025), ue, y + 0.45, 0.06); }
        for (let k = 0; k < 6; k++) put(iron, new THREE.BoxGeometry(0.03, 0.03, 1.0), u0 + 0.15 + k * (span - 0.3) / 5, y - 0.04, 0.55);    // slats under the grate
        if (f < floors - 1) {                                                                                                              // stair up to the next landing
          const run = span * 0.55, rise = 3.4, len = Math.hypot(run, rise), ang = Math.atan2(rise, run), sx = u0 + 0.25 + run / 2;
          put(iron, new THREE.BoxGeometry(len, 0.04, 0.5), sx, y + rise / 2, 0.75, ang);
          put(iron, new THREE.BoxGeometry(len, 0.03, 0.03), sx, y + rise / 2 + 0.85, 1.0, ang);
        }
      }
      const ly = 5.2 - 0.95, lu = u1 - 0.45;                                                                                               // drop ladder, pulled up
      for (const s2 of [-0.2, 0.2]) put(iron, new THREE.BoxGeometry(0.035, 2.0, 0.035), lu + s2, ly - 1.0, 0.95);
      for (let k = 0; k < 7; k++) put(iron, new THREE.BoxGeometry(0.4, 0.025, 0.025), lu, ly - 0.2 - k * 0.27, 0.95);
    }
    // drainpipe down one end, with brackets and a shoe at the bottom
    if (h > 5 && rnd() < 0.8) {
      const u = (rnd() < 0.5 ? -1 : 1) * (fw / 2 - 0.25);
      put(iron, new THREE.CylinderGeometry(0.065, 0.065, h - 0.3, 8), u, (h - 0.3) / 2 + 0.3, 0.12);
      for (let y = 1.5; y < h; y += 2.2) put(iron, new THREE.BoxGeometry(0.2, 0.04, 0.16), u, y, 0.06);
      put(iron, new THREE.CylinderGeometry(0.065, 0.065, 0.35, 8), u, 0.25, 0.25, 0, Math.PI / 2.6);
      put(iron, new THREE.BoxGeometry(0.3, 0.2, 0.25), u, h - 0.1, 0.15);
    }
    // window AC units, dripping on the pavement since forever
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      if (rnd() > 0.14) continue;
      const u = colU(c), y = 5.2 + f * 3.4 - 1.05;
      put(ac, new THREE.BoxGeometry(0.72, 0.44, 0.52), u, y, 0.28);
      put(iron, new THREE.BoxGeometry(0.6, 0.32, 0.02), u, y, 0.545);
      put(iron, new THREE.BoxGeometry(0.04, 0.04, 0.5), u - 0.3, y - 0.26, 0.26); put(iron, new THREE.BoxGeometry(0.04, 0.04, 0.5), u + 0.3, y - 0.26, 0.26);
    }
    if (iron.length) { const m = new THREE.Mesh(mergeGeometries(iron), ironMat); m.castShadow = true; scene.add(m); }
    if (ac.length) { const m = new THREE.Mesh(mergeGeometries(ac), acMat2); m.castShadow = true; scene.add(m); }
  };

  // ---------------- upper windows: interior mapped, instanced
  const wins = [];
  kit.screens = 0; kit.screenAt = [];
  kit.window = (p, ry, lit) => wins.push({ p, ry, lit });
  const skies = [];
  kit.skylight = (p, ry) => skies.push({ p, ry });   // p = centre of the glass (top of the frame), long axis along x when ry = 0
  const buildSkylights = () => {
    if (!skies.length) return;
    const A = skylightAtlas(), SW = 3.0, SD = 2.0;
    const im = interiorMaterial({ back: A.back, mid: A.mid, cells: [4, 2], w: SW, h: SD, depth: 3.2, midZ: 0.3, wall: 0x6a6258, floorA: 0x6a6258, light: new THREE.Color(1.5, 1.1, 0.7), shop: false });
    kit.mats.push(im);
    const n = skies.length, IM = new THREE.InstancedMesh(new THREE.PlaneGeometry(SW, SD), im, n), room = new Float32Array(n * 4);
    let ks = 2114; const kr = () => { ks = (ks * 16807) % 2147483647; return (ks - 1) / 2147483646; };
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), qy = new THREE.Quaternion();
    skies.forEach((sk, i) => {
      qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sk.ry); Q.copy(qy).multiply(qx);
      M4.compose(sk.p, Q, S3.set(1, 1, 1)); IM.setMatrixAt(i, M4);
      const lit = kr() < 0.7;
      room.set([Math.floor(kr() * 8), lit ? 0.6 + kr() * 0.4 : 0, kr(), lit ? Math.floor(kr() * 8) : -1], i * 4);
    });
    IM.geometry.setAttribute('aRoom', new THREE.InstancedBufferAttribute(room, 4));
    IM.frustumCulled = false; scene.add(IM); kit.skylightIM = IM;
  };
  kit.finish = () => {
    buildSkylights();
    const A = apartmentAtlas(), WW = 1.15, WH = 1.6;
    const im = interiorMaterial({ back: A.back, mid: A.mid, cells: [4, 2], w: WW, h: WH, depth: 3.0, wall: 0x7a6a58, floorA: 0x5a4030, light: new THREE.Color(1.0, 0.72, 0.46), shop: false, screen: screenAtlas() });
    let sseed = 7781; const srnd = () => { sseed = (sseed * 16807) % 2147483647; return (sseed - 1) / 2147483646; };
    kit.mats.push(im);
    const n = wins.length;
    const inside = new THREE.InstancedMesh(new THREE.PlaneGeometry(WW, WH), im, n);
    const room = new Float32Array(n * 4);
    // trim: head, sill, jambs, a mullion and a transom bar in front of the glass
    const tp = [];
    const tb = (x, y, z, w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); tp.push(g); };
    tb(0, WH / 2 + 0.06, 0.05, WW + 0.3, 0.12, 0.14); tb(0, -WH / 2 - 0.04, 0.09, WW + 0.42, 0.07, 0.24);
    tb(-WW / 2 - 0.06, 0, 0.05, 0.12, WH + 0.1, 0.12); tb(WW / 2 + 0.06, 0, 0.05, 0.12, WH + 0.1, 0.12);
    const trimIM = new THREE.InstancedMesh(mergeGeometries(tp), frameMat, n);
    // mullion + transom: not on ad screens (they'd cut the picture in four)
    tp.length = 0; tb(0, 0, 0.1, 0.045, WH, 0.04); tb(0, WH * 0.18, 0.1, WW, 0.04, 0.04);
    const barIM = new THREE.InstancedMesh(mergeGeometries(tp), frameMat, n); let nb = 0;
    wins.forEach((w, i) => {
      const nn = new THREE.Vector3(Math.sin(w.ry), 0, Math.cos(w.ry));
      Q.setFromAxisAngle(UP, w.ry);
      M4.compose(w.p.clone().addScaledVector(nn, 0.03), Q, S3.set(1, 1, 1)); inside.setMatrixAt(i, M4);
      M4.compose(w.p.clone(), Q, S3.set(1, 1, 1)); trimIM.setMatrixAt(i, M4);
      const mid = rnd() < 0.55 ? Math.floor(rnd() * 3) : rnd() < 0.18 ? 3 + Math.floor(rnd() * 2) : rnd() < 0.3 ? 5 : rnd() < 0.3 ? 7 : -1;
      room.set([Math.floor(rnd() * 8), w.lit ? 0.45 + rnd() * 0.55 : 0, rnd(), mid], i * 4);
      // about one upper window in eight is an ad screen (1 in 5 of those a Census PSA)
      if (srnd() < 0.125) { const L = srnd() < 0.2 ? SCREEN_ADS.census : SCREEN_ADS.city; room.set([L[Math.floor(srnd() * L.length)], -1, srnd(), -1], i * 4); kit.screens++; if (kit.screenAt.length < 80) kit.screenAt.push([+w.p.x.toFixed(1), +w.p.y.toFixed(1), +w.p.z.toFixed(1), +w.ry.toFixed(2)]); }
      else barIM.setMatrixAt(nb++, M4);
      pane(w.p.clone().addScaledVector(nn, 0.07), w.ry, WW - 0.02, WH - 0.02, 'win');
    });
    inside.geometry.setAttribute('aRoom', new THREE.InstancedBufferAttribute(room, 4));
    inside.frustumCulled = false; trimIM.castShadow = false; trimIM.receiveShadow = true;
    barIM.count = nb; barIM.receiveShadow = true;
    scene.add(inside); scene.add(trimIM); scene.add(barIM);
    glassIM.instanceMatrix.needsUpdate = true;
    glassIM.computeBoundingSphere();
  };

  // ---------------- shards: one InstancedMesh pool with simple ballistic physics
  const SH = 700;
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.45, 0, 0.5, -0.3, 0, -0.05, 0.6, 0], 3));
  triGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  // glass, not black paper (lighting Fix 10): clear, non-metallic, with a glint that flickers per shard (dimmer at rest)
  const shardU = { uTime: { value: 0 } };
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, metalness: 0, roughness: 0.08, envMapIntensity: 2.0, side: THREE.DoubleSide, transparent: true, opacity: 0.38, depthWrite: false });
  shardMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shardU.uTime;
    sh.vertexShader = 'attribute float aGl; varying float vGl; varying float vSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGl = aGl; vSeed = float(gl_InstanceID) * 1.618;');
    sh.fragmentShader = 'uniform float uTime; varying float vGl; varying float vSeed;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float g = pow(abs(dot(normal, normalize(vec3(0.0, 0.6, 0.8)))), 24.0); totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * g * 2.2 * (0.6 + 0.4 * sin(uTime * 18.0 + vSeed)) * vGl + vec3(0.09, 0.11, 0.14) * (0.5 + 0.5 * vGl); }`);
  };
  const aGl = new THREE.InstancedBufferAttribute(new Float32Array(SH).fill(1), 1); triGeo.setAttribute('aGl', aGl);
  const shardIM = new THREE.InstancedMesh(triGeo, shardMat, SH); shardIM.frustumCulled = false; scene.add(shardIM);
  for (let i = 0; i < SH; i++) shardIM.setMatrixAt(i, Z0);
  const shards = []; let shardNext = 0;
  const E = new THREE.Euler();
  const spawnShard = (p, v, s) => {
    const i = shardNext; shardNext = (shardNext + 1) % SH;
    shards[i] = { p: p.clone(), v: v.clone(), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: new THREE.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24), s, rest: false, life: 12, sx: 0.6 + Math.random() * 0.8 }; aGl.setX(i, 1); aGl.needsUpdate = true;
  };

  // ---------------- breaking
  const decals = [];
  const crackAt = (P, at) => {
    P.cracks++; P.lastCrack = kit.time;
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), crackMat); d.renderOrder = 4;
    const off = at ? at.clone().sub(P.c) : new THREE.Vector3();
    const u = THREE.MathUtils.clamp(off.dot(P.r), -P.w / 2 + 0.3, P.w / 2 - 0.3), y = THREE.MathUtils.clamp(off.y, -P.h / 2 + 0.3, P.h / 2 - 0.3);
    d.position.copy(P.c).addScaledVector(P.r, u).addScaledVector(P.n, 0.006); d.position.y += y; d.rotation.y = P.ry; d.rotation.z = Math.random() * 6; d.scale.setScalar(0.6 + Math.random() * 0.4);
    scene.add(d); decals.push(d); (P.decals = P.decals || []).push(d);
    if (decals.length > 40) { const old = decals.shift(); scene.remove(old); }
    if (kit.sfx && kit.sfx.crack) kit.sfx.crack();
  };
  kit.shatter = (P, dir, force = 1) => {
    if (P.broken) return; P.broken = true;
    glassIM.setMatrixAt(P.i, Z0); glassIM.instanceMatrix.needsUpdate = true;
    for (const d of P.decals || []) scene.remove(d);
    const rim = remIM[P.i % 3]; if (rim.count < 200) { rim.setMatrixAt(rim.count++, P.mat); rim.instanceMatrix.needsUpdate = true; }
    const area = P.w * P.h, count = Math.min(46, Math.max(10, Math.round(area * 16)));
    const out = dir ? Math.max(-0.4, dir.dot(P.n)) : 0;
    for (let k = 0; k < count; k++) {
      const u = (Math.random() - 0.5) * P.w * 0.85, y = (Math.random() - 0.5) * P.h * 0.85;
      const p = P.c.clone().addScaledVector(P.r, u); p.y += y;
      const v = P.n.clone().multiplyScalar((0.6 + Math.random() * 2.4) * (0.5 + force * 0.5) * (out < -0.2 ? 0.5 : 1));
      if (dir) v.addScaledVector(dir, (Math.random() * 1.5) * force);
      v.x += (Math.random() - 0.5) * 1.5; v.z += (Math.random() - 0.5) * 1.5; v.y += Math.random() * 1.5 - 0.3;
      spawnShard(p, v, 0.05 + Math.random() * Math.random() * 0.28);
    }
    if (kit.sfx && kit.sfx.glass) kit.sfx.glass(area > 2 ? 1 : 0.6);
    if (kit.onShatter) kit.onShatter(P);
  };
  const near = (x, z, rad) => { const out = []; const r = Math.ceil(rad / 6) + 1, cx = Math.floor(x / 6), cz = Math.floor(z / 6); for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const l = kit.grid.get(`${cx + i},${cz + j}`); if (l) out.push(...l); } return out; };
  const _d = new THREE.Vector3();
  // something moving through space at `vel` with radius `rad`: shatter what it goes through, crack what it only knocks
  // swept: from `prev` to `p` this frame, so fast things can't tunnel past a pane between frames
  const _q = new THREE.Vector3();
  kit.hitSphere = (p, rad, vel, prev = null, speed = 0) => {
    const sp = Math.max(speed, vel.length()); if (sp < 3.5) return false;
    let hit = false;
    for (const P of near(p.x, p.z, rad + 3)) {
      if (P.broken) continue;
      const db = _d.copy(p).sub(P.c).dot(P.n), da = prev ? _q.copy(prev).sub(P.c).dot(P.n) : db;
      if (Math.min(da, db) > rad + 0.15 || (da < -rad && db < -rad)) continue;
      const t = prev && da !== db ? THREE.MathUtils.clamp((da - rad) / (da - db), 0, 1) : 1;
      _q.copy(prev || p).lerp(p, t).sub(P.c);
      if (Math.abs(_q.dot(P.r)) > P.w / 2 + rad * 0.6 || Math.abs(_q.y) > P.h / 2 + rad * 0.6) continue;
      if (vel.dot(P.n) > 1.5 && db > 0 && !prev) continue;               // moving away from it
      hit = true;
      const at = _q.clone().add(P.c);
      if (sp > 7 || P.cracks >= 1 && sp > 4.5) kit.shatter(P, vel.lengthSq() > 0.01 ? vel.clone().normalize() : P.n.clone().negate(), Math.min(2, sp / 9));
      else if (kit.time - P.lastCrack > 0.4) crackAt(P, at);
    }
    return hit;
  };
  // a segment (a bullet): first one cracks, two cracks or a heavy round shatters
  kit.hitSegment = (a, b, heavy) => {
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = a.distanceTo(b);
    for (const P of near(mx, mz, len + 1)) {
      if (P.broken) continue;
      const da = _d.copy(a).sub(P.c).dot(P.n), db = new THREE.Vector3().copy(b).sub(P.c).dot(P.n);
      if (da * db > 0) continue;
      const t = da / (da - db), q = a.clone().lerp(b, t), o = q.clone().sub(P.c);
      if (Math.abs(o.dot(P.r)) > P.w / 2 || Math.abs(o.y) > P.h / 2) continue;
      if (heavy || P.cracks >= 2) kit.shatter(P, b.clone().sub(a).normalize(), 0.8); else crackAt(P, q);
      return q;
    }
    return null;
  };
  // blast: everything within r goes, pushed away from the centre
  kit.blast = (p, r, force = 1) => {
    for (const P of near(p.x, p.z, r)) {
      if (P.broken) continue;
      const d = P.c.distanceTo(p); if (d > r) continue;
      if (d < r * 0.7) kit.shatter(P, P.c.clone().sub(p).normalize(), force * (1.4 - d / r)); else if (P.cracks === 0) crackAt(P, null);
    }
  };

  kit.update = (dt) => {
    kit.time += dt; shardU.uTime.value = kit.time;
    for (const m of kit.mats) m.uniforms.uTime.value = kit.time;
    let dirty = false;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i]; if (!s) continue;
      dirty = true;
      if (!s.rest) {
        s.v.y -= 14 * dt; s.p.addScaledVector(s.v, dt);
        s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
        if (s.p.y < 0.012) {
          s.p.y = 0.012; s.v.y *= -0.25; s.v.x *= 0.5; s.v.z *= 0.5; s.w.multiplyScalar(0.4);
          if (Math.abs(s.v.y) < 0.6) { s.rest = true; s.r.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.15; s.r.y = 0; aGl.setX(i, 0.35); aGl.needsUpdate = true; }
        }
      }
      s.life -= dt;
      const k = s.life < 2 ? Math.max(0, s.life / 2) : 1;
      E.set(s.r.x, s.r.y, s.r.z); Q.setFromEuler(E); M4.compose(s.p, Q, S3.set(s.s * s.sx * k, s.s * k, s.s * k)); shardIM.setMatrixAt(i, M4);
      if (s.life <= 0) { shards[i] = null; shardIM.setMatrixAt(i, Z0); }
    }
    if (dirty) shardIM.instanceMatrix.needsUpdate = true;
  };
  kit.glassIM = glassIM;
  return kit;
}
