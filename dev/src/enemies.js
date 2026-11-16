import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, GRP, ALL, clamp, damp, rand } from './state.js';
import { makeCharacter, findBone, blobShadow } from './assets.js';
import { aimArm, blendLocomotion, softTex } from './hero.js';

// The Census: tactical "Counters" in black kit, visor-helmeted Marksmen, Lobbers with grenade packs,
// and the Auditor — a ceramic-armoured heavy.
const MALE = { idle: 'm_idle_neutral_01', walk: 'm_walk_cool_01', run: 'm_run_fast_01' };
const FEMALE = { idle: 'f_idle_neutral_01', walk: 'f_walk_cool_01', run: 'f_run_fast_01' };
export const ETYPES = {
  counter:  { hp: 60,  speed: 3.9, mass: 80,  scale: 1.0,  model: 'counter',  clips: MALE,   stagger: 14, grip: true, label: 'COUNTER', walkRef: 1.5, runRef: 5.0 },
  marksman: { hp: 50,  speed: 3.4, mass: 75,  scale: 1.0,  model: 'marksman', clips: FEMALE, stagger: 12, grip: true, label: 'MARKSMAN', walkRef: 1.45, runRef: 5.2 },
  lobber:   { hp: 55,  speed: 3.2, mass: 85,  scale: 1.04, model: 'counter',  clips: MALE,   stagger: 14, grip: true, label: 'LOBBER', walkRef: 1.5, runRef: 5.0 },
  auditor:  { hp: 520, speed: 2.5, mass: 650, scale: 1.62, model: 'auditor',  clips: { idle: 'aud_idle', walk: 'aud_walk', run: 'aud_run' }, stagger: 9999, grip: false, label: 'AUDITOR', walkRef: 1.3, runRef: 4.0 },
};

let ringTex = null;
function threatRing(scale) {
  if (!ringTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,60,60,0)'); g.addColorStop(0.74, 'rgba(255,60,60,0.22)'); g.addColorStop(0.87, 'rgba(255,110,100,0.8)'); g.addColorStop(1, 'rgba(255,60,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); ringTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * scale, 1.4 * scale), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.1, 0.4, 0.4) }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 4; return m;
}
let barTex = null;
function bar() {
  if (!barTex) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); barTex = new THREE.CanvasTexture(c); }
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0x000000, opacity: 0.6, transparent: true, depthTest: false }));
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0xff5050, depthTest: false }));
  bg.center.set(0, 0.5); fg.center.set(0, 0.5); bg.renderOrder = 20; fg.renderOrder = 21;
  return { bg, fg };
}
const rifleGeo = new THREE.BoxGeometry(0.06, 0.1, 0.78);
const rifleMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.7, roughness: 0.35 });

