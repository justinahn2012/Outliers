import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, GRP, ALL, clamp, damp } from './state.js';
import { makeCharacter, findBone, blobShadow } from './assets.js';
import { sharedHaloTexture } from './powers.js';

// Iris Calloway — a real rigged, motion-captured actor (charcoal leather, silver hair),
// with telekinetic overlays: floating hair, glowing hands, reach-and-hold arm IK.
export function createHero() {
  const root = new THREE.Group();
  const model = new THREE.Group(); root.add(model);
  const c = makeCharacter('iris', { idle: 'f_idle_neutral_01', walk: 'f_walk_cool_01', run: 'f_run_fast_01' });
  c.obj.scale.setScalar(1.1);
  model.add(c.obj);
  const B = c.bones;
  const bones = {
    head: findBone(B, 'Bip01_Head'), neck: findBone(B, 'Bip01_Neck'), spine: findBone(B, 'Bip01_Spine2', 'Bip01_Spine1'),
    rU: findBone(B, 'Bip01_R_UpperArm'), rF: findBone(B, 'Bip01_R_Forearm'), rH: findBone(B, 'Bip01_R_Hand'),
    lU: findBone(B, 'Bip01_L_UpperArm'), lF: findBone(B, 'Bip01_L_Forearm'), lH: findBone(B, 'Bip01_L_Hand'),
  };
  // hair material: a little emissive lift so the silver reads at night
  for (const m of c.mats) if (m.alphaTest > 0 || /opacity/.test(m.name)) { m.color.setRGB(0.78, 0.82, 0.95); m.emissive = new THREE.Color(0x8a90b0); m.emissiveIntensity = 0.06; }

  const U = { uTime: { value: 0 }, uPower: { value: 0 }, uFlow: { value: new THREE.Vector2() } };
  // Floating silver locks — her "still underwater" signature. Thin, hashed-alpha strands that drift.
  const hair = null; // floating-strand overlay removed: read as a white broom from the gameplay camera

  // hand glows
  const glowTex = softTex();
  const mkSprite = (tex, col, sc) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(sc); s.renderOrder = 31; G.scene.add(s); return s; };
  // each hand: a hot core + a lamp-style halo with rays
  const handGlow = [0, 1].map(() => mkSprite(glowTex, new THREE.Color(1.6, 1.25, 2.6), 0.32));
  const handHalo = [0, 1].map(() => mkSprite(sharedHaloTexture(), new THREE.Color(0.85, 0.55, 1.9), 1.1));
  const browGlow = mkSprite(glowTex, new THREE.Color(1.4, 1.0, 2.6), 0.22);
  const browHalo = mkSprite(sharedHaloTexture(), new THREE.Color(0.7, 0.45, 1.6), 0.7);
  // ground aura
  const auraTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createRadialGradient(64, 64, 18, 64, 64, 64); g.addColorStop(0, 'rgba(150,110,255,0)'); g.addColorStop(0.72, 'rgba(150,110,255,0.35)'); g.addColorStop(0.84, 'rgba(210,190,255,0.75)'); g.addColorStop(1, 'rgba(150,110,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
  })();
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.9, 0.75, 1.4) }));
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; aura.renderOrder = 5; root.add(aura);
  const blob = blobShadow(1.3); blob.position.y = 0.02; root.add(blob);
  const light = new THREE.PointLight(0xa58cff, 1.5, 6, 2); light.position.set(0, 1.2, 0.9); root.add(light);
  G.scene.add(root);

  const body = new CANNON.Body({ mass: 70, material: G.charMat, fixedRotation: true, linearDamping: 0.0, collisionFilterGroup: GRP.HERO, collisionFilterMask: ALL & ~GRP.HELD, allowSleep: false });
  body.addShape(new CANNON.Sphere(0.36), new CANNON.Vec3(0, -0.47, 0));
  body.addShape(new CANNON.Sphere(0.32), new CANNON.Vec3(0, 0.3, 0));
  body.position.set(0, 0.85, 12);
  G.world.addBody(body);

  const hero = {
    kind: 'hero', root, model, body, char: c, bones, hair, handGlow, handHalo, browGlow, browHalo, aura, light, U, trail: new HandTrail(), flourish: null,
    hp: 100, maxHp: 100, focus: 100, maxFocus: 100,
    yaw: Math.PI, moveAmt: 0, power: 0, lastHurt: -10, focusDelay: 0, levitate: 0, invuln: 0, dead: false,
    pos: new THREE.Vector3(0, 0, 12), aimW: [0, 0], stepT: 0, stepSide: 1,
  };
  body.userData = hero;
  return hero;
}

