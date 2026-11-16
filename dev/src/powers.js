import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand } from './state.js';

// Big-moment VFX for Null's Surge and Root Access: lamp-style light halos, a fresnel shock dome,
// ground shock rings, a screen-space refraction shockwave, and the digital kit below.
function haloTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,255,255,0.9)'); g.addColorStop(0.22, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // soft starburst rays, like light bleeding through rain
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2, len = S * (0.32 + Math.random() * 0.18), w = 2 + Math.random() * 3;
    x.save(); x.translate(S / 2, S / 2); x.rotate(a);
    const rg = x.createLinearGradient(0, 0, len, 0); rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.moveTo(0, -w); x.lineTo(len, 0); x.lineTo(0, w); x.fill(); x.restore();
  }
  return new THREE.CanvasTexture(c);
}

let _haloTex = null;
export function sharedHaloTexture() { return _haloTex || (_haloTex = haloTexture()); }

export class Halos {
  constructor(scene, n = 10) {
    const tex = sharedHaloTexture();
    this.list = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      s.visible = false; s.renderOrder = 30; scene.add(s);
      this.list.push({ s, life: 0, ml: 1, s0: 1, s1: 2, i0: 1, col: new THREE.Color(), follow: null, rise: 0, hold: 0, pulse: 0 });
    }
    this.k = 0;
  }
  // a light-bloom halo; color can exceed 1 (HDR) so the bloom pass catches it
  spawn(pos, s0, s1, life, color, intensity = 1, opts = {}) {
    const h = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    h.s.position.copy(pos); h.life = life; h.ml = life; h.s0 = s0; h.s1 = s1; h.i0 = intensity;
    h.col.set(color); h.follow = opts.follow || null; h.yOff = opts.yOff || 0; h.hold = opts.hold || 0; h.pulse = opts.pulse || 0; h.ease = opts.ease || 'out';
    h.s.material.rotation = Math.random() * Math.PI * 2; h.spin = (Math.random() - 0.5) * 0.6;
    h.s.visible = true; return h;
  }
  update(dt) {
    for (const h of this.list) {
      if (h.life <= 0) { if (h.s.visible) h.s.visible = false; continue; }
      h.life -= dt;
      const t = 1 - Math.max(0, h.life) / h.ml;
      const e = h.ease === 'in' ? t * t : 1 - Math.pow(1 - t, 3);
      const sc = h.s0 + (h.s1 - h.s0) * e;
      h.s.scale.setScalar(sc * (1 + Math.sin(G.rt * 22) * 0.04 * h.pulse));
      if (h.follow) h.s.position.set(h.follow.x, h.follow.y + h.yOff, h.follow.z);
      const fade = t < h.hold ? 1 : 1 - (t - h.hold) / (1 - h.hold);
      const a = Math.max(0, fade) * h.i0;
      h.s.material.color.copy(h.col).multiplyScalar(a);
      h.s.material.opacity = Math.min(1, a);
      h.s.material.rotation += h.spin * dt;
    }
  }
}

// Expanding sphere with a hot fresnel rim — reads as a pressure wave in the rain
export class Domes {
  constructor(scene, n = 3) {
    const geo = new THREE.SphereGeometry(1, 48, 24);
    this.list = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uT: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uCol; uniform float uA; uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
          void main(){
            float f = 1.0 - abs(dot(vN, vV));
            float rim = pow(f, 2.6);
            float bands = 0.65 + 0.35 * sin(vP.y * 18.0 - uT * 30.0 + atan(vP.z, vP.x) * 6.0);
            float grain = 0.75 + 0.25 * h(floor(vP * 40.0));
            float ground = smoothstep(-0.05, 0.25, vP.y);   // only the upper hemisphere shows
            gl_FragColor = vec4(uCol * rim * bands * grain * uA * ground, 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 29; m.frustumCulled = false; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, r0: 0.5, r1: 6, a0: 1 });
    }
    this.k = 0;
  }
  spawn(pos, r0, r1, life, color, a0 = 1) {
    const d = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    d.m.position.set(pos.x, 0, pos.z); d.life = life; d.ml = life; d.r0 = r0; d.r1 = r1; d.a0 = a0;
    d.m.material.uniforms.uCol.value.set(color); d.m.visible = true;
  }
  update(dt) {
    for (const d of this.list) {
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.life -= dt;
      const t = 1 - Math.max(0, d.life) / d.ml;
      const e = 1 - Math.pow(1 - t, 3);
      const r = d.r0 + (d.r1 - d.r0) * e;
      d.m.scale.set(r, r * 0.62, r);
      d.m.material.uniforms.uA.value = d.a0 * (1 - t) * (1 - t) * 2.2;
      d.m.material.uniforms.uT.value = G.rt;
    }
  }
}

