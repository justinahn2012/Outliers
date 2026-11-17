import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, GRP, ALL, clamp, damp, rand } from './state.js';
import { makeCharacter, findBone, blobShadow, addRim } from './assets.js';
import { aimArm, twoBoneIK, blendLocomotion, softTex } from './hero.js';

// The Census: tactical "Counters" in black kit, visor-helmeted Marksmen, Lobbers with grenade packs,
// and the Auditor — a ceramic-armoured heavy.
// Census stand in an aggressive idle; below 40% health they limp (motion-captured injured walk/run)
const MALE = { idle: 'm_idle_angry_01', walk: 'm_walk_cool_01', run: 'm_run_fast_01', hwalk: 'm_walk_bruised', hrun: 'm_run_injured' };
const FEMALE = { idle: 'f_idle_angry_01', walk: 'f_walk_cool_01', run: 'f_run_fast_01', hwalk: 'f_walk_bruised', hrun: 'f_run_injured' };
const CIVM = { idle: 'm_idle_neutral_01', walk: 'm_walk_cool_01', run: 'm_run_fast_01', hwalk: 'm_walk_bruised', hrun: 'm_run_injured' };
export const ETYPES = {
  counter:  { hp: 60,  speed: 3.9, mass: 80,  scale: 1.0,  model: 'counter',  clips: MALE,   stagger: 14, grip: true, label: 'COUNTER', walkRef: 1.5, runRef: 5.0 },
  marksman: { hp: 50,  speed: 3.4, mass: 75,  scale: 1.0,  model: 'marksman', clips: FEMALE, stagger: 12, grip: true, label: 'MARKSMAN', walkRef: 1.45, runRef: 5.2 },
  lobber:   { hp: 55,  speed: 3.2, mass: 85,  scale: 1.04, model: 'counter',  clips: MALE,   stagger: 14, grip: true, label: 'LOBBER', walkRef: 1.5, runRef: 5.0 },
  auditor:  { hp: 520, speed: 2.5, mass: 650, scale: 1.62, model: 'auditor',  clips: { idle: 'aud_idle', walk: 'aud_walk', run: 'aud_run' }, stagger: 9999, grip: false, label: 'AUDITOR', walkRef: 1.3, runRef: 4.0 },
  warden:   { hp: 95,  speed: 2.7, mass: 110, scale: 1.08, model: 'counter',  clips: MALE,   stagger: 26, grip: true, label: 'WARDEN', walkRef: 1.5, runRef: 5.0, shield: true },
  informant:{ hp: 40,  speed: 5.6, mass: 70,  scale: 0.97, model: 'civ_m',  clips: CIVM,   stagger: 6,  grip: true, label: 'INFORMANT', walkRef: 1.5, runRef: 5.0 },
  clerk:    { hp: 26,  speed: 4.4, mass: 10,  scale: 1.0,  drone: 'clerk', stagger: 1, grip: true, label: 'CLERK', hover: 2.5 },
  lamplighter: { hp: 640, speed: 3.0, mass: 400, scale: 1.0, drone: 'lamp', stagger: 9999, grip: false, label: 'LAMPLIGHTER', hover: 7.5, boss: true },
};

