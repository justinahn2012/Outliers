import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeDecals } from './ground.js';
import { G, GRP, ALL, rand } from './state.js';
import { A } from './assets.js';
import { makeFacadeKit } from './facade.js';
import { buildLandmarks } from './landmarks.js';
import { drawLedger, drawTally, ledgerFit } from './ledger.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let seed = 1337;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const cloneTex = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

export function signTexture(text, color, vertical, sub) {
  const W = vertical ? 128 : 1024, H = vertical ? 512 : 192;
  const [c, x] = canvas(W, H);
  x.fillStyle = 'rgba(6,6,12,0.92)'; x.fillRect(0, 0, W, H);
  x.strokeStyle = color; x.lineWidth = 6; x.shadowColor = color; x.shadowBlur = 18; x.strokeRect(10, 10, W - 20, H - 20);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (vertical) {
    x.font = '900 74px Inter, Arial, sans-serif';
    const ch = text.split(''); const step = (H - 60) / ch.length;
    ch.forEach((l, i) => { x.shadowBlur = 24; x.fillStyle = color; x.fillText(l, W / 2, 40 + step * (i + 0.5)); x.shadowBlur = 6; x.fillStyle = '#fff'; x.fillText(l, W / 2, 40 + step * (i + 0.5)); });
  } else {
    x.font = '900 96px Inter, Arial, sans-serif';
    x.shadowBlur = 30; x.fillStyle = color; x.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    x.shadowBlur = 8; x.fillStyle = '#fff'; x.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    if (sub) { x.font = '700 34px Inter, Arial, sans-serif'; x.shadowBlur = 12; x.fillStyle = color; x.fillText(sub, W / 2, H * 0.8); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Harrow is a tenement street, not a highway (environment.md Fix 6): double yellow, parking lanes with bay ticks, worn
// crosswalks; paint wears off in the wheel paths
function markingsTexture() {
  const W = 512, H = 1664; const [c, x] = canvas(W, H);
  const m = (v) => v * 32, WH = 'rgba(214,210,198,0.75)';
  x.fillStyle = 'rgba(196,154,58,0.75)'; x.fillRect(m(8) - 7, 0, 4, H); x.fillRect(m(8) + 3, 0, 4, H);
  x.fillStyle = WH;
  for (const lx of [2.4, 13.6]) { x.fillRect(m(lx) - 2, 0, 4, H); const dir = lx < 8 ? -1 : 1; for (let z = 1.5; z < 52; z += 6.1) x.fillRect(dir < 0 ? m(lx - 0.5) : m(lx), m(z), m(0.5), 4); }
  for (const cz of [6, 44]) for (let i = 0.6; i < 15.4; i += 1.1) x.fillRect(m(i + 0.2), m(cz), m(0.55), m(3));
  x.fillRect(m(0.5), m(9.6), m(7.3), 10); x.fillRect(m(8.2), m(43.2), m(7.3), 10);
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) {
    const px = ((i - 3) / 4) % W, xm = px / 32 - 8;
    const worn = [1.6, 3.6, 7.0].some(b => Math.abs(Math.abs(xm) - b) < 0.25) ? 0.45 : 1;
    d[i] *= (0.45 + rnd() * 0.55) * worn;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function windowTexture() {
  const [c, x] = canvas(128, 176);
  const g = x.createRadialGradient(64, 30, 4, 64, 60, 130); g.addColorStop(0, '#fff2d6'); g.addColorStop(0.45, '#c98f55'); g.addColorStop(1, '#3a2414');
  x.fillStyle = g; x.fillRect(0, 0, 128, 176);
  // blinds pulled part way
  const drop = 30 + rnd() * 70;
  for (let y = 0; y < drop; y += 6) { x.fillStyle = 'rgba(40,26,14,0.55)'; x.fillRect(0, y, 128, 3.5); }
  // furniture silhouettes and a plant
  x.fillStyle = 'rgba(20,12,6,0.85)'; x.fillRect(10, 130, 54, 46); x.fillRect(80, 118, 30, 58);
  x.beginPath(); x.ellipse(98, 108, 16, 20, 0, 0, Math.PI * 2); x.fill();
  // mullion
  x.fillStyle = '#120c08'; x.fillRect(62, 0, 4, 176); x.fillRect(0, 86, 128, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function storeTexture() {
  const [c, x] = canvas(512, 192);
  const g = x.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, '#fff6e0'); g.addColorStop(0.5, '#b88a5a'); g.addColorStop(1, '#2a1a10');
  x.fillStyle = g; x.fillRect(0, 0, 512, 192);
  for (let s = 0; s < 4; s++) { x.fillStyle = 'rgba(30,18,10,0.8)'; x.fillRect(0, 50 + s * 34, 512, 5); for (let k = 0; k < 40; k++) { x.fillStyle = `hsla(${rnd() * 360},45%,${30 + rnd() * 30}%,0.9)`; x.fillRect(rnd() * 500, 32 + s * 34, 6 + rnd() * 10, 16 + rnd() * 4); } }
  x.fillStyle = 'rgba(10,8,6,0.9)'; x.fillRect(380, 30, 70, 162);
  x.fillStyle = '#16100a'; for (let k = 0; k <= 4; k++) x.fillRect(k * 128 - 3, 0, 6, 192); x.fillRect(0, 0, 512, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// world-space puddle mask (R = standing water), 40 x 40 m tiled (environment.md Fix 2): compound puddles + wheel ruts.
// Gutters are a uniform per floor now, not baked in.
function puddleTexture() {
  const S = 512, PX = S / 40; const [c, x] = canvas(S, S);
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  seed = 99;
  const wrap = (draw) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.save(); x.translate(ox, oy); draw(); x.restore(); } };
  x.filter = 'blur(2px)'; x.fillStyle = '#fff';
  for (let i = 0; i < 18; i++) {
    const cx = rnd() * S, cy = rnd() * S, parts = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < parts; k++) {
      const r = (0.4 + rnd() * 1.2) * PX, px = cx + (rnd() - 0.5) * 2.2 * PX, py = cy + (rnd() - 0.5) * 2.2 * PX, pts = [];
      for (let v = 0; v < 14; v++) { const a = v / 14 * Math.PI * 2, rr = r * (0.75 + rnd() * 0.5); pts.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr]); }
      wrap(() => { x.beginPath(); pts.forEach(([a, b], j) => j ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); });
    }
  }
  for (let i = 0; i < 10; i++) {
    const cx = rnd() * S, cy = rnd() * S, len = (2 + rnd() * 4) * PX, w = 0.45 * PX;
    for (const off of [-0.9, 0.9]) wrap(() => { x.beginPath(); x.roundRect(cx + off * PX - w / 2, cy - len / 2, w, len, w / 2); x.fill(); });
  }
  x.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// 30 soft blotches (0.8-1.1 once remapped), tiled every 23 m, multiplied into every floor's colour and roughness
function macroTexture() {
  const S = 256; const [c, x] = canvas(S, S); x.fillStyle = 'rgb(170,170,170)'; x.fillRect(0, 0, S, S);
  let q = 23; const r = () => { q = (q * 16807) % 2147483647; return (q - 1) / 2147483646; };
  for (let i = 0; i < 30; i++) { const px = r() * S, py = r() * S, rad = 20 + r() * 50, v = Math.round(r() * 255);
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rad); g.addColorStop(0, `rgba(${v},${v},${v},0.6)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = g; x.fillRect(px + ox - rad, py + oy - rad, rad * 2, rad * 2); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// sodium-lit cloud base: only the reflection camera sees it (layer 1), so puddles mirror a lit sky instead of black
function cloudTexture() {
  const S = 256; const [c, x] = canvas(S, S); x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 180; i++) {
    const px = rnd() * S, py = rnd() * S, r = 10 + rnd() * 30;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- planar reflection for the wet street ----------
export class Wet {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 0 });
    this.cam = new THREE.PerspectiveCamera();
    this.texMatrix = new THREE.Matrix4();
    this.enabled = true;
    this.uniforms = { tRefl: { value: this.rt.texture }, uTexMatrix: { value: this.texMatrix }, tPuddle: { value: puddleTexture() }, tMacro: { value: macroTexture() }, uTime: { value: 0 }, uWet: { value: 1 }, uReflOn: { value: 1 } };
    this.hide = [];
    this.cam.layers.enable(1);
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
      fog: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { tCloud: { value: cloudTexture() }, uT: { value: 0 }, uC: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform sampler2D tCloud; uniform float uT; uniform vec2 uC; varying vec3 vW;
        void main(){ float cl = texture2D(tCloud, (vW.xz + vec2(uT * 0.5, 0.0)) / 60.0).r;
          vec3 c = mix(vec3(0.2, 0.14, 0.105), vec3(0.045, 0.05, 0.075), smoothstep(0.0, 180.0, length(vW.xz - uC))) * (0.65 + 0.7 * cl);
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    this.sky.layers.set(1); this.sky.frustumCulled = false; this.sky.renderOrder = -10;
  }
  resize(w, h) { this.rt.setSize(Math.max(64, Math.floor(w * 0.5)), Math.max(64, Math.floor(h * 0.5))); }
  // derived from three's Reflector: mirror the camera about y=0 with an oblique near plane
  render(renderer, scene, camera) {
    if (!this.enabled) { this.uniforms.uReflOn.value = 0; return; }
    this.uniforms.uReflOn.value = 1;
    const mc = this.cam; const n = _n.set(0, 1, 0);
    _rp.set(0, 0, 0); _cp.setFromMatrixPosition(camera.matrixWorld);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_cp);
    _view.subVectors(_rp, _cp); _view.reflect(n).negate(); _view.add(_rp);
    _look.subVectors(_rp, _look); _look.reflect(n).negate(); _look.add(_rp);
    mc.position.copy(_view); mc.up.set(0, 1, 0).applyMatrix4(_rot).reflect(n);
    mc.lookAt(_look); mc.far = camera.far; mc.near = camera.near; mc.fov = camera.fov; mc.aspect = camera.aspect;
    mc.updateMatrixWorld(); mc.projectionMatrix.copy(camera.projectionMatrix);
    this.texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMatrix.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    // oblique clip plane
    _plane.setFromNormalAndCoplanarPoint(n, _rp).applyMatrix4(mc.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = mc.projectionMatrix;
    _q4.x = (Math.sign(_clip.x) + pm.elements[8]) / pm.elements[0];
    _q4.y = (Math.sign(_clip.y) + pm.elements[9]) / pm.elements[5];
    _q4.z = -1; _q4.w = (1 + pm.elements[10]) / pm.elements[14];
    _clip.multiplyScalar(2 / _clip.dot(_q4));
    pm.elements[2] = _clip.x; pm.elements[6] = _clip.y; pm.elements[10] = _clip.z + 1 - 0.003; pm.elements[14] = _clip.w;
    if (!this.sky.parent) scene.add(this.sky);
    this.sky.position.set(_cp.x, 40, _cp.z); this.sky.material.uniforms.uC.value.set(_cp.x, _cp.z); this.sky.material.uniforms.uT.value = this.uniforms.uTime.value;
    const vis = this.hide.map(o => o.visible); this.hide.forEach(o => (o.visible = false));
    const sAuto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    const fog = scene.fog;
    const prevRT = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, mc);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = sAuto; scene.fog = fog;
    this.hide.forEach((o, i) => (o.visible = vis[i]));
  }
  // inject wetness + reflection into a MeshStandardMaterial
  patch(mat, { reflect = 1, puddles = 1, area = [-15, -30, 40, 40], gut = [0, 0, 0.3, 0] } = {}) {
    const U = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.uniforms.uArea = { value: new THREE.Vector4(...area) }; sh.uniforms.uGut = { value: new THREE.Vector4(...gut) };
      sh.uniforms.uReflect = { value: reflect }; sh.uniforms.uPud = { value: puddles };
      sh.vertexShader = 'uniform mat4 uTexMatrix; varying vec4 vRefl; varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = modelMatrix * vec4(transformed, 1.0); vWPos = wp4.xyz; vRefl = uTexMatrix * wp4;`);
      sh.fragmentShader = `uniform sampler2D tRefl; uniform sampler2D tPuddle; uniform sampler2D tMacro; uniform float uTime; uniform float uWet; uniform float uReflOn; uniform vec4 uArea; uniform float uReflect; uniform float uPud; uniform vec4 uGut;
        varying vec4 vRefl; varying vec3 vWPos; float gPud;
      ` + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 puv = (vWPos.xz - uArea.xy) / uArea.zw;
          float macro = texture2D(tMacro, vWPos.xz / 23.0).r * 0.3 + 0.8;   // breaks the 2-3 m tile repeat (Fix 6)
          diffuseColor.rgb *= macro;
          float pm = texture2D(tPuddle, puv).r * uPud;
          gPud = smoothstep(0.5, 0.85, pm) * uWet;
          gPud = max(gPud, 0.9 * uGut.w * uWet * (1.0 - smoothstep(0.0, uGut.z, min(abs(vWPos.x - uGut.x), abs(vWPos.x - uGut.y)))));
          diffuseColor.rgb *= mix(0.8, 0.7, gPud);
          float soak = smoothstep(0.3, 0.5, pm) * (1.0 - smoothstep(0.5, 0.62, pm));   // a dark soaked rim: a crisp edge from above
          diffuseColor.rgb *= 1.0 - 0.2 * soak * uWet;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor * mix(1.0, 0.62, uWet) * macro, 0.05, gPud);`)
        .replace('#include <opaque_fragment>', `
          // the rain never ripples the water (STORY.md: RAIN = SAFE, it's a replay): still mirrors under falling rain
          vec4 rc = vRefl; rc.xy += normal.xy * 0.12 * (1.0 - gPud) * rc.w;
          // no reflection pass (phones that can't afford it): puddles still mirror the sodium cloud base, as a flat tone
          vec3 refl = uReflOn > 0.5 ? texture2DProj(tRefl, rc).rgb : vec3(0.11, 0.08, 0.065);
          float ndv = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
          refl += vec3(0.020, 0.026, 0.030) * 2.2 * (0.7 + 0.3 * fres) * (1.0 - smoothstep(0.0, 0.05, dot(refl, vec3(0.333))));
          float rAmt = mix(0.06 * uReflOn, 0.9, gPud) * uWet * uReflect;
          outgoingLight = outgoingLight * (1.0 - rAmt * 0.5) + refl * rAmt * mix(0.45, 1.0, fres);
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'wet3' + reflect + puddles;
  }
}
const _n = new THREE.Vector3(), _rp = new THREE.Vector3(), _cp = new THREE.Vector3(), _rot = new THREE.Matrix4(), _look = new THREE.Vector3(), _view = new THREE.Vector3();
const _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q4 = new THREE.Vector4();

// A night sky built in code (art panel, lighting fix 1): a near-black zenith, a dim sodium horizon band and a few
// coloured glints for wet surfaces to catch. The old skyline HDRI lit every street evenly like dusk.
export function buildEnvironment(renderer, scene) {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; void main(){ float y = vD.y;
      vec3 zen = vec3(0.010, 0.016, 0.020), hor = vec3(0.060, 0.045, 0.035), low = vec3(0.006, 0.007, 0.008);
      vec3 c = y > 0.0 ? mix(hor, zen, smoothstep(0.08, 0.5, y)) : mix(hor, low, smoothstep(0.0, -0.08, y));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  env.add(sky);
  const glints = [[3.0, 1.9, 0.9], [3.0, 1.9, 0.9], [3.0, 1.9, 0.9], [3.0, 1.9, 0.9], [2.4, 0.3, 1.0], [2.4, 0.3, 1.0], [0.3, 2.0, 2.6], [0.3, 2.0, 2.6], [1.6, 1.8, 2.0], [1.6, 1.8, 2.0]];
  glints.forEach((c, i) => {
    const a = i / glints.length * Math.PI * 2 + 0.3, el = (5 + (i * 37 % 10)) * Math.PI / 180;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(6, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.DoubleSide }));
    q.position.set(Math.cos(a) * Math.cos(el) * 45, Math.sin(el) * 45, Math.sin(a) * Math.cos(el) * 45); q.lookAt(0, 0, 0); env.add(q);
  });
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 1.0;
  pm.dispose();
}

function pbr(prefix, rx, ry, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map: cloneTex(A.tex[prefix + '_d'], rx, ry), normalMap: cloneTex(A.tex[prefix + '_n'], rx, ry),
    roughnessMap: cloneTex(A.tex[prefix + '_arm'], rx, ry), aoMap: null, metalnessMap: null, roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(1, 1), ...extra,
  });
}

// bare street tree (environment.md Fix 10): trunk, 4 branches, 3 secondaries each, 3 tertiaries each (~530 tris)
function treeGeometry() {
  let q = 4242; const r = () => { q = (q * 16807) % 2147483647; return (q - 1) / 2147483646; };
  const gs = [], up = new THREE.Vector3(0, 1, 0);
  const limb = (a, dir, len, r0) => {
    const g = new THREE.CylinderGeometry(r0 * 0.55, r0, len, 5, 1, true); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)); g.translate(a.x, a.y, a.z); gs.push(g);
    return a.clone().addScaledVector(dir, len);
  };
  const tip = limb(new THREE.Vector3(), up.clone(), 2.4, 0.12);
  for (let i = 0; i < 4; i++) {
    const az = i / 4 * Math.PI * 2 + r() * 0.6, pitch = (35 + r() * 20) * Math.PI / 180;
    const d1 = new THREE.Vector3(Math.sin(pitch) * Math.cos(az), Math.cos(pitch), Math.sin(pitch) * Math.sin(az));
    const b1 = limb(tip.clone().addScaledVector(up, -0.2 - r() * 0.3), d1, 1.6, 0.06);
    for (let j = 0; j < 3; j++) {
      const d2 = d1.clone().add(new THREE.Vector3((r() - 0.5) * 1.2, (r() - 0.2) * 0.8, (r() - 0.5) * 1.2)).normalize();
      const b2 = limb(tip.clone().lerp(b1, 0.5 + j * 0.2), d2, 0.9, 0.03);
      for (let k = 0; k < 3; k++) { const d3 = d2.clone().add(new THREE.Vector3((r() - 0.5) * 1.4, (r() - 0.3), (r() - 0.5) * 1.4)).normalize(); limb(b1.clone().lerp(b2, 0.4 + k * 0.25).lerp(b2, 0.3), d3, 0.5, 0.015); }
    }
  }
  const g = mergeGeometries(gs.map(x => x.index ? x.toNonIndexed() : x)); g.computeVertexNormals(); return g;
}