// Turbulent ground shock ring (thick hot leading edge + smoky trail)
export class ShockRings {
  constructor(scene, n = 4) {
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    this.list = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uCol: { value: new THREE.Color() }, uR: { value: 0.5 }, uA: { value: 0 }, uSeed: { value: Math.random() * 10 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uCol; uniform float uR; uniform float uA; uniform float uSeed; varying vec2 vUv;
          float n1(float x){ return fract(sin(x * 91.7 + uSeed) * 4375.85); }
          float vn(float a){ float i = floor(a), f = fract(a); return mix(n1(i), n1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
          void main(){
            float r = length(vUv); float a = atan(vUv.y, vUv.x);
            float wob = (vn(a * 5.0) - 0.5) * 0.06 + (vn(a * 13.0 + 7.0) - 0.5) * 0.03;
            float d = r - uR - wob;
            float edge = exp(-pow(d / 0.025, 2.0));
            float trail = smoothstep(-0.32, 0.0, d) * (1.0 - smoothstep(0.0, 0.02, d)) * 0.45;
            float streak = 0.6 + 0.4 * vn(a * 40.0);
            float v = (edge * 1.6 + trail * streak) * uA * smoothstep(1.0, 0.9, r);
            gl_FragColor = vec4(uCol * v, 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 7; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, r1: 6, a0: 1 });
    }
    this.k = 0;
  }
  spawn(pos, r1, life, color, a0 = 1) {
    const s = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    s.m.position.set(pos.x, 0.06, pos.z); s.m.scale.setScalar(r1); s.life = life; s.ml = life; s.a0 = a0;
    s.m.material.uniforms.uCol.value.set(color); s.m.material.uniforms.uSeed.value = Math.random() * 50; s.m.visible = true;
  }
  update(dt) {
    for (const s of this.list) {
      if (s.life <= 0) { s.m.visible = false; continue; }
      s.life -= dt;
      const t = 1 - Math.max(0, s.life) / s.ml;
      s.m.material.uniforms.uR.value = 0.04 + 0.86 * (1 - Math.pow(1 - t, 2.4));
      s.m.material.uniforms.uA.value = s.a0 * (1 - t);
    }
  }
}

// Screen-space refraction shockwave, consumed by the grade pass
export const Shock = {
  active: false, t: 0, life: 0.6, world: new THREE.Vector3(), maxR: 0.6, strength: 0.03,
  fire(pos, life = 0.6, maxR = 0.6, strength = 0.03) { this.world.copy(pos); this.t = 0; this.life = life; this.maxR = maxR; this.strength = strength; this.active = true; },
  update(dt, uniforms, camera, W, H) {
    if (!this.active) { uniforms.uShockS.value = 0; return; }
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) { this.active = false; uniforms.uShockS.value = 0; return; }
    const v = _v.copy(this.world).project(camera);
    uniforms.uShockC.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    uniforms.uShockR.value = this.maxR * (1 - Math.pow(1 - k, 2.2));
    uniforms.uShockS.value = this.strength * (1 - k);
    uniforms.uAspect.value = W / H;
  },
};
const _v = new THREE.Vector3();


export const Powers = {
  halos: null, domes: null, shocks: null, beams: null, grids: null, walls: null, voxels: null, reticles: null, brackets: null,
  init(scene) {
    this.halos = new Halos(scene, 12); this.domes = new Domes(scene, 3); this.shocks = new ShockRings(scene, 5);
    this.beams = new Beams(scene, 2); this.grids = new GridScans(scene, 3); this.walls = new ScanWalls(scene, 2);
    this.voxels = new Voxels(scene, 420); this.reticles = new Reticles(scene, 24); this.brackets = new Brackets(scene, 6);
  },
  update(dt) {
    this.halos.update(dt); this.domes.update(dt); this.shocks.update(dt); this.beams.update(dt);
    this.grids.update(dt); this.walls.update(dt); this.voxels.update(dt); this.reticles.update(dt); this.brackets.update(dt);
  },
};

// expanding-front timing shared by the ground scan, the data wall and gameplay hits
export const Front = {
  radiusAt(R, k) { return 0.6 + (R - 0.6) * (1 - Math.pow(1 - Math.min(1, k), 2)); },
  timeToReach(R, d, life) { const f = Math.min(1, Math.max(0, (d - 0.6) / (R - 0.6))); return (1 - Math.sqrt(1 - f)) * life; },
};

const HASH = 'float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }';

// ---------------------------------------------------------------------------
// Ground scan: the street turns into a grid of square tiles that light up as the
// front passes, then drop out at random, like a frame being redrawn.
// ---------------------------------------------------------------------------
export class GridScans {
  constructor(scene, n = 3) {
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    this.list = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -6,
        uniforms: { uCol: { value: new THREE.Color() }, uR: { value: 0 }, uRmax: { value: 7 }, uAge: { value: 0 }, uA: { value: 0 }, uCell: { value: 0.45 }, uT: { value: 0 }, uSeed: { value: 0 } },
        vertexShader: 'uniform float uRmax; varying vec2 vP; void main(){ vP = (uv * 2.0 - 1.0) * uRmax; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uCol; uniform float uR; uniform float uRmax; uniform float uAge; uniform float uA; uniform float uCell; uniform float uT; uniform float uSeed; varying vec2 vP;
          ${HASH}
          void main(){
            vec2 q = vP / uCell; vec2 cell = floor(q); vec2 f = fract(q);
            float rc = length((cell + 0.5) * uCell);
            if (rc > uRmax) discard;
            float h1 = hh(cell + uSeed), h2 = hh(cell + uSeed + 17.3);
            float d = uR - rc;                                   // > 0 once the front has passed this tile
            float inner = step(0.07, f.x) * step(f.x, 0.93) * step(0.07, f.y) * step(f.y, 0.93);
            float rim = 1.0 - step(0.035, f.x) * step(f.x, 0.965) * step(0.035, f.y) * step(f.y, 0.965);
            float ragged = (h2 - 0.5) * uCell * 1.6;             // the front is stair-stepped, never a clean circle
            float front = step(-uCell * 0.4, d + ragged) * step(d + ragged, uCell * 1.8);
            float keep = step(0.0, d) * step(h1, 0.5 - d * 0.06 - uAge * 0.62);
            float flick = step(0.22, hh(cell + floor(uT * 22.0) + uSeed));
            float tile = front * (0.55 + 0.3 * h2) + keep * 0.22 * flick;
            float grid = rim * step(0.0, d) * 0.16 * (1.0 - uAge);
            float edge = smoothstep(uRmax, uRmax - uCell * 3.0, rc);
            float v = (tile * (inner * 0.55 + rim * 1.5) + grid) * uA * edge;
            vec3 col = mix(uCol, vec3(1.8, 1.6, 2.6), front * step(d + ragged, uCell * 0.7) * 0.35);
            gl_FragColor = vec4(col * v, 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 7; m.frustumCulled = false; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, R: 7, scan: 0.8 });
    }
    this.k = 0;
  }
  // R = max radius, scan = seconds for the front to reach R, life = total lifetime (>= scan)
  spawn(pos, R, scan, life, color, cell = 0.45) {
    const g = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    g.m.position.set(pos.x, 0.035, pos.z); g.m.scale.setScalar(R); g.R = R; g.scan = scan; g.life = life; g.ml = life;
    const u = g.m.material.uniforms; u.uCol.value.set(color); u.uRmax.value = R; u.uCell.value = cell; u.uSeed.value = Math.random() * 90; u.uR.value = 0;
    g.m.visible = true; return g;
  }
  update(dt) {
    for (const g of this.list) {
      if (g.life <= 0) { g.m.visible = false; continue; }
      g.life -= dt; const age = g.ml - g.life;
      const u = g.m.material.uniforms;
      u.uR.value = Front.radiusAt(g.R, age / g.scan) * (age < g.scan ? 1 : 1.2);
      const k = Math.max(0, g.life / g.ml);
      u.uAge.value = 1 - k; u.uA.value = (age < 0.06 ? 1.2 : 0.95) * Math.min(1, k * 1.6); u.uT.value = G.rt;
    }
  }
}