// Census drones: a small Clerk (stamps objects so they can't be lifted) and the big Lamplighter searchlight
function droneVisual(kind) {
  const big = kind === 'lamp', S = big ? 2.6 : 1;
  const g = new THREE.Group(); const mats = [];
  const shell = new THREE.MeshStandardMaterial({ color: big ? 0x2a2e34 : 0x3a3f46, metalness: 0.75, roughness: 0.35, emissive: 0x000000 }); mats.push(shell);
  const dark = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.6, roughness: 0.5, emissive: 0x000000 }); mats.push(dark);
  const amber = new THREE.MeshStandardMaterial({ color: 0x221000, emissive: big ? 0xfff2dc : 0xff8a20, emissiveIntensity: big ? 0.6 : 1.6 }); mats.push(amber);
  const stripe = new THREE.MeshStandardMaterial({ color: 0x221000, emissive: 0xff8a20, emissiveIntensity: 1.4 }); mats.push(stripe);
  const glass = new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.9, roughness: 0.05, envMapIntensity: 2 });
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * S, y * S, z * S); m.castShadow = true; parent.add(m); return m; };
  // hull: an octagonal puck with a lit Census band and a dark sensor dome
  add(new THREE.CylinderGeometry(0.27 * S, 0.3 * S, 0.16 * S, 8), shell, 0, 0, 0);
  add(new THREE.CylinderGeometry(0.305 * S, 0.305 * S, 0.035 * S, 8), stripe, 0, -0.02, 0);
  add(new THREE.SphereGeometry(0.17 * S, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 0.08, 0);
  // camera eye at the front, amber iris
  add(new THREE.SphereGeometry(0.075 * S, 12, 10), glass, 0, -0.01, 0.27);
  const iris = add(new THREE.TorusGeometry(0.06 * S, 0.012 * S, 6, 16), amber, 0, -0.01, 0.3); iris.castShadow = false;
  // four arms with guarded rotors; spinning blades, not discs
  const rotors = [];
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.4, roughness: 0.6 });
  const blurMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.12, depthWrite: false });
  for (const [ax, az] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const arm = add(new THREE.BoxGeometry(0.42 * S, 0.04 * S, 0.06 * S), shell, ax * 0.3, 0.02, az * 0.3); arm.rotation.y = -Math.atan2(az, ax);
    add(new THREE.CylinderGeometry(0.045 * S, 0.05 * S, 0.08 * S, 10), dark, ax * 0.5, 0.04, az * 0.5);
    const guard = add(new THREE.TorusGeometry(0.21 * S, 0.014 * S, 6, 24), shell, ax * 0.5, 0.08, az * 0.5); guard.rotation.x = Math.PI / 2;
    const rot = new THREE.Group(); rot.position.set(ax * 0.5 * S, 0.09 * S, az * 0.5 * S); g.add(rot);
    for (const r of [0, Math.PI / 2]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.36 * S, 0.006 * S, 0.035 * S), bladeMat); bl.rotation.y = r; rot.add(bl); }
    const blur = new THREE.Mesh(new THREE.CircleGeometry(0.19 * S, 20), blurMat); blur.rotation.x = -Math.PI / 2; blur.position.y = 0.004 * S; rot.add(blur);
    rotors.push(rot);
    // nav light on each arm tip: white at the front, amber behind
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.02 * S, 6, 4), new THREE.MeshBasicMaterial({ color: az > 0 ? new THREE.Color(2.2, 2.2, 2.4) : new THREE.Color(2.6, 1.0, 0.2), toneMapped: false }));
    nav.position.set(ax * 0.66 * S, 0.06 * S, az * 0.66 * S); g.add(nav);
  }
  let lamp;
  if (big) {
    // searchlight: a gimballed housing with a hot lens
    add(new THREE.BoxGeometry(0.1, 0.25, 0.4).scale(S, S, S), dark, 0, -0.12, 0);
    add(new THREE.CylinderGeometry(0.2 * S, 0.26 * S, 0.24 * S, 18), dark, 0, -0.2, 0);
    lamp = add(new THREE.CylinderGeometry(0.19 * S, 0.19 * S, 0.02 * S, 18), amber, 0, -0.32, 0);
  } else {
    // the stamp: a short piston with a glowing square pad
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), shell, 0, -0.14, 0);
    lamp = add(new THREE.BoxGeometry(0.16, 0.035, 0.16), amber, 0, -0.23, 0);
    add(new THREE.BoxGeometry(0.19, 0.03, 0.19), dark, 0, -0.205, 0);
  }
  return { g, mats, rotors };
}
let spotTex = null;
function spotTexture() {
  if (spotTex) return spotTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.92, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (spotTex = new THREE.CanvasTexture(c));
}
const shieldGeo = new THREE.BoxGeometry(0.82, 1.3, 0.07);
const shieldMat = new THREE.MeshStandardMaterial({ color: 0x1a2028, metalness: 0.3, roughness: 0.12, transparent: true, opacity: 0.82, envMapIntensity: 1.5 });
const shieldStripe = new THREE.MeshStandardMaterial({ color: 0x221000, emissive: 0xff8a20, emissiveIntensity: 1.3 });