// ---------- level ----------
export function buildLevel(scene, world, wet) {
  const L = { lights: [], update: null, lampHeads: [], gates: [], vents: [], spots: [], fades: [], roofs: [], lampPosts: [], noBatch: [], trees: [] };
  // Every lamp, neon and lantern registers a light "spot"; only the POOL nearest the camera get a real
  // point light each frame, so the shader cost stays flat however big the world gets.
  const spots = L.spots;
  // all practicals use physical decay 2 now; old decay-1.6 intensities are scaled to land in the same place at ~3 m
  const addSpot = (x, y, z, color, intensity, distance, decay = 1.6, flick = 0) => { const s = { p: new THREE.Vector3(x, y, z), c: new THREE.Color(color), i: intensity * (decay < 2 ? 1.7 : 1), d: distance, decay: 2, flick, k: 1 }; spots.push(s); return s; };
  L.addSpot = addSpot;
  const POOL = [];
  for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.userData.sp = null; l.userData.w = 0; scene.add(l); POOL.push(l); }
  const groundMat = new CANNON.Material('ground');
  G.groundMat = groundMat;
  const ground = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.GROUND, collisionFilterMask: ALL });
  ground.addShape(new CANNON.Box(new CANNON.Vec3(70, 0.5, 58.5)), new CANNON.Vec3(25, -0.5, -33.9));      // x -45..95, z 24.6 .. -92.4
  ground.addShape(new CANNON.Box(new CANNON.Vec3(32.7, 0.5, 21.8)), new CANNON.Vec3(47.3, -0.5, -114.2)); // container yard + shed: x 14.6..80, z -92.4..-136
  ground.addShape(new CANNON.Box(new CANNON.Vec3(20.7, 0.5, 8)), new CANNON.Vec3(-41.3, -0.5, -112));     // ferry pier: x -62..-20.6, z -120..-104
  ground.addShape(new CANNON.Box(new CANNON.Vec3(17.6, 0.5, 19.1)), new CANNON.Vec3(-3.0, -0.5, -111.5)); // Pier 9 docks: x -20.6..14.6, z -92.4..-130.6
  world.addBody(ground); G.groundBody = ground;
  const wall = (cx, cy, cz, hx, hy, hz) => {
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(cx, cy, cz); world.addBody(b); return b;
  };
  wall(-13.6, 15, -5, 1, 15, 30); wall(13.6, 15, 9.25, 1, 15, 15.75); wall(13.6, 15, -23.75, 1, 15, 11.25);
  wall(-11.8, 15, -27.4, 4.2, 15, 1); wall(11.8, 15, -27.4, 4.2, 15, 1);
  wall(0, 0.48, 24.85, 14, 0.48, 0.22);

  // Wet asphalt with real-time reflections, puddles and rain ripples
  const street = new THREE.Mesh(new THREE.PlaneGeometry(17, 52), pbr('asphalt_02', 17 / 3.2, 52 / 3.2, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0 }));
  wet.patch(street.material, { reflect: 1, puddles: 1, gut: [-8.3, 8.3, 0.35, 1] });
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -1); street.receiveShadow = true; scene.add(street);
  wet.hide.push(street);
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(16, 52), new THREE.MeshStandardMaterial({ map: markingsTexture(), transparent: true, roughness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  marks.rotation.x = -Math.PI / 2; marks.position.set(0, 0.004, -1); marks.receiveShadow = true; scene.add(marks); wet.hide.push(marks);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(6, 52), pbr('concrete_pavement', 6 / 1.8, 52 / 1.8, { color: new THREE.Color(0.82, 0.8, 0.78) }));
    wet.patch(sw.material, { reflect: 0.55, puddles: 0.35 });
    sw.rotation.x = -Math.PI / 2; sw.position.set(sx * 11.5, 0.002, -1); sw.receiveShadow = true; scene.add(sw); wet.hide.push(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 52), pbr('concrete_wall_008', 0.2, 18));
    curb.position.set(sx * 8.56, 0.0, -1); curb.receiveShadow = true; scene.add(curb);
    const pan = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 52), pbr('concrete_wall_008', 0.2, 20, { color: new THREE.Color(0.55, 0.55, 0.55), roughness: 0.3 }));   // gutter pan
    pan.rotation.x = -Math.PI / 2; pan.position.set(sx * 8.21, 0.003, -1); pan.receiveShadow = true; scene.add(pan);
  }
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 1 }));
  fill.rotation.x = -Math.PI / 2; fill.position.set(0, -0.02, -20); scene.add(fill); wet.hide.push(fill);

  // Brick facades with real glass windows (instanced), storefronts and rooftop clutter
  // facades: mostly soot-dark brick, with red brick, industrial brick and painted render mixed in (seeded, so the city is stable)
  const PAINT = [[0.55, 0.62, 0.6], [0.72, 0.62, 0.48], [0.5, 0.52, 0.6], [0.66, 0.5, 0.47], [0.6, 0.6, 0.58]];
  // facades fall off with height (lighting_vfx.md Fix 6): staticBatch bakes userData.falloff into vertex colours, so the
  // street stays the brightest band, upper floors go dark and lit windows pop
  const brick = (w, h, rot) => {
    const r = rnd(); let m, tile;
    if (r < 0.42) m = pbr('dark_brick_wall', w / (tile = 2.6), h / 2.6);
    else if (r < 0.62) m = pbr('red_brick', w / (tile = 2.2), h / 2.2, { color: new THREE.Color(0.62, 0.55, 0.52) });
    else if (r < 0.82) m = pbr('factory_brick', w / (tile = 2.4), h / 2.4, { color: new THREE.Color(0.8, 0.76, 0.72) });
    else { const c = PAINT[Math.floor(rnd() * PAINT.length)]; m = pbr('plaster_wall', w / (tile = 3.2), h / 3.2, { color: new THREE.Color(c[0], c[1], c[2]) }); }
    m.userData.falloff = true; m.userData.tile = tile; return m;
  };
  // side and back faces use the building's own wall (environment.md Fix 10), re-tiled for that face's width; no rng draw
  const wallFor = (m, fw, h) => { const c = m.clone(); const t = m.userData.tile || 2.6; for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) c[k] = cloneTex(m[k], fw / t, h / t); return c; };
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.95 });
  const kit = makeFacadeKit(scene, { rnd, signTexture });

  // ---- roofs: tar surface (tiled by world size), a parapet, and real rooftop kit instead of one stretched slab ----
  const roofTex = (() => {
    const [c, x] = canvas(256, 256);
    x.fillStyle = '#3b3c40'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = 40 + Math.random() * 40 | 0; x.fillStyle = `rgba(${v},${v},${v + 3},0.55)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    x.strokeStyle = 'rgba(12,12,14,0.8)'; x.lineWidth = 3; for (let k = 0; k <= 256; k += 128) { x.beginPath(); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(70,72,78,0.18)'; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 40, 10 + Math.random() * 20, Math.random() * 3, 0, 6.28); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  // roofs are dark glossy foreground silhouettes, clearly not floor (lighting Fix 6)
  const tarMat = new THREE.MeshStandardMaterial({ map: cloneTex(A.tex.tarred_gravel_d, 1, 1), normalMap: cloneTex(A.tex.tarred_gravel_n, 1, 1), roughnessMap: cloneTex(A.tex.tarred_gravel_arm, 1, 1), color: new THREE.Color(0.46, 0.46, 0.48), roughness: 0.4, metalness: 0.05, envMapIntensity: 0.6 });
  const parapetMat = pbr('concrete_wall_008', 1, 1, { color: new THREE.Color(0.5, 0.49, 0.47) }); parapetMat.roughness = 0.35;
  // roof dressing shares one look (colour goes into the batch's vertex colours), so it costs one draw per cell
  const dressMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.3, side: THREE.DoubleSide });
  const flashMat = dressMat(0x2a2b2e), doorMat = dressMat(0x1a1b1e), bulbMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffd9a0, emissiveIntensity: 2.5 });
  const dishMat = dressMat(0xb8b8b0), potMat = dressMat(0x6a3a2a), leafMat = dressMat(0x1e3a22), poleMat = dressMat(0x2a2c30);
  const clothMats = [0x8a2a2a, 0x2a4a6a, 0xd8d2c0, 0x3a5a3a, 0x6a5a2a].map(dressMat);
  // Census beacons on one roof in three: the authority's amber on the skyline (one Points draw, blink in the shader)
  const beaconPts = [], beaconPh = [];
  L.finishBeacons = () => {
    if (!beaconPts.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(beaconPts, 3)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(beaconPh, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, tHalo: { value: haloTex } },
      vertexShader: 'attribute float aPh; uniform float uT; varying float vOn; void main(){ vOn = step(fract(uT / 1.4 + aPh), 0.1286); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.5 * 1.4 * 900.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D tHalo; varying float vOn; void main(){ if (vOn < 0.5) discard; float a = texture2D(tHalo, gl_PointCoord).r; gl_FragColor = vec4(vec3(3.0, 1.4, 0.3) * a, 1.0); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9; scene.add(pts); L.beaconMat = m;
  };
  // one blinking red LED on a condenser of every big roof: rooftop interest without a pool light (one instanced draw)
  const roofLed = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.42, 0.26), toneMapped: false }), 160);
  roofLed.count = 0; roofLed.frustumCulled = false; scene.add(roofLed); L.roofLed = roofLed;
  const _lm = new THREE.Matrix4();
  const acMat = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.45, metalness: 0.7 }), grilleMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.7, metalness: 0.5 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5d6166, roughness: 0.5, metalness: 0.75 }), tankMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.85 });
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.1, metalness: 0.8, envMapIntensity: 1.4 }), skyLit = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffc890, emissiveIntensity: 0.55, roughness: 0.2 });
  const scaleUV = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
  const roofTop = (x0, x1, z0, z1, h, wallMat, nSky = 0) => {
    L.roofs.push({ x0, x1, z0, z1, h });
    // new roof dressing draws from its own hash so the city's seeded layout downstream stays put
    let rs = Math.abs(Math.sin(x0 * 12.9898 + z0 * 78.233 + h * 3.17)) * 1e6 | 0; const rh = () => { rs = (rs * 16807 + 11) % 2147483647; return rs / 2147483647; };
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const top = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(w, d), w / 2.2, d / 2.2), tarMat); top.rotation.x = -Math.PI / 2; top.position.set(cx, h + 0.015, cz); top.receiveShadow = true; scene.add(top);
    const T = 0.28, PH = 0.75;
    for (const [px, pz, sx, sz] of [[cx, z0 + T / 2 - 0.12, w + 0.24, T], [cx, z1 - T / 2 + 0.12, w + 0.24, T], [x0 + T / 2 - 0.12, cz, T, d], [x1 - T / 2 + 0.12, cz, T, d]]) {
      const len = Math.max(sx, sz), g = scaleUV(new THREE.BoxGeometry(sx, PH, sz), len / 3, PH / 3);
      const m = new THREE.Mesh(g, parapetMat); m.position.set(px, h + PH / 2, pz); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(sx === len ? len + 0.34 : 0.42, 0.05, sz === len ? len + 0.34 : 0.42), flashMat); cap.position.set(px, h + PH + 0.025, pz); scene.add(cap);
    }
    const area = w * d, inner = (k) => [x0 + 1.4 + rnd() * Math.max(0.1, w - 2.8), z0 + 1.4 + rnd() * Math.max(0.1, d - 2.8)];
    for (let k = 0; k < Math.min(4, 1 + Math.floor(area / 90)); k++) {            // condenser units with a fan grille
      const [ax, az] = inner(); const s = 0.9 + rnd() * 0.6, ry = rnd() < 0.5 ? 0 : Math.PI / 2;
      const u = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, s * 0.75, s), acMat); u.position.set(ax, h + s * 0.375, az); u.rotation.y = ry; u.castShadow = true; scene.add(u);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.32, s * 0.32, 0.03, 16), grilleMat); fan.position.set(ax, h + s * 0.76, az); scene.add(fan);
      if (k === 0 && area >= 110 && roofLed.count < 160) { _lm.makeTranslation(ax + s * 0.5 * (ry ? 0 : 1), h + s * 0.78, az + s * 0.4 * (ry ? 1 : 0)); roofLed.setMatrixAt(roofLed.count++, _lm); }
    }
    for (let k = 0; k < 2 + Math.floor(area / 160); k++) {                          // vent stacks
      const [vx, vz] = inner(); const ph = 0.6 + rnd() * 0.9;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, ph, 8), pipeMat); p.position.set(vx, h + ph / 2, vz); scene.add(p);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.1, 8), pipeMat); cap.position.set(vx, h + ph + 0.05, vz); scene.add(cap);
    }
    { const [hx, hz] = inner();
      if (area >= 60 && w > 4 && d > 4.4) {                                          // stair bulkhead with a door and a caged light
        const bx = THREE.MathUtils.clamp(hx, x0 + 1.5, x1 - 1.5), bz = THREE.MathUtils.clamp(hz, z0 + 1.7, z1 - 1.7);
        const bh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.6), wallMat || parapetMat); bh.position.set(bx, h + 1.2, bz); bh.castShadow = true; scene.add(bh);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.04), doorMat); door.position.set(bx, h + 1.0, bz + 1.31); scene.add(door);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.1), bulbMat); lamp.position.set(bx, h + 2.15, bz + 1.36); scene.add(lamp);
      } else { const hb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), grilleMat); hb.position.set(hx, h + 0.25, hz); scene.add(hb); }
    }
    const spot = () => [x0 + 1.2 + rh() * Math.max(0.1, w - 2.4), z0 + 1.2 + rh() * Math.max(0.1, d - 2.4)];
    if (area > 40 && rh() < 0.4) {                                                   // satellite dish on an arm, facing south-southwest
      const [sx3, sz3] = spot(), yaw = (200 + rh() * 20) * Math.PI / 180;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5, 1, true), poleMat); arm.position.set(sx3, h + 0.3, sz3); scene.add(arm);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 3, 0, Math.PI * 2, 0, 0.9), dishMat); dish.position.set(sx3, h + 0.65, sz3); dish.rotation.set(-1.1, yaw, 0, 'YXZ'); scene.add(dish);
    }
    if (area > 40 && rh() < 0.25) {                                                  // three plant pots
      const [px3, pz3] = spot();
      for (let k = 0; k < 3; k++) { const ox = (k - 1) * 0.6, pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.35, 8, 1, true), potMat); pot.position.set(px3 + ox, h + 0.175, pz3); scene.add(pot);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), leafMat); leaf.scale.set(1, 0.7 + rh() * 0.5, 1); leaf.position.set(px3 + ox, h + 0.5, pz3); scene.add(leaf); }
    }
    if (area > 70 && w > 4 && rh() < 0.25) {                                         // laundry: two poles, three lines, cloth
      const [lx3, lz3] = spot(), L2 = Math.min(3.2, w - 2.4), ax = THREE.MathUtils.clamp(lx3, x0 + 1.2, x1 - 1.2 - L2);
      for (const e of [0, L2]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5, 1, true), poleMat); pole.position.set(ax + e, h + 0.9, lz3); scene.add(pole); }
      for (let k = 0; k < 3; k++) {
        const lz = lz3 + (k - 1) * 0.35, line = new THREE.Mesh(new THREE.BoxGeometry(L2, 0.012, 0.012), poleMat); line.position.set(ax + L2 / 2, h + 1.75, lz); scene.add(line);
        for (let c = 0; c < 3; c++) if (rh() < 0.75) { const cw = 0.4 + rh() * 0.4, ch = 0.4 + rh() * 0.5, cl = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), clothMats[Math.floor(rh() * clothMats.length)]); cl.position.set(ax + 0.4 + c * (L2 - 0.8) / 2, h + 1.75 - ch / 2, lz); cl.rotation.x = -0.25; scene.add(cl); }
      }
    }
    if (rh() < 0.34) {                                                               // Census beacon pole
      const [cx3, cz3] = spot(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 5, 1, true), poleMat); pole.position.set(cx3, h + 1.25, cz3); scene.add(pole);
      beaconPts.push(cx3, h + 2.55, cz3); beaconPh.push(rh());
    }
    // skylights look down into the room below (interior-mapped, environment.md Fix 8): a row of three on the lowered
    // lane-side roofs, one on every other big roof
    const skylight = (sx, sz, ry) => { const fr = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 2.2), doorMat); fr.position.set(sx, h + 0.15, sz); fr.rotation.y = ry; scene.add(fr); kit.skylight(new THREE.Vector3(sx, h + 0.305, sz), ry); };
    if (nSky) { const along = w >= d, n = nSky, L3 = along ? w : d, step = Math.min(4.7, (L3 - 2) / n); for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * step; along ? skylight(cx + o, cz, 0) : skylight(cx, cz + o, Math.PI / 2); } }
    if (area > 110 && rnd() < 0.6) {
      const [sx2, sz2] = inner(); rnd(); rnd(); rnd();   // (keep the seeded sequence the old skylight used)
      if (!nSky && (L.roofs.length % 2 === 0) && w > 4 && d > 3) skylight(THREE.MathUtils.clamp(sx2, x0 + 2, x1 - 2), THREE.MathUtils.clamp(sz2, z0 + 1.5, z1 - 1.5), 0);
    }
    if (area > 200 && rnd() < 0.5) {                                                 // old timber water tank on legs
      const [tx, tz] = inner();
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 1.8, 14), tankMat); tk.position.set(tx, h + 1.9, tz); tk.castShadow = true; scene.add(tk);
      const lid = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.6, 14), tankMat); lid.position.set(tx, h + 3.1, tz); scene.add(lid);
      for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), pipeMat); leg.position.set(tx + lx, h + 0.5, tz + lz); scene.add(leg); }
    }
  };
  const bldg = (x0, x1, z0, z1, h, axis) => {
    const w = x1 - x0, d = z1 - z0;
    const faceW = axis === 'x' ? d : w;
    const face = brick(faceW, h);
    const sideX = wallFor(face, d, h), sideZ = wallFor(face, w, h);
    const mats = axis === 'x'
      ? [x1 < 0 ? face : sideX, x1 < 0 ? sideX : face, roofMat, roofMat, sideZ, sideZ]
      : [sideX, sideX, roofMat, roofMat, face, sideZ];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.ceil(h / 2.5)), 1), mats);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    // windows on the street face
    const fx = axis === 'x' ? (x1 < 0 ? x1 + 0.02 : x0 - 0.02) : 0;
    const fz = axis === 'z' ? z1 + 0.02 : 0;
    const ry = axis === 'x' ? (x1 < 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    const cols = Math.floor(faceW / 2.6), floors = Math.floor((h - 4.2) / 3.4);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols * faceW - faceW / 2, y = 5.2 + f * 3.4;
      const p = axis === 'x' ? new THREE.Vector3(fx, y, (z0 + z1) / 2 + u) : new THREE.Vector3((x0 + x1) / 2 + u, y, fz);
      kit.window(p, ry, rnd() < 0.38);
    }
    kit.dress(axis === 'x' ? fx : (x0 + x1) / 2, axis === 'x' ? (z0 + z1) / 2 : fz, ry, faceW, h, floors, cols);
    // ground floor: a real shopfront with a room behind the glass
    const sw = Math.min(faceW - 2, 7);
    kit.storefront(axis === 'x' ? fx : (x0 + x1) / 2, axis === 'x' ? (z0 + z1) / 2 + (rnd() - 0.5) * 2 : fz, ry, sw);
    roofTop(x0, x1, z0, z1, h, face);
  };
  const block = (x0, x1, z0, z1, h, faces, opts = {}) => {
    const w = x1 - x0, d = z1 - z0;
    const mats = [roofMat, roofMat, roofMat, roofMat, roofMat, roofMat];
    const idx = { '+x': 0, '-x': 1, '+z': 4, '-z': 5 };
    for (const f of faces) mats[idx[f]] = brick(f[1] === 'x' ? d : w, h);
    { const own = mats[idx[faces[0]]]; if (own && own !== roofMat) for (const [k, fw] of [[0, d], [1, d], [4, w], [5, w]]) if (mats[k] === roofMat) mats[k] = wallFor(own, fw, h); }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.ceil(h / 2.5)), 1), mats);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    if (opts.collide !== false) wall((x0 + x1) / 2, h / 2, (z0 + z1) / 2, w / 2, h / 2, d / 2);
    for (const f of faces) {
      const alongZ = f[1] === 'x', fw = alongZ ? d : w, pos = f[0] === '+';
      const fx = alongZ ? (pos ? x1 + 0.02 : x0 - 0.02) : 0, fz = !alongZ ? (pos ? z1 + 0.02 : z0 - 0.02) : 0;
      const ry = f === '+x' ? Math.PI / 2 : f === '-x' ? -Math.PI / 2 : f === '+z' ? 0 : Math.PI;
      const cols = Math.floor(fw / 2.6), floors = Math.floor((h - 4.2) / 3.4);
      for (let fl = 0; fl < floors; fl++) for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols * fw - fw / 2, y = 5.2 + fl * 3.4;
        const p = alongZ ? new THREE.Vector3(fx, y, (z0 + z1) / 2 + u) : new THREE.Vector3((x0 + x1) / 2 + u, y, fz);
        const lit = rnd() < (opts.lit ?? 0.38);
        if (!(opts.skipWin && opts.skipWin(p))) kit.window(p, ry, lit);
      }
      if (!opts.bare) kit.dress(alongZ ? fx : (x0 + x1) / 2, alongZ ? (z0 + z1) / 2 : fz, ry, fw, h, floors, cols);
      if (opts.noStore && opts.noStore.includes(f)) continue;
      const sw = Math.min(fw - 2, opts.storeW || 7);
      if (sw < 2) continue;
      const off = (opts.storeOff && opts.storeOff[f]) || (rnd() - 0.5) * 2;
      kit.storefront(alongZ ? fx : (x0 + x1) / 2 + off, alongZ ? (z0 + z1) / 2 + off : fz, ry, sw, { kind: opts.shop && opts.shop[f], closed: opts.closed && opts.closed.includes(f) });
    }
    roofTop(x0, x1, z0, z1, h, mats.find(q => q !== roofMat), opts.skylights || 0);
  };
  seed = 4242;
  [[-27, -17.5, 15], [-15.5, -3.5, 11], [-1.5, 11, 17], [13, 25, 10]].forEach(([z0, z1, h]) => bldg(-28, -12.7, z0, z1, h, 'x'));
  [[-27, -12.5, 13], [3, 14, 12], [16, 25, 9]].forEach(([z0, z1, h]) => bldg(12.7, 28, z0, z1, h, 'x'));
  // six bare street trees in grated pits along the kerbs
  for (const [tx, tz] of [[-9.1, -11], [-9.1, 2.5], [-9.1, 23], [9.1, -19], [9.1, 6], [9.1, 23]]) {
    L.trees.push([tx, 0, tz, L.trees.length + 1]);
    const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(0.15, 0.15, 2.4, 8)); b.position.set(tx, 1.2, tz); world.addBody(b);
  }
  // the side-street corner is one storey so its roof doesn't fill the lane's frame (environment.md Fix 8)
  block(12.7, 20, -1.5, 1, 9, ['-x', '-z'], { noStore: ['-x', '-z'] });
  // Neon
  // vertical signs are blade signs (environment.md Fix 3): they face +z (the camera) and stick out from the wall at x
  // into the street, on a backing box with two brackets; rotY only says which way the street is (sin > 0: +x)
  const signBack = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.5, roughness: 0.5 });
  const sign = (text, color, vertical, x, y, z, rotY, w, h, sub) => {
    const t = signTexture(text, color, vertical, sub);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.45, 1.45, 1.45), toneMapped: false }));
    if (vertical) {
      const dir = Math.sin(rotY) > 0 ? 1 : -1, cx = x + dir * (0.15 + w / 2);
      m.position.set(cx, y, z + 0.06); scene.add(m);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.1), signBack); back.position.set(cx, y, z); scene.add(back);
      for (const e of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.05, 0.05), signBack); b.position.set(x + dir * (w + 0.15) / 2, y + e * (h / 2 - 0.08), z - 0.02); scene.add(b); }
      return [m, back, cx];
    }
    m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.1), signBack.clone()); back.position.set(x, y, z); back.rotation.y = rotY; back.translateZ(-0.07); scene.add(back);
    return [m, back];
  };
  sign('RAMEN', '#ff2a8a', true, -12.7, 7.5, -9, Math.PI / 2, 1.3, 5.2);
  sign('HOTEL', '#19e3ff', true, 12.7, 8, -20, -Math.PI / 2, 1.3, 5.2);
  sign('BAR', '#ff5040', true, 12.7, 5.5, 8.5, -Math.PI / 2, 1.1, 3.2);
  sign('WASH', '#7dffb0', true, -12.7, 5.2, 18, Math.PI / 2, 1.1, 3.6);
  const arch = sign('PIER 9 MARKET', '#ffb060', false, 0, 10.5, -26.5, 0, 14, 2.6, 'OPEN LATE · FISH · NOODLES');
  for (const q of arch) if (q) L.noBatch.push(q);   // it fades out of the camera's way
  // the propaganda flanks the market entrance on the visible strips of the market blocks' south faces
  sign('OUTLIERS ARE NOT A CRIME', '#ff2a8a', false, -10.15, 5.2, -26.55, 0, 4.6, 0.62);
  sign('THE CENSUS COUNTS', '#ffd9a0', false, 10.15, 5.4, -26.55, 0, 4.6, 0.8, '|||| EVERY ONE OF US');
  { const beam = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.7 })); beam.position.set(0, 10.5, -26.85); scene.add(beam); arch.push(beam); }
  // the arch over the market entrance fades out while the camera passes under it
  for (const m of arch) if (m) { m.material.transparent = true; m.userData.baseOpacity = 1; }
  L.archFade = (center) => {
    const target = center.z < -23.5 ? 0 : 1;
    for (const m of arch) if (m) { const o = m.material.opacity + (target - m.material.opacity) * 0.12; m.material.opacity = o; m.visible = o > 0.02; }
  };
  addSpot(-11.9, 7.5, -8.4, 0xff2a8a, 22, 15, 1.7); addSpot(11.9, 8, -19.4, 0x19e3ff, 22, 15, 1.7);

  // Victorian lamp posts (photoscanned) with warm sodium-ish pools and a hint of volumetric haze
  const lampSrc = A.gltf.street_lamp.scene;
  const haloTex = (() => { const [c, x] = canvas(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(1.0, 0.62, 0.3) } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); gl_FragColor = vec4(uCol * 0.08 * vY * vY * edge, 1.0); }',
  });
  const lampSpots = [[-9.4, -17], [9.4, -5], [-9.4, 7], [9.4, 18], [-9.4, -26 + 4], [9.4, -24]];
  for (const [lx, lz] of lampSpots) {
    const lamp = lampSrc.clone(); lamp.position.set(lx, 0, lz); lamp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); lamp.userData.static = true; scene.add(lamp); L.lampPosts.push([lx, lz]);
    addSpot(lx, 3.45, lz, 0xffbf80, 32, 16, 1.5);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.0, 1.4, 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(lx, 3.55, lz); halo.scale.setScalar(0.35); scene.add(halo);
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(0.18, 0.13, 0.08), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    haze.position.set(lx, 3.5, lz); haze.scale.setScalar(1.8); scene.add(haze);
    // (no cone under a 3.45 m lamp: from above the pool decal does its job; lighting Fix 8)
    const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(0.14, 0.18, 3.8, 8)); b.position.set(lx, 1.9, lz); world.addBody(b);
  }
  // LED halo lamps strung over the middle of Harrow Street (art panel: lit pools inside the gameplay frame every 14 m)
  {
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.5), toneMapped: false });
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.6 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.7 });
    for (const z of [14, 0, -14]) {
      const rm = ringMat.clone(), hm = houseMat.clone();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 32), rm); ring.rotation.x = Math.PI / 2; ring.position.set(0, 7.45, z); scene.add(ring);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.08, 24), hm); disc.position.set(0, 7.53, z); scene.add(disc);
      // fades while it would sit between the camera and her
      L.fades.push({ objs: [ring, disc], mats: [rm, hm], low: 0.15, test: (c) => Math.abs(c.x) < 3.5 && c.z > z - 7 && c.z < z - 1 });
      for (const sx of [-1, 1]) {
        const a = new THREE.Vector3(0, 7.6, z), b = new THREE.Vector3(sx * 12.6, 9.2, z), len = a.distanceTo(b);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), wireMat); w.position.copy(a).add(b).multiplyScalar(0.5); w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); scene.add(w);
      }
      addSpot(0, 7.2, z, 0xffc58a, 24, 15, 2);
    }
  }
  // Hydrants (photoscanned, aged variant)
  const hyd = A.gltf.hydrant.scene;
  for (const [hx, hz] of [[-9.0, -2], [9.0, 12]]) {
    const g = new THREE.Group(); hyd.updateMatrixWorld(true);
    hyd.traverse(o => { if (o.isMesh) { let t = o; while (t.parent && t.parent !== hyd) t = t.parent; if (!/aged/.test(t.name)) return; const m = new THREE.Mesh(o.geometry, o.material); m.applyMatrix4(o.matrixWorld); m.position.x -= 0.3; m.castShadow = m.receiveShadow = true; g.add(m); } });
    g.position.set(hx, 0, hz); g.rotation.y = hx < 0 ? Math.PI / 2 : -Math.PI / 2; g.userData.static = true; scene.add(g);
    const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(0.18, 0.18, 0.8, 8)); b.position.set(hx, 0.4, hz); world.addBody(b);
  }

  // ---- the rest of Chapter 1: Pier 9 Market, Gut Lane, Pier 9 docks ----
  buildPier9({ scene, world, wet, block, sign, addSpot, groundMat, L, haloTex, coneMat, lampSrc });
  const inst = (geo, mat, list, color) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length); const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    list.forEach((w, i) => { Q.setFromEuler(new THREE.Euler(0, w.ry, 0)); M.compose(w.p, Q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, M); if (color && w.col) im.setColorAt(i, w.col); });
    scene.add(im); return im;
  };
  // every window in the city: interior-mapped rooms behind breakable glass
  kit.finish();
  L.facade = kit;


  // Pier edge + harbour
  const conc = pbr('concrete_wall_008', 10, 0.5);
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(28, 0.96, 0.44), conc); barrier.position.set(0, 0.48, 24.85); barrier.castShadow = barrier.receiveShadow = true; scene.add(barrier);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 0.46), new THREE.MeshStandardMaterial({ color: 0xc8a232, roughness: 0.6 })); stripe.position.set(0, 0.86, 24.85); scene.add(stripe);
  const pierFace = new THREE.Mesh(new THREE.BoxGeometry(90, 1.6, 0.6), conc); pierFace.position.set(0, -0.8, 24.9); scene.add(pierFace);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), new THREE.MeshStandardMaterial({ color: 0x020509, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -1.1, 65); scene.add(water); wet.hide.push(water);
  G.waterY = -1.1;

  // Light: dim cool moonlight (shadows), city-glow ambient
  const hemi = new THREE.HemisphereLight(0x3d5a66, 0x15110e, 0.22); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9ec3d6, 0.38);
  moon.position.set(-8, 22, 10); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03;
  scene.add(moon); scene.add(moon.target); L.moon = moon;

  // Rain that catches the light (lighting_vfx.md Fix 8): thin streaks lit by the 6 pool lights + her light, so it glows
  // amber under lamps, pink by the neon and violet around Null, and is nearly invisible in the dark. No sticks at the lens.
  const N = 1800;
  const rg = new THREE.InstancedBufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  rg.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(N * 4); for (let i = 0; i < N; i++) { off[i * 4] = rand(-14, 14); off[i * 4 + 1] = rand(0, 9); off[i * 4 + 2] = rand(-16, 14); off[i * 4 + 3] = Math.random(); }
  const oattr = new THREE.InstancedBufferAttribute(off, 4); rg.setAttribute('aOff', oattr); rg.instanceCount = N;
  const LP = Array.from({ length: 7 }, () => new THREE.Vector4()), LC = Array.from({ length: 7 }, () => new THREE.Vector3());
  const LIT_GLSL = `uniform vec4 uLP[7]; uniform vec3 uLC[7];
    vec3 litAt(vec3 wp) { vec3 lit = vec3(0.10, 0.12, 0.14); for (int i = 0; i < 7; i++) { vec3 d = wp - uLP[i].xyz; lit += uLC[i] * uLP[i].w * 0.04 / (1.0 + dot(d, d)); } return lit; }`;
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uLP: { value: LP }, uLC: { value: LC } },
    vertexShader: `attribute vec4 aOff; uniform float uTime; uniform vec3 uCenter; varying float vA; varying float vU; varying vec3 vLit;
      ${LIT_GLSL}
      void main(){
        float fall = 22.0 + aOff.w * 6.0;
        vec3 p = aOff.xyz; p.y = mod(p.y - uTime * fall, 9.0);
        p.x = uCenter.x + mod(p.x - uCenter.x + 14.0 + uTime * 1.2, 28.0) - 14.0;
        p.z = uCenter.z + mod(p.z - uCenter.z + 18.0, 32.0) - 18.0;
        vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 wp = p + camR * position.x * 0.012 + vec3(0.04, 1.0, 0.0) * position.y * 0.9;
        vA = (0.14 + aOff.w * 0.16) * smoothstep(4.0, 8.0, distance(wp, cameraPosition)); vU = position.x + 0.5;
        vLit = litAt(wp) * 2.0;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: 'varying float vA; varying float vU; varying vec3 vLit; void main(){ float e = 1.0 - abs(vU - 0.5) * 2.0; gl_FragColor = vec4(vLit * vA * e, 1.0); }',
  });
  // splash rings: 160 instanced rings with a 0.3 s life, respawned around the view (~530 a second), lit the same way
  const SPN = 160, spGeo = new THREE.InstancedBufferGeometry();
  spGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3)); spGeo.setIndex([0, 2, 1, 0, 3, 2]);
  const spA = new Float32Array(SPN * 3); for (let i = 0; i < SPN; i++) { spA[i * 3 + 2] = -1 - Math.random() * 0.3; }
  const spAttr = new THREE.InstancedBufferAttribute(spA, 3); spGeo.setAttribute('aSp', spAttr); spGeo.instanceCount = SPN;
  const splashMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uLP: { value: LP }, uLC: { value: LC } },
    vertexShader: `attribute vec3 aSp; uniform float uTime; varying vec2 vQ; varying float vT; varying vec3 vLit;
      ${LIT_GLSL}
      void main(){ vT = clamp((uTime - aSp.z) / 0.3, 0.0, 1.0); float r = 0.02 + 0.14 * vT; vQ = position.xz; vec3 wp = vec3(aSp.x + position.x * r, 0.015, aSp.y + position.z * r); vLit = litAt(wp + vec3(0.0, 0.4, 0.0)) * 3.0; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `varying vec2 vQ; varying float vT; varying vec3 vLit; void main(){ float d = length(vQ); float ring = smoothstep(0.72, 0.86, d) * (1.0 - smoothstep(0.86, 1.0, d)); if (vT >= 1.0) discard; gl_FragColor = vec4(vLit * ring * 0.5 * (1.0 - vT), 1.0); }`,
  });
  const splashes = new THREE.Mesh(spGeo, splashMat); splashes.frustumCulled = false; splashes.renderOrder = 3; scene.add(splashes); wet.hide.push(splashes);
  let spNext = 0;
  // ground-hugging mist cards: horizontal noise quads that drift with the wind, tinted toward the nearest light
  const mistTex = (() => { const S = 128; const [c, x] = canvas(S, S); const img = x.createImageData(S, S); const h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    const n2 = (u, v, f) => { const i = Math.floor(u * f), j = Math.floor(v * f), fu = u * f - i, fv = v * f - j, w = (q) => ((q % f) + f) % f, s2 = (t) => t * t * (3 - 2 * t); const a = h(w(i), w(j)), b = h(w(i + 1), w(j)), cc = h(w(i), w(j + 1)), d = h(w(i + 1), w(j + 1)); return a + (b - a) * s2(fu) + (cc - a) * s2(fv) + (a - b - cc + d) * s2(fu) * s2(fv); };
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const u = xx / S, v = y / S, n = n2(u, v, 4) * 0.65 + n2(u, v, 8) * 0.35, e = Math.min(1, 4 * Math.min(u, 1 - u, v, 1 - v) + 0.2); const val = Math.max(0, n - 0.35) * 1.6 * e * 255; const k = (y * S + xx) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = val; }
    x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); return t; })();
  const MISTN = 12, mistGeo = new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), mistCol = new THREE.Color(0.03, 0.04, 0.045);
  const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, color: mistCol, transparent: true, opacity: 0.07, depthWrite: false, fog: false });
  const mists = []; for (let i = 0; i < MISTN; i++) { const m = new THREE.Mesh(mistGeo, mistMat); m.position.set(rand(-15, 15), 0.4 + Math.random() * 0.8, rand(-15, 15)); m.rotation.y = Math.random() * 6; m.renderOrder = 14; scene.add(m); wet.hide.push(m); L.noBatch.push(m); mists.push(m); }
  // per-zone atmosphere (lighting_vfx.md Appendix A): hemisphere, moon, fog, exposure, wetness and mist lerp over 1.5 s
  const ZL = [
    ['#3d5a66', 0.22, 0.38, '#0b1216', 0.022, 1.20, 1.0, 8, 0.07], ['#46606a', 0.26, 0.40, '#0d1418', 0.020, 1.15, 0.85, 6, 0.06],
    ['#3d5a66', 0.18, 0.34, '#0b1216', 0.030, 1.20, 0.9, 8, 0.07], ['#3d5a66', 0.16, 0.30, '#0e1214', 0.020, 1.15, 0.6, 6, 0.06],
    ['#50707a', 0.24, 0.30, '#0e1a1f', 0.026, 1.10, 0.25, 8, 0.08], ['#34505a', 0.14, 0.28, '#0a1013', 0.032, 1.20, 1.0, 6, 0.08],
    ['#3d5a66', 0.18, 0.36, '#0d1215', 0.024, 1.20, 0.8, 8, 0.07], ['#3d5a66', 0.20, 0.40, '#0c1316', 0.022, 1.15, 0.9, 8, 0.07],
    ['#3a5866', 0.20, 0.55, '#0c1418', 0.028, 1.20, 1.0, 12, 0.10], ['#3a5866', 0.18, 0.45, '#0d1519', 0.034, 1.15, 1.0, 12, 0.10],
  ].map(([hc, hi, mi, fc, fd, ex, wt, mn, ma]) => ({ hc: new THREE.Color(hc), hi, mi, fc: new THREE.Color(fc).multiplyScalar(1.25), fd: 0.019 + (fd - 0.022) * 0.6, ex, wt, mn, ma }));   // fog: the panel's contrast, gentler (a dark fog only darkens on a phone)
  const ZC = { hc: new THREE.Color(0x3d5a66), hi: 0.22, mi: 0.38, fc: new THREE.Color(0x0b1216), fd: 0.022, ex: 1.2, wt: 1, mn: 8, ma: 0.07 };
  let mistTint = new THREE.Color(1, 1, 1), mistTintT = 0, lastZ = 0;
  const rain = new THREE.Mesh(rg, rainMat); rain.frustumCulled = false; rain.renderOrder = 15; scene.add(rain); wet.hide.push(rain);
  const _sd = [], _hl = new THREE.Vector3(), _mt = new THREE.Color(1, 1, 1);
  L.update = (dt, center) => {
    kit.update(dt);
    if (L.updateGround) L.updateGround(dt, center);
    moon.position.set(center.x - 8, 22, center.z + 10); moon.target.position.set(center.x, 0, center.z);
    // light pool: the 6 spots that contribute most near the view get real lights. A challenger has to beat a holder by 15%,
    // and slots fade in/out at 6/s so lights never pop. Every spot also leaves a pool decal on the ground (see pools below).
    const score = (sp) => { const dx = sp.p.x - center.x, dz = sp.p.z - (center.z - 2), d = Math.sqrt(dx * dx + dz * dz); return d > 34 ? 0 : sp.i * sp.k * (1 - d / 34) ** 2; };
    _sd.length = 0;
    for (const sp of spots) { const sc = score(sp); if (sc > 0) _sd.push([sc, sp]); }
    _sd.sort((u, v) => v[0] - u[0]);
    const want = new Set(_sd.slice(0, POOL.length).map(e => e[1]));
    for (const l of POOL) { const sp = l.userData.sp; if (sp && !want.has(sp)) { const mine = score(sp), best = _sd.find(e => !POOL.some(q => q.userData.sp === e[1]) && want.has(e[1])); if (best && best[0] > mine * 1.15) l.userData.next = best[1]; } }
    for (const l of POOL) {
      if (!l.userData.sp) { const free = _sd.find(e => want.has(e[1]) && !POOL.some(q => q.userData.sp === e[1] || q.userData.next === e[1])); if (free) { l.userData.sp = free[1]; l.userData.w = 0; } }
      if (l.userData.next) { l.userData.w -= dt * 6; if (l.userData.w <= 0) { l.userData.sp = l.userData.next; l.userData.next = null; l.userData.w = 0; } }
      else if (l.userData.sp) l.userData.w = Math.min(1, l.userData.w + dt * 6);
      const sp = l.userData.sp; if (!sp) { l.intensity = 0; continue; }
      let k = sp.k;
      if (sp.flick) k *= Math.random() < 0.06 ? 0.15 : (0.9 + Math.sin(G.rt * 31 + sp.p.x) * 0.1);
      l.position.copy(sp.p); l.color.copy(sp.c); l.distance = sp.d; l.decay = 2;
      l.intensity = sp.i * k * Math.max(0, l.userData.w);
      sp.lit = Math.max(0, l.userData.w);
    }
    for (const g of L.gates) g.update(dt);
    if (L.archFade) L.archFade(center);
    for (const F of L.fades) { const t = F.test(center) ? F.low : 1; for (const m of F.mats) { m.opacity += (t - m.opacity) * 0.12; m.transparent = m.opacity < 0.99; m.depthWrite = m.opacity > 0.6; } for (const o of F.objs) o.visible = F.mats[0].opacity > 0.03; }
    if (L.updateExtra) L.updateExtra(dt, center);
    rainMat.uniforms.uTime.value += dt; rainMat.uniforms.uCenter.value.copy(center);
    wet.uniforms.uTime.value += dt;
    // lights for the rain and splashes: the 6 pool lights + her violet light
    POOL.forEach((l, i) => { LP[i].set(l.position.x, l.position.y, l.position.z, l.intensity); LC[i].set(l.color.r, l.color.g, l.color.b); });
    if (G.hero && G.hero.light) { G.hero.light.getWorldPosition(_hl); LP[6].set(_hl.x, _hl.y, _hl.z, G.hero.light.intensity * 6); LC[6].set(0.65, 0.55, 1.0); }
    const st = rainMat.uniforms.uTime.value; splashMat.uniforms.uTime.value = st;
    for (let k = 0, n = Math.min(SPN, Math.round(530 * dt) + (Math.random() < (530 * dt) % 1 ? 1 : 0)); k < n; k++) { const i = spNext; spNext = (spNext + 1) % SPN; spA[i * 3] = center.x + rand(-12, 12); spA[i * 3 + 1] = center.z + rand(-18, 12); spA[i * 3 + 2] = st - Math.random() * 0.05; }
    spAttr.needsUpdate = true;
    // atmosphere for the zone she's in
    { const zq = zoneAt(center.x, center.z); if (zq >= 0) lastZ = zq; const Z = ZL[lastZ] || ZL[0], a = Math.min(1, dt / 1.5 * 3);
      ZC.hc.lerp(Z.hc, a); ZC.fc.lerp(Z.fc, a); for (const k of ['hi', 'mi', 'fd', 'ex', 'wt', 'mn', 'ma']) ZC[k] += (Z[k] - ZC[k]) * a;
      hemi.color.copy(ZC.hc); hemi.intensity = ZC.hi; moon.intensity = ZC.mi;
      if (scene.fog && scene.fog.isFogExp2) { scene.fog.color.copy(ZC.fc); scene.fog.density = ZC.fd; }
      if (G.renderer) G.renderer.toneMappingExposure = ZC.ex;
      wet.uniforms.uWet.value = ZC.wt;
      // mist: re-centred on the view as it drifts with the wind; tinted toward the strongest nearby light every 0.5 s
      mistTintT -= dt; if (mistTintT <= 0) { mistTintT = 0.5; let best = null, bi = 0; for (const l of POOL) if (l.intensity > bi) { bi = l.intensity; best = l; } _mt.copy(best ? best.color : _mt.set(1, 1, 1)); }
      mistTint.lerp(_mt, Math.min(1, dt * 2)); mistMat.color.copy(ZC.fc).multiplyScalar(6.0).lerp(mistTint.clone().multiplyScalar(0.16), 0.35); mistMat.opacity = ZC.ma;
      mists.forEach((m, i) => { m.visible = i < Math.round(ZC.mn); m.position.x += 0.4 * dt; const dx = m.position.x - center.x, dz = m.position.z - (center.z - 3); if (dx > 15) m.position.x -= 30; if (dx < -15) m.position.x += 30; if (dz > 15) m.position.z -= 30; if (dz < -15) m.position.z += 30; }); }
  };
  // ---- light on the ground (art panel): every light leaves a pool, every shop spills onto the pavement, and the wet street
  //      carries a long reflection streak toward the viewer from whatever is lit nearby. Three draw calls in total.
  {
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const vs = 'attribute vec3 aCol; varying vec3 vC; varying vec2 vU; void main(){ vC = aCol; vU = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }';
    const mk = (fs, n, extra = {}) => { const g = flat.clone(); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: vs, fragmentShader: fs, ...extra }), n); m.frustumCulled = false; m.renderOrder = 2; m.count = 0; scene.add(m); wet.hide.push(m); return m; };
    const pools = mk('varying vec3 vC; varying vec2 vU; void main(){ float r = length(vU - 0.5) * 2.0; float a = smoothstep(1.0, 0.75, r) * (0.35 + 0.65 * (1.0 - r) * (1.0 - r)); gl_FragColor = vec4(vC * a, 1.0); }', 220);
    const spill = mk('varying vec3 vC; varying vec2 vU; void main(){ float a = vU.y * vU.y * smoothstep(0.5, 0.34, abs(vU.x - 0.5)); gl_FragColor = vec4(vC * a, 1.0); }', 80);
    const streakU = { uTime: { value: 0 } };
    const streaks = mk('uniform float uTime; varying vec3 vC; varying vec2 vU; void main(){ float x = vU.x - 0.5, y = 1.0 - vU.y; float a = exp(-pow(x / 0.28, 2.0) * 9.0) * exp(-1.2 * pow((y - 0.35) / 0.45, 2.0)) * (0.65 + 0.35 * sin(y * 40.0 + uTime * 6.0 + vC.r * 30.0)); gl_FragColor = vec4(vC * a, 1.0); }', 64, { uniforms: streakU });
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
    // pools: one per light, sized by its height
    const pl = spots.filter(sp => sp.p.y > 0.4 && sp.p.y < 14);
    pl.forEach((sp, i) => { const r = THREE.MathUtils.clamp(sp.p.y * 1.1, 2.5, 7); M.compose(P.set(sp.p.x, 0.016, sp.p.z), Q.identity(), S.set(r * 2, 1, r * 2)); pools.setMatrixAt(i, M); });
    pools.count = Math.min(220, pl.length);
    // shop spill
    kit.shops.forEach((sh, i) => { if (i >= 80) return; const ang = Math.atan2(sh.n.x, sh.n.z); M.compose(P.copy(sh.p).addScaledVector(sh.n, 1.3).setY(0.014), Q.setFromAxisAngle(UPV, ang), S.set(sh.w * 1.15, 1, 2.6)); spill.setMatrixAt(i, M); const c = sh.light.clone().multiplyScalar(0.2); spill.geometry.attributes.aCol.setXYZ(i, c.r, c.g, c.b); });
    spill.count = Math.min(80, kit.shops.length); spill.geometry.attributes.aCol.needsUpdate = true;
    // streak sources: every light plus every lit fascia
    const srcs = [...pl.map(sp => ({ p: sp.p, c: sp.c, k: () => Math.min(1.6, sp.i * sp.k / 30) * 0.55, sp })), ...kit.shops.map(sh => ({ p: sh.p.clone().setY(3.4), c: sh.light, k: () => 0.45 }))];
    const cand = [];
    L.updateGround = (dt, center) => {
      streakU.uTime.value = G.rt || 0;
      const cam = G.camera; if (!cam) return;
      const ca = pools.geometry.attributes.aCol;
      pl.forEach((sp, i) => { const lit = sp.lit || 0, f = 0.08 * (sp.k ?? 1) * (0.35 + 0.65 * (1 - lit)) * Math.min(1.4, sp.i / 40); ca.setXYZ(i, sp.c.r * f, sp.c.g * f, sp.c.b * f); });
      ca.needsUpdate = true;
      cand.length = 0;
      for (const s of srcs) { const d = Math.hypot(s.p.x - center.x, s.p.z - center.z); if (d < 30) cand.push([d, s]); }
      cand.sort((a, b) => a[0] - b[0]);
      const sa = streaks.geometry.attributes.aCol, cp = cam.position;
      let n = 0;
      for (const [, s] of cand) {
        if (n >= 64) break;
        const Ly = Math.max(0.3, s.p.y), t = cp.y / (cp.y + Ly);
        const qx = cp.x + (s.p.x - cp.x) * t, qz = cp.z + (s.p.z - cp.z) * t;
        let ax = cp.x - s.p.x, az = cp.z - s.p.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
        const len = THREE.MathUtils.clamp(0.8 + 0.55 * Ly, 1.2, 6), wid = Math.min(0.22 + 0.08 * Ly, 0.7);
        M.compose(P.set(qx + ax * 0.2 * len, 0.012, qz + az * 0.2 * len), Q.setFromAxisAngle(UPV, Math.atan2(ax, az)), S.set(wid, 1, len)); streaks.setMatrixAt(n, M);
        const k = s.k(); sa.setXYZ(n, s.c.r * k, s.c.g * k, s.c.b * k); n++;
      }
      streaks.count = n; streaks.instanceMatrix.needsUpdate = true; sa.needsUpdate = true;
    };
  }
  L.finishBeacons(); L.finishCables();
  // bare trees: one instanced draw; bare branches throwing moon shadows on wet stone
  { const tg = treeGeometry(), tim = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.6 }), L.trees.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    L.trees.forEach(([x, y, z, k], i) => { M.compose(P.set(x, y, z), Q.setFromAxisAngle(UP, k * 2.39), S.setScalar(0.9 + (k * 0.137 % 1) * 0.25)); tim.setMatrixAt(i, M); });
    tim.castShadow = true; tim.receiveShadow = true; scene.add(tim); }
  L.decals = makeDecals(scene, ZONES, { stacks: L.stacks, trees: L.trees.filter(t => t[1] < 0.1) });
  return L;
}

// =====================================================================================
// Chapter 1 beyond Harrow Street: Pier 9 Market (z -26.6..-64.4), Gut Lane (z -64.4..-92.4)
// and the Pier 9 docks (z -92.4..-130.6) with open water on the west and north edges.
// =====================================================================================
export const ZONES = [
  { id: 'harrow', name: 'HARROW STREET', rects: [[-12.4, 12.4, -26.9, 24.4]], start: [0, 12] },
  { id: 'plaza', name: 'CHECKPOINT PLAZA', rects: [[12.4, 30, -12.5, -6.5, { pitch: 76, name: 'SIDE STREET' }], [30, 62, -30, 4]], start: [15.5, -9.5] },
  { id: 'tram', name: 'TRAM CUT', rects: [[44, 50, -48, -30, { name: 'TRAM LINE' }], [7.1, 50, -48, -42, { pitch: 76 }]], start: [47, -32.5] },
  { id: 'market', name: 'PIER 9 MARKET', rects: [[-7.1, 7.1, -64, -26.9]], start: [4.5, -45] },
  { id: 'cold', name: 'COLD STORAGE', rects: [[-29.6, -7.9, -64, -46.4, { pitch: 66 }]], start: [-10, -55] },
  { id: 'alley', name: 'GUT LANE', rects: [[-4.15, 4.15, -92, -64]], start: [0, -67.5] },
  { id: 'rail', name: 'THE RAIL YARD', rects: [[4.15, 30, -82, -76, { pitch: 76, name: 'YARD ROAD' }], [30, 78, -92, -66, { pitch: 58 }]], start: [7.5, -79] },
  { id: 'yard', name: 'CONTAINER YARD', rects: [[40, 80, -136, -92, { openN: true }], [14.2, 40, -122, -110, { pitch: 72, name: 'TRANSIT SHED' }]], start: [65, -95] },
  { id: 'docks', name: 'PIER 9 DOCKS', rects: [[-20.3, 14.2, -130.3, -92, { openW: true, openN: true }]], start: [11, -116] },
  { id: 'ferry', name: 'FERRY PIER', rects: [[-62, -20.3, -120, -104, { openN: true, openS: true, openW: true }]], start: [-23.5, -112] },
];
// gate i opens when zone i is cleared; the last two never open (Census locks on the old shortcuts)
export const GATES = [
  { x0: -12.5, x1: -6.5, at: 12.6, alongZ: true },    // harrow -> plaza side street
  { x0: 44, x1: 50, at: -30 },                         // plaza -> tram cut
  { x0: -48, x1: -42, at: 7.6, alongZ: true },        // tram cut -> market
  { x0: -58, x1: -52, at: -7.75, alongZ: true },      // market -> cold storage
  { x0: -4.6, x1: 4.6, at: -64.4 },                    // market -> gut lane
  { x0: -82, x1: -76, at: 4.6, alongZ: true },        // gut lane -> rail yard
  { x0: 60, x1: 70, at: -92 },                         // rail yard -> container yard
  { x0: -122, x1: -110, at: 14.6, alongZ: true },     // transit shed -> docks
  { x0: -120, x1: -104, at: -20.8, alongZ: true },    // docks -> ferry pier
  { x0: -7.6, x1: 7.6, at: -26.9 },                    // (locked) harrow -> market arch
  { x0: -4.6, x1: 4.6, at: -92.4 },                    // (locked) gut lane -> docks
];
export function rectOf(x, z, pad = 0.4) {
  for (let i = 0; i < ZONES.length; i++) for (const r of ZONES[i].rects) if (x >= r[0] - pad && x <= r[1] + pad && z >= r[2] - pad && z <= r[3] + pad) return [i, r];
  return null;
}
export function zoneAt(x, z) { const h = rectOf(x, z); return h ? h[0] : -1; }

export function containerTexture(base, label) {
  const [c, x] = canvas(512, 256);
  x.fillStyle = base; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 512; i += 16) { const g = x.createLinearGradient(i, 0, i + 16, 0); g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.28)'); x.fillStyle = g; x.fillRect(i, 0, 16, 256); }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 512, 10); x.fillRect(0, 246, 512, 10);
  for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(90,45,20,${0.08 + Math.random() * 0.18})`; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 256, 4 + Math.random() * 30, 2 + Math.random() * 9, 0, 0, 6.28); x.fill(); }
  x.font = '900 46px Inter, Arial, sans-serif'; x.fillStyle = 'rgba(235,235,235,0.75)'; x.textAlign = 'center'; x.fillText(label, 256, 120);
  x.font = '700 18px Inter, Arial, sans-serif'; x.fillText('CSFU 409117 · 22G1', 256, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// container faces from above (environment.md Fix 5): the label stays on the long sides, the roof is corrugated steel with
// corner castings, rust and a dent pool, the ends are doors. Box face order: +x, -x, +y, -y, +z, -z (long axis = x).
function containerRoofTexture(base) {
  const [c, x] = canvas(512, 256), b = new THREE.Color(base).multiplyScalar(0.78);
  x.fillStyle = '#' + b.getHexString(); x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 24; i++) { const x0 = 4 + i * 21, g = x.createLinearGradient(x0, 0, x0 + 21, 0); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.22)'); x.fillStyle = g; x.fillRect(x0, 0, 21, 256); }
  for (let k = 0, n = 2 + Math.floor(Math.random() * 3); k < n; k++) { const r = 10 + Math.random() * 20; x.fillStyle = `rgba(90,46,24,${0.35 + Math.random() * 0.25})`; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 256, r, r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, 6.3); x.fill(); }
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.ellipse(150 + Math.random() * 220, 80 + Math.random() * 100, 30 + Math.random() * 30, 15 + Math.random() * 15, 0, 0, 6.3); x.fill();
  for (const [cx, cy] of [[0, 0], [494, 0], [0, 240], [494, 240]]) { x.fillStyle = '#6b6a66'; x.fillRect(cx, cy, 18, 16); x.fillStyle = '#151515'; x.fillRect(cx + 7, cy + 6, 4, 4); }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 6; x.strokeRect(3, 3, 506, 250);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function containerEndTexture(base) {
  const [c, x] = canvas(256, 256); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 14) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, i, 256, 4); }
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(126, 0, 4, 256);
  for (const bx of [40, 86, 170, 216]) { x.fillStyle = '#8a8a86'; x.fillRect(bx - 3, 6, 6, 244); x.fillStyle = '#2a2a2a'; x.fillRect(bx - 8, 120, 16, 10); }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 248);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function containerMatSet(base, label, opts = {}) {
  const P = { roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0.45 };
  const side = new THREE.MeshStandardMaterial({ map: containerTexture(base, label), ...P }), end = new THREE.MeshStandardMaterial({ map: containerEndTexture(base), ...P });
  const top = new THREE.MeshStandardMaterial({ map: containerRoofTexture(base), ...P }), bottom = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  return [end, end, top, bottom, side, side];
}
let _ledgerCol = null;
function ledgerColumnTexture() {
  if (_ledgerCol) return _ledgerCol;
  const [c, x] = canvas(128, 1024); x.clearRect(0, 0, 128, 1024);
  for (let k = 0; k < 20; k++) drawLedger(x, String(1000 + Math.floor(Math.random() * 8999)), 10, 12 + k * 51, 30, '#fff', { ghost: 0.12 });
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; return (_ledgerCol = t);
}
function gateTextTexture() {
  const [c, x] = canvas(1024, 128);
  x.clearRect(0, 0, 1024, 128);
  // Census text is always LEDGER (14-segment, ghosted segments) with a tally code
  const wpx = drawTally(x, '78', 12, 49, 30, '#fff');
  drawLedger(x, 'CENSUS CHECKPOINT · PRESENT YOUR TALLY', 26 + wpx, 49, 30, '#fff', { ghost: 0.1 });
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function decalTexture(draw, w = 512, h = 256) { const [c, x] = canvas(w, h); x.clearRect(0, 0, w, h); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function softRectTexture() {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// A Census checkpoint: amber hologram wall with scrolling text that blocks the way until the zone is clear.
function makeGate(scene, world, groundMat, x0, x1, z, alongZ = false) {
  // alongZ: the gate spans z0..z1 (given as x0..x1) at x = z
  const w = x1 - x0, H = 3.4, cx = (x0 + x1) / 2;
  const tex = gateTextTexture();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uT: { value: 0 }, uOpen: { value: 0 }, tText: { value: tex }, uRep: { value: w / 9 }, tCol: { value: ledgerColumnTexture() }, uW: { value: w } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform float uOpen; uniform sampler2D tText; uniform float uRep; uniform sampler2D tCol; uniform float uW; varying vec2 vUv;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float row = floor(uv.y * 14.0);
        uv.x += (step(0.93, hh(vec2(row, floor(uT * 9.0)))) - 0.0) * 0.03;
        float scan = 0.55 + 0.45 * sin(uv.y * 140.0 - uT * 7.0);
        float grid = max(step(0.95, fract(uv.x * uRep * 6.0)), step(0.92, fract(uv.y * 7.0))) * 0.45;
        float txt = texture2D(tText, vec2(fract(uv.x * uRep - uT * 0.06), (uv.y - 0.42) * 5.0 + 0.5)).a * step(0.32, uv.y) * step(uv.y, 0.52);
        float edge = smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.85, uv.y);
        float rim = step(uv.y, 0.025) * 2.0 + step(0.975, uv.x) + step(uv.x, 0.025);
        float alive = step(uOpen * 1.02, hh(floor(vUv * vec2(uRep * 10.0, 9.0))));
        // the ledger column: record numbers rising at 0.5 m/s near each end of the cordon
        float cw = 0.9 / uW, colA = step(0.04, uv.x) * step(uv.x, 0.04 + cw), colB = step(0.96 - cw, uv.x) * step(uv.x, 0.96);
        float cu = colA > 0.5 ? (uv.x - 0.04) / cw : (uv.x - (0.96 - cw)) / cw;
        float ledger = (colA + colB) * texture2D(tCol, vec2(cu, fract(uv.y * 3.4 / 8.0 - uT * 0.5 / 8.0))).a * step(0.55, uv.y) * 0.9;
        vec3 col = vec3(1.0, 0.5, 0.12) * ((0.12 * scan + grid) * edge + txt * 1.3 + rim * 0.6 + ledger);
        gl_FragColor = vec4(col * alive, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat); m.renderOrder = 26; scene.add(m);
  if (alongZ) { m.position.set(z, H / 2, cx); m.rotation.y = Math.PI / 2; } else m.position.set(cx, H / 2, z);
  const [hc, hx] = canvas(1024, 80); const htex = new THREE.CanvasTexture(hc); htex.anisotropy = 4;
  const header = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 5.6), Math.min(w, 5.6) / 12.8), new THREE.MeshBasicMaterial({ map: htex, color: new THREE.Color(2.0, 1.0, 0.25), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  header.position.copy(m.position); header.position.y = H + 0.42; header.rotation.y = m.rotation.y; header.renderOrder = 27; scene.add(header);
  const paintHeader = (n) => { const t = 'CORDON ORD 7781 · RENEWED ×' + n, h = ledgerFit(t, 980, 52); hx.clearRect(0, 0, 1024, 80); drawLedger(hx, t, 512, 40 - h / 2, h, '#fff', { ghost: 0.1, align: 'center' }); htex.needsUpdate = true; };
  paintHeader(6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.7, emissive: 0xff7a20, emissiveIntensity: 0 });
  const posts = [];
  for (const px of [x0, x1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, H + 0.3, 0.28), postMat); if (alongZ) p.position.set(z, (H + 0.3) / 2, px); else p.position.set(px, (H + 0.3) / 2, z); p.castShadow = true; scene.add(p); posts.push(p); }
  const body = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
  if (alongZ) { body.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 2.5, w / 2))); body.position.set(z, 2.5, cx); }
  else { body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 2.5, 0.3))); body.position.set(cx, 2.5, z); }
  world.addBody(body);
  const g = {
    x0, x1, z, cx, alongZ, open: false, k: 0, inWorld: true, body, flick: 0,
    // Rewrite on a held cordon: it thins for a beat, then every chip renewing it writes it straight back
    flicker() { this.flick = 0.55; },
    renewed(n) { paintHeader(n); },
    get pos() { return alongZ ? new THREE.Vector3(z, 0, cx) : new THREE.Vector3(cx, 0, z); },
    openNow() { if (this.open) return; this.open = true; if (this.inWorld) { world.removeBody(body); this.inWorld = false; } },
    snapOpen() { this.openNow(); this.k = 1; mat.uniforms.uOpen.value = 1; m.visible = false; header.visible = false; },
    close() { this.open = false; this.k = 0; mat.uniforms.uOpen.value = 0; m.visible = true; header.visible = true; if (!this.inWorld) { world.addBody(body); this.inWorld = true; } },
    update(dt) {
      mat.uniforms.uT.value = G.rt;
      if (this.open && this.k < 1) { this.k = Math.min(1, this.k + dt * 1.6); mat.uniforms.uOpen.value = this.k; header.material.opacity = 1 - this.k; if (this.k >= 1) { m.visible = false; header.visible = false; } }
      postMat.emissiveIntensity = this.open ? 0 : 0.6 + Math.sin(G.rt * 5) * 0.2;
      if (!this.open && this.flick > 0) { this.flick = Math.max(0, this.flick - dt); mat.uniforms.uOpen.value = 0.8 * Math.min(1, this.flick * 3) * (0.55 + 0.45 * Math.sin(G.rt * 55)); }
    },
  };
  return g;
}