// ---------------------------------------------------------------------------
// Data wall: a ring of flickering block columns with ragged tops and scanlines,
// rising at the front like a level meter, expanding with it.
// ---------------------------------------------------------------------------
export class ScanWalls {
  constructor(scene, n = 2) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true); geo.translate(0, 0.5, 0);
    this.list = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uT: { value: 0 }, uSeed: { value: Math.random() * 10 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uCol; uniform float uA; uniform float uT; uniform float uSeed; varying vec2 vUv;
          ${HASH}
          void main(){
            float seg = floor(vUv.x * 150.0);
            float gap = step(0.12, fract(vUv.x * 150.0));
            float tq = floor(uT * 16.0);
            float colH = 0.18 + 0.82 * pow(hh(vec2(seg, tq * 0.0 + 3.1) + uSeed), 1.6) * (0.7 + 0.3 * hh(vec2(seg, tq) + uSeed));
            float row = floor(vUv.y * 16.0);
            float on = step(0.5, hh(vec2(seg, row) + tq * 0.37 + uSeed));
            float rowgap = step(0.14, fract(vUv.y * 16.0));
            float top = step(vUv.y, colH);
            float cap = step(colH - 0.05, vUv.y) * top;
            float scan = 0.7 + 0.3 * step(0.5, fract(vUv.y * 70.0 - uT * 4.0));
            float base = smoothstep(0.0, 0.06, vUv.y);
            float v = on * rowgap * gap * top * scan * base * (1.0 - vUv.y / max(colH, 0.01) * 0.55) * uA;
            gl_FragColor = vec4(uCol * v + (uCol * 0.5 + vec3(0.45, 0.4, 0.6)) * cap * gap * uA, 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 27; m.frustumCulled = false; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, R: 7, H: 1.6 });
    }
    this.k = 0;
  }
  spawn(pos, R, H, life, color) {
    const w = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    w.m.position.set(pos.x, 0, pos.z); w.R = R; w.H = H; w.life = life; w.ml = life; w.m.material.uniforms.uCol.value.set(color); w.m.visible = true;
  }
  update(dt) {
    for (const w of this.list) {
      if (w.life <= 0) { w.m.visible = false; continue; }
      w.life -= dt; const age = 1 - Math.max(0, w.life / w.ml);
      const r = Front.radiusAt(w.R, age);
      w.m.scale.set(r, w.H * (1 - age * 0.6) * Math.min(1, age * 7), r);
      w.m.material.uniforms.uA.value = 1.1 * (1 - age) * (1 - age) * Math.min(1, age * 5) * (Math.random() < 0.08 ? 0.3 : 1); w.m.material.uniforms.uT.value = G.rt;
    }
  }
}