let ringTex = null;
// ring colour says what it is from above: brawler red, rifle amber, grenades green, shield steel, runner white, heavy crimson
const RING = { counter: [1.2, 0.26, 0.22], marksman: [1.3, 0.72, 0.14], lobber: [0.36, 1.2, 0.3], warden: [0.25, 1.15, 1.3], informant: [1.3, 1.25, 1.1], auditor: [1.4, 0.1, 0.08], clerk: [1.3, 0.7, 0.15], lamplighter: [1, 1, 1] };
const RING_SHAPE = { counter: 'solid', marksman: 'chevron', lobber: 'dash', warden: 'double', informant: 'dots', auditor: 'dial', clerk: 'diamond', lamplighter: 'solid' };
const ringTexes = {};
function ringTexture(shape) {
  if (ringTexes[shape]) return ringTexes[shape];
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.clearRect(0, 0, S, S);
  const glowArc = (r, w, a0, a1) => { x.save(); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = w; x.shadowColor = '#fff'; x.shadowBlur = 6; x.beginPath(); x.arc(64, 64, r, a0, a1); x.stroke(); x.restore(); };
  const g = x.createRadialGradient(64, 64, 30, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  if (shape === 'solid') glowArc(54, 4, 0, 6.29);
  else if (shape === 'double') { glowArc(56, 3, 0, 6.29); glowArc(47, 3, 0, 6.29); }
  else if (shape === 'dash') for (let k = 0; k < 12; k++) glowArc(54, 4, k / 12 * 6.283, k / 12 * 6.283 + 0.32);
  else if (shape === 'dots') for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283; x.fillStyle = '#fff'; x.beginPath(); x.arc(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54, 3.2, 0, 6.29); x.fill(); }
  else if (shape === 'dial') { glowArc(54, 3, 0, 6.29); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, l = k % 6 ? 6 : 12; x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); x.lineTo(64 + Math.cos(a) * (46 - l), 64 + Math.sin(a) * (46 - l)); x.stroke(); } }
  else if (shape === 'chevron') { glowArc(54, 3.5, 0, 6.29); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 2); x.lineTo(54, 16); x.lineTo(64, 11); x.lineTo(74, 16); x.closePath(); x.fill(); }
  else if (shape === 'diamond') { x.save(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.shadowColor = '#fff'; x.shadowBlur = 6; x.beginPath(); x.moveTo(64, 8); x.lineTo(120, 64); x.lineTo(64, 120); x.lineTo(8, 64); x.closePath(); x.stroke(); x.restore(); }
  return (ringTexes[shape] = new THREE.CanvasTexture(c));
}
const ringBackTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 18, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0.55)'); g.addColorStop(0.9, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function threatRing(scale, type) {
  if (!ringTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.74, 'rgba(255,255,255,0.2)'); g.addColorStop(0.87, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');   // white: the colour comes from the type
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); ringTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * scale, 1.4 * scale), new THREE.MeshBasicMaterial({ map: ringTexture(RING_SHAPE[type] || 'solid'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.2, 0.26, 0.22) }));
  if (type && RING[type]) m.material.color.setRGB(...RING[type]);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * scale, 1.5 * scale), new THREE.MeshBasicMaterial({ map: ringBackTex, transparent: true, depthWrite: false })); back.renderOrder = 3; back.position.z = -0.004; m.add(back);
  m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.userData.spin = RING_SHAPE[type] === 'dash' ? 1.2 : RING_SHAPE[type] === 'dial' ? 0.35 : 0; return m;
}
let barTex = null;
function bar() {
  if (!barTex) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); barTex = new THREE.CanvasTexture(c); }
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0x000000, opacity: 0.6, transparent: true, depthTest: false }));
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0xff5050, depthTest: false }));
  bg.center.set(0, 0.5); fg.center.set(0, 0.5); bg.renderOrder = 20; fg.renderOrder = 21;
  return { bg, fg };
}
const rifleMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.7, roughness: 0.35 });
const rifleMat2 = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.4, roughness: 0.6 });
const sightMat = new THREE.MeshStandardMaterial({ color: 0x221000, emissive: 0xff8a20, emissiveIntensity: 2.2 });
function makeRifle() {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(0.065, 0.11, 0.36), rifleMat, 0, 0, 0.02);                      // receiver
  add(new THREE.BoxGeometry(0.06, 0.085, 0.26), rifleMat2, 0, 0.005, 0.3);                  // handguard
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8), rifleMat, 0, 0.012, 0.56, Math.PI / 2); // barrel
  add(new THREE.BoxGeometry(0.05, 0.1, 0.26), rifleMat2, 0, -0.025, -0.28);                 // stock
  add(new THREE.BoxGeometry(0.04, 0.15, 0.07), rifleMat, 0, -0.12, 0.08, 0.25);              // magazine
  add(new THREE.BoxGeometry(0.035, 0.11, 0.05), rifleMat2, 0, -0.09, -0.08, -0.3);           // grip
  add(new THREE.CylinderGeometry(0.024, 0.024, 0.2, 10), rifleMat, 0, 0.095, 0.03, Math.PI / 2); // scope
  add(new THREE.BoxGeometry(0.02, 0.02, 0.01), sightMat, 0, 0.095, 0.135);                   // amber lens
  return g;
}
const padMat = new THREE.MeshStandardMaterial({ color: 0x150b00, emissive: 0xffa040, emissiveIntensity: 1.8 });