let _soft = null;
export function softTex() {
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _soft = new THREE.CanvasTexture(c); return _soft;
}

function buildFloatingHair(U) {
  const strands = 70, segs = 10;
  const pos = [], uv = [], aU = [], aT = [], aPh = [], idx = [];
  let vi = 0;
  for (let s = 0; s < strands; s++) {
    const a = Math.PI * (0.35 + 1.3 * Math.random());          // from the back/sides of the crown
    const root = new THREE.Vector3(Math.cos(a) * 0.075, 0.07 + Math.random() * 0.04, -Math.abs(Math.sin(a)) * 0.07 - 0.015);
    const dir = new THREE.Vector3(Math.cos(a) * 0.35, 0.35 + Math.random() * 0.3, -1).normalize();
    const len = 0.22 + Math.random() * 0.3;
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0.3)).normalize();
    const ph = Math.random() * 6.28, w0 = 0.006 + Math.random() * 0.01;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const p = root.clone().addScaledVector(dir, len * t);
      p.y += Math.sin(t * 3 + ph) * 0.03 * t; p.x += Math.sin(t * 2.4 + ph * 1.3) * 0.03 * t;
      const w = w0 * (1 - t * 0.8);
      pos.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
      uv.push(0, t, 1, t); aU.push(0, 1); aT.push(t, t); aPh.push(ph, ph);
      if (k < segs) idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
      vi += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
  g.setAttribute('aPh', new THREE.Float32BufferAttribute(aPh, 1));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xdfe3ee, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide, alphaHash: true, transparent: false, emissive: 0x7a66ff, emissiveIntensity: 0.15 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uPower = U.uPower; sh.uniforms.uFlow = U.uFlow;
    sh.vertexShader = 'attribute float aT; attribute float aU; attribute float aPh; uniform float uTime; uniform float uPower; uniform vec2 uFlow; varying float vT; varying float vU;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position); float t = aT; vT = t; vU = aU; float w = t * t;
      float amp = 0.035 + uPower * 0.07;
      transformed.x += sin(uTime * 1.2 + aPh + t * 3.0) * amp * w;
      transformed.z += cos(uTime * 1.0 + aPh * 1.7 + t * 2.4) * amp * w;
      transformed.y += (sin(uTime * 0.8 + aPh * 0.6 + t * 2.0) * amp * 0.8 + uPower * 0.16) * w;
      transformed.xz -= uFlow * w * 0.18;`);
    sh.fragmentShader = 'varying float vT; varying float vU;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      diffuseColor.a *= (1.0 - smoothstep(0.55, 1.0, vT)) * (0.55 + 0.45 * sin(vU * 3.14159));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= (0.3 + vT * 2.2);`);
  };
  const m = new THREE.Mesh(g, mat); m.castShadow = false; m.frustumCulled = false;
  return m;
}