// ---------------------------------------------------------------------------
// Voxels: glowing data cubes. Positions snap to a coarse grid and they shrink in
// steps, so they move like pixels rather than debris.
// ---------------------------------------------------------------------------
export class Voxels {
  constructor(scene, max = 400) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const shade = [0.78, 0.62, 1.0, 0.42, 0.88, 0.55], c = [];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) c.push(shade[f], shade[f], shade[f]);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; scene.add(this.mesh);
    this.max = max; this.k = 0; this.live = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.r = new Float32Array(max * 3); this.w = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.ml = new Float32Array(max); this.s = new Float32Array(max); this.g = new Float32Array(max);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._pos = new THREE.Vector3(); this._sc = new THREE.Vector3();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this._zero);
  }
  emit(x, y, z, vx, vy, vz, size, life, r, g, b, grav = 9) {
    const i = this.k; this.k = (this.k + 1) % this.max;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    for (let a = 0; a < 3; a++) { this.r[i * 3 + a] = Math.random() * 6.28; this.w[i * 3 + a] = (Math.random() - 0.5) * 14; }
    this.life[i] = life; this.ml[i] = life; this.s[i] = size; this.g[i] = grav;
    this.mesh.instanceColor.setXYZ(i, r, g, b); this.mesh.instanceColor.needsUpdate = true;
    this.live = 1;
  }
  update(dt) {
    if (!this.live) return;
    let any = 0; const Q = 0.09, RQ = Math.PI / 8;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, this._zero); any = 1; continue; }
      const j = i * 3, P = this.p, V = this.v;
      V[j + 1] -= this.g[i] * dt;
      const drag = Math.exp(-1.8 * dt); V[j] *= drag; V[j + 2] *= drag;
      P[j] += V[j] * dt; P[j + 1] += V[j + 1] * dt; P[j + 2] += V[j + 2] * dt;
      if (P[j + 1] < this.s[i] * 0.5) { P[j + 1] = this.s[i] * 0.5; V[j + 1] *= -0.35; V[j] *= 0.6; V[j + 2] *= 0.6; }
      for (let a = 0; a < 3; a++) this.r[j + a] += this.w[j + a] * dt;
      const k = this.life[i] / this.ml[i];
      const step = Math.ceil(k * 4) / 4;                    // shrink in hard steps
      const flick = k < 0.45 && Math.random() < 0.16 ? 0 : 1;
      const sz = this.s[i] * step * flick;
      this._pos.set(Math.round(P[j] / Q) * Q, Math.round(P[j + 1] / Q) * Q, Math.round(P[j + 2] / Q) * Q);
      this._e.set(Math.round(this.r[j] / RQ) * RQ, Math.round(this.r[j + 1] / RQ) * RQ, Math.round(this.r[j + 2] / RQ) * RQ);
      this._q.setFromEuler(this._e); this._sc.set(sz, sz, sz);
      this._m.compose(this._pos, this._q, this._sc); this.mesh.setMatrixAt(i, this._m); any = 1;
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true; else this.live = 0;
  }
}