function buildPier9(C) {
  const { scene, world, wet, block, sign, addSpot, groundMat, L, haloTex, coneMat, lampSrc } = C;
  const metal = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.75 });
  const rusty = new THREE.MeshStandardMaterial({ color: 0x2b2421, roughness: 0.8, metalness: 0.5 });
  const stat = (x, y, z, hx, hy, hz, ry = 0, mask = ALL) => {
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: mask });
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(x, y, z); if (ry) b.quaternion.setFromEuler(0, ry, 0);
    world.addBody(b); return b;
  };
  const statCyl = (x, y, z, r, h) => { const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(r, r, h, 8)); b.position.set(x, y, z); world.addBody(b); };
  const mesh = (geo, mat, x, y, z, ry = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; if (shadow) { m.castShadow = true; m.receiveShadow = true; } scene.add(m); return m; };
  const floor = (prefix, x0, x1, z0, z1, tile, reflect, puddles, extra = {}) => {
    const w = x1 - x0, d = z1 - z0, { gut, ...ex } = extra;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pbr(prefix, w / tile, d / tile, ex));
    const hh = (k) => { const v = Math.sin(x0 * 12.9898 + z0 * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    wet.patch(m.material, { reflect, puddles, area: [x0 + hh(1) * 40, z0 + hh(2) * 40, 40, 40], gut: gut || [0, 0, 0.3, 0] });
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); wet.hide.push(m); return m;
  };
  const decal = (tex, w, h, x, y, z, ry, opacity = 0.9) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
  // overhead cables as flat ribbons facing up (environment.md Fix 7): THREE.Line is one device pixel wide on a phone.
  // Every ribbon goes into one merged, shadow-casting mesh at the end of the build.
  const ribbonGeos = [], ribbonPts = [];
  const cable = (a, b, sag, width = 0.03, insulators = true) => {
    const n = 16, pos = [], idx = [], dir = new THREE.Vector3().subVectors(b, a), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(width / 2), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); ribbonGeos.push(g);
    if (insulators) for (const e of [a, b]) ribbonPts.push(e);
    return pts;
  };
  L.finishCables = () => {
    if (!ribbonGeos.length) return;
    const m = new THREE.Mesh(mergeGeometries(ribbonGeos.map(g => g.toNonIndexed())), new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }));
    m.castShadow = true; m.userData.noBatch = true; scene.add(m);
    const ins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.5 }), ribbonPts.length);
    ribbonPts.forEach((p, i) => ins.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(ins);
  };
  seed = 9191;

  // ---------------- PIER 9 MARKET: a covered night market lane ----------------
  floor('pavement_03', -7.6, 7.6, -64.4, -26.6, 2.2, 0.55, 0.35, { gut: [0, 0, 0.22, 1] });
  block(-28, -7.6, -46, -26.6, 11, ['+z', '+x'], { storeOff: { '+z': -2 } });
  block(7.6, 28, -42, -37, 4.6, ['-x', '-z'], { noStore: ['-x'], skylights: 3 });            // one storey on the tram cut's east-west leg
  block(7.6, 28, -37, -26.6, 10, ['+z', '-x', '-z'], { storeOff: { '+z': 2 }, noStore: ['-z'] });
  block(7.6, 28, -66, -48, 13, ['-x', '+z'], { noStore: ['-x'] });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.85 });
  const canvasCols = [0x5a1a1d, 0x184549, 0x6b4e17, 0x24335a, 0x452445, 0x284425];
  const crateGeo = new THREE.BoxGeometry(0.55, 0.2, 0.4), iceMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e0, roughness: 0.3 });
  const boxMats = [new THREE.MeshStandardMaterial({ color: 0x1f5f9a, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0xb84a1e, roughness: 0.5 })];
  const lanternMat = glowMat(2.4, 0.55, 0.25);
  let ci = 0;
  // stall canopies (environment.md Fix 5): sagging canvas, striped or numbered, seams, a dark rain belly; one atlas
  const STALLS = ['37 SQUID', '41 NOODLE', '44 EEL', '52 ICE', '58 CRAB', '29 TEA'];
  const canAtlas = (() => {
    const [c, x] = canvas(1024, 768), [rc, rx] = canvas(1024, 768);
    rx.fillStyle = 'rgb(0,204,0)'; rx.fillRect(0, 0, 1024, 768);
    for (let k = 0; k < 12; k++) {
      const ox = (k % 4) * 256, oy = Math.floor(k / 4) * 256, col = new THREE.Color(canvasCols[k % canvasCols.length]), hi = col.clone().multiplyScalar(1.35);
      x.fillStyle = '#' + col.getHexString(); x.fillRect(ox, oy, 256, 256);
      if (k % 2 === 0) { x.fillStyle = '#' + hi.getHexString(); for (let i = 0; i < 10; i += 2) x.fillRect(ox + i * 25.6, oy, 25.6, 256); }
      else { x.save(); x.translate(ox + 128, oy + 128); x.fillStyle = '#e8e4da'; x.textAlign = 'center'; x.textBaseline = 'middle'; const [n, nm] = STALLS[(k >> 1) % STALLS.length].split(' '); x.font = "900 64px 'Bebas Neue', Impact, sans-serif"; x.fillText(n, 0, -30); x.font = "700 30px 'Bebas Neue', Impact, sans-serif"; x.fillText(nm, 0, 30); x.restore(); }
      x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i < 3; i++) x.fillRect(ox, oy + i * 83, 256, 2);
      const g = x.createRadialGradient(ox + 128, oy + 128, 0, ox + 128, oy + 128, 50); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(ox, oy, 256, 256);
      const rg = rx.createRadialGradient(ox + 128, oy + 128, 0, ox + 128, oy + 128, 46); rg.addColorStop(0, 'rgb(0,30,0)'); rg.addColorStop(1, 'rgba(0,204,0,0)'); rx.fillStyle = rg; rx.fillRect(ox, oy, 256, 256);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return [t, new THREE.CanvasTexture(rc)];
  })();
  const canMat = new THREE.MeshStandardMaterial({ map: canAtlas[0], roughnessMap: canAtlas[1], roughness: 1, side: THREE.DoubleSide });
  const canopyGeo = (k) => {
    const g = new THREE.PlaneGeometry(2.5, 3.1, 6, 6); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, U = g.attributes.uv, ox = (k % 4) / 4, oy = 1 - (Math.floor(k / 4) + 1) / 3;
    for (let i = 0; i < P.count; i++) {
      const u = U.getX(i), v = U.getY(i), edge = (u < 0.01 || u > 0.99 || v < 0.01 || v > 0.99) ? 0.05 : 0;
      P.setY(i, -0.14 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) - edge);
      U.setXY(i, ox + u / 4, oy + v / 3);
    }
    g.computeVertexNormals(); return g;
  };
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    if ((side < 0 && i === 3) || (side > 0 && i === 1)) continue;   // gaps = side doors
    const z = -31.6 - i * 5.5 + (side > 0 ? 1.6 : 0), x = side * 6.0;
    mesh(new THREE.BoxGeometry(1.3, 0.95, 2.6), counterMat, x, 0.475, z); stat(x, 0.5, z, 0.65, 0.5, 1.3);
    const canv = new THREE.Mesh(canopyGeo(ci++ % 12), canMat);
    canv.position.set(x - side * 0.35, 2.6, z); canv.rotation.z = side * 0.16; canv.castShadow = true; canv.receiveShadow = true; scene.add(canv);
    for (const dz of [-1.45, 1.45]) mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6), metal, x - side * 1.35, 1.25, z + dz, 0, false);
    for (let k = 0; k < 3; k++) { const cz = z - 0.8 + k * 0.8; mesh(crateGeo, boxMats[(i + k) % 2], x, 1.05, cz, 0, false); mesh(new THREE.BoxGeometry(0.48, 0.05, 0.34), iceMat, x, 1.16, cz, 0, false); }
    mesh(new THREE.SphereGeometry(0.17, 12, 8), lanternMat, x - side * 1.4, 2.2, z + 1.2, 0, false);
    mesh(new THREE.SphereGeometry(0.17, 12, 8), lanternMat, x - side * 1.4, 2.2, z - 1.2, 0, false);
  }
  // festoon lights strung across the lane
  const bulbs = [];
  for (let k = 0; k < 9; k++) {
    // nine strands (six old + three new between them) at alternating heights, as ribbons so they read on a phone
    const z = -29.5 - k * 4.27, top = k % 2 ? 5.6 : 6.3;
    const pts = cable(new THREE.Vector3(-7.5, top, z), new THREE.Vector3(7.5, top, z + 2.2), 1.2, 0.02, false);
    for (let i = 1; i < 16; i += 1.4) bulbs.push(pts[Math.round(i)]);
    if (k % 3 === 0) addSpot(0, 5.2, z + 1.1, 0xffbe70, 20, 13, 1.6);
  }
  const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), glowMat(2.6, 1.7, 0.85), bulbs.length);
  bulbs.forEach((p, i) => bulbIM.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(bulbIM);
  sign('NOODLES', '#ff2a8a', true, -7.6, 6.2, -37, Math.PI / 2, 1.2, 4.6); addSpot(-6.85, 6.2, -36.4, 0xff2a8a, 16, 11, 1.7);
  sign('FISH', '#19e3ff', true, 7.6, 5.6, -55, -Math.PI / 2, 1.1, 3.4); addSpot(6.9, 5.6, -54.4, 0x19e3ff, 16, 11, 1.7);
  sign('PAWN', '#ffb03a', true, -7.6, 5.4, -58, Math.PI / 2, 1.1, 3.6);
  // Census banners hung across the lane on two cables, facing the camera; they fade while she walks just north of them
  {
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6, metalness: 0.4 });
    const banner = (text, sub, y, z, w, h) => {
      const [m, back] = sign(text, '#e8f0ff', false, 0, y, z, 0, w, h, sub), objs = [m, back];
      m.material.color.setScalar(0.95); m.material.toneMapped = true;   // printed cloth, not neon: it hangs close to the camera, so no bloom
      for (const e of [-1, 1]) {
        const ax = e * 7.6, ay = 9.2, bx = e * (w / 2 - 0.2), by = y + h / 2, len = Math.hypot(ax - bx, ay - by);
        const c = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, 0.035), cableMat.clone()); c.position.set((ax + bx) / 2, (ay + by) / 2, z - 0.05); c.rotation.z = Math.atan2(ay - by, ax - bx); scene.add(c); objs.push(c);
      }
      const mats = objs.map(o => o.material); for (const q of mats) { q.transparent = true; q.opacity = 1; }
      for (const o of objs) L.noBatch.push(o);
      L.fades.push({ objs, mats, low: 0.12, test: (c) => c.z < z && c.z > z - 8 && Math.abs(c.x) < 9 });
    };
    banner('ENUMERATION 99.9997%', 'THANK YOU FOR BEING COUNTED', 8.6, -40, 10, 1.9);
    banner('EVERYONE COUNTS', null, 8.2, -52, 7, 1.3);
  }

  // ---------------- GUT LANE: a narrow wet service alley ----------------
  floor('asphalt_02', -4.6, 4.6, -92.4, -64.4, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0, gut: [0, 0, 0.3, 1] });
  block(-28, -4.6, -92.4, -64.4, 12, ['+x', '+z', '-z'], { noStore: ['+x', '+z'], storeW: 6, lit: 0.22 });
  block(4.6, 30, -76, -71.5, 4.6, ['-x', '-z', '+x'], { noStore: ['-x', '+x'], storeW: 5, lit: 0.22, skylights: 3 });   // one storey on Yard Road
  block(4.6, 30, -71.5, -64.4, 9, ['-x', '+z', '-z', '+x'], { noStore: ['-x', '+z', '-z'], storeW: 5, lit: 0.22 });
  block(4.6, 30, -92.4, -82, 11, ['-x', '+z', '-z', '+x'], { noStore: ['-x'], storeW: 5, lit: 0.22 });
  // the overhead layer (environment.md Fix 7): cables wall to wall and five laundry lines, only where both walls are tall
  { let q = 611; const qr = () => { q = (q * 16807) % 2147483647; return (q - 1) / 2147483646; };
    for (const z of [-65.5, -67.3, -69.6, -83.2, -85.8, -88.1, -90.6]) cable(new THREE.Vector3(-4.6, 6 + qr() * 3, z), new THREE.Vector3(4.6, 6 + qr() * 3, z + (qr() - 0.5) * 2.4), 0.32, 0.03);
    const CL = [0x6e5e50, 0x4b5868, 0x7c7a70, 0x5a3a3a, 0x3e4a3a, 0x8a7f6a].map(c => new THREE.Color(c));
    for (const zl of [-66.4, -68.8, -70.8, -84.6, -89.2]) {
      const y = 5 + qr() * 0.6, pts = cable(new THREE.Vector3(-4.6, y, zl), new THREE.Vector3(4.6, y, zl + (qr() - 0.5) * 0.6), 0.15, 0.015), gs = [];
      const n = 5 + Math.floor(qr() * 4);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5 + (qr() - 0.5) * 0.4) / n, p = pts[Math.round(t * 16)], w = 0.5 + qr() * 0.3, h = 0.6 + qr() * 0.4;
        const g = new THREE.PlaneGeometry(w, h); g.rotateX(-0.2); g.translate(p.x, p.y - h / 2, p.z);
        const c = CL[Math.floor(qr() * CL.length)], col = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); gs.push(g);
      }
      const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const cloth = new THREE.Mesh(mergeGeometries(gs), cm); cloth.castShadow = true; scene.add(cloth); L.noBatch.push(cloth);
      L.fades.push({ objs: [cloth], mats: [cm], low: 0.2, test: (c) => c.z < zl + 0.5 && c.z > zl - 4 && Math.abs(c.x) < 6 });
    } }
  const dumpMat = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.6, metalness: 0.5 });
  for (const [x, z, ry] of [[-3.55, -70.5, 0], [3.5, -82.5, 0], [-3.5, -88.6, 0]]) {
    mesh(new THREE.BoxGeometry(1.0, 1.25, 2.0), dumpMat, x, 0.625, z, ry);
    const lid = mesh(new THREE.BoxGeometry(1.05, 0.06, 2.05), dumpMat, x + Math.sign(x) * 0.2, 1.35, z, ry); lid.rotation.z = Math.sign(x) * 0.35;
    stat(x, 0.65, z, 0.5, 0.65, 1.0, ry);
  }
  // fire escapes
  const fe = (wx, dir, z0, z1) => {
    const x = wx + dir * 0.55, len = z1 - z0, zc = (z0 + z1) / 2;
    for (const y of [4.4, 7.8, 11.2]) {
      mesh(new THREE.BoxGeometry(1.1, 0.06, len), metal, x, y, zc, 0, true);
      mesh(new THREE.BoxGeometry(0.05, 0.05, len), metal, x + dir * 0.52, y + 1.0, zc, 0, false);
      for (let k = 0; k <= 6; k++) mesh(new THREE.BoxGeometry(0.035, 1.0, 0.035), metal, x + dir * 0.52, y + 0.5, z0 + (len * k) / 6, 0, false);
      const st = mesh(new THREE.BoxGeometry(0.7, 0.05, 4.4), metal, x, y - 1.7, zc - len * 0.18, 0, false); st.rotation.x = 0.66;
    }
  };
  fe(-4.6, 1, -79, -73); fe(4.6, -1, -87, -81);
  for (const [x, z] of [[-4.5, -67.5], [4.5, -74], [-4.5, -84], [4.5, -90]]) mesh(new THREE.CylinderGeometry(0.09, 0.09, 14, 8), rusty, x, 7, z, 0, false);
  for (const [x, z, flick] of [[-4.45, -69, 0], [4.45, -78, 1], [-4.45, -87, 0]]) {
    mesh(new THREE.BoxGeometry(0.2, 0.25, 0.5), metal, x, 3.6, z, 0, false);
    mesh(new THREE.BoxGeometry(0.02, 0.16, 0.4), glowMat(1.8, 1.9, 2.2), x + Math.sign(-x) * 0.11, 3.5, z, 0, false);
    addSpot(x - Math.sign(x) * 0.6, 3.3, z, 0xd8f2ff, 14, 10, 1.7, flick);
  }
  L.vents.push([-3.8, -76.2], [3.9, -69.3], [0.6, -90.1], [-4.4, 22.5], [5.2, -6.5]);
  const grateTex = decalTexture((x, w, h) => { x.fillStyle = '#26282c'; x.fillRect(0, 0, w, h); x.fillStyle = '#060607'; for (let i = 8; i < w - 8; i += 14) x.fillRect(i, 8, 7, h - 16); x.strokeStyle = '#3a3d42'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); }, 128, 128);
  const grateMat = new THREE.MeshStandardMaterial({ map: grateTex, roughness: 0.45, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z] of L.vents) { const g = mesh(new THREE.PlaneGeometry(0.9, 0.9), grateMat, x, 0.006, z, 0, false); g.rotation.x = -Math.PI / 2; }
  // neon steam (addendum #19): each vent's steam takes a city colour, with a faint additive light shaft over the grate
  const VCOL = [[0.1, 0.83, 0.9], [1.0, 0.18, 0.48]];
  L.ventCol = L.vents.map((v, i) => VCOL[(i * 7 + 3) % 5 < 2 ? 1 : 0]);
  {
    const gs = [];
    L.vents.forEach(([x, z], i) => {
      const c = L.ventCol[i];
      const g = new THREE.CylinderGeometry(0.85, 0.42, 3.0, 14, 1, true); g.translate(x, 1.5, z);
      const d = new THREE.CircleGeometry(0.55, 14); d.rotateX(-Math.PI / 2); d.translate(x, 0.012, z);
      for (const q of [g, d]) { const n = q.attributes.position.count, col = new Float32Array(n * 3), k = new Float32Array(n), ac = new Float32Array(n * 3); for (let j = 0; j < n; j++) { col.set(c, j * 3); ac.set([x, 0, z], j * 3); k[j] = q === d ? 1 : 0; } q.setAttribute('color', new THREE.BufferAttribute(col, 3)); q.setAttribute('aDisc', new THREE.BufferAttribute(k, 1)); q.setAttribute('aC', new THREE.BufferAttribute(ac, 3)); delete q.attributes.normal; gs.push(q.index ? q.toNonIndexed() : q); }
    });
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, vertexColors: true,
      uniforms: { uT: { value: 0 } },
      vertexShader: 'attribute float aDisc; attribute vec3 aC; varying vec3 vC; varying float vY; varying float vD; varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vC = color; vD = aDisc; vY = position.y; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = vec3(position.x - aC.x, 0.0, position.z - aC.z); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uT; varying vec3 vC; varying float vY; varying float vD; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.0), f.x), f.y); }
        void main(){
          if (vD > 0.5) { float r = 1.0 - clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0); gl_FragColor = vec4(vC * 0.16 * r * r * (0.75 + 0.25 * sin(uT * 3.0 + vW.x)), 1.0); return; }
          float up = clamp(vY / 3.0, 0.0, 1.0), fall = (1.0 - up) * (1.0 - up) * smoothstep(0.0, 0.25, up);
          float face = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
          float wisp = n2(vec2(atan(vN.z, vN.x) * 2.0, vY * 1.6 - uT * 0.9)) * 0.7 + 0.3;
          gl_FragColor = vec4(vC * fall * wisp * face * face * 0.09, 1.0);
        }`,
    });
    const shafts = new THREE.Mesh(mergeGeometries(gs, false), shaftMat); shafts.renderOrder = 6; shafts.frustumCulled = false; scene.add(shafts);
    L.noBatch.push(shafts); L.ventShafts = shaftMat;
  }
  // her mark, and a way to Moth's
  // on the south face at the top of Yard Road: the first thing in frame when she steps out of Gut Lane
  decal(decalTexture((x, w, h) => { x.strokeStyle = '#9b6bff'; x.lineWidth = 16; x.shadowColor = '#9b6bff'; x.shadowBlur = 12; x.beginPath(); x.arc(w / 2, h / 2, 80, 0, 6.28); x.stroke(); x.beginPath(); x.moveTo(w / 2 - 110, h / 2 + 110); x.lineTo(w / 2 + 110, h / 2 - 110); x.stroke(); }, 512, 256), 4, 2, 7.2, 2.6, -81.97, 0, 0.85);
  decal(decalTexture((x, w, h) => { x.font = '900 72px Inter, Arial'; x.fillStyle = '#e9e4da'; x.textAlign = 'center'; x.globalAlpha = 0.85; x.fillText('COUNT ME OUT', w / 2, h / 2 + 24); }, 512, 128), 3.4, 0.85, 11.5, 1.9, -81.97, 0, 0.8);
  decal(decalTexture((x, w, h) => { x.font = '800 60px Inter, Arial'; x.fillStyle = '#ffb060'; x.textAlign = 'center'; x.fillText('INK  ▾  PIER 9', w / 2, h / 2 + 20); }, 512, 128), 2.6, 0.65, 4.58, 1.8, -88.5, -Math.PI / 2, 0.85);

  // ---------------- PIER 9: the docks ----------------
  floor('concrete_floor_worn_001', -20.6, 14.6, -130.6, -92.4, 3.0, 0.9, 0.9, { color: new THREE.Color(0.6, 0.58, 0.54), envMapIntensity: 1.7 });
  block(15.0, 40, -136, -122, 12, ['-x', '+z', '+x'], { storeW: 9, lit: 0.18, noStore: ['+z'] });
  block(15.0, 40, -110, -105, 4.6, ['-x', '-z', '+x'], { noStore: ['-z', '-x', '+x'], lit: 0.18, skylights: 3 });   // one storey along the transit shed
  block(15.0, 40, -105, -92.4, 9, ['-x', '-z', '+z', '+x'], { storeW: 9, lit: 0.18, noStore: ['-z'] });
  const conc = pbr('concrete_wall_008', 12, 0.6);
  mesh(new THREE.BoxGeometry(0.6, 1.8, 38.8), conc, -20.9, -0.9, -111.5, 0, false);
  mesh(new THREE.BoxGeometry(35.8, 1.8, 0.6), conc, -3.0, -0.9, -130.9, 0, false);
  const lip = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.8 });
  mesh(new THREE.BoxGeometry(0.35, 0.16, 38.2), lip, -20.42, 0.08, -111.5, 0, false);
  mesh(new THREE.BoxGeometry(35.2, 0.16, 0.35), lip, -3.2, 0.08, -130.42, 0, false);
  const yellow = new THREE.MeshStandardMaterial({ color: 0xc8a232, roughness: 0.6 });
  mesh(new THREE.BoxGeometry(0.16, 0.01, 37.6), yellow, -19.6, 0.005, -111.5, 0, false);
  mesh(new THREE.BoxGeometry(34.4, 0.01, 0.16), yellow, -3.4, 0.005, -129.6, 0, false);
  // the hero can't step off the edge (everyone else can go overboard)
  stat(-21.0, 2, -98.2, 0.4, 2, 5.8, 0, GRP.HERO); stat(-21.0, 2, -125.4, 0.4, 2, 5.4, 0, GRP.HERO); stat(-3.0, 2, -131.0, 17.8, 2, 0.4, 0, GRP.HERO);
  for (let z = -96; z >= -128; z -= 6.4) { mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), metal, -19.95, 0.27, z, 0); statCyl(-19.95, 0.27, z, 0.22, 0.55); }
  for (let x = -14; x <= 10; x += 6) { mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), metal, x, 0.27, -129.95, 0); statCyl(x, 0.27, -129.95, 0.22, 0.55); }
  // shipping containers (static stacks; two loose ones are liftable props)
  const contMats = [['#7a2a1c', 'CANTOR SOUND'], ['#1f4a73', 'TALLYFREIGHT'], ['#2f5a3a', 'CANTOR SOUND'], ['#8a6d2a', 'HALDEN MED'], ['#3c4148', 'TALLYFREIGHT'], ['#5e2a24', 'HALDEN MED']].map(([c, l]) => containerMatSet(c, l));
  const contGeo = new THREE.BoxGeometry(6.06, 2.59, 2.44);
  const cont = (x, z, ry, n, mi) => { for (let k = 0; k < n; k++) { mesh(contGeo, contMats[(mi + k) % contMats.length], x, 1.295 + k * 2.59, z, ry + (k ? 0.03 : 0)); } stat(x, 1.295 * n, z, 3.03, 1.295 * n, 1.22, ry); };
  cont(11.3, -99.5, Math.PI / 2, 2, 0); cont(11.3, -106.6, Math.PI / 2, 1, 1); cont(-15.8, -96.4, 0, 2, 2); cont(8.6, -124.2, 0.05, 1, 3); cont(-15.6, -99.0, 0, 1, 1);
  // gantry crane on the west edge, legs on the dock and in the water
  const craneMat = new THREE.MeshStandardMaterial({ color: 0x8f6f18, roughness: 0.55, metalness: 0.6 });
  for (const [x, z] of [[-19.2, -104], [-19.2, -120], [-30, -104], [-30, -120]]) { mesh(new THREE.BoxGeometry(0.7, 15, 0.7), craneMat, x, 7.5 - (x < -25 ? 1.1 : 0), z, 0); if (x > -25) stat(x, 7.5, z, 0.35, 7.5, 0.35); }
  for (const z of [-104, -120]) mesh(new THREE.BoxGeometry(11.5, 0.9, 0.9), craneMat, -24.6, 15, z);
  mesh(new THREE.BoxGeometry(1.2, 1.2, 17.5), craneMat, -24.6, 15.6, -112); mesh(new THREE.BoxGeometry(1.0, 0.8, 26), craneMat, -24.6, 16.4, -112 - 0, Math.PI / 2);
  mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), metal, -21.5, 14.4, -112);
  const redLights = [];
  for (const [x, y, z] of [[-12.0, 16.9, -112], [-37.2, 16.9, -112], [-24.6, 16.2, -103.6]]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(3, 0.2, 0.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(x, y, z); s.scale.setScalar(0.9); scene.add(s); redLights.push(s); }
  // sodium mast lights
  for (const [x, z] of [[-8, -101], [5, -113.5], [-12, -124.5]]) {
    mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), metal, x, 4.5, z, 0); statCyl(x, 2, z, 0.2, 4);
    mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), metal, x, 9.05, z, 0, false);
    mesh(new THREE.BoxGeometry(0.8, 0.04, 0.42), glowMat(3, 1.7, 0.6), x, 8.9, z, 0, false);
    addSpot(x, 8.6, z, 0xffa648, 46, 22, 1.4);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.4, 1.4, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(x, 8.85, z); halo.scale.setScalar(0.6); scene.add(halo);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 8.6, 24, 1, true), coneMat); cone.position.set(x, 8.8 - 4.3, z); scene.add(cone);
  }
  // Moth's: a stairwell kiosk at the end of the pier, warm light leaking from below
  const kx = 11.6, kz = -127.2;
  block(kx - 1.6, kx + 1.6, kz - 1.6, kz + 1.6, 3.0, ['-x'], { noStore: ['-x'], lit: 0 });
  mesh(new THREE.PlaneGeometry(1.3, 2.3), glowMat(1.9, 1.05, 0.45), kx - 1.62, 1.15, kz, -Math.PI / 2, false);
  sign('PUMP HOUSE 9', '#cfeeff', false, kx - 1.66, 2.75, kz, -Math.PI / 2, 2.6, 0.5);
  addSpot(kx - 2.6, 1.6, kz, 0xd8f2ff, 10, 8, 1.6);
  // lights under the harbour: windows of something below the water
  const winTex = softRectTexture();
  const uw = [];
  for (const [bx, bz, cols, rows] of [[-36, -140, 6, 3], [-12, -146, 5, 3], [10, -142, 4, 2], [-44, -112, 3, 6], [-38, -96, 2, 4]]) {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (Math.random() < 0.6) uw.push([bx + c * 2.6 + (bz > -130 ? 0 : 0), bz - r * 3.2, Math.random()]);
  }
  const uwMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(0.35, 0.6, 0.75), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const uwIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 2.2).rotateX(-Math.PI / 2), uwMat, uw.length);
  uw.forEach(([x, z], i) => uwIM.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, -1.06, z))); uwIM.renderOrder = 3; scene.add(uwIM);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshStandardMaterial({ color: 0x020509, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-50, -1.1, -170); scene.add(sea); wet.hide.push(sea);

  buildExpansion(C, { metal, rusty, stat, statCyl, mesh, floor, decal, glowMat, conc, cable, lip, yellow, cont, contMats, contGeo, counterMat, canvasCols, lanternMat, redLights, haloTex, coneMat, lampSrc, crateGeo, boxMats, iceMat });
  buildLandmarks(C, { metal, stat, statCyl, mesh, glowMat });
  L.updateExtra = (dt, center) => {
    if (L.roofLed) L.roofLed.visible = ((G.rt || 0) * 0.5) % 1 < 0.5;
    if (L.beaconMat) L.beaconMat.uniforms.uT.value = G.rt || 0;
    if (L.floods) for (const f of L.floods) if (f.seq) { const t = G.rt - f.seq; f.k = t < 0.6 ? ((t * 5) % 1 < 0.5 ? 0.1 : 1) : 0.4; if (f.lens) f.lens.visible = f.k > 0.3; }
    if (G.fx) L.vents.forEach(([vx, vz], i) => { if (Math.abs(vz - center.z) < 22 && Math.abs(vx - center.x) < 28 && Math.random() < 0.55) { const c = L.ventCol[i], lo = Math.random() < 0.6; G.fx.smoke.emit(vx + rand(-0.3, 0.3), 0.1, vz + rand(-0.3, 0.3), rand(-0.15, 0.15), rand(0.8, 1.6), rand(-0.15, 0.15), 0.22 + c[0] * (lo ? 0.4 : 0.15), 0.23 + c[1] * (lo ? 0.4 : 0.15), 0.27 + c[2] * (lo ? 0.4 : 0.15), rand(1.2, 2.2), 0.18, 0.9, -0.15, 0.5, 0.55); } });
    if (L.ventShafts) L.ventShafts.uniforms.uT.value = G.rt;
    const blink = (G.rt % 1.6) < 0.5 ? 1 : 0.05;
    for (const s of redLights) s.material.opacity = blink;
    uwMat.opacity = 0.26 + Math.sin(G.rt * 0.7) * 0.06 + Math.sin(G.rt * 2.3) * 0.03;
    if (L.landmarkTick) L.landmarkTick(dt, center);
  };
}

// =====================================================================================
// The rest of Chapter 1: Checkpoint Plaza, Tram Cut, Cold Storage, the Rail Yard,
// the Container Yard + transit shed and the Ferry Pier. Plus every Census gate, in route order.
// =====================================================================================
function chainTexture() {
  const [c, x] = canvas(128, 128); x.clearRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(190,195,200,0.85)'; x.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function buildExpansion(C, H) {
  const { scene, world, wet, block, sign, addSpot, groundMat, L } = C;
  // LED wall-packs every ~8 m along the narrow east-west lanes (art panel: muddy lanes), on the camera-facing wall
  {
    const packMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.6 }), barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.5), toneMapped: false });
    const lane = (x0, x1, zWall, dirZ) => { for (let x = x0 + 4; x < x1 - 2; x += 8) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.22), packMat); b.position.set(x, 3.8, zWall + dirZ * 0.11); scene.add(b);
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.16), barMat); g.position.set(x, 3.72, zWall + dirZ * 0.12); scene.add(g);
      addSpot(x, 3.4, zWall + dirZ * 1.3, 0xffd6a0, 12, 8, 2);
    } };
    lane(12.4, 30, -12.5, 1);   // side street
    lane(7.6, 44, -48, 1);      // tram cut
    lane(4.6, 30, -82, 1);      // yard road
    lane(14.2, 40, -122, 1);    // transit shed
  }
  const { metal, rusty, stat, statCyl, mesh, floor, decal, glowMat, conc, cable, cont, contMats, contGeo, counterMat, haloTex, coneMat, lampSrc, crateGeo, boxMats, iceMat } = H;
  seed = 7171;
  // dark fill under the east of the city so nothing shows through the gaps
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(110, 200), new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.set(45, -0.03, -60); scene.add(f); wet.hide.push(f); }
  const lampPost = (x, z, ry = 0) => {
    const lamp = lampSrc.clone(); lamp.position.set(x, 0, z); lamp.rotation.y = ry; lamp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); lamp.userData.static = true; scene.add(lamp); L.lampPosts.push([x, z]);
    addSpot(x, 3.45, z, 0xffbf80, 30, 15, 1.5);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.0, 1.4, 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(x, 3.55, z); halo.scale.setScalar(0.35); scene.add(halo);
    { const hz = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(0.18, 0.13, 0.08), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); hz.position.set(x, 3.5, z); hz.scale.setScalar(1.8); scene.add(hz); }
    // (no cone under a low lamp: the pool decal does its job from above)
    statCyl(x, 1.9, z, 0.16, 3.8);
  };
  const mast = (x, z, h = 10, col = 0xffa648, inten = 44) => {
    mesh(new THREE.CylinderGeometry(0.13, 0.17, h, 8), metal, x, h / 2, z, 0); statCyl(x, 2, z, 0.2, 4);
    mesh(new THREE.BoxGeometry(1.0, 0.28, 0.55), metal, x, h + 0.05, z, 0, false);
    mesh(new THREE.BoxGeometry(0.9, 0.04, 0.45), glowMat(3, 1.8, 0.7), x, h - 0.1, z, 0, false);
    addSpot(x, h - 0.4, z, col, inten, 22, 1.4);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.4, 1.5, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(x, h - 0.15, z); halo.scale.setScalar(0.6); scene.add(halo);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.48, h, 24, 1, true), coneMat); cone.position.set(x, h / 2, z); scene.add(cone);
  };
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    const tex = chainTexture(); tex.repeat.set(len / 1.2, 2.5 / 1.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.5), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }));
    m.position.set((x0 + x1) / 2, 1.25, (z0 + z1) / 2); m.rotation.y = ry - Math.PI / 2; scene.add(m);
    for (let k = 0; k <= Math.ceil(len / 3); k++) { const t = k / Math.ceil(len / 3); mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), metal, x0 + (x1 - x0) * t, 1.3, z0 + (z1 - z0) * t, 0, false); }
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
    b.addShape(new CANNON.Box(new CANNON.Vec3(len / 2, 1.3, 0.12))); b.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2); b.quaternion.setFromEuler(0, ry - Math.PI / 2, 0); world.addBody(b);
  };
  const rails = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5c5650, metalness: 0.9, roughness: 0.35 });
    for (const off of [-0.72, 0.72]) { const r = mesh(new THREE.BoxGeometry(0.08, 0.1, len), railMat, cx + Math.cos(ry) * off, 0.05, cz - Math.sin(ry) * off, ry, false); }
    const n = Math.floor(len / 0.9);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.07, 0.24), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.9 }), n);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; M.compose(new THREE.Vector3(cx + Math.sin(ry) * len * t, 0.02, cz + Math.cos(ry) * len * t), Q, new THREE.Vector3(1, 1, 1)); sl.setMatrixAt(i, M); }
    sl.receiveShadow = true; scene.add(sl);
  };
  const tex2 = (draw, w = 512, h = 256) => { const [c, x] = canvas(w, h); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

  // ================= CHECKPOINT PLAZA =================
  floor('asphalt_02', 12.4, 30, -12.5, -6.5, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0 });
  block(12.9, 30, -27, -12.55, 12.9, ['+z'], { noStore: ['+z'], skipWin: (p) => p.x > 23.5 && p.x < 29.5 });
  // a ghost sign on the face-on wall at the top of the side street: old paint for a district the Ledger says never existed.
  // Paint is analog, so it survived the deletion (STORY.md rule 5)
  { const [gc, gx] = canvas(512, 600);
    gx.fillStyle = 'rgba(207,195,166,0.35)'; gx.fillRect(20, 20, 472, 560);
    gx.fillStyle = 'rgba(107,42,34,0.6)'; gx.textAlign = 'center'; gx.font = "900 92px 'Bebas Neue', Impact, sans-serif";
    ['TIDELINES', 'FERRY', '& FISH CO.'].forEach((t, k) => gx.fillText(t, 256, 150 + k * 120));
    gx.font = "700 34px 'Bebas Neue', Impact, sans-serif"; gx.fillText('DAILY SAILINGS · ICE · BAIT', 256, 520);
    gx.globalCompositeOperation = 'destination-out';
    let q = 60000; const qr = () => { q = (q * 16807) % 2147483647; return (q - 1) / 2147483646; };
    for (let k = 0; k < 4000; k++) { gx.beginPath(); gx.arc(qr() * 512, qr() * 600, 1 + qr() * 2.5, 0, 6.3); gx.fill(); }
    for (let k = 0; k < 20; k++) { const dx = qr() * 512, dy = qr() * 300; gx.fillRect(dx, dy, 2 + qr() * 3, 80 + qr() * 200); }
    gx.globalCompositeOperation = 'source-over';
    const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), new THREE.MeshStandardMaterial({ map: gt, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    gs.position.set(26.5, 7.5, -12.53); scene.add(gs); }
  block(12.7, 30, -6.45, -1.5, 4.6, ['-x', '-z'], { storeW: 6, skylights: 3 });
  floor('granite_tile', 30, 62, -30, 4, 2.3, 0.9, 0.5, { color: new THREE.Color(0.7, 0.74, 0.82), roughness: 0.6 });
  block(20, 30, -30, -12.55, 14, ['+x'], { storeW: 6 });
  block(20, 30, -1.5, 6, 12, ['+x', '-z'], { storeW: 6, noStore: ['-z'] });
  block(28, 44, -42, -37, 4.6, ['-z', '+x'], { noStore: ['-z', '+x'], skylights: 3 });
  block(28, 44, -37, -30, 10, ['+z', '-z', '+x'], { noStore: ['-z'] });
  block(50, 70, -42, -30, 20, ['+z', '-z', '-x'], { noStore: ['+z', '-z', '-x'], skipWin: (p) => p.z > -30.5 && p.x > 50.2 && p.x < 61.8 && p.y < 7.3 });
  block(62, 80, -30, 6, 18, ['-x'], { storeW: 9 });
  block(28, 80, 4, 20, 7, ['-z'], { storeW: 8 });
  // Census checkpoint booth + scanner arches at the side-street mouth
  const glassBooth = new THREE.MeshStandardMaterial({ color: 0x0a0f14, metalness: 0.4, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 2 });
  mesh(new THREE.BoxGeometry(2.4, 2.6, 2.4), glassBooth, 34.5, 1.3, -15.5, 0); stat(34.5, 1.3, -15.5, 1.2, 1.3, 1.2);
  mesh(new THREE.BoxGeometry(2.6, 0.2, 2.6), metal, 34.5, 2.7, -15.5, 0); mesh(new THREE.BoxGeometry(2.62, 0.06, 2.62), glowMat(2.6, 1.2, 0.3), 34.5, 2.55, -15.5, 0, false);
  addSpot(34.5, 3.2, -15.5, 0xff9a40, 14, 9, 1.6);
  for (const az of [-11.6, -7.4]) {
    for (const ax of [32.4, 35.6]) mesh(new THREE.BoxGeometry(0.25, 3, 0.4), metal, ax, 1.5, az, 0);
    mesh(new THREE.BoxGeometry(3.45, 0.3, 0.42), metal, 34, 3.05, az, 0);
    mesh(new THREE.BoxGeometry(3.0, 0.06, 0.3), glowMat(2.6, 1.2, 0.3), 34, 2.88, az, 0, false);
  }
  // Registrar's broadcast screen on the east face
  const weilTex = tex2((x, w, h) => {
    x.fillStyle = '#05070c'; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w * 0.28, h * 0.5, 10, w * 0.28, h * 0.5, h * 0.55); g.addColorStop(0, '#2b3b55'); g.addColorStop(1, '#05070c'); x.fillStyle = g; x.fillRect(0, 0, w * 0.56, h);
    x.fillStyle = '#c9d6ea'; x.beginPath(); x.ellipse(w * 0.28, h * 0.42, 34, 44, 0, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(w * 0.28, h * 0.98, 78, 60, 0, 3.14, 6.28); x.fill();
    x.fillStyle = '#e8f0ff'; x.font = '900 34px Inter, Arial'; x.textAlign = 'left'; x.fillText('EVERYONE', w * 0.56, h * 0.38); x.fillText('COUNTS.', w * 0.56, h * 0.56);
    x.font = '700 15px Inter, Arial'; x.fillStyle = '#9fb4d8'; x.fillText('REGISTRAR C. WEIL · LIVE', w * 0.56, h * 0.74);
    for (let y = 0; y < h; y += 3) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y, w, 1); }
  });
  // low on the south face of the north block: from the plaza camera that wall is only in frame below y ~7 m
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: weilTex, color: new THREE.Color(1.3, 1.3, 1.4), toneMapped: false })); m.position.set(56, 4.25, -29.93); scene.add(m); addSpot(56, 4.5, -27.5, 0x9fc0ff, 16, 14, 1.6); }
  sign('TALLY CLINIC', '#19e3ff', true, 30.0, 6, -24, Math.PI / 2, 1.2, 5);
  // two flood masts: the Census lights its own space hard and cold (lighting_vfx.md Fix 9); relays going down put them out
  L.floods = [];
  for (const [fx, fz] of [[33.5, -27.5], [59.5, 1.5]]) {
    mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 8), metal, fx, 4.5, fz, 0); statCyl(fx, 4.5, fz, 0.2, 9);
    mesh(new THREE.BoxGeometry(1.4, 0.3, 0.6), metal, fx, 9.1, fz, 0);
    const lens = mesh(new THREE.BoxGeometry(1.2, 0.04, 0.45), glowMat(2.6, 2.8, 3.0), fx, 8.93, fz, 0, false);
    const sp = addSpot(fx, 8.6, fz, 0xe6f0ff, 46, 26, 1.4); sp.lens = lens; L.floods.push(sp);
  }
  L.floodFlicker = (x, z) => { let best = null, bd = 1e9; for (const f of L.floods) { const d = Math.hypot(f.p.x - x, f.p.z - z); if (d < bd && !f.seq) { bd = d; best = f; } } if (best) best.seq = G.rt; };
  // planters + benches + tram shelter
  const planterMat = pbr('concrete_wall_008', 1, 0.4);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x1d2a1a, roughness: 0.9 });
  for (const [px, pz] of [[40, -6], [52, -6], [40, -20], [52, -20]]) {
    mesh(new THREE.BoxGeometry(3, 0.7, 3), planterMat, px, 0.35, pz, 0); stat(px, 0.35, pz, 1.5, 0.35, 1.5);
    L.trees.push([px, 0.7, pz, L.trees.length + 3]);
  }
  // slatted benches on cast-iron ends (were brown boxes)
  { const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.7 }), iron = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.7 });
    for (const [bx, bz] of [[46, -2.5], [46, -23.5]]) {
      for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(2.4, 0.04, 0.11), wood, bx, 0.45, bz - 0.15 + k * 0.13, 0);
      for (let k = 0; k < 2; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.03), wood); sl.position.set(bx, 0.62 + k * 0.14, bz + 0.25); sl.rotation.x = -0.18; sl.castShadow = true; scene.add(sl); }
      for (const ex of [-1.05, 1.05]) { mesh(new THREE.BoxGeometry(0.06, 0.45, 0.5), iron, bx + ex, 0.22, bz + 0.02, 0); mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), iron, bx + ex, 0.62, bz + 0.27, 0); }
      stat(bx, 0.3, bz, 1.2, 0.3, 0.3, 0);
    } }
  { // tram shelter: it sits between the camera and the tram line, so it fades while she's on the line
    const sm = metal.clone(), sg = glassBooth.clone();
    const o = [mesh(new THREE.BoxGeometry(5.6, 0.12, 2.2), sm, 47, 2.8, -28.6, 0), mesh(new THREE.BoxGeometry(5.4, 2.6, 0.06), sg, 47, 1.4, -29.6, 0, false)];
    for (const sx of [44.4, 49.6]) o.push(mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), sm, sx, 1.4, -27.6, 0));
    const sgn = sign('TRAM · LINE 3 · PIER', '#e8f0ff', false, 47, 3.3, -27.5, 0, 4.4, 0.55);
    const mats = [sm, sg]; for (const q of sgn) if (q) { q.material = q.material.clone(); mats.push(q.material); o.push(q); }
    L.fades.push({ objs: o, mats, low: 0.12, test: (c) => c.x > 43 && c.x < 51 && c.z < -30.2 });
  }
  for (const [lx, lz] of [[33, -3], [59, -3], [33, -27], [59, -27]]) lampPost(lx, lz);

  // ================= TRAM CUT =================
  floor('asphalt_02', 44, 50, -48, -30, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0 });
  floor('asphalt_02', 7.6, 44, -48, -42, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0 });
  // the track bed: setts with the rails set into them, down both legs of the cut
  floor('cobblestone_embedded_asphalt', 45.6, 48.4, -48, -30, 1.9, 1, 1, { color: new THREE.Color(0.8, 0.78, 0.76) }).position.y = 0.003;
  floor('cobblestone_embedded_asphalt', 7.6, 45.6, -47.7, -44.9, 1.9, 1, 1, { color: new THREE.Color(0.8, 0.78, 0.76) }).position.y = 0.003;
  block(28, 70, -66, -48, 7, ['+z', '-z'], { noStore: ['-z'] });
  block(50, 70, -48, -42, 12, ['-x'], { noStore: ['-x'] });
  block(70, 80, -66, -30, 7, ['-z'], { noStore: ['-z'] });
  rails(47, -30.5, 47, -46.3); rails(8, -46.3, 49, -46.3);
  // abandoned tram car
  const tramTex = tex2((x, w, h) => {
    x.fillStyle = '#8a8f96'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d4f7a'; x.fillRect(0, h * 0.62, w, h * 0.16);
    x.fillStyle = '#0b1016'; for (let i = 0; i < 7; i++) x.fillRect(18 + i * 70, h * 0.18, 52, h * 0.34);
    x.fillStyle = '#e8f0ff'; x.font = '800 22px Inter, Arial'; x.fillText('CANTOR SOUND TRANSIT · 3', 20, h * 0.9);
    x.fillStyle = 'rgba(255,40,140,0.85)'; x.font = '900 40px Inter, Arial'; x.fillText('∅', w * 0.78, h * 0.58);
  });
  { const tm = new THREE.MeshStandardMaterial({ map: tramTex, roughness: 0.5, metalness: 0.5 });
    // the roof is what the camera sees (environment.md Fix 5): rusty paint, a big 3, vents, a folded pantograph, a torn tarp
    const roofTex = tex2((x, w, h) => {
      x.fillStyle = '#55595e'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 10; k++) { x.fillStyle = `rgba(90,50,32,${0.3 + Math.random() * 0.35})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 5 + Math.random() * 14, 0, 0, 6.3); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < w; i += 56) x.fillRect(i, 0, 2, h);
      x.save(); x.translate(w * 0.36, h / 2); x.rotate(-Math.PI / 2); x.fillStyle = '#e8e4da'; x.font = "900 150px 'Bebas Neue', Impact, sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('3', 0, 6); x.restore();
    }, 512, 144);
    mesh(new THREE.BoxGeometry(9, 3.0, 2.5), [tm, tm, new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.55, metalness: 0.5 }), metal, tm, tm], 33, 1.65, -46.3, 0);
    stat(33, 1.6, -46.3, 4.5, 1.6, 1.25);
    const ventM = new THREE.MeshStandardMaterial({ color: 0x3d4248, roughness: 0.5, metalness: 0.6 }), insM = new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: 0.4 });
    for (const vx of [29.6, 30.9]) mesh(new THREE.BoxGeometry(0.6, 0.15, 0.4), ventM, vx, 3.22, -46.3, 0, false);
    for (const [ix, iz] of [[32.2, -46.85], [32.2, -45.75], [33.8, -46.85], [33.8, -45.75]]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 8), insM, ix, 3.22, iz, 0, false);
    for (const [ax, az, ang] of [[32.6, -46.6, 0.6], [33.4, -46.6, -0.6], [32.6, -46.0, -0.6], [33.4, -46.0, 0.6]]) mesh(new THREE.BoxGeometry(1.1, 0.04, 0.04), metal, ax, 3.32, az, ang, false);
    { const tarp = new THREE.PlaneGeometry(3, 2, 4, 3); tarp.rotateX(-Math.PI / 2); const P = tarp.attributes.position; for (let i = 0; i < P.count; i++) { const px = P.getX(i), pz = P.getZ(i); P.setY(i, (px > 1.2 && pz < -0.6) ? 0.3 : 0.02 * Math.sin(px * 3)); } tarp.computeVertexNormals();
      const tp = new THREE.Mesh(tarp, new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.75, side: THREE.DoubleSide })); tp.position.set(36.4, 3.17, -46.3); tp.castShadow = true; scene.add(tp); } }
  // catenary (environment.md Fix 7): poles in pairs, span ribbons at 6.6 m, a contact wire over the track with droppers
  { const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
    const pair = (ax, az, bx, bz) => { for (const [px, pz] of [[ax, az], [bx, bz]]) mesh(new THREE.CylinderGeometry(0.12, 0.15, 7.2, 8), poleM, px, 3.6, pz, 0); cable(new THREE.Vector3(ax, 6.6, az), new THREE.Vector3(bx, 6.6, bz), 0.08, 0.035); };
    for (const z of [-31, -43]) pair(44.3, z, 49.7, z);
    for (const x of [10, 22, 34]) pair(x, -42.3, x, -47.7);
    for (const [ax, az, bx, bz] of [[8, -45, 49, -45], [47, -31, 47, -45]]) {
      cable(new THREE.Vector3(ax, 6.2, az), new THREE.Vector3(bx, 6.2, bz), 0.25, 0.02, false);
      const L2 = Math.hypot(bx - ax, bz - az); for (let d = 2; d < L2; d += 4) { const t = d / L2; mesh(new THREE.BoxGeometry(0.015, 0.4, 0.015), poleM, ax + (bx - ax) * t, 6.4, az + (bz - az) * t, 0, false); }
    } }
  addSpot(20, 4.5, -45, 0xd8f2ff, 14, 11, 1.7, 1); addSpot(40, 4.5, -45, 0xffbf80, 16, 12, 1.6); addSpot(47, 4.5, -36, 0xffbf80, 16, 12, 1.6);
  decal(decalTexture((x, w, h) => { x.font = '900 64px Inter, Arial'; x.fillStyle = '#e9e4da'; x.textAlign = 'center'; x.globalAlpha = 0.8; x.fillText('WHO COUNTS THE COUNTERS?', w / 2, h / 2 + 22); }, 1024, 128), 6, 0.75, 20, 2.6, -47.95, 0, 0.8);

  // ================= COLD STORAGE (roofless cutaway) =================
  const frostFloor = floor('concrete_floor_worn_001', -30, -7.6, -64.4, -46, 3.0, 0.35, 0.15, { color: new THREE.Color(0.78, 0.86, 0.95) });
  block(-50, -30, -66, -44, 14, []);
  // insulated freezer panels: vertical seams, frost along the bottom, grime, a painted stripe
  const panelTex = tex2((x, w, h) => {
    x.fillStyle = '#9aa3ab'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, h, 0, h * 0.55); g.addColorStop(0, 'rgba(235,245,255,0.55)'); g.addColorStop(1, 'rgba(235,245,255,0)'); x.fillStyle = g; x.fillRect(0, h * 0.55, w, h * 0.45);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(40,45,50,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 20, 2 + Math.random() * 30); }
    x.fillStyle = 'rgba(30,34,38,0.9)'; for (let k = 0; k <= w; k += w / 4) x.fillRect(k - 2, 0, 3, h);
    x.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k <= w; k += w / 4) x.fillRect(k + 1, 0, 1, h);
    x.fillStyle = '#2d5d8a'; x.fillRect(0, h * 0.62, w, h * 0.05);
  }, 256, 256);
  panelTex.wrapS = THREE.RepeatWrapping;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: panelTex, roughness: 0.7, metalness: 0.15 });
  const panelGeo = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, len = Math.max(w, d); for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 4.8); return g; };
  const cw = (x0, x1, z0, z1, h = 4.6) => { mesh(panelGeo(x1 - x0, h, z1 - z0), wallMat, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0); stat((x0 + x1) / 2, h / 2, (z0 + z1) / 2, (x1 - x0) / 2, h / 2, (z1 - z0) / 2); };
  cw(-30.4, -30, -64.4, -46); cw(-30.4, -7.6, -46.4, -46); cw(-30.4, -7.6, -64.4, -64.0);
  cw(-7.9, -7.6, -64.4, -58); cw(-7.9, -7.6, -52, -46);
  // the market-facing facade above the loading door
  mesh(panelGeo(0.3, 3.2, 6), wallMat, -7.75, 6.2, -55, 0, false);
  sign('COLD STORAGE · NO ENTRY', '#cfeeff', false, -7.58, 5.2, -55, Math.PI / 2, 5.2, 0.6);
  // the market face reads as a loading dock (environment.md Fix 10): shutter coil, bumpers, hazard strip, pipes, condensers
  { const pipeW = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.5, metalness: 0.2 }), blk = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.8 });
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 6.2, 12), metal); coil.rotation.x = Math.PI / 2; coil.position.set(-7.3, 2.75, -55); coil.castShadow = true; scene.add(coil);
    mesh(new THREE.BoxGeometry(0.62, 0.62, 6.3), metal, -7.35, 2.75, -55, 0);
    for (const bz of [-57.6, -56.2, -53.8, -52.4]) mesh(new THREE.BoxGeometry(0.12, 0.5, 0.25), blk, -7.52, 0.75, bz, 0);
    const hz = (() => { const [hc, hx] = canvas(512, 32); hx.fillStyle = '#111'; hx.fillRect(0, 0, 512, 32); hx.fillStyle = '#c8a232'; for (let k = -32; k < 512; k += 32) { hx.beginPath(); hx.moveTo(k, 32); hx.lineTo(k + 16, 32); hx.lineTo(k + 32, 0); hx.lineTo(k + 16, 0); hx.fill(); } const t = new THREE.CanvasTexture(hc); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); return t; })();
    for (const [z0, z1] of [[-64.4, -58], [-52, -46]]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 0.3), new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6 })); st.position.set(-7.57, 0.15, (z0 + z1) / 2); st.rotation.y = Math.PI / 2; scene.add(st); }
    for (const py of [3.9, 4.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 18, 8), pipeW); p.rotation.x = Math.PI / 2; p.position.set(-7.42, py, -55.2); scene.add(p); }
    for (let bz = -64; bz <= -46.5; bz += 2) mesh(new THREE.BoxGeometry(0.2, 0.36, 0.05), metal, -7.5, 4.0, bz, 0, false);
    for (const cz of [-62, -49]) { mesh(new THREE.BoxGeometry(0.6, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.45, metalness: 0.7 }), -7.3, 3.0, cz, 0); const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 16), blk); fan.rotation.z = Math.PI / 2; fan.position.set(-6.99, 3.0, cz); scene.add(fan); } }
  // racks with ice crates
  for (const rz of [-50, -55.5]) for (const rx of [-26, -19.5]) {
    mesh(new THREE.BoxGeometry(5, 0.08, 1.2), metal, rx, 1.0, rz, 0); mesh(new THREE.BoxGeometry(5, 0.08, 1.2), metal, rx, 2.1, rz, 0);
    for (const ex of [-2.4, 2.4]) for (const ez of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), metal, rx + ex, 1.2, rz + ez, 0, false);
    for (let k = 0; k < 4; k++) { mesh(crateGeo, boxMats[k % 2], rx - 1.8 + k * 1.2, 1.15, rz, 0, false); mesh(new THREE.BoxGeometry(0.48, 0.05, 0.34), iceMat, rx - 1.8 + k * 1.2, 1.27, rz, 0, false); }
    stat(rx, 1.2, rz, 2.5, 1.2, 0.6);
  }
  // cold-room light strips
  for (const [lx, lz, f] of [[-24, -49, 0], [-15, -57, 1], [-24, -60.5, 0]]) { mesh(new THREE.BoxGeometry(2.4, 0.06, 0.15), glowMat(2.0, 2.4, 2.8), lx, 4.4, lz, 0, false); addSpot(lx, 4.0, lz, 0xd8f2ff, 16, 11, 1.7, f); }
  // strip curtain at the door
  for (let k = 0; k < 9; k++) { const s2 = mesh(new THREE.BoxGeometry(0.02, 2.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.35, roughness: 0.2 }), -8.3, 1.4, -57.6 + k * 0.7, 0, false); s2.renderOrder = 5; }
  L.coldSpots = [[-27, -62.6], [-22, -62.6], [-17, -62.6], [-12, -62.6]];   // cage positions (missions.js builds them)

  // ================= LANE TO THE RAIL YARD =================
  floor('asphalt_02', 4.6, 30, -82, -76, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0 });
  addSpot(16, 3.5, -79, 0xd8f2ff, 12, 10, 1.7);

  // ================= THE RAIL YARD =================
  const gravel = floor('asphalt_02', 30, 78, -92, -66, 2.4, 0.55, 0.35);
  gravel.material.color = new THREE.Color(0.62, 0.58, 0.55);
  block(78, 95, -104, -60, 14, ['-x'], { noStore: ['-x'] });
  for (const rz of [-86.5, -79, -71.5]) { floor('gravel_floor_02', 30, 78, rz - 1.8, rz + 1.8, 2.0, 0.3, 0.2, { color: new THREE.Color(0.6, 0.56, 0.52) }).position.y = 0.003; rails(30, rz, 78, rz); }
  const boxcarRoof = new THREE.MeshStandardMaterial({ map: tex2((x, w, h) => {
    x.fillStyle = '#2a2a2c'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#6a6862'; x.fillRect(0, h * 0.41, w, h * 0.18); x.fillStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < w; i += 5) x.fillRect(i, h * 0.41, 1.5, h * 0.18);
    for (const hx of [0.22, 0.7]) { x.fillStyle = '#3a3a3e'; x.fillRect(w * hx, h * 0.12, w * 0.07, h * 0.25); x.fillRect(w * hx, h * 0.63, w * 0.07, h * 0.25); x.strokeStyle = '#151515'; x.lineWidth = 2; x.strokeRect(w * hx, h * 0.12, w * 0.07, h * 0.25); x.strokeRect(w * hx, h * 0.63, w * 0.07, h * 0.25); }
    for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(90,46,24,${0.3 + Math.random() * 0.3})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 20, 4 + Math.random() * 8, 0, 0, 6.3); x.fill(); }
  }, 512, 128), roughness: 0.6, metalness: 0.5 });
  const boxcar = (x, z, mi) => {
    const ms = containerMatSet(['#5a2a1c', '#2b3a4a', '#4a4a2a'][mi % 3], ['CS&P RAIL', 'TALLYFREIGHT', 'CANTOR SOUND'][mi % 3], { roughness: 0.7, metalness: 0.4 });
    ms[2] = boxcarRoof;
    const g = new THREE.BoxGeometry(12.5, 3.4, 2.9); g.rotateY(Math.PI / 2);
    mesh(g, ms, x, 2.25, z, Math.PI / 2); stat(x, 2.0, z, 6.25, 2.0, 1.45);
    for (const e of [-1, 1]) for (const sd of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), metal, x + sd * 1.3, 3.97, z + e * 6.0, 0, false);   // grab irons
    mesh(new THREE.BoxGeometry(11.5, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 }), x, 0.4, z, 0);
  };
  boxcar(38, -86.5, 0); boxcar(51.5, -86.5, 1); boxcar(64, -71.5, 2); boxcar(70, -79, 0);
  // signal tower + gantry
  mesh(new THREE.BoxGeometry(0.3, 7, 0.3), metal, 33, 3.5, -75.4, 0); mesh(new THREE.BoxGeometry(0.3, 7, 0.3), metal, 33, 3.5, -67, 0);
  mesh(new THREE.BoxGeometry(0.4, 0.4, 9), metal, 33, 7, -71.2, 0);
  for (const [sx, sz, red] of [[33, -71.5, 1], [33, -79, 0], [33, -86.5, 1]]) { const s3 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: red ? new THREE.Color(3, 0.25, 0.2) : new THREE.Color(0.3, 3, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s3.position.set(sx, 6.5, sz); s3.scale.setScalar(0.8); scene.add(s3); }
  mast(42, -76, 11); mast(66, -83, 11); mast(56, -68.5, 10);
  fence(40, -92, 60, -92); fence(70, -92, 80, -92);
  sign('LOCKDOWN ZONE 4', '#ff5a3a', false, 77.95, 5, -79, -Math.PI / 2, 5, 0.8);

  // ================= CONTAINER YARD + TRANSIT SHED =================
  floor('asphalt_02', 40, 80, -136, -92, 3.6, 1, 1, { normalScale: new THREE.Vector2(1.1, 1.1), envMapIntensity: 1.7 });
  floor('concrete_floor_worn_001', 14.6, 40, -122, -110, 3.0, 0.5, 0.4, { color: new THREE.Color(0.55, 0.54, 0.52) });
  block(80, 95, -140, -92, 14, ['-x'], { noStore: ['-x'] });
  mesh(new THREE.BoxGeometry(40.6, 1.8, 0.6), conc, 60, -0.9, -136.3, 0, false);
  mesh(new THREE.BoxGeometry(40, 0.16, 0.35), H.lip, 60, 0.08, -135.8, 0, false);
  stat(60, 2, -136.4, 20.4, 2, 0.4, 0, GRP.HERO);
  // container maze (static stacks); the informant runs the gaps
  const stacks = [
    [46, -100, 0, 2], [46, -110, 0, 1], [53, -98.5, Math.PI / 2, 2], [61, -105, 0, 3], [70, -100, Math.PI / 2, 1],
    [75, -110, Math.PI / 2, 2], [53, -117, 0, 2], [64, -116, Math.PI / 2, 1], [44, -126, 0, 2], [56, -129, 0, 1], [70, -126, Math.PI / 2, 2], [76, -131, 0, 1],
  ];
  stacks.forEach(([x, z, ry, n], i) => cont(x, z, ry, n, i));
  mast(58, -110.5, 12); mast(48, -131, 11); mast(74, -119, 11);
  // straddle carrier
  const sc = new THREE.MeshStandardMaterial({ color: 0x9a7a1a, roughness: 0.55, metalness: 0.6 });
  for (const [lx, lz] of [[66.2, -122.2], [66.2, -128.8], [72.8, -122.2], [72.8, -128.8]]) { mesh(new THREE.BoxGeometry(0.5, 8, 0.5), sc, lx, 4, lz, 0); stat(lx, 4, lz, 0.25, 4, 0.25); }
  mesh(new THREE.BoxGeometry(7.2, 0.8, 0.6), sc, 69.5, 8, -122.2, 0); mesh(new THREE.BoxGeometry(7.2, 0.8, 0.6), sc, 69.5, 8, -128.8, 0); mesh(new THREE.BoxGeometry(2.4, 1.6, 2.2), metal, 69.5, 9.1, -125.5, 0);
  // the shed: roll-up door frames, shrink-wrapped pallet loads (nothing here looks liftable), a parked forklift
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0xb8c4cc, roughness: 0.25, metalness: 0.05 }), strapMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
  for (const dx of [15.0, 39.6]) { mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), metal, dx, 2.6, -121.7, 0); mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), metal, dx, 2.6, -110.3, 0); mesh(new THREE.BoxGeometry(0.6, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x5a6068, metalness: 0.7, roughness: 0.45 }), dx, 4.6, -116, 0); }
  for (const [px, pz] of [[20, -112], [24, -120.5], [33, -112.2], [36, -120.4]]) { mesh(new THREE.BoxGeometry(1.2, 0.15, 1.0), counterMat, px, 0.08, pz, 0, false); mesh(new THREE.BoxGeometry(1.2, 1.35, 1.0), wrapMat, px, 0.825, pz, 0); for (const sy of [0.45, 0.85, 1.25]) mesh(new THREE.BoxGeometry(1.22, 0.03, 1.02), strapMat, px, sy, pz, 0, false); stat(px, 0.75, pz, 0.6, 0.75, 0.5); }
  { const fk = new THREE.MeshStandardMaterial({ color: 0xc8901a, roughness: 0.5, metalness: 0.4 });
    mesh(new THREE.BoxGeometry(1.2, 1.4, 2.2), fk, 29, 0.9, -119.8, 0); mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), metal, 29.4, 1.2, -118.5, 0, false); mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), metal, 28.6, 1.2, -118.5, 0, false); stat(29, 0.9, -119.8, 0.6, 0.9, 1.1); }
  for (const [lx, lz] of [[21, -116], [33, -116]]) { mesh(new THREE.ConeGeometry(0.5, 0.4, 12, 1, true), metal, lx, 5.0, lz, 0, false); addSpot(lx, 4.6, lz, 0xffc070, 18, 11, 1.6); }

  // the quay reads as a quay (art_director.md Fix 10): coping with a worn white edge, cast-iron bollards every 6 m, old tyre
  // fenders on the quay face between them
  { const iron = new THREE.MeshStandardMaterial({ color: 0x1e2024, metalness: 0.6, roughness: 0.5 }), cop = new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.8 }), edge = new THREE.MeshStandardMaterial({ color: 0x8e8c86, roughness: 0.7 }), tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });
    const bollard = (x, z) => { mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.6, 12), iron, x, 0.3, z, 0); mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), iron, x, 0.62, z, 0); statCyl(x, 0.35, z, 0.24, 0.7); };
    // west edge (x -20.3) and north edge (z -130.3)
    mesh(new THREE.BoxGeometry(0.6, 0.04, 38), cop, -20.0, 0.02, -111, 0, false); mesh(new THREE.BoxGeometry(0.1, 0.045, 38), edge, -20.25, 0.025, -111, 0, false);
    mesh(new THREE.BoxGeometry(34.5, 0.04, 0.6), cop, -3.05, 0.02, -130.0, 0, false); mesh(new THREE.BoxGeometry(34.5, 0.045, 0.1), edge, -3.05, 0.025, -130.25, 0, false);
    for (let z = -95; z > -129; z -= 6) if (Math.abs(z + 104) > 1.8 && Math.abs(z + 120) > 1.8) bollard(-19.8, z);
    for (let x = -14; x < 13; x += 6) bollard(x, -129.8);
    for (let z = -98; z > -129; z -= 6) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 8, 16), tyre); t.position.set(-20.42, -0.35, z); t.rotation.y = Math.PI / 2; scene.add(t); }
    for (let x = -11; x < 13; x += 6) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 8, 16), tyre); t.position.set(x, -0.35, -130.42); scene.add(t); }
  }
  // ================= FERRY PIER =================
  const deck = floor('weathered_planks', -62, -20.6, -120, -104, 2.0, 0.35, 0.25);
  mesh(new THREE.BoxGeometry(41.4, 1.8, 0.5), conc, -41.3, -0.9, -120.25, 0, false); mesh(new THREE.BoxGeometry(41.4, 1.8, 0.5), conc, -41.3, -0.9, -103.75, 0, false); mesh(new THREE.BoxGeometry(0.5, 1.8, 16.5), conc, -62.25, -0.9, -112, 0, false);
  for (let x = -60; x <= -24; x += 4.5) for (const z of [-120.6, -103.4]) mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.9 }), x, -1.4, z, 0, false);
  stat(-41.3, 2, -120.5, 20.7, 2, 0.35, 0, GRP.HERO); stat(-41.3, 2, -103.5, 20.7, 2, 0.35, 0, GRP.HERO); stat(-62.5, 2, -112, 0.35, 2, 8, 0, GRP.HERO);
  for (let x = -57; x <= -26; x += 6.2) { mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), metal, x, 0.27, -119.5, 0); statCyl(x, 0.27, -119.5, 0.22, 0.55); }
  statCyl(-30, 7.5, -104, 0.4, 15); statCyl(-30, 7.5, -120, 0.4, 15);
  // terminal hut (roofless cutaway) at the end of the pier
  const hutMat = new THREE.MeshStandardMaterial({ color: 0x2e3a44, roughness: 0.6, metalness: 0.3 });
  for (const [x0, x1, z0, z1] of [[-61.8, -61.4, -118, -106], [-61.8, -52, -118, -117.6], [-61.8, -52, -106.4, -106]]) { mesh(new THREE.BoxGeometry(x1 - x0, 3.2, z1 - z0), hutMat, (x0 + x1) / 2, 1.6, (z0 + z1) / 2, 0); stat((x0 + x1) / 2, 1.6, (z0 + z1) / 2, (x1 - x0) / 2, 1.6, (z1 - z0) / 2); }
  for (const bz of [-108.2, -115.8]) { mesh(new THREE.BoxGeometry(0.6, 0.45, 2.6), counterMat, -57.5, 0.45, bz, 0); stat(-57.5, 0.3, bz, 0.3, 0.3, 1.3); }
  // Moth's: a stairwell door in the terminal's back wall, warm light leaking up from below the pier
  mesh(new THREE.PlaneGeometry(1.4, 2.4), glowMat(1.9, 1.05, 0.45), -61.36, 1.2, -112, Math.PI / 2, false);
  mesh(new THREE.BoxGeometry(0.1, 2.7, 0.15), metal, -61.3, 1.35, -112.8, 0, false); mesh(new THREE.BoxGeometry(0.1, 2.7, 0.15), metal, -61.3, 1.35, -111.2, 0, false);
  sign('MOTH · INK ▾', '#ffb060', false, -61.3, 2.95, -112, Math.PI / 2, 2.6, 0.5);
  addSpot(-60.2, 1.6, -112, 0xffa050, 16, 8, 1.6);
  L.mothDoor = new THREE.Vector3(-60.0, 0, -112);
  sign('FERRY · HALDEN ISLAND', '#19d3e6', false, -52, 3.6, -112, Math.PI / 2, 5.6, 0.7, 'LAST SAILING CANCELLED');
  // pale fog lamps on low posts along both pier edges (Moth's door stays the only warm light here)
  { const post = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
    for (const z of [-119.4, -104.6]) for (let x = -58; x <= -26; x += 8) { mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.0, 8), post, x, 0.5, z, 0, false); mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), glowMat(1.6, 1.8, 2.0), x, 1.05, z, 0, false); addSpot(x, 1.2, z, 0xdce8ff, 8, 4, 2); } }
  addSpot(-56, 3, -112, 0xd8e8ff, 14, 10, 1.6, 1);
  // the docked ferry along the north side
  const hull = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.5, metalness: 0.3 });
  const hullDark = new THREE.MeshStandardMaterial({ color: 0x1d3550, roughness: 0.5, metalness: 0.3 });
  mesh(new THREE.BoxGeometry(34, 2.6, 8), hullDark, -42, 0.2, -126.5, 0, false);
  mesh(new THREE.BoxGeometry(32, 2.4, 7.4), hull, -42.5, 2.5, -126.5, 0, false);
  mesh(new THREE.BoxGeometry(14, 2.2, 6.2), hull, -40, 4.8, -126.5, 0, false);
  const winStrip = glowMat(1.6, 1.5, 1.3);
  mesh(new THREE.BoxGeometry(30, 0.5, 7.5), winStrip, -42.5, 2.7, -126.5, 0, false);
  mesh(new THREE.BoxGeometry(4, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4 }), -36, 6.2, -126.5, 0, false);
  addSpot(-42, 4, -122.5, 0xfff0d0, 18, 14, 1.6);
  lampPost(-30.5, -105.2); lampPost(-46, -105.2); lampPost(-46, -118.8);

  // ================= GATES, in route order =================
  for (const g of GATES) L.gates.push(makeGate(scene, world, groundMat, g.x0, g.x1, g.at, !!g.alongZ));
}