export function spawnEnemy(type, x, z) {
  const def = ETYPES[type];
  if (def.drone) return spawnDrone(type, def, x, z);
  const c = makeCharacter(def.model, def.clips);
  const s = def.scale;
  const root = new THREE.Group(); const model = new THREE.Group(); root.add(model); model.add(c.obj);
  c.obj.scale.setScalar(s * (type === 'auditor' ? 1 : 1));
  model.position.y = -0.85 * s;
  const B = c.bones;
  const bones = type === 'auditor'
    ? { rU: findBone(B, 'mixamorigRightArm'), rF: findBone(B, 'mixamorigRightForeArm'), rH: findBone(B, 'mixamorigRightHand'), lU: findBone(B, 'mixamorigLeftArm'), lF: findBone(B, 'mixamorigLeftForeArm'), lH: findBone(B, 'mixamorigLeftHand'), spine: findBone(B, 'mixamorigSpine2'), lT: findBone(B, 'mixamorigLeftUpLeg'), rT: findBone(B, 'mixamorigRightUpLeg') }
    : { head: findBone(B, 'Bip01_Head'), rU: findBone(B, 'Bip01_R_UpperArm'), rF: findBone(B, 'Bip01_R_Forearm'), rH: findBone(B, 'Bip01_R_Hand'), lU: findBone(B, 'Bip01_L_UpperArm'), lF: findBone(B, 'Bip01_L_Forearm'), lH: findBone(B, 'Bip01_L_Hand'), spine: findBone(B, 'Bip01_Spine2'), lT: findBone(B, 'Bip01_L_Thigh'), rT: findBone(B, 'Bip01_R_Thigh') };
  const hb = bar(); root.add(hb.bg); root.add(hb.fg);
  G.scene.add(root);
  const ring = threatRing(s, type); G.scene.add(ring);
  const blob = blobShadow(1.3 * s); G.scene.add(blob);
  // gear: stun-gauntlet glow (counter), rifle (marksman), grenade canisters (lobber), eye (auditor)
  const gear = {};
  if (type === 'counter' || type === 'auditor') {
    gear.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: type === 'auditor' ? new THREE.Color(2.2, 0.3, 0.2) : new THREE.Color(2.2, 1.1, 0.25), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    gear.glow.scale.setScalar(type === 'auditor' ? 0.6 : 0.32); G.scene.add(gear.glow);
  }
  if (type === 'marksman') { gear.rifle = makeRifle(); G.scene.add(gear.rifle); c.obj.traverse(o => { if (o.isMesh && /machinegun/.test(o.material.name)) o.visible = false; }); }   // she carries ours, not the slung one
  // the informant is a civilian with Moth's address glowing on a phone in his hand
  if (type === 'informant') {
    gear.pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.15), padMat); G.scene.add(gear.pad);
    gear.padGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: new THREE.Color(2.4, 1.3, 0.35), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); gear.padGlow.scale.setScalar(0.5); G.scene.add(gear.padGlow);
  }
  // guns that came without textures render as flat placeholder yellow: make them gunmetal
  for (const m of c.mats) if (/pistol|shotgun/.test(m.name)) { m.map = null; m.color.set(0x1c1e22); m.metalness = 0.65; m.roughness = 0.42; m.needsUpdate = true; }
  const civ = def.model === 'civ_m' || def.model === 'civ_f';
  for (const m of c.mats) addRim(m, type === 'auditor' ? 0xff5a30 : 0xff9a1a, civ || m.alphaTest > 0 ? 0 : 0.3, 0.8);
  if (type === 'lobber') {
    gear.pack = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.05), new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.4, roughness: 0.6 })); plate.position.z = 0.03; gear.pack.add(plate);
    const canMat = new THREE.MeshStandardMaterial({ color: 0x2f3a28, metalness: 0.5, roughness: 0.45 }), bandMat = new THREE.MeshStandardMaterial({ color: 0x0a1a06, emissive: 0x58ff40, emissiveIntensity: 1.2 });
    for (const k of [-1, 0, 1]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.27, 10), canMat); m.position.set(k * 0.105, 0, -0.04); m.castShadow = true; gear.pack.add(m);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.025, 10), bandMat); band.position.set(k * 0.105, 0.07, -0.04); gear.pack.add(band);
    }
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
  if (def.shield) {
    const sh = new THREE.Group(); const p = new THREE.Mesh(shieldGeo, shieldMat); p.castShadow = true; sh.add(p);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 0.075), shieldStripe); st.position.y = 0.42; sh.add(st);
    // a strap and a grip on the inside face, so the hand visibly holds it
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.05), shieldStripe.clone()); grip.material.emissiveIntensity = 0.15; grip.material.color.set(0x111111); grip.position.set(0, 0, -0.06); sh.add(grip);
    root.add(sh); e.shield = sh; e.shieldUp = true;
  }
  G.enemies.push(e);
  if (type === 'marksman') {
    e.laser = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    e.laser.renderOrder = 12; G.scene.add(e.laser);
  }
  return e;
}