// ---------------------------------------------------------------------------
// Lock-on reticles for Root Access: snap onto each target and track it.
// ---------------------------------------------------------------------------
function reticleTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 7; x.lineCap = 'square';
  x.shadowColor = '#fff'; x.shadowBlur = 6;
  const m = 14, l = 30;
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const cx = sx ? S - m : m, cy = sy ? S - m : m, dx = sx ? -1 : 1, dy = sy ? -1 : 1;
    x.beginPath(); x.moveTo(cx, cy + dy * l); x.lineTo(cx, cy); x.lineTo(cx + dx * l, cy); x.stroke();
  }
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(S / 2, S / 2 - 12); x.lineTo(S / 2 + 12, S / 2); x.lineTo(S / 2, S / 2 + 12); x.lineTo(S / 2 - 12, S / 2); x.closePath(); x.stroke();
  x.fillRect(S / 2 - 3, S / 2 - 3, 6, 6);
  return new THREE.CanvasTexture(c);
}
export class Reticles {
  constructor(scene, n = 24) {
    const tex = reticleTexture(); this.list = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.visible = false; s.renderOrder = 40; scene.add(s);
      this.list.push({ s, on: false, t: 0, out: 0, target: null, yOff: 0, size: 1, col: new THREE.Color() });
    }
    this.k = 0;
  }
  spawn(target, yOff, size, color) {
    const r = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    r.target = target; r.yOff = yOff; r.size = size; r.t = 0; r.out = 0; r.on = true; r.col.set(color); r.s.visible = true;
    r.s.material.rotation = Math.PI / 4;
    return r;
  }
  clear(burst = false) { for (const r of this.list) if (r.on && !r.out) r.out = burst ? 0.22 : 0.12; }
  update(dt) {
    for (const r of this.list) {
      if (!r.on) continue;
      r.t += dt;
      const p = r.target; r.s.position.set(p.x, p.y + r.yOff, p.z);
      let sc, a;
      const lock = Math.min(1, r.t / 0.16);
      if (r.out) {
        r.out -= dt; if (r.out <= 0) { r.on = false; r.s.visible = false; continue; }
        sc = r.size * (1 + (0.22 - Math.max(0, r.out)) * 6); a = r.out / 0.22 * 2;
      } else {
        sc = r.size * (1 + (1 - lock) * 1.8) * (1 + Math.sin(r.t * 9) * 0.05);
        a = lock < 1 ? (Math.random() < 0.5 ? 1.6 : 0.4) : 1.2;
      }
      r.s.material.rotation = lock < 1 ? Math.PI / 4 * (1 - lock) : 0;
      r.s.scale.setScalar(sc);
      r.s.material.color.copy(r.col).multiplyScalar(a);
    }
  }
}

