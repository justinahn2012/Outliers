import * as THREE from 'three';
import { G, rand } from './state.js';

// ---------- GPU point particles (CPU simulated) ----------
const PVERT = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale;
varying float vAlpha; varying vec3 vColor;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vAlpha = aAlpha; vColor = aColor;
}`;
const PFRAG = `
varying float vAlpha; varying vec3 vColor; uniform float uSoft;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.5 - uSoft, d);
  gl_FragColor = vec4(vColor, vAlpha * a);
}`;

export class Particles {
  constructor(scene, max, additive, soft = 0.45) {
    this.max = max; this.i = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.life = new Float32Array(max); this.ml = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG,
      uniforms: { uScale: { value: 400 }, uSoft: { value: soft } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, r, g, b, life, s0, s1, grav = 0, drag = 0, a0 = 1) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    const k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z;
    this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.c[k] = r; this.c[k + 1] = g; this.c[k + 2] = b;
    this.life[i] = life; this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = a0;
  }
  update(dt) {
    const { p, v, life, ml } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (this.size[i] !== 0) { this.size[i] = 0; this.alpha[i] = 0; } continue; }
      life[i] -= dt;
      const k = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      v[k] *= dr; v[k + 1] = v[k + 1] * dr - this.grav[i] * dt; v[k + 2] *= dr;
      p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
      if (p[k + 1] < 0.03 && this.grav[i] > 0) { p[k + 1] = 0.03; v[k + 1] *= -0.3; v[k] *= 0.6; v[k + 2] *= 0.6; }
      const t = 1 - Math.max(0, life[i]) / ml[i];
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }
}

// ---------- Telekinetic tether ribbon ----------
const TVERT = `
varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const TFRAG = `
varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
void main(){
  float across = abs(vUv.y - 0.5) * 2.0;
  float core = exp(-across*across*7.0);
  float pulse = 0.55 + 0.45 * sin(vUv.x * 38.0 - uTime * 22.0);
  float wisp = 0.5 + 0.5 * sin(vUv.x * 13.0 + uTime * 9.0 + vUv.y * 6.0);
  float fade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
  float a = core * (0.35 + 0.65 * pulse * wisp) * fade * uAlpha;
  gl_FragColor = vec4(uColor * (1.2 + core * 2.5), a);
}`;
export class Tether {
  constructor(scene) {
    this.N = 24;
    const n = this.N + 1;
    this.pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < n; i++) {
      uv[i * 4] = i / this.N; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / this.N; uv[i * 4 + 3] = 1;
      if (i < this.N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: TVERT, fragmentShader: TFRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.62, 0.42, 1.0) }, uAlpha: { value: 1 } },
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.mesh.renderOrder = 11;
    scene.add(this.mesh);
  }
  set(a, b, camPos, t, alpha, width, sag) {
    this.mesh.visible = alpha > 0.01;
    if (!this.mesh.visible) return;
    this.mat.uniforms.uTime.value = t; this.mat.uniforms.uAlpha.value = alpha;
    const mid = _m.copy(a).add(b).multiplyScalar(0.5); mid.y += sag;
    // perpendicular wiggle
    for (let i = 0; i <= this.N; i++) {
      const u = i / this.N, iu = 1 - u;
      const px = iu * iu * a.x + 2 * iu * u * mid.x + u * u * b.x;
      const py = iu * iu * a.y + 2 * iu * u * mid.y + u * u * b.y;
      const pz = iu * iu * a.z + 2 * iu * u * mid.z + u * u * b.z;
      // tangent
      const tx = 2 * iu * (mid.x - a.x) + 2 * u * (b.x - mid.x);
      const ty = 2 * iu * (mid.y - a.y) + 2 * u * (b.y - mid.y);
      const tz = 2 * iu * (mid.z - a.z) + 2 * u * (b.z - mid.z);
      _t.set(tx, ty, tz).normalize();
      _c.set(camPos.x - px, camPos.y - py, camPos.z - pz).normalize();
      _s.crossVectors(_t, _c).normalize();
      const wob = Math.sin(u * 9 + t * 14) * 0.06 * Math.sin(u * Math.PI);
      const w = width * (0.55 + 0.45 * Math.sin(u * Math.PI));
      const k = i * 6;
      const cx = px + _s.x * wob, cy = py + _s.y * wob, cz = pz + _s.z * wob;
      this.pos[k] = cx - _s.x * w; this.pos[k + 1] = cy - _s.y * w; this.pos[k + 2] = cz - _s.z * w;
      this.pos[k + 3] = cx + _s.x * w; this.pos[k + 4] = cy + _s.y * w; this.pos[k + 5] = cz + _s.z * w;
    }
    this.aPos.needsUpdate = true;
  }
}
const _m = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();

// ---------- Rings (shockwaves, telegraphs, target locks) ----------
export class Rings {
  constructor(scene, n = 10) {
    this.list = [];
    const geo = new THREE.RingGeometry(0.82, 1, 64, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 8; scene.add(m);
      this.list.push({ m, life: 0, ml: 1, r0: 1, r1: 2, a0: 1, follow: null });
    }
    this.k = 0;
  }
  spawn(x, y, z, r0, r1, life, color, a0 = 1, follow = null) {
    const r = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    r.m.position.set(x, y, z); r.m.material.color.set(color);
    r.life = life; r.ml = life; r.r0 = r0; r.r1 = r1; r.a0 = a0; r.follow = follow; r.m.visible = true;
    r.m.scale.setScalar(r0);
    return r;
  }
  update(dt) {
    for (const r of this.list) {
      if (r.life <= 0) { r.m.visible = false; continue; }
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.ml;
      const e = 1 - Math.pow(1 - t, 3);
      r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      r.m.material.opacity = r.a0 * (1 - t);
      if (r.follow) { r.m.position.x = r.follow.x; r.m.position.z = r.follow.z; }
    }
  }
}

