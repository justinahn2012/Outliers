import * as THREE from 'three';
import { G, rand } from './state.js';

// Big-moment VFX for Surge and Undertow: lamp-style light halos, a fresnel shock dome,
// a turbulent ground shock ring, and data for a screen-space refraction shockwave.

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

export class Halos {
  constructor(scene, n = 10) {
    const tex = haloTexture();
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
  halos: null, domes: null, shocks: null, spikes: null, fissures: null, beams: null, walls: null,
  init(scene) {
    this.halos = new Halos(scene, 12); this.domes = new Domes(scene, 3); this.shocks = new ShockRings(scene, 5);
    this.spikes = new Spikes(scene, 220); this.fissures = new Fissures(scene, 3); this.beams = new Beams(scene, 2); this.walls = new WaveWalls(scene, 2);
  },
  update(dt) {
    this.halos.update(dt); this.domes.update(dt); this.shocks.update(dt);
    this.spikes.update(dt); this.fissures.update(dt); this.beams.update(dt); this.walls.update(dt);
  },
};

// ---------------------------------------------------------------------------
// Eruption kit — DOTA/WC3-style ground ability: crystal spike waves, glowing fissures,
// a light pillar and a rolling wall of water.
// ---------------------------------------------------------------------------
function shardGeometry() {
  // tall faceted crystal, base at y=0, tip at y=1
  const g = new THREE.CylinderGeometry(0, 1, 1, 5, 3, false);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const bulge = Math.sin(Math.min(1, y) * Math.PI) * 0.18;           // fatter mid-section
    p.setX(i, p.getX(i) * (1 + bulge) + (Math.random() - 0.5) * 0.04 * (1 - y));
    p.setZ(i, p.getZ(i) * (1 + bulge) + (Math.random() - 0.5) * 0.04 * (1 - y));
  }
  g.computeVertexNormals();
  return g;
}

export class Spikes {
  constructor(scene, max = 200) {
    this.max = max;
    const geo = shardGeometry();
    this.aGlow = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGlow', this.aGlow);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute float aGlow; varying float vG; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){
          vec4 lp = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            lp = instanceMatrix * lp;
            vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          #else
            vN = normalize(normalMatrix * normal);
          #endif
          vec4 mv = modelViewMatrix * lp; vV = normalize(-mv.xyz); vY = position.y; vG = aGlow;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uTime; varying float vG; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){
          if (vG <= 0.001) discard;
          float f = 1.0 - abs(dot(normalize(vN), vV));
          vec3 deep = vec3(0.10, 0.04, 0.32);
          vec3 hot = vec3(0.95, 0.62, 2.0);
          float facet = 0.55 + 0.45 * abs(normalize(vN).x * 0.7 + normalize(vN).z * 0.3);
          float bands = 0.75 + 0.25 * sin(vY * 22.0 - uTime * 14.0);
          vec3 col = deep * facet + hot * (pow(f, 2.2) * 1.4 + pow(vY, 3.0) * 1.1) * bands;
          col += vec3(1.8, 1.5, 2.6) * smoothstep(0.85, 1.0, vY) * 0.6;
          col *= vG;
          gl_FragColor = vec4(col, clamp(0.78 + f * 0.22, 0.0, 1.0) * min(1.0, vG * 1.5));
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.items = Array.from({ length: max }, () => ({ on: false }));
    this.k = 0; this.mat = mat;
    const M = new THREE.Matrix4(); M.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, M);
    this.onShatter = null;
  }
  // rings: [{ r, n, h, w }]; speed = how fast the wave front travels (m/s)
  burst(center, rings, speed = 18, hold = 0.32) {
    for (const R of rings) {
      const off = Math.random() * Math.PI * 2;
      for (let j = 0; j < R.n; j++) {
        const it = this.items[this.k]; this.k = (this.k + 1) % this.max;
        const a = off + (j / R.n) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / R.n) * 0.6;
        const r = R.r * (0.88 + Math.random() * 0.24);
        it.on = true; it.t = -r / speed; it.hold = hold * (0.8 + Math.random() * 0.4);
        it.pos = new THREE.Vector3(center.x + Math.cos(a) * r, -0.05, center.z + Math.sin(a) * r);
        const tilt = 0.25 + Math.random() * 0.45;
        const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)).normalize();
        it.q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28));
        it.h = R.h * (0.7 + Math.random() * 0.6); it.w = R.w * (0.75 + Math.random() * 0.6);
        it.erupted = false; it.shattered = false;
      }
    }
  }
  update(dt) {
    const M = new THREE.Matrix4(), S = new THREE.Vector3();
    this.mat.uniforms.uTime.value = G.rt;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const it = this.items[i];
      if (!it.on) continue;
      any = true;
      it.t += dt;
      let sy = 0, sw = 0, glow = 0;
      if (it.t < 0) { sy = 0; }
      else if (it.t < 0.09) { const k = it.t / 0.09; sy = (1 - Math.pow(1 - k, 3)) * 1.18; sw = 0.6 + k * 0.4; glow = 2.4; if (!it.erupted) { it.erupted = true; this.onErupt && this.onErupt(it); } }
      else if (it.t < 0.09 + it.hold) { const k = (it.t - 0.09) / it.hold; sy = 1.18 - 0.18 * Math.min(1, k * 3); sw = 1; glow = 1.0 + 1.4 * Math.max(0, 1 - k * 4); }
      else if (it.t < 0.09 + it.hold + 0.22) {
        const k = (it.t - 0.09 - it.hold) / 0.22; sy = 1 - k; sw = 1 - k * 0.5; glow = 1 + k * 1.5;
        if (!it.shattered) { it.shattered = true; this.onShatter && this.onShatter(it); }
      } else { it.on = false; }
      S.set(it.w * sw, it.h * sy, it.w * sw);
      M.compose(it.pos, it.q, it.on ? S : S.set(0, 0, 0));
      this.mesh.setMatrixAt(i, M);
      this.aGlow.array[i] = it.on ? glow : 0;
    }
    if (any || this._wasAny) { this.mesh.instanceMatrix.needsUpdate = true; this.aGlow.needsUpdate = true; }
    this._wasAny = any;
  }
}

function fissureTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.shadowColor = '#fff'; x.shadowBlur = 10;
  const crack = (px, py, ang, len, w, depth) => {
    let cx = px, cy = py;
    x.lineWidth = w; x.beginPath(); x.moveTo(cx, cy);
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      ang += (Math.random() - 0.5) * 0.7;
      cx += Math.cos(ang) * len / steps; cy += Math.sin(ang) * len / steps;
      x.lineTo(cx, cy);
      if (depth > 0 && Math.random() < 0.28) { x.stroke(); crack(cx, cy, ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), len * 0.45, w * 0.6, depth - 1); x.lineWidth = w; x.beginPath(); x.moveTo(cx, cy); }
      x.lineWidth = Math.max(1, w * (1 - i / steps));
    }
    x.stroke();
  };
  const n = 13;
  for (let i = 0; i < n; i++) crack(S / 2, S / 2, (i / n) * Math.PI * 2 + Math.random() * 0.3, S * (0.36 + Math.random() * 0.12), 5 + Math.random() * 3, 2);
  // scorched core
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.16); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.shadowBlur = 0; x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export class Fissures {
  constructor(scene, n = 3) {
    this.tex = [fissureTexture(), fissureTexture(), fissureTexture()];
    this.list = [];
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: this.tex[i % 3], color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6 });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 6; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, R: 6, col: new THREE.Color() });
    }
    this.k = 0;
  }
  spawn(pos, R, life, color) {
    const f = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    f.m.position.set(pos.x, 0.03, pos.z); f.m.rotation.y = Math.random() * 6.28; f.gain = R > 9 ? 0.6 : 1; f.R = R; f.life = life; f.ml = life; f.col.set(color); f.m.visible = true;
  }
  update(dt) {
    for (const f of this.list) {
      if (f.life <= 0) { f.m.visible = false; continue; }
      f.life -= dt; const age = f.ml - f.life;
      const grow = 1 - Math.pow(1 - Math.min(1, age / 0.16), 3);
      f.m.scale.setScalar(f.R * (0.25 + 0.75 * grow));
      const k = Math.max(0, f.life / f.ml);
      const flick = 0.85 + Math.random() * 0.15;
      f.m.material.color.copy(f.col).multiplyScalar((age < 0.1 ? 2.0 : 0.95) * k * k * flick * f.gain);
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

// rolling ring-wall of water thrown up by the wave front
export class WaveWalls {
  constructor(scene, n = 2) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true); geo.translate(0, 0.5, 0);
    this.list = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uA: { value: 0 }, uT: { value: 0 }, uSeed: { value: Math.random() * 10 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.y *= 0.75 + 0.35 * sin(uv.x * 37.0) * sin(uv.x * 11.0 + 1.3); gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
        fragmentShader: `uniform float uA; uniform float uT; uniform float uSeed; varying vec2 vUv;
          float h(float x){ return fract(sin(x * 127.1 + uSeed) * 43758.5); }
          void main(){
            float col = floor(vUv.x * 220.0);
            float streak = 0.4 + 0.6 * h(col);
            float rise = fract(vUv.y * 2.0 - uT * 3.0 + h(col + 3.0));
            float foam = smoothstep(0.0, 0.25, vUv.y) * pow(1.0 - vUv.y, 1.4);
            float v = foam * streak * (0.65 + 0.35 * rise) * uA;
            gl_FragColor = vec4(vec3(0.55, 0.65, 0.95) * v + vec3(0.6, 0.4, 1.0) * v * 0.5, 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 27; m.frustumCulled = false; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, R: 7, H: 1.6 });
    }
    this.k = 0;
  }
  spawn(pos, R, H, life) {
    const w = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    w.m.position.set(pos.x, 0, pos.z); w.R = R; w.H = H; w.life = life; w.ml = life; w.m.visible = true;
  }
  update(dt) {
    for (const w of this.list) {
      if (w.life <= 0) { w.m.visible = false; continue; }
      w.life -= dt; const age = 1 - Math.max(0, w.life / w.ml);
      const r = 0.6 + (w.R - 0.6) * (1 - Math.pow(1 - age, 2));
      w.m.scale.set(r, w.H * (1 - age * 0.7) * Math.min(1, age * 8), r);
      w.m.material.uniforms.uA.value = 1.6 * (1 - age); w.m.material.uniforms.uT.value = G.rt;
    }
  }
}
