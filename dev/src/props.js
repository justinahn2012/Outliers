import * as THREE from 'three';
import { mergeGroupByMaterial } from './batch.js';
import { makeShieldVisual, SHIELD_SIZE } from './shield.js';
import * as CANNON from 'cannon-es';
import { G, GRP, ALL, clamp, rand } from './state.js';
import { A } from './assets.js';
import { containerTexture } from './level.js';

// Every liftable thing is a photoscanned prop with real mass and real durability.
// hp = how much gunfire it soaks as a shield before it comes apart.
export const DEFS = {
  trash:   { model: 'trashcan', parts: n => !/rust|lid/.test(n), mass: 14, hp: 45, shape: 'cyl', metal: true, label: 'TRASH CAN' },
  trashR:  { model: 'trashcan', parts: n => /rust/.test(n) && !/lid/.test(n), mass: 14, hp: 40, shape: 'cyl', metal: true, label: 'TRASH CAN' },
  barrel:  { model: 'barrel_red', mass: 26, hp: 30, shape: 'cyl', metal: true, explosive: true, label: 'FUEL DRUM' },
  drum:    { model: 'barrel_blue', mass: 9, hp: 35, shape: 'cyl', label: 'PLASTIC DRUM' },
  crate:   { model: 'crate', mass: 12, hp: 38, shape: 'box', breakable: true, wood: true, label: 'CRATE' },
  barrier: { model: 'barrier', mass: 280, hp: 420, shape: 'box', stone: true, label: 'BARRIER' },
  car:     { model: 'covered_car', mass: 380, hp: 520, shape: 'box', metal: true, label: 'CAR' },
  // flying traffic pulled out of the sky (templates registered by cyber.js from the fliers themselves)
  skydrone: { proc: 'ext', mass: 9, hp: 40, shape: 'box', metal: true, label: 'DELIVERY DRONE' },
  spinner:  { proc: 'ext', mass: 300, hp: 420, shape: 'box', metal: true, label: 'SPINNER' },
  utility: { model: 'utility_box', mass: 85, hp: 180, shape: 'box', metal: true, label: 'UTILITY BOX' },
  bag:     { model: 'trashbag', mass: 5, hp: 14, shape: 'box', soft: true, label: 'TRASH BAG' },
  box:     { model: 'cardboard', mass: 3, hp: 10, shape: 'box', soft: true, label: 'BOX' },
  fire:    { model: 'fire_barrel', mass: 30, hp: 80, shape: 'cyl', metal: true, fire: true, label: 'FIRE BARREL' },
  container: { proc: 'container', mass: 900, hp: 900, shape: 'box', metal: true, label: 'CONTAINER' },
  cagedoor: { proc: 'cagedoor', mass: 30, hp: 260, shape: 'box', metal: true, label: 'CAGE DOOR' },
  riotshield: { proc: 'riotshield', mass: 16, hp: 170, shape: 'box', metal: true, label: 'RIOT SHIELD' },
  chunk:   { mass: 2.5, hp: 6, shape: 'box', label: 'DEBRIS' },
  wallslab: { mass: 120, hp: 240, shape: 'box', stone: true, label: 'WALL' },   // torn out of a building by Rewrite
};

const TEMPLATES = {};
export function registerTemplate(type, src) {
  const g = new THREE.Group();
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  src.traverse(o => { if (!o.isMesh) return; const m = new THREE.Mesh(o.geometry, o.material); m.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); m.castShadow = true; g.add(m); });
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  for (const m of g.children) m.position.sub(c);
  TEMPLATES[type] = { g, size };
}