export function spawnEnemy(type, x, z) {
  const def = ETYPES[type];
  const c = makeCharacter(def.model, def.clips);
  const s = def.scale;
  const root = new THREE.Group(); const model = new THREE.Group(); root.add(model); model.add(c.obj);
  c.obj.scale.setScalar(s * (type === 'auditor' ? 1 : 1));
  model.position.y = -0.85 * s;
  const B = c.bones;
  const bones = type === 'auditor'
    ? { rU: findBone(B, 'mixamorigRightArm'), rF: findBone(B, 'mixamorigRightForeArm'), rH: findBone(B, 'mixamorigRightHand'), lU: findBone(B, 'mixamorigLeftArm'), lF: findBone(B, 'mixamorigLeftForeArm'), lH: findBone(B, 'mixamorigLeftHand'), spine: findBone(B, 'mixamorigSpine2'), lT: findBone(B, 'mixamorigLeftUpLeg'), rT: findBone(B, 'mixamorigRightUpLeg') }
    : { rU: findBone(B, 'Bip01_R_UpperArm'), rF: findBone(B, 'Bip01_R_Forearm'), rH: findBone(B, 'Bip01_R_Hand'), lU: findBone(B, 'Bip01_L_UpperArm'), lF: findBone(B, 'Bip01_L_Forearm'), lH: findBone(B, 'Bip01_L_Hand'), spine: findBone(B, 'Bip01_Spine2'), lT: findBone(B, 'Bip01_L_Thigh'), rT: findBone(B, 'Bip01_R_Thigh') };
  const hb = bar(); root.add(hb.bg); root.add(hb.fg);
  G.scene.add(root);
  const ring = threatRing(s); G.scene.add(ring);
  const blob = blobShadow(1.3 * s); G.scene.add(blob);
  // gear: stun-gauntlet glow (counter), rifle (marksman), grenade canisters (lobber), eye (auditor)
  const gear = {};
  if (type === 'counter' || type === 'auditor') {
    gear.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: type === 'auditor' ? new THREE.Color(2.2, 0.3, 0.2) : new THREE.Color(2.2, 1.1, 0.25), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    gear.glow.scale.setScalar(type === 'auditor' ? 0.6 : 0.32); G.scene.add(gear.glow);
  }
  if (type === 'marksman') { gear.rifle = new THREE.Mesh(rifleGeo, rifleMat); gear.rifle.castShadow = true; G.scene.add(gear.rifle); }
  if (type === 'lobber') {
    gear.pack = new THREE.Group();
    for (const k of [-1, 0, 1]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0x3a4a30, emissive: 0x58ff40, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.4 })); m.position.set(k * 0.12, 0, 0); gear.pack.add(m); }
    G.scene.add(gear.pack);
  }
  const body = new CANNON.Body({ mass: def.mass, material: G.charMat, fixedRotation: true, linearDamping: 0.05, angularDamping: 0.3, collisionFilterGroup: GRP.ENEMY, collisionFilterMask: ALL, allowSleep: false });
  body.addShape(new CANNON.Sphere(0.38 * s), new CANNON.Vec3(0, -0.47 * s, 0));
  body.addShape(new CANNON.Sphere(0.36 * s), new CANNON.Vec3(0, 0.33 * s, 0));
  body.position.set(x, 0.85 * s + 0.02, z);
  G.world.addBody(body);
  const e = {
    kind: 'enemy', type, def, root, model, char: c, bones, gear, hb, ring, blob, body, stepT: 0, mass: def.mass, radius: 0.85 * s, hh: 0.85 * s,
    hp: def.hp, maxHp: def.hp, state: 'spawn', stateT: 0, atkCD: rand(0.6, 1.6), yaw: 0,
    dead: false, alive: true, held: null, thrown: false, thrownT: 0, antiGrav: 0,
    lastHit: new Map(), prev: new THREE.Vector3(x, 0.85, z), stuckT: 0, sideSteer: 0, flinch: 0, hpShow: 0,
    downT: 0, fade: 1, strafe: Math.random() < 0.5 ? -1 : 1, spawnT: 0, charge: null, slamRing: null, laser: null, stun: 0,
    glowMats: c.mats.map(m => { m.userData.base = (m.emissive || new THREE.Color()).clone(); m.userData.baseI = m.emissiveIntensity ?? 1; return m; }), glow: 0, flailPh: Math.random() * 6,
  };
  body.userData = e;
  model.scale.setScalar(0.01);
  G.enemies.push(e);
  if (type === 'marksman') {
    e.laser = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    e.laser.renderOrder = 12; G.scene.add(e.laser);
  }
  return e;
}

export function removeEnemy(e) {
  e.alive = false;
  G.scene.remove(e.root); G.world.removeBody(e.body); G.scene.remove(e.ring); G.scene.remove(e.blob);
  for (const k in e.gear) G.scene.remove(e.gear[k]);
  if (e.laser) G.scene.remove(e.laser);
  const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1);
}

export function setEnemyGlow(e, g) {
  e.glow = g;
  for (const m of e.glowMats) {
    if (!m.emissive) continue;
    if (g > 0.01) { m.emissive.setRGB(0.42 * g, 0.2 * g, 1.0 * g); m.emissiveIntensity = 0.8; }
    else { m.emissive.copy(m.userData.base); m.emissiveIntensity = m.userData.baseI; }
  }
}