// --- a ribbon of light that trails her conducting hand, like a baton's path ---
class HandTrail {
  constructor(n = 22) {
    this.n = n; this.pts = Array.from({ length: n }, () => new THREE.Vector3()); this.ready = false;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < n; i++) { uv[i * 4] = i / (n - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (n - 1); uv[i * 4 + 3] = 1; if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); this.attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float head = 1.0 - vUv.x; float across = 1.0 - abs(vUv.y - 0.5) * 2.0; float v = pow(head, 1.6) * pow(across, 1.5) * uA; gl_FragColor = vec4(vec3(0.85, 0.6, 2.2) * v * 2.0, 1.0); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 32; G.scene.add(this.mesh);
  }
  update(p, alpha, camPos) {
    if (!this.ready) { this.pts.forEach(q => q.copy(p)); this.ready = true; }
    for (let i = this.n - 1; i > 0; i--) this.pts[i].lerp(this.pts[i - 1], 0.55);
    this.pts[0].copy(p);
    this.mat.uniforms.uA.value = alpha; this.mesh.visible = alpha > 0.02;
    if (!this.mesh.visible) return;
    const a = this.attr.array;
    for (let i = 0; i < this.n; i++) {
      const c = this.pts[i], nx = this.pts[Math.min(this.n - 1, i + 1)], pv = this.pts[Math.max(0, i - 1)];
      _tg.subVectors(pv, nx); if (_tg.lengthSq() < 1e-8) _tg.set(0, 1, 0); _tg.normalize();
      _cv.subVectors(camPos, c).normalize(); _sd.crossVectors(_tg, _cv).normalize();
      const w = 0.045 * (1 - i / this.n);
      a[i * 6] = c.x - _sd.x * w; a[i * 6 + 1] = c.y - _sd.y * w; a[i * 6 + 2] = c.z - _sd.z * w;
      a[i * 6 + 3] = c.x + _sd.x * w; a[i * 6 + 4] = c.y + _sd.y * w; a[i * 6 + 5] = c.z + _sd.z * w;
    }
    this.attr.needsUpdate = true;
  }
}
const _tg = new THREE.Vector3(), _cv = new THREE.Vector3(), _sd = new THREE.Vector3();

// --- reach-and-hold: rotate an upper arm so the arm points at a world target ---
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
export function aimArm(upper, fore, hand, target, w, straighten = 0.55) {
  if (!upper || !fore || w <= 0.001) return;
  upper.getWorldPosition(_p0); (hand || fore).getWorldPosition(_p1);
  const cur = _p1.sub(_p0).normalize();
  const want = _w.copy(target).sub(_p0).normalize();
  _q.setFromUnitVectors(cur, want);
  upper.getWorldQuaternion(_wq);
  _q2.copy(_q).multiply(_wq);
  upper.parent.getWorldQuaternion(_pq).invert();
  _q2.premultiply(_pq);
  upper.quaternion.slerp(_q2, clamp(w, 0, 1));
  // straighten the elbow toward the target as weight rises
  if (straighten > 0) fore.quaternion.slerp(_q.identity(), clamp(w * straighten, 0, 1));
}

export function blendLocomotion(c, speed, dt, walkRef = 1.45, runRef = 5.2) {
  const idleW = 1 - clamp(speed / 0.9, 0, 1);
  const runW = clamp((speed - 3.0) / 2.0, 0, 1);
  const walkW = (1 - idleW) * (1 - runW);
  const A = c.actions;
  if (A.idle) A.idle.setEffectiveWeight(idleW);
  if (A.walk) { A.walk.setEffectiveWeight(walkW); A.walk.timeScale = clamp(speed / walkRef, 0.7, 1.7); }
  if (A.run) { A.run.setEffectiveWeight(runW); A.run.timeScale = clamp(speed / runRef, 0.75, 1.35); }
}