// ---------- Floating combat text ----------
export class Numbers {
  constructor(el) {
    this.el = el; this.list = [];
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('div'); d.className = 'num'; el.appendChild(d);
      this.list.push({ d, life: 0, p: new THREE.Vector3(), vy: 0 });
    }
    this.k = 0; this._v = new THREE.Vector3();
  }
  spawn(pos, text, cls, scale = 1) {
    const n = this.list[this.k]; this.k = (this.k + 1) % this.list.length;
    n.p.copy(pos); n.p.x += rand(-0.3, 0.3); n.life = 0.9; n.vy = 2.4;
    n.d.textContent = text; n.d.className = 'num ' + (cls || '');
    n.scale = scale; n.d.style.display = 'block';
  }
  update(dt, camera) {
    for (const n of this.list) {
      if (n.life <= 0) { if (n.d.style.display !== 'none') n.d.style.display = 'none'; continue; }
      n.life -= dt; n.p.y += n.vy * dt; n.vy *= 0.92;
      const v = this._v.copy(n.p).project(camera);
      const x = (v.x * 0.5 + 0.5) * G.W, y = (-v.y * 0.5 + 0.5) * G.H;
      const t = n.life / 0.9;
      const s = n.scale * (t > 0.8 ? 1 + (t - 0.8) * 3 : 1);
      n.d.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`;
      n.d.style.opacity = Math.min(1, t * 2.2);
    }
  }
}

// ---------- High-level FX helpers ----------
export const FX = {
  add: null, smoke: null, rings: null, numbers: null, flashLight: null, flashI: 0,
  init(scene, numbersEl) {
    this.add = new Particles(scene, 1800, true, 0.5);
    this.smoke = new Particles(scene, 360, false, 0.5);
    this.rings = new Rings(scene, 14);
    this.numbers = new Numbers(numbersEl);
    this.flashLight = new THREE.PointLight(0xffa040, 0, 26, 1.6);
    this.flashLight.position.set(0, -50, 0);
    scene.add(this.flashLight);
  },
  setScale(px) { this.add.mat.uniforms.uScale.value = px; this.smoke.mat.uniforms.uScale.value = px; },
  update(dt) {
    this.add.update(dt); this.smoke.update(dt); this.rings.update(dt);
    if (this.flashI > 0) { this.flashI = Math.max(0, this.flashI * Math.exp(-dt * 9) - dt * 10); }
    this.flashLight.intensity = this.flashI;
  },
  flash(pos, color, intensity) {
    this.flashLight.position.set(pos.x, pos.y + 1.2, pos.z);
    this.flashLight.color.set(color);
    this.flashI = Math.max(this.flashI, intensity);
  },
  sparks(p, n, speed, col = [1, 0.75, 0.4], size = 0.12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = rand(-0.2, 1);
      const s = speed * rand(0.35, 1);
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * s * (1 - u * 0.5), u * s + 1.5, Math.sin(a) * s * (1 - u * 0.5),
        col[0] * 2.5, col[1] * 2.2, col[2] * 2, rand(0.25, 0.6), size, size * 0.3, 18, 1.5);
    }
  },
  psi(p, n, speed, size = 0.22, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = rand(-1, 1);
      const s = speed * rand(0.3, 1);
      const c = Math.random();
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * s, e * s * 0.7, Math.sin(a) * s,
        0.55 + c * 0.4, 0.38 + c * 0.3, 1.5, rand(life * 0.6, life), size, 0.02, 0, 2.5, 0.9);
    }
  },
  dust(p, n, spread, size = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.5, 1) * spread;
      const g = rand(0.16, 0.24);
      this.smoke.emit(p.x + Math.cos(a) * 0.3, 0.2, p.z + Math.sin(a) * 0.3, Math.cos(a) * s, rand(0.3, 1.2), Math.sin(a) * s,
        g, g * 1.02, g * 1.1, rand(0.7, 1.3), size * 0.5, size * 1.6, -0.3, 2.2, 0.55);
    }
  },
  explosion(p, r) {
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, e = rand(-0.2, 1), s = rand(2, 9) * r / 3.5;
      const hot = Math.random();
      this.add.emit(p.x, p.y + 0.4, p.z, Math.cos(a) * s * (1 - e * 0.4), e * s + 2, Math.sin(a) * s * (1 - e * 0.4),
        2.3, 0.85 + hot * 0.9, 0.18 + hot * 0.15, rand(0.35, 0.75), rand(0.8, 1.5) * r / 3.5, 0.2, -2, 3.2);
    }
    this.sparks(p, 40, 16, [1, 0.7, 0.3], 0.12);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.6, 3.2);
      const g = rand(0.06, 0.13);
      this.smoke.emit(p.x + Math.cos(a) * 0.5, p.y + rand(0.3, 1.5), p.z + Math.sin(a) * 0.5,
        Math.cos(a) * s, rand(1.2, 3.4), Math.sin(a) * s, g, g, g * 1.1, rand(1.4, 2.6), 1.2, 3.6, -0.6, 1.4, 0.75);
    }
    this.rings.spawn(p.x, 0.08, p.z, 0.5, r * 1.15, 0.45, 0xffa050, 1);
    this.flash(p, 0xff8a3a, 55);
  },
  splash(p) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.5, 3);
      this.add.emit(p.x, -0.9, p.z, Math.cos(a) * s, rand(4, 9), Math.sin(a) * s, 0.5, 0.65, 0.9, rand(0.6, 1.1), 0.18, 0.08, 18, 0.5, 0.8);
    }
    this.rings.spawn(p.x, -1.08, p.z, 0.3, 3, 1.1, 0x6f8fb8, 0.6);
  },
};