function spawnDrone(type, def, x, z) {
  const V = droneVisual(def.drone);
  const root = new THREE.Group(); root.add(V.g); G.scene.add(root);
  const hb = bar(); root.add(hb.bg); root.add(hb.fg);
  const s = def.drone === 'lamp' ? 2.6 : 1;
  const ring = threatRing(def.drone === 'lamp' ? 2.4 : 0.8, type); G.scene.add(ring);
  const blob = blobShadow(def.drone === 'lamp' ? 3 : 0.9); G.scene.add(blob);
  const body = new CANNON.Body({ mass: def.mass, material: G.charMat, fixedRotation: true, linearDamping: 0.2, angularDamping: 0.4, collisionFilterGroup: GRP.ENEMY, collisionFilterMask: ALL, allowSleep: false });
  body.addShape(new CANNON.Sphere(def.drone === 'lamp' ? 1.35 : 0.36));
  body.position.set(x, def.hover, z); G.world.addBody(body);
  const gear = {};
  if (def.drone === 'lamp') {
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: spotTexture(), color: new THREE.Color(1.6, 1.7, 1.9), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spot.rotation.x = -Math.PI / 2; spot.renderOrder = 6; G.scene.add(spot); gear.spot = spot;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1, 1, 24, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(0.8, 0.85, 1.0) } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN, vV)), 1.4); gl_FragColor = vec4(uCol * 0.11 * (0.3 + vY) * e, 1.0); }',
    }));
    cone.renderOrder = 14; G.scene.add(cone); gear.cone = cone;
  }
  const e = {
    kind: 'enemy', type, def, root, model: V.g, char: null, bones: null, gear, hb, ring, blob, body, stepT: 0, mass: def.mass, radius: def.drone === 'lamp' ? 1.5 : 0.45, hh: 0.3 * s,
    hp: def.hp, maxHp: def.hp, state: 'spawn', stateT: 0, atkCD: rand(1, 2), yaw: 0, fly: true, rotors: V.rotors,
    dead: false, alive: true, held: null, thrown: false, thrownT: 0, antiGrav: 0,
    lastHit: new Map(), prev: new THREE.Vector3(x, def.hover, z), stuckT: 0, sideSteer: 0, flinch: 0, hpShow: 0,
    downT: 0, fade: 1, strafe: Math.random() < 0.5 ? -1 : 1, spawnT: 0, stun: 0, spotP: new THREE.Vector3(x, 0, z), countT: 0,
    glowMats: V.mats.map(m => { m.userData.base = (m.emissive || new THREE.Color()).clone(); m.userData.baseI = m.emissiveIntensity ?? 1; return m; }), glow: 0, flailPh: 0,
  };
  body.userData = e;
  V.g.scale.setScalar(0.01);
  G.enemies.push(e);
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
  const white = (e.pop || 0) > 0;
  for (const m of e.glowMats) {
    if (!m.emissive) continue;
    if (white) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 1.6; }
    else if (g > 0.01) { m.emissive.setRGB(0.42 * g, 0.2 * g, 1.0 * g); m.emissiveIntensity = 0.8; }
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
  if (e.def.drone) return updateDroneVisual(e, dt);
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
  const A = e.char.actions;
  if (A.hwalk && A.hrun) {
    const want = !e.dead && e.hp < e.maxHp * 0.4 ? 1 : 0;
    e.hurtK = (e.hurtK || 0) + (want - (e.hurtK || 0)) * Math.min(1, dt * 3);
    const h = e.hurtK, ww = A.walk.getEffectiveWeight(), rw = A.run.getEffectiveWeight();
    A.walk.setEffectiveWeight(ww * (1 - h)); A.run.setEffectiveWeight(rw * (1 - h));
    A.hwalk.setEffectiveWeight(ww * h); A.hrun.setEffectiveWeight(rw * h);
    A.hwalk.timeScale = A.walk.timeScale * 0.9; A.hrun.timeScale = A.run.timeScale;
  }
  e.char.mixer.update(limp ? dt * 0.15 : dt);
  e.root.updateMatrixWorld(true);

  // procedural combat poses layered over the mocap
  const hp = G.hero.body.position;
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  if (!limp && !e.dead) {
    if ((e.type === 'counter' || e.type === 'warden' || e.type === 'lobber') && (e.state === 'windup' || e.state === 'strike' || e.state === 'throw')) {
      // torso: wind back on the windup, drive through on the strike (twist about up + lean)
      const wind = e.state === 'windup' ? Math.min(1, e.stateT / 0.35) : e.state === 'throw' ? Math.max(0, 1 - e.stateT / 0.3) : 0;
      const drive = e.state === 'strike' ? Math.sin(Math.min(1, e.stateT / 0.3) * Math.PI) : e.state === 'throw' ? Math.max(0, Math.min(1, (e.stateT - 0.3) / 0.25)) : 0;
      if (B.spine && B.rU && B.lU) {
        B.rU.getWorldPosition(_rs); B.lU.getWorldPosition(_ls);
        const rx = _rs.x - _ls.x, rz = _rs.z - _ls.z, sgn = -Math.sign(rz * fx - rx * fz) || 1;
        bendBone(B.spine, _up, sgn * (0.55 * wind - 0.6 * drive));
        _f.set(fz, 0, -fx); bendBone(B.spine, _f, -0.18 * wind + 0.28 * drive);
      }
    }
    if ((e.type === 'counter' || e.type === 'warden') && (e.state === 'windup' || e.state === 'strike')) {
      B.rU.getWorldPosition(_p); B.lU.getWorldPosition(_ls);
      _left.copy(_ls).sub(_p); _left.y = 0; _left.normalize();
      if (e.state === 'windup') {
        // stun-baton fist cocked back beside the head, elbow high and behind
        const k = Math.min(1, e.stateT / 0.25);
        _t.set(_p.x - fx * 0.22 - _left.x * 0.1, _p.y + 0.12, _p.z - fz * 0.22 - _left.z * 0.1);
        _pole.set(_p.x - _left.x * 0.4 - fx * 0.5, _p.y + 0.1, _p.z - _left.z * 0.4 - fz * 0.5);
        twoBoneIK(B.rU, B.rF, B.rH, _t, _pole, k);
      } else { _t.set(hp.x, 1.1, hp.z); aimArm(B.rU, B.rF, B.rH, _t, 1, 0.9); }
    }
    if (e.shield && e.shieldUp) shieldPose(e, fx, fz);
    if (e.type === 'marksman' && e.gear.rifle && B.rU && B.lU) {
      const aiming = e.state === 'aim' || e.state === 'recover' || e.state === 'burst';
      e.aimK = (e.aimK || 0) + ((aiming ? 1 : 0) - (e.aimK || 0)) * Math.min(1, dt * 8);
      B.rU.getWorldPosition(_rs); B.lU.getWorldPosition(_ls);
      _left.copy(_ls).sub(_rs); _left.y = 0; _left.normalize();
      // aim straight at her when aiming; otherwise low ready, muzzle down
      _d1.set(hp.x - _rs.x, 1.2 - _rs.y, hp.z - _rs.z).normalize();
      _d2.set(fx + _left.x * 0.35, -0.75, fz + _left.z * 0.35).normalize();
      _dir.copy(_d2).lerp(_d1, e.aimK).normalize();
      const R = e.gear.rifle;
      R.position.copy(_rs).addScaledVector(_dir, 0.3).addScaledVector(_left, 0.07); R.position.y -= 0.04;
      R.lookAt(_t.copy(R.position).add(_dir));
      _g1.set(0, -0.09, -0.08).applyQuaternion(R.quaternion).add(R.position);   // trigger hand on the grip
      _g2.set(0, -0.05, 0.19).applyQuaternion(R.quaternion).add(R.position);    // support hand on the handguard
      _pole.copy(_rs).addScaledVector(_left, -0.45); _pole.y -= 0.6;
      twoBoneIK(B.rU, B.rF, B.rH, _g1, _pole, 1);
      _pole.copy(_ls).addScaledVector(_left, 0.3).addScaledVector(_dir, 0.2); _pole.y -= 0.6;
      twoBoneIK(B.lU, B.lF, B.lH, _g2, _pole, 1);
      if (B.head) { _f.set(_dir.z, 0, -_dir.x).normalize(); bendBone(B.head, _f, 0.12 * e.aimK); }   // cheek down to the stock
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
  if (e.gear.rifle && B.rH && (limp || e.dead)) { B.rH.getWorldPosition(_p); e.gear.rifle.position.copy(_p); e.gear.rifle.quaternion.copy(e.root.quaternion); }
  if (e.gear.pack && B.spine) {
    B.spine.getWorldPosition(_p); e.gear.pack.position.set(_p.x - fx * 0.16, _p.y - 0.02, _p.z - fz * 0.16);
    e.gear.pack.quaternion.copy(e.root.quaternion); e.gear.pack.visible = e.fade > 0.3;
  }
  if (e.flinch > 0 && !limp && !e.dead && B.spine && e.hitDir) {
    const k = Math.sin(Math.min(1, e.flinch / 0.22) * Math.PI) * (e.type === 'auditor' ? 0.18 : 0.42);
    _f.set(e.hitDir.z, 0, -e.hitDir.x).normalize();          // bend axis: perpendicular to the hit, in the ground plane
    bendBone(B.spine, _f, k); if (B.head) bendBone(B.head, _f, k * 0.7);
  }
  if (e.shield) placeShield(e, fx, fz, limp);
  if (e.gear.pad && B.rH) {
    B.rH.getWorldPosition(_p); e.gear.pad.position.copy(_p); e.gear.pad.quaternion.copy(e.root.quaternion);
    e.gear.padGlow.position.copy(_p); e.gear.padGlow.material.opacity = e.dead ? 0 : 0.55 + Math.sin(G.rt * 9) * 0.25; e.gear.pad.visible = !e.dead;
  }
  if (e.flinch > 0) e.flinch -= dt;
  // spawn / death scale
  if (e.state === 'spawn') e.model.scale.setScalar(Math.min(1, e.spawnT / 0.5));
  else e.model.scale.setScalar(e.pop > 0 ? 1.07 : 1);
  if (e.dead) {
    const d = Math.min(1, 1 - e.fade);
    if (d !== e._dis) { e._dis = d; for (const m of e.char.mats) if (m.userData.rim) m.userData.rim.uDis.value = d; }
    for (const k in e.gear) if (e.gear[k].visible !== undefined && e.gear[k].isObject3D) e.gear[k].visible = d < 0.45;
    if (e.shield) e.shield.visible = d < 0.45;
  }
  // threat ring
  e.ring.position.set(b.position.x, 0.025, b.position.z);
  if (e.ring.userData.spin) e.ring.rotation.z += dt * e.ring.userData.spin;
  if (e.pop > 0) { e.pop -= dt; if (e.pop <= 0) setEnemyGlow(e, e.glow); }
  const tele = e.state === 'windup' || e.state === 'aim' || e.state === 'throw' || e.state === 'slamWind' || e.state === 'chargeWind';
  e.tele = (e.tele || 0) + ((tele ? 1 : 0) - (e.tele || 0)) * Math.min(1, dt * 10);
  e.ring.material.opacity = e.dead ? Math.max(0, e.fade - 0.3) : (e.state === 'spawn' ? Math.min(1, e.spawnT * 2) : 0.85 + e.tele * 0.6);
  e.ring.scale.setScalar(1 + e.tele * (0.18 + Math.sin(G.rt * 22) * 0.08));
  e.ring.visible = e.ring.material.opacity > 0.01;
  const air = Math.max(0, b.position.y - 0.85 * s);
  e.blob.position.set(b.position.x, 0.02, b.position.z); e.blob.material.opacity = 0.8 * e.fade * Math.max(0, 1 - air / 3); e.blob.scale.setScalar(1 + air * 0.3);
  if (moving > 0.8 && !limp && G.fx) { e.stepT -= dt * (moving > 3 ? 1.6 : 1); if (e.stepT <= 0) { e.stepT = 0.38; for (let k = 0; k < 3; k++) G.fx.add.emit(b.position.x + rand(-0.15, 0.15), 0.04, b.position.z + rand(-0.15, 0.15), rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5), 0.5, 0.56, 0.68, 0.3, 0.07, 0.02, 9, 0, 0.55); } }
  // health bar
  e.hpShow = Math.max(0, e.hpShow - dt);
  const show = !e.dead && e.state !== 'spawn' && (e.hpShow > 0 || e.type === 'auditor' || e.hp < e.maxHp);
  e.hb.bg.visible = e.hb.fg.visible = show && !G.cyber;     // the cyber layer's ID tags carry health now
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

// rotate a bone about a WORLD axis (Object3D.rotateOnWorldAxis assumes an unrotated parent; bones never have one)
const _bq = new THREE.Quaternion(), _bpq = new THREE.Quaternion(), _bdq = new THREE.Quaternion();
export function bendBone(bone, axis, ang) {
  bone.getWorldQuaternion(_bq); _bdq.setFromAxisAngle(axis, ang); _bq.premultiply(_bdq);
  bone.parent.getWorldQuaternion(_bpq).invert(); bone.quaternion.copy(_bpq.multiply(_bq));
  bone.updateMatrixWorld(true);
}
// Warden: left forearm across the chest, shield strapped to it and squared to the front
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _dir = new THREE.Vector3(), _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3();
const _ls = new THREE.Vector3(), _rs = new THREE.Vector3(), _left = new THREE.Vector3(), _pole = new THREE.Vector3(), _hand = new THREE.Vector3(), _fore = new THREE.Vector3(), _sq = new THREE.Quaternion(), _sy = new THREE.Quaternion();
function shieldPose(e, fx, fz) {
  const B = e.bones; if (!B.lU || !B.rU) return;
  B.lU.getWorldPosition(_ls); B.rU.getWorldPosition(_rs);
  _left.copy(_ls).sub(_rs); _left.y = 0; const sw = _left.length() || 0.3; _left.normalize();
  const cx = (_ls.x + _rs.x) / 2, cz = (_ls.z + _rs.z) / 2, sy = (_ls.y + _rs.y) / 2;
  _t.set(cx + fx * 0.31 + _left.x * sw * 0.12, sy - 0.32, cz + fz * 0.31 + _left.z * sw * 0.12);
  _pole.set(_ls.x + _left.x * 0.5 - fx * 0.1, _ls.y - 0.5, _ls.z + _left.z * 0.5 - fz * 0.1);
  twoBoneIK(B.lU, B.lF, B.lH, _t, _pole, 1);
}
function placeShield(e, fx, fz, limp) {
  const B = e.bones, sh = e.shield;
  sh.scale.copy(e.model.scale);
  sh.visible = !e.dead || e.fade > 0.3;
  if (!B.lH || !B.lF) return;
  B.lH.getWorldPosition(_hand); B.lF.getWorldPosition(_fore);
  // center the shield just in front of the forearm, a little above the grip
  const p = _p.copy(_hand).lerp(_fore, 0.35);
  if (limp) { e.root.worldToLocal(p); sh.position.copy(p); return; }
  p.x += fx * 0.13; p.z += fz * 0.13; p.y += 0.12;
  e.root.worldToLocal(p); sh.position.copy(p);
  sh.quaternion.setFromAxisAngle(_up, 0); sh.rotateX(-0.06);
}

function updateDroneVisual(e, dt) {
  const b = e.body, big = e.def.drone === 'lamp';
  e.root.position.set(b.position.x, b.position.y, b.position.z);
  if (b.fixedRotation) { const tilt = Math.min(0.35, Math.hypot(b.velocity.x, b.velocity.z) * 0.05); _q.setFromEuler(_e.set(b.velocity.z * 0.03 * (big ? 0.3 : 1), e.yaw, -b.velocity.x * 0.03 * (big ? 0.3 : 1))); e.root.quaternion.slerp(_q, damp(8, dt)); if (tilt < 0) e.root.quaternion.identity(); }
  else e.root.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  for (const r of e.rotors) r.rotation.y += dt * (e.dead ? 4 : 40);
  if (e.state === 'spawn') e.model.scale.setScalar(Math.min(1, 0.01 + e.spawnT * 2));
  else e.model.scale.setScalar(Math.max(0.01, e.fade));
  if (e.glitchT > 0) { e.glitchT -= dt; e.root.visible = e.glitchT <= 0 || Math.random() > 0.2; if (e.glitchT > 0) { e.root.position.x += (Math.random() - 0.5) * 0.3; } } else e.root.visible = true;
  // health bar
  const show = e.hpShow > 0 || big;
  e.hpShow -= dt;
  const w = big ? 3.2 : 0.8, k = clamp(e.hp / e.maxHp, 0, 1);
  e.hb.bg.visible = e.hb.fg.visible = show && !e.dead && !G.cyber;
  if (show) {
    const y = big ? 1.9 : 0.6;
    _q.copy(e.root.quaternion).invert();
    e.hb.bg.position.set(-w / 2, y, 0).applyQuaternion(_q); e.hb.fg.position.set(-w / 2, y, 0).applyQuaternion(_q);
    e.hb.bg.scale.set(w, big ? 0.16 : 0.08, 1); e.hb.fg.scale.set(w * k, big ? 0.16 : 0.08, 1);
  }
  e.ring.position.set(b.position.x, 0.025, b.position.z); e.ring.material.opacity = e.dead ? 0 : 0.5 * e.fade; e.ring.visible = !big;
  e.blob.position.set(b.position.x, 0.02, b.position.z); e.blob.material.opacity = 0.5 * e.fade;
  if (big && e.gear.spot) {
    const sp = e.spotP, R = e.spotR || 2.6;
    e.gear.spot.position.set(sp.x, 0.05, sp.z); e.gear.spot.scale.setScalar(R * 2);
    const hot = e.countT > 0 ? Math.min(1, e.countT / 1.4) : 0;
    e.gear.spot.material.color.setRGB(0.95 + hot * 1.4, 1.0 - hot * 0.7, 1.15 - hot * 0.95);
    e.gear.spot.visible = e.gear.cone.visible = !e.dead && e.state !== 'spawn';
    const top = new THREE.Vector3(b.position.x, b.position.y - 0.6, b.position.z), bot = new THREE.Vector3(sp.x, 0, sp.z);
    const len = top.distanceTo(bot);
    e.gear.cone.position.copy(top).lerp(bot, 0.5); e.gear.cone.scale.set(R, len, R);
    e.gear.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bot.sub(top).normalize());
    e.gear.cone.material.uniforms.uCol.value.setRGB(0.8 + hot, 0.85 - hot * 0.5, 1.0 - hot * 0.7);
  }
}