const _hp = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
export function updateHeroVisual(h, dt, holds) {
  const b = h.body;
  h.pos.set(b.position.x, b.position.y - 0.83, b.position.z);
  h.root.position.copy(h.pos);
  const sp = Math.hypot(b.velocity.x, b.velocity.z);
  h.moveAmt += (clamp(sp / 6.4, 0, 1) - h.moveAmt) * damp(10, dt);

  let targetYaw = h.yaw;
  if (holds.length) { const o = holds[0].obj.body.position; targetYaw = Math.atan2(o.x - b.position.x, o.z - b.position.z); }
  else if (sp > 0.6) targetYaw = Math.atan2(b.velocity.x, b.velocity.z);
  let dy = targetYaw - h.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  h.yaw += dy * damp(12, dt);
  h.model.rotation.y = h.yaw;
  const lev = h.levitate;
  h.surgePose = Math.max(0, (h.surgePose || 0) - dt * 1.6);
  const sp2 = h.surgePose || 0;
  h.model.position.y = lev * 1.0 + Math.sin(G.rt * 2.2) * 0.012 * lev + Math.sin(Math.min(1, sp2) * Math.PI) * 0.18;

  // mocap locomotion (slowed while levitating)
  blendLocomotion(h.char, lev > 0.3 ? 0 : sp, dt);
  h.char.mixer.update(dt);
  h.root.updateMatrixWorld(true);

  // telekinetic reach: right hand for one object, both for two or for something heavy
  const B = h.bones;
  const heavy = holds.length === 1 && holds[0].obj.mass > 100;
  const wR = holds.length ? 1 : (lev > 0.1 ? lev : 0);
  const wL = holds.length >= 2 || heavy ? 1 : (lev > 0.1 ? lev : 0);
  h.aimW[0] += (wR - h.aimW[0]) * damp(12, dt); h.aimW[1] += (wL - h.aimW[1]) * damp(12, dt);
  const fwdX = Math.sin(h.yaw), fwdZ = Math.cos(h.yaw);
  (B.spine || B.neck || B.rU).getWorldPosition(_c);
  const sideOf = (U) => { U.getWorldPosition(_hp); let sx = _hp.x - _c.x, sz = _hp.z - _c.z; const sl = Math.hypot(sx, sz) || 1; return [sx / sl, sz / sl]; };
  const t = G.rt;
  if (h.flourish) h.flourish.t += dt;
  if (h.flourish && h.flourish.t > 0.38) h.flourish = null;
  if (holds.length) {
    // CONDUCTOR: her lead hand directs the object like a baton — it points at it, leads where it's going,
    // and traces a small figure-eight beat while it hovers; the other hand shapes the "music"
    const conduct = (U, F, H, o, phase, w) => {
      U.getWorldPosition(_hp);
      const op = o.body.position, ov = o.body.velocity;
      _d.set(op.x - _hp.x, op.y - _hp.y, op.z - _hp.z).normalize();
      const sp = Math.min(1, Math.hypot(ov.x, ov.z) / 10);
      const beat = 1 - sp * 0.7;
      _sd.set(-_d.z, 0, _d.x).normalize();
      _t.copy(_hp).addScaledVector(_d, 0.75);
      _t.y += 0.18;
      _t.addScaledVector(_sd, Math.sin(t * 2.4 + phase) * 0.13 * beat);
      _t.y += Math.sin(t * 4.8 + phase) * 0.09 * beat;
      _t.x += clamp(ov.x * 0.035, -0.3, 0.3); _t.z += clamp(ov.z * 0.035, -0.3, 0.3); _t.y += clamp(ov.y * 0.03, -0.2, 0.25);
      aimArm(U, F, H, _t, w, 0.22);
    };
    h.aimW[0] += (1 - h.aimW[0]) * damp(12, dt); h.aimW[1] += (1 - h.aimW[1]) * damp(12, dt);
    if (!h.flourish) conduct(B.rU, B.rF, B.rH, holds[0].obj, 0, h.aimW[0]);
    if (holds[1]) conduct(B.lU, B.lF, B.lH, holds[1].obj, 1.6, h.aimW[1]);
    else if (B.lU) {
      // off hand: palm half-raised at her side, breathing with the beat; lifts higher for heavy loads
      const load = Math.min(1, holds[0].obj.mass / 380);
      const [sx, sz] = sideOf(B.lU);
      _t.set(_hp.x + sx * 0.5 + fwdX * 0.38, _hp.y - 0.28 + load * 0.4 + Math.sin(t * 2.4 + 2) * 0.06, _hp.z + sz * 0.5 + fwdZ * 0.38);
      aimArm(B.lU, B.lF, B.lH, _t, h.aimW[1] * 0.85, 0.15);
    }
  } else if ((h.surgePose || 0) > 0.02) {
    // Surge: arms flung wide and down, palms driving the wave out
    const k = Math.min(1, h.surgePose * 1.6);
    for (const [U, F, H, sg] of [[B.rU, B.rF, B.rH, 1], [B.lU, B.lF, B.lH, -1]]) {
      if (!U) continue; U.getWorldPosition(_hp);
      _t.set(_hp.x + Math.sin(h.yaw + sg * 1.45) * 2, _hp.y - 0.5, _hp.z + Math.cos(h.yaw + sg * 1.45) * 2);
      aimArm(U, F, H, _t, k);
    }
  } else if (lev > 0.05) {
    // UNDERTOW: arms spread out to her sides, rising as the tide builds around her
    h.aimW[0] += (lev - h.aimW[0]) * damp(10, dt); h.aimW[1] += (lev - h.aimW[1]) * damp(10, dt);
    const swell = G.ultState && G.ultState.phase === 'vortex' ? Math.min(1, G.ultState.t / 1.6) : 0;
    const arms = [[B.rU, B.rF, B.rH], [B.lU, B.lF, B.lH]];
    for (let i = 0; i < 2; i++) {
      const [U, F, H] = arms[i]; if (!U) continue;
      const [sx, sz] = sideOf(U);
      const lift = -0.35 + lev * 0.35 + swell * 0.55 + Math.sin(t * 2.1 + i * 1.7) * 0.04 + Math.sin(t * 29 + i) * 0.02 * swell;
      _t.set(_hp.x + sx * 0.95 + fwdX * 0.18, _hp.y + lift, _hp.z + sz * 0.95 + fwdZ * 0.18);
      aimArm(U, F, H, _t, h.aimW[i]);
    }
  } else { h.aimW[0] += (0 - h.aimW[0]) * damp(8, dt); h.aimW[1] += (0 - h.aimW[1]) * damp(8, dt); }
  // the throw: a conductor's downbeat — hand whips from high-back through to low-forward along the throw
  if (h.flourish && B.rU) {
    const f = h.flourish, k = Math.min(1, f.t / 0.22), e = 1 - Math.pow(1 - k, 3);
    B.rU.getWorldPosition(_hp);
    const back = _d.set(-f.dir.x * 0.5, 0.75, -f.dir.z * 0.5), fwd = _sd.set(f.dir.x * 0.95, -0.25, f.dir.z * 0.95);
    _t.copy(_hp).add(back.lerp(fwd, e));
    aimArm(B.rU, B.rF, B.rH, _t, 1 - Math.max(0, f.t - 0.22) / 0.16, 0.5);
  }

  // power drives hair float, glows
  const want = Math.max(holds.length ? 0.6 + holds.length * 0.2 : 0, lev);
  h.power += (want - h.power) * damp(5, dt);
  h.U.uTime.value = G.rt; h.U.uPower.value = h.power;
  const cy = Math.cos(-h.yaw), sy = Math.sin(-h.yaw), fx = b.velocity.x / 6.4, fz = b.velocity.z / 6.4;
  h.U.uFlow.value.set(fx * cy - fz * sy, fx * sy + fz * cy);
  // power wisps rising off her hair and shoulders instead (only while she's using it)
  if (B.head && h.power > 0.25 && G.fx && Math.random() < h.power * 0.9) {
    B.head.getWorldPosition(_hp);
    G.fx.add.emit(_hp.x + (Math.random() - 0.5) * 0.25, _hp.y + 0.05, _hp.z + (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, 0.55, 0.4, 1.4, 0.7, 0.12, 0.01, 0, 0.8, 0.7);
  }
  const hands = [B.rH, B.lH];
  const lit = holds.length || h.flourish ? 1 : Math.max(lev, Math.min(1, (h.surgePose || 0) * 1.5));
  h.handLit = (h.handLit || 0) + (lit - (h.handLit || 0)) * damp(10, dt);
  for (let i = 0; i < 2; i++) {
    if (!hands[i]) continue;
    hands[i].getWorldPosition(_hp);
    const flick = 0.82 + Math.sin(G.rt * 19 + i * 2.3) * 0.1 + Math.random() * 0.08;
    const g = h.handLit * flick * (i === 1 && holds.length === 1 ? 0.55 : 1);
    h.handGlow[i].position.copy(_hp); h.handGlow[i].material.opacity = g;
    h.handHalo[i].position.copy(_hp); h.handHalo[i].material.opacity = g * 0.9;
    h.handHalo[i].material.rotation += dt * (i ? -0.8 : 0.8);
    h.handHalo[i].scale.setScalar(0.95 + Math.sin(G.rt * 6 + i) * 0.1 + h.power * 0.25);
    // energy motes swirling off her fingers
    if (g > 0.3 && G.fx && Math.random() < 0.7) {
      const a = Math.random() * 6.28, r = 0.12 + Math.random() * 0.12;
      G.fx.add.emit(_hp.x + Math.cos(a) * r, _hp.y + (Math.random() - 0.5) * 0.15, _hp.z + Math.sin(a) * r, -Math.sin(a) * 1.2, 0.5 + Math.random() * 0.6, Math.cos(a) * 1.2, 0.8, 0.55, 2.0, 0.45, 0.1, 0.01, 0, 1.5, 0.85);
    }
  }
  if (B.rH) { B.rH.getWorldPosition(_hp); h.trail.update(_hp, (holds.length || h.flourish ? 1 : 0) * h.handLit, G.camera.position); }
  if (B.head) {
    B.head.getWorldPosition(_hp); _hp.y += 0.06;
    _hp.x += Math.sin(h.yaw) * 0.08; _hp.z += Math.cos(h.yaw) * 0.08;  // brow, just in front of her forehead
    h.browPos = (h.browPos || new THREE.Vector3()).copy(_hp);
    const bg = (holds.length ? 1 : 0) * (0.85 + Math.sin(G.rt * 14) * 0.15);
    h.browLit = (h.browLit || 0) + (bg - (h.browLit || 0)) * damp(10, dt);
    h.browGlow.position.copy(_hp); h.browGlow.material.opacity = h.browLit;
    h.browHalo.position.copy(_hp); h.browHalo.material.opacity = h.browLit * 0.75; h.browHalo.material.rotation -= dt * 0.6;
  }
  // wet footsteps
  h.stepT -= dt * (sp > 3 ? 1.6 : 1);
  if (sp > 0.8 && h.stepT <= 0 && h.levitate < 0.2 && G.fx) {
    h.stepT = 0.36; h.stepSide *= -1;
    const ox = Math.cos(h.yaw) * 0.12 * h.stepSide, oz = -Math.sin(h.yaw) * 0.12 * h.stepSide;
    for (let k = 0; k < 4; k++) G.fx.add.emit(h.pos.x + ox, 0.04, h.pos.z + oz, (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2, 0.5, 0.56, 0.68, 0.3, 0.07, 0.02, 9, 0, 0.6);
  }
  h.light.intensity = 1.2 + h.power * 3 + Math.sin(G.rt * 13) * h.power * 0.6;
  h.aura.scale.setScalar(0.8 + h.power * 0.7 + Math.sin(G.rt * 3) * 0.06);
  h.aura.material.opacity = 0.25 + h.power * 0.6;
  h.aura.rotation.z += dt * (0.4 + h.power * 2);
}