// ---------------------------------------------------------------------------
// Selection brackets: violet corner brackets that snap around whatever she holds.
// ---------------------------------------------------------------------------
const _bq = new THREE.Quaternion();
export class Brackets {
  constructor(scene, n = 6) {
    this.cache = new Map(); this.list = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.visible = false; m.renderOrder = 35; m.frustumCulled = false; scene.add(m);
      this.list.push({ m, obj: null, t: 0, out: 0, yOff: 0 });
    }
    this.col = new THREE.Color(1.1, 0.75, 2.6);
  }
  geo(hx, hy, hz) {
    const key = hx.toFixed(2) + ',' + hy.toFixed(2) + ',' + hz.toFixed(2);
    if (this.cache.has(key)) return this.cache.get(key);
    const th = 0.03, parts = [];
    const L = Math.max(0.12, Math.min(0.45, Math.min(hx, hy, hz) * 0.7));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * hx, cy = sy * hy, cz = sz * hz;
      const a = new THREE.BoxGeometry(L, th, th); a.translate(cx - sx * L / 2, cy, cz); parts.push(a);
      const b = new THREE.BoxGeometry(th, L, th); b.translate(cx, cy - sy * L / 2, cz); parts.push(b);
      const c = new THREE.BoxGeometry(th, th, L); c.translate(cx, cy, cz - sz * L / 2); parts.push(c);
    }
    const g = mergeGeometries(parts); parts.forEach(p => p.dispose());
    this.cache.set(key, g); return g;
  }
  attach(obj, size, yOff = 0) {
    const b = this.list.find(x => !x.obj && !x.out) || this.list.find(x => !x.obj) || this.list[0];
    const pad = 0.08;
    b.m.geometry = this.geo(size.x / 2 + pad, size.y / 2 + pad, size.z / 2 + pad);
    b.obj = obj; b.t = 0; b.out = 0; b.yOff = yOff; b.m.visible = true;
    return b;
  }
  detach(obj) { for (const b of this.list) if (b.obj === obj) { b.obj = null; b.out = 0.16; b.last = b.m.position.clone(); } }
  update(dt) {
    for (const b of this.list) {
      if (!b.obj && !b.out) { if (b.m.visible) b.m.visible = false; continue; }
      let sc, a;
      if (b.obj) {
        const o = b.obj, p = o.body.position, q = o.body.quaternion;
        if (!o.alive) { this.detach(o); continue; }
        b.t += dt;
        _bq.set(q.x, q.y, q.z, q.w);
        b.m.quaternion.copy(_bq);
        b.m.position.set(0, b.yOff, 0).applyQuaternion(_bq).add(p);
        const lock = Math.min(1, b.t / 0.14);
        sc = 1 + (1 - lock * lock) * 0.45;
        a = lock < 1 ? (Math.random() < 0.6 ? 1.4 : 0.3) : 0.85 + Math.sin(b.t * 7) * 0.15;
      } else {
        b.out -= dt; if (b.out <= 0) { b.out = 0; b.m.visible = false; continue; }
        sc = 1 + (0.16 - b.out) * 2.5; a = b.out / 0.16;
      }
      b.m.scale.setScalar(sc);
      b.m.material.color.copy(this.col).multiplyScalar(a);
    }
  }
}

// vertical pillar of light at the caster
export class Beams {
  constructor(scene, n = 2) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true); geo.translate(0, 0.5, 0);
    this.list = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uT: { value: 0 } },
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: `uniform vec3 uCol; uniform float uA; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){ float core = pow(abs(dot(vN, vV)), 1.5); float up = pow(1.0 - vUv.y, 1.6);
            float streak = 0.7 + 0.3 * sin(vUv.x * 60.0 + uT * 8.0) * sin(vUv.y * 9.0 - uT * 20.0);
            gl_FragColor = vec4(uCol * core * up * streak * uA, 1.0); }`,
      });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 28; m.frustumCulled = false; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, r: 1, h: 10 });
    }
    this.k = 0;
  }
  spawn(pos, r, h, life, color) {
    const b = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    b.m.position.set(pos.x, 0, pos.z); b.r = r; b.h = h; b.life = life; b.ml = life; b.m.material.uniforms.uCol.value.set(color); b.m.visible = true;
  }
  update(dt) {
    for (const b of this.list) {
      if (b.life <= 0) { b.m.visible = false; continue; }
      b.life -= dt; const k = Math.max(0, b.life / b.ml), age = 1 - k;
      const w = b.r * (0.35 + 0.65 * Math.min(1, age * 6)) * (0.6 + 0.4 * k);
      b.m.scale.set(w, b.h * (0.6 + 0.4 * Math.min(1, age * 8)), w);
      b.m.material.uniforms.uA.value = 2.2 * k * k; b.m.material.uniforms.uT.value = G.rt;
    }
  }
}