function template(type) {
  if (TEMPLATES[type]) return TEMPLATES[type];
  const def = DEFS[type];
  if (def.proc === 'cagedoor') {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.85, roughness: 0.35 });
    const parts = [];
    for (const y of [-1.15, 1.15]) parts.push([2.2, 0.1, 0.1, 0, y]);
    for (const x of [-1.05, 1.05]) parts.push([0.1, 2.4, 0.1, x, 0]);
    for (let k = 1; k < 10; k++) parts.push([0.04, 2.3, 0.04, -1.05 + k * 0.21, 0]);
    parts.push([2.2, 0.06, 0.06, 0, 0]);
    for (const [w, h, d, x, y] of parts) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, 0); b.castShadow = true; g.add(b); }
    mergeGroupByMaterial(g); return (TEMPLATES[type] = { g, size: new THREE.Vector3(2.2, 2.4, 0.14) });
  }
  if (def.proc === 'riotshield') {
    const g = makeShieldVisual(); g.children.forEach(c => c.position.z += 0.05);   // the Warden's shield, same visuals
    return (TEMPLATES[type] = { g, size: SHIELD_SIZE.clone() });
  }
  if (def.proc === 'container') {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(6.06, 2.59, 2.44), new THREE.MeshStandardMaterial({ map: containerTexture('#5a2a6a', 'CANTOR SOUND'), roughness: 0.6, metalness: 0.45 }));
    m.castShadow = m.receiveShadow = true; g.add(m);
    return (TEMPLATES[type] = { g, size: new THREE.Vector3(6.06, 2.59, 2.44) });
  }
  const src = A.gltf[def.model].scene;
  src.updateMatrixWorld(true);
  const g = new THREE.Group();
  src.traverse(o => {
    if (!o.isMesh) return;
    let top = o; while (top.parent && top.parent !== src && top.parent.type !== 'Scene') top = top.parent;
    if (def.parts && !def.parts(top.name)) return;
    const m = new THREE.Mesh(o.geometry, o.material);
    m.applyMatrix4(o.matrixWorld);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  });
  mergeGroupByMaterial(g);      // one draw per material, not per sub-mesh
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  for (const m of g.children) m.position.sub(c);
  TEMPLATES[type] = { g, size };
  return TEMPLATES[type];
}

export function halfHeight(o) { return o.size.y / 2; }

export function makeProp(type, x, z, rotY = 0, y = null, chunkOf = null) {
  const def = DEFS[type];
  let mesh, size;
  if (type === 'chunk' || chunkOf) {
    size = chunkOf.size.clone();
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    mesh = new THREE.Group(); const m = new THREE.Mesh(geo, chunkOf.mat); m.castShadow = m.receiveShadow = true; mesh.add(m);
  } else {
    const t = template(type); size = t.size.clone();
    mesh = t.g.clone();
  }
  const glowMats = [];
  mesh.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      o.material.userData.baseColor = o.material.color.clone();
      o.material.userData.baseEmissive = (o.material.emissive || new THREE.Color()).clone();
      o.material.userData.baseEI = o.material.emissiveIntensity ?? 1;
      o.material.envMapIntensity = 0.8;
      if (o.material.emissive) glowMats.push(o.material);     // unlit parts (LEDs on pulled-down fliers) don't take a glow
    }
  });
  const hh = size.y / 2;
  const body = new CANNON.Body({
    mass: def.mass, material: G.propMat, collisionFilterGroup: GRP.PROP, collisionFilterMask: ALL,
    linearDamping: 0.04, angularDamping: 0.14, allowSleep: true, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.6,
  });
  const s = 0.94;
  if (def.shape === 'cyl') body.addShape(new CANNON.Cylinder(Math.max(size.x, size.z) / 2 * s, Math.max(size.x, size.z) / 2 * s, size.y * 0.98, 14));
  else body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2 * s, size.y / 2 * 0.98, size.z / 2 * s)));
  body.position.set(x, y === null ? hh + 0.01 : y, z);
  body.quaternion.setFromEuler(0, rotY || 0, 0);
  const obj = {
    kind: 'prop', type, def, mesh, body, glowMats, mass: def.mass, size,
    radius: size.length() / 2, hRad: Math.hypot(size.x, size.z) / 2 * 0.86, hh, alive: true,
    hp: def.hp, maxHp: def.hp, dmgShow: 0, char: 0,
    held: null, thrown: false, thrownT: 0, antiGrav: 0, glow: 0, lastHit: new Map(),
    prev: new THREE.Vector3(x, hh, z), bornT: G.t, inWater: false, fireT: 0,
  };
  body.userData = obj;
  G.scene.add(mesh); G.world.addBody(body);
  G.props.push(obj);
  if (def.fire) addFire(obj);
  return obj;
}