export function setRagdoll(e, on) {
  const b = e.body;
  if (on) {
    if (!b.fixedRotation) return;
    b.fixedRotation = false; b.updateMassProperties();
    b.angularDamping = 0.25; b.linearDamping = 0.08; b.material = null;
  } else {
    b.fixedRotation = true; b.updateMassProperties();
    b.angularVelocity.set(0, 0, 0); b.material = G.charMat; b.linearDamping = 0.05;
  }
}

const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _t = new THREE.Vector3(), _f = new THREE.Vector3();
const _e = new THREE.Euler();

export function updateEnemyVisual(e, dt) {
  const b = e.body, B = e.bones, s = e.def.scale;
  e.root.position.set(b.position.x, b.position.y, b.position.z);
  // glitch: the body stutters sideways and drops frames, like corrupted video
  if (e.glitchT > 0) {
    e.glitchT -= dt;
    if (e.glitchT <= 0) e.root.visible = true;
    else {
      const q = Math.floor(G.rt * 30);
      if (q !== e._gq) { e._gq = q; e._gx = (Math.random() - 0.5) * 0.34; e._gz = (Math.random() - 0.5) * 0.34; e._gv = Math.random() > 0.2; }
      e.root.position.x += e._gx; e.root.position.z += e._gz; e.root.visible = e._gv;
    }
  }
  if (b.fixedRotation) { _q.setFromAxisAngle(_up, e.yaw); e.root.quaternion.slerp(_q, damp(12, dt)); }
  else e.root.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  const limp = e.state === 'gripped' || e.state === 'ragdoll' || e.state === 'getup';
  const sp = Math.hypot(b.velocity.x, b.velocity.z);
  const moving = (e.state === 'move' || e.state === 'charge') ? sp : 0;
  blendLocomotion(e.char, limp ? 0 : moving, dt, e.def.walkRef, e.def.runRef);
  e.char.mixer.update(limp ? dt * 0.15 : dt);
  e.root.updateMatrixWorld(true);

  // procedural combat poses layered over the mocap
  const hp = G.hero.body.position;
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  if (!limp && !e.dead) {
    if (e.type === 'counter' && (e.state === 'windup' || e.state === 'strike')) {
      B.rU.getWorldPosition(_p);
      if (e.state === 'windup') _t.set(_p.x - fx * 0.4, _p.y + 1.3, _p.z - fz * 0.4); else _t.set(hp.x, 0.9, hp.z);
      aimArm(B.rU, B.rF, B.rH, _t, 1);
    }
    if (e.type === 'marksman') {
      _t.set(hp.x, 1.25, hp.z);
      const w = e.state === 'aim' || e.state === 'recover' || e.state === 'burst' ? 1 : 0.65;
      aimArm(B.rU, B.rF, B.rH, _t, w); aimArm(B.lU, B.lF, B.lH, _t, w * 0.9);
    }
    if (e.type === 'lobber' && e.state === 'throw') {
      B.rU.getWorldPosition(_p);
      const k = e.stateT / 0.55;
      _t.set(_p.x - fx * (0.6 - k * 1.6), _p.y + 1.2 - k * 0.6, _p.z - fz * (0.6 - k * 1.6));
      aimArm(B.rU, B.rF, B.rH, _t, 1);
    }
    if (e.type === 'auditor' && (e.state === 'slamWind' || e.state === 'slam' || e.state === 'chargeWind')) {
      B.rU.getWorldPosition(_p);
      const up = e.state !== 'slam';
      _t.set(_p.x + fx * (up ? 0.2 : 1.5), _p.y + (up ? 1.6 : -1.0), _p.z + fz * (up ? 0.2 : 1.5));
      aimArm(B.rU, B.rF, B.rH, _t, 1);
      B.lU.getWorldPosition(_p); _t.set(_p.x + fx * (up ? 0.2 : 1.5), _p.y + (up ? 1.6 : -1.0), _p.z + fz * (up ? 0.2 : 1.5));
      aimArm(B.lU, B.lF, B.lH, _t, 1);
    }
  } else if (B.rU) {
    // limp / flailing: arms thrown out, legs kicking
    e.flailPh += dt * (e.state === 'gripped' ? 11 : 4);
    const a = e.state === 'gripped' ? 1 : 0.6;
    for (const [U, F, H, sgn] of [[B.rU, B.rF, B.rH, 1], [B.lU, B.lF, B.lH, -1]]) {
      if (!U) continue;
      U.getWorldPosition(_p);
      _f.set(sgn, 0.4 + Math.sin(e.flailPh + sgn) * 0.6 * a, Math.cos(e.flailPh * 1.3 + sgn) * 0.6 * a).applyQuaternion(e.root.quaternion);
      _t.copy(_p).add(_f);
      aimArm(U, F, H, _t, 0.85);
    }
    if (B.lT && B.rT) { B.lT.rotation.z += Math.sin(e.flailPh) * 0.25 * a; B.rT.rotation.z -= Math.cos(e.flailPh) * 0.25 * a; }
  }
  // gear placement
  if (e.gear.glow && B.rH) { B.rH.getWorldPosition(_p); e.gear.glow.position.copy(_p); e.gear.glow.material.opacity = e.dead ? 0 : (e.state === 'windup' || e.state === 'slamWind' ? 1 : 0.45) * (0.8 + Math.sin(G.rt * 20) * 0.2); }
  if (e.gear.rifle && B.rH) {
    B.rH.getWorldPosition(_p);
    e.gear.rifle.position.copy(_p);
    if (!limp) { _t.set(hp.x, 1.25, hp.z); e.gear.rifle.lookAt(_t); e.gear.rifle.translateZ(0.25); }
    else e.gear.rifle.quaternion.copy(e.root.quaternion);
    e.gear.rifle.visible = !e.dead || e.fade > 0.5;
  }
  if (e.gear.pack && B.spine) {
    B.spine.getWorldPosition(_p); e.gear.pack.position.set(_p.x - fx * 0.2, _p.y, _p.z - fz * 0.2);
    e.gear.pack.quaternion.copy(e.root.quaternion); e.gear.pack.visible = e.fade > 0.3;
  }
  if (e.flinch > 0) e.flinch -= dt;
  // spawn / death scale
  if (e.state === 'spawn') e.model.scale.setScalar(Math.min(1, e.spawnT / 0.5));
  else if (e.dead) e.model.scale.setScalar(Math.max(0.001, e.fade));
  else e.model.scale.setScalar(1);
  // threat ring
  e.ring.position.set(b.position.x, 0.025, b.position.z);
  e.ring.material.opacity = e.dead ? Math.max(0, e.fade - 0.3) : (e.state === 'spawn' ? Math.min(1, e.spawnT * 2) : 0.85);
  e.ring.visible = e.ring.material.opacity > 0.01;
  const air = Math.max(0, b.position.y - 0.85 * s);
  e.blob.position.set(b.position.x, 0.02, b.position.z); e.blob.material.opacity = 0.8 * e.fade * Math.max(0, 1 - air / 3); e.blob.scale.setScalar(1 + air * 0.3);
  if (moving > 0.8 && !limp && G.fx) { e.stepT -= dt * (moving > 3 ? 1.6 : 1); if (e.stepT <= 0) { e.stepT = 0.38; for (let k = 0; k < 3; k++) G.fx.add.emit(b.position.x + rand(-0.15, 0.15), 0.04, b.position.z + rand(-0.15, 0.15), rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5), 0.5, 0.56, 0.68, 0.3, 0.07, 0.02, 9, 0, 0.55); } }
  // health bar
  e.hpShow = Math.max(0, e.hpShow - dt);
  const show = !e.dead && e.state !== 'spawn' && (e.hpShow > 0 || e.type === 'auditor' || e.hp < e.maxHp);
  e.hb.bg.visible = e.hb.fg.visible = show;
  if (show) {
    const w = e.type === 'auditor' ? 1.8 : 0.9;
    const top = 1.25 * s;
    _q.copy(e.root.quaternion).invert();
    const off = _t.set(-w / 2, top, 0).applyQuaternion(_q);
    e.hb.bg.position.copy(off); e.hb.fg.position.copy(off);
    e.hb.bg.scale.set(w, 0.08, 1); e.hb.fg.scale.set(w * clamp(e.hp / e.maxHp, 0, 1), 0.08, 1);
    e.hb.fg.material.color.set(e.type === 'auditor' ? 0xff3030 : 0xffd0d0);
  }
}