function addFire(o) {
  const light = new THREE.PointLight(0xff7a2a, 14, 9, 1.7);
  light.position.set(0, o.hh + 0.4, 0); o.mesh.add(light); o.fireLight = light;
}

export function removeProp(o) {
  if (!o.alive) return;
  o.alive = false;
  G.scene.remove(o.mesh); G.world.removeBody(o.body);
  for (const m of o.glowMats) m.dispose();
  const i = G.props.indexOf(o); if (i >= 0) G.props.splice(i, 1);
}

// violet telekinetic glow + battle damage (charring) share the same materials
export function setGlow(o, g) {
  o.glow = g;
  for (const m of o.glowMats) {
    if (g > 0.01) { m.emissive.setRGB(0.42 * g, 0.2 * g, 1.0 * g); m.emissiveIntensity = 1.1; }
    else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
  }
}
export function applyDamageLook(o) {
  const d = 1 - clamp(o.hp / o.maxHp, 0, 1);
  for (const m of o.glowMats) {
    m.color.copy(m.userData.baseColor).multiplyScalar(1 - d * 0.55);
    if (m.roughness !== undefined) m.roughness = Math.min(1, (m.userData.baseRough ??= m.roughness) + d * 0.3);
  }
}

// Props per zone (index = ZONES order). Spawned lazily around the player so the physics world stays small.
const R = () => Math.random() * 6.28;
export const ZONE_PROPS = [
  // 0 HARROW STREET
  () => [
    ['car', -6.6, -4.5, 0.03], ['car', 6.7, 10.5, Math.PI - 0.04],
    ['barrier', -2.2, -12.5, 0.15], ['barrier', 3.6, -0.5, -0.2], ['barrier', -4.8, 6.8, 1.45],
    ['utility', 11.6, -15, -Math.PI / 2], ['utility', -11.7, 4.8, Math.PI / 2],
    ...[[-9.7, -9.4], [-9.7, -8.7], [9.7, -2.6], [9.6, 14.6], [-9.7, 14.2], [3.2, -17.8], [-2.8, 12.6], [9.5, 20.6], [-9.9, -21], [1.4, 1.8], [-4.2, -9.2], [5.4, -6.4]].map(([x, z], i) => [i % 3 === 0 ? 'trashR' : 'trash', x, z, R()]),
    ...[[-4.2, -17.4], [-3.5, -17.9], [-3.8, -16.7], [5.2, 4.2], [4.5, 18.6], [7.4, -20.5]].map(([x, z]) => ['barrel', x, z, R()]),
    ...[[8.2, -13.6], [-10.2, 9.5], [1.6, 21]].map(([x, z]) => ['drum', x, z, R()]),
    ['crate', 6.1, -14.2, 0.1], ['crate', 7.0, -14.6, 1.4], ['crate', -6.6, 17.2, 0.2], ['crate', -5.6, 17.6, -0.4], ['crate', -1.8, -3.2, 0.4], ['crate', 6.4, -14.35, 0.5, 0.57],
    ...[[-10.4, -14.6], [-10.9, -13.6], [10.5, 2.6], [10.9, 3.4], [-10.6, 20.2], [10.2, -20.8], [-0.6, -21.6]].map(([x, z]) => ['bag', x, z, R()]),
    ...[[-9.4, -15.6], [10.0, 1.4], [2.4, -18.6], [-7.8, 18.4]].map(([x, z]) => ['box', x, z, R()]),
    ['fire', -10.4, -6.0, 0],
  ],
  // 1 CHECKPOINT PLAZA (+ side street)
  () => [
    ['car', 38, 0.6, 1.57], ['car', 57, -25, 0.2],
    ['barrier', 38.5, -14.5, 1.57], ['barrier', 48, -13.5, 0.3], ['barrier', 55, -2, 1.2],
    ...[[31, -3], [61, -8], [43, -28.5], [60, 2.5], [31, -28], [20, -7.3]].map(([x, z]) => ['trash', x, z, R()]),
    ['barrel', 54, -18, 0], ['barrel', 54.7, -18.6, 1], ['barrel', 36, -25, 2],
    ['crate', 58, -28.4, 0.2], ['crate', 58.8, -27.9, 1.1], ['drum', 42, -12, 0], ['drum', 50, -26, 0],
    ['bag', 22, -12, 0], ['bag', 26, -7, 1], ['bag', 31.5, -20, 2], ['box', 24, -11.8, 0], ['box', 45, 1.5, 0],
    ['utility', 61.2, -20, -Math.PI / 2], ['fire', 39, -2.5, 0],
  ],
  // 2 TRAM CUT
  () => [
    ['barrier', 45.5, -37, 0.2], ['bag', 49, -33, 0], ['bag', 9, -43, 1], ['bag', 16, -47.3, 2],
    ['trash', 43, -43, 0], ['trash', 21, -43.2, 0], ['trash', 49, -46.5, 0],
    ['crate', 12, -47, 0.3], ['crate', 12.6, -46.4, 1.2], ['barrel', 25, -43, 0], ['barrel', 40, -43.5, 0], ['box', 46, -40, 0], ['drum', 18, -43, 0],
  ],
  // 3 PIER 9 MARKET
  () => [
    ...[[-4.3, -33], [4.4, -41], [-4.2, -49], [4.3, -60.5]].map(([x, z]) => ['trash', x, z, R()]),
    ['crate', -3.6, -37, 0.3], ['crate', -2.9, -37.5, 1.1], ['crate', 3.4, -52, 0.2], ['crate', 3.9, -52.7, 1.3], ['crate', -2, -58.4, 0.5],
    ['bag', 4.2, -34, 0], ['bag', -4.3, -44.5, 1], ['bag', -4.4, -61, 2], ['box', 3.6, -38, 0], ['box', -3.1, -55, 0], ['box', 2, -38.8, 0],
    ['barrel', 2.6, -47.5, 0], ['barrel', -2.4, -62.5, 0], ['barrel', 3.0, -48.2, 1], ['drum', -3.5, -41, 0], ['drum', 3.9, -58, 0],
    ['barrier', 0.8, -40.5, 1.45], ['barrier', -1.5, -56.2, 0.2], ['fire', -4.1, -52.5, 0],
  ],
  // 4 COLD STORAGE (cage doors are added by the rescue mission)
  () => [
    ['crate', -14, -48, 0.2], ['crate', -13.3, -48.7, 1], ['crate', -24, -52.8, 0], ['crate', -17, -52.8, 0.6],
    ['drum', -10, -48, 0], ['drum', -28.4, -58, 0], ['drum', -9, -62.5, 0], ['box', -12, -52.5, 0], ['box', -20, -58.6, 0], ['box', -27, -47.5, 0],
    ['trash', -9, -50, 0], ['barrel', -15, -58.8, 0], ['utility', -28.8, -52, Math.PI / 2],
  ],
  // 5 GUT LANE
  () => [
    ...[[-3.6, -67], [3.7, -72], [-3.7, -79.5], [3.6, -88.2]].map(([x, z], i) => [i % 2 ? 'trash' : 'trashR', x, z, R()]),
    ...[[-3.6, -72.3], [-3.2, -72.9], [3.5, -84.6], [3.3, -86.6], [-3.5, -91]].map(([x, z]) => ['bag', x, z, R()]),
    ['box', 3.4, -66.5, 0], ['box', -2.9, -84, 0], ['box', 1.5, -77, 0], ['crate', 2.9, -73.5, 0.2], ['crate', 3.4, -73.9, 1.2],
    ['barrel', -3.4, -82, 0], ['drum', 3.7, -90.6, 0], ['utility', -3.75, -74.6, Math.PI / 2],
  ],
  // 6 RAIL YARD (+ lane)
  () => [
    ['barrel', 46, -76, 0], ['barrel', 46.7, -76.6, 1], ['barrel', 58, -90, 0], ['barrel', 36, -68, 0],
    ['drum', 12, -77, 0], ['drum', 26, -81, 0], ['crate', 40, -80, 0.2], ['crate', 40.6, -80.6, 1.1], ['crate', 54, -74, 0.4],
    ['trash', 31, -82, 0], ['trash', 60, -66.8, 0], ['barrier', 49, -79, 0.1], ['barrier', 36, -79, 1.4],
    ['car', 58, -81.5, 0.1], ['utility', 77.3, -90, -Math.PI / 2], ['fire', 44, -70.5, 0], ['bag', 20, -81, 0], ['box', 9, -81, 0],
  ],
  // 7 CONTAINER YARD (+ shed)
  () => [
    ['container', 58, -124.5, 0.3],
    ['barrel', 50, -104, 0], ['barrel', 50.6, -104.6, 1], ['barrel', 68, -95.5, 0], ['barrel', 78, -120, 0],
    ['crate', 41.5, -95, 0.2], ['crate', 42, -95.7, 1], ['crate', 66, -111, 0.5], ['trash', 79, -98, 0], ['trash', 42, -134, 0],
    ['barrier', 60, -95, 0.1], ['barrier', 48, -121, 1.5], ['drum', 71, -134, 0], ['drum', 55, -112, 0],
    ['bag', 18, -111, 0], ['bag', 37, -121, 0], ['box', 22, -121, 0], ['box', 30, -111.3, 0], ['car', 72, -106, 0.2],
  ],
  // 8 PIER 9 DOCKS
  () => [
    ['container', -6, -106, 0.15], ['container', 2.6, -121.6, -0.1], ['car', -11, -116, 0.6],
    ['barrier', -3, -99.2, 0], ['barrier', 6, -103, 1.2], ['barrier', -14, -108.5, 0.3],
    ...[[3.5, -100.5], [4.2, -101.3], [-9.6, -112.3], [-10.3, -113], [0.5, -126.6]].map(([x, z]) => ['barrel', x, z, R()]),
    ['crate', -16.5, -103.6, 0.1], ['crate', -15.9, -104.3, 0.9], ['crate', -15.2, -121, 0.3], ['crate', 4.4, -127.7, 0], ['crate', 5.2, -127.4, 0.6], ['crate', -16.2, -103.95, 0.5, 0.57],
    ['trash', 12.6, -104, 0], ['trash', -17.8, -126.5, 0], ['trash', 12.5, -129, 0], ['drum', -5.5, -126, 0], ['drum', 7.2, -109, 0],
    ['fire', -1.5, -114, 0], ['utility', 13.1, -100.5, -Math.PI / 2],
    ['bag', -18, -118, 0], ['bag', 10.8, -95.6, 0], ['bag', -7.8, -95.4, 0], ['box', -17.4, -118.8, 0], ['box', 9.6, -95.8, 0],
  ],
  // 9 FERRY PIER
  () => [
    ['crate', -35, -106, 0.2], ['crate', -35.6, -106.6, 1], ['crate', -50, -118, 0.4], ['barrel', -28, -118, 0], ['barrel', -28.6, -117.4, 1],
    ['trash', -44, -104.8, 0], ['trash', -26, -104.6, 0], ['barrier', -40, -112, 0.1], ['barrier', -48, -108, 1.4],
    ['drum', -55, -105, 0], ['drum', -48, -118.6, 0], ['bag', -60, -105, 0], ['box', -59.5, -118.8, 0], ['fire', -33, -112, 0],
  ],
];
export function populateZone(i) {
  const list = ZONE_PROPS[i] ? ZONE_PROPS[i]() : [];
  const out = [];
  for (const [t, x, z, r = 0, y = null] of list) { const o = makeProp(t, x, z, r, y); o.zone = i; out.push(o); }
  return out;
}
