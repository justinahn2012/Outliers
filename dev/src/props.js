import * as THREE from 'three';
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
  utility: { model: 'utility_box', mass: 85, hp: 180, shape: 'box', metal: true, label: 'UTILITY BOX' },
  bag:     { model: 'trashbag', mass: 5, hp: 14, shape: 'box', soft: true, label: 'TRASH BAG' },
  box:     { model: 'cardboard', mass: 3, hp: 10, shape: 'box', soft: true, label: 'BOX' },
  fire:    { model: 'fire_barrel', mass: 30, hp: 80, shape: 'cyl', metal: true, fire: true, label: 'FIRE BARREL' },
  container: { proc: 'container', mass: 900, hp: 900, shape: 'box', metal: true, label: 'CONTAINER' },
  chunk:   { mass: 2.5, hp: 6, shape: 'box', label: 'DEBRIS' },
};

const TEMPLATES = {};
function template(type) {
  if (TEMPLATES[type]) return TEMPLATES[type];
  const def = DEFS[type];
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
  if (type === 'chunk') {
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
      glowMats.push(o.material);
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

export function populateProps() {
  const P = (t, x, z, r = 0, y = null) => makeProp(t, x, z, r, y);
  // the big stuff: shields and wrecking balls
  P('car', -6.6, -4.5, 0.03); P('car', 6.7, 10.5, Math.PI - 0.04);
  P('barrier', -2.2, -12.5, 0.15); P('barrier', 3.6, -0.5, -0.2); P('barrier', -4.8, 6.8, 1.45);
  P('utility', 11.6, -10, -Math.PI / 2); P('utility', -11.7, 4.8, Math.PI / 2);
  // street clutter
  const cans = [[-9.7, -9.4], [-9.7, -8.7], [9.7, -2.6], [9.6, 14.6], [-9.7, 14.2], [3.2, -17.8], [-2.8, 12.6], [9.5, 20.6], [-9.9, -21], [1.4, 1.8], [-4.2, -9.2], [5.4, -6.4]];
  cans.forEach(([x, z], i) => P(i % 3 === 0 ? 'trashR' : 'trash', x, z, rand(0, 6)));
  for (const [x, z] of [[-4.2, -17.4], [-3.5, -17.9], [-3.8, -16.7], [5.2, 4.2], [4.5, 18.6], [7.4, -20.5]]) P('barrel', x, z, rand(0, 6));
  for (const [x, z] of [[8.2, -13.6], [-10.2, 9.5], [1.6, 21]]) P('drum', x, z, rand(0, 6));
  for (const [x, z, r] of [[6.1, -14.2, 0.1], [7.0, -14.6, 1.4], [-6.6, 17.2, 0.2], [-5.6, 17.6, -0.4], [-1.8, -3.2, 0.4]]) P('crate', x, z, r);
  P('crate', 6.4, -14.35, 0.5, 0.36 + 0.18 + 0.03);
  for (const [x, z] of [[-10.4, -14.6], [-10.9, -13.6], [10.5, 2.6], [10.9, 3.4], [-10.6, 20.2], [10.2, -20.8], [-0.6, -21.6]]) P('bag', x, z, rand(0, 6));
  for (const [x, z] of [[-9.4, -15.6], [10.0, 1.4], [2.4, -18.6], [-7.8, 18.4]]) P('box', x, z, rand(0, 6));
  P('fire', -10.4, -6.0, 0);

  // ---- Pier 9 Market ----
  for (const [x, z] of [[-4.3, -33], [4.4, -41], [-4.2, -49], [4.3, -60.5]]) P('trash', x, z, rand(0, 6));
  for (const [x, z, r] of [[-3.6, -37, 0.3], [-2.9, -37.5, 1.1], [3.4, -52, 0.2], [3.9, -52.7, 1.3], [-2, -58.4, 0.5]]) P('crate', x, z, r);
  for (const [x, z] of [[4.2, -34], [-4.3, -44.5], [-4.4, -61]]) P('bag', x, z, rand(0, 6));
  for (const [x, z] of [[3.6, -45], [-3.1, -55], [2, -38]]) P('box', x, z, rand(0, 6));
  for (const [x, z] of [[2.6, -47.5], [-2.4, -62.5], [3.0, -48.2]]) P('barrel', x, z, rand(0, 6));
  for (const [x, z] of [[-3.5, -41], [3.9, -58]]) P('drum', x, z, rand(0, 6));
  P('barrier', 0.8, -43.5, 1.45); P('barrier', -1.5, -56.2, 0.2);
  P('fire', -4.1, -52.5, 0);
  // ---- Gut Lane ----
  for (const [x, z] of [[-3.6, -67], [3.7, -72], [-3.7, -79.5], [3.6, -88.2]]) P(Math.random() < 0.5 ? 'trash' : 'trashR', x, z, rand(0, 6));
  for (const [x, z] of [[-3.6, -72.3], [-3.2, -72.9], [3.5, -80.6], [3.3, -86.6], [-3.5, -91]]) P('bag', x, z, rand(0, 6));
  for (const [x, z] of [[3.4, -66.5], [-2.9, -84], [1.5, -77]]) P('box', x, z, rand(0, 6));
  P('crate', 2.9, -75.5, 0.2); P('crate', 3.4, -75.9, 1.2); P('barrel', -3.4, -82, 0); P('drum', 3.7, -90.6, 0);
  P('utility', -3.75, -74.6, Math.PI / 2);
  // ---- Pier 9 docks ----
  P('container', -6, -106, 0.15); P('container', 2.6, -121.6, -0.1);
  P('car', -11, -116, 0.6);
  P('barrier', -3, -99.2, 0); P('barrier', 6, -103, 1.2); P('barrier', -14, -108.5, 0.3);
  for (const [x, z] of [[3.5, -100.5], [4.2, -101.3], [-9.6, -112.3], [-10.3, -113], [0.5, -126.6]]) P('barrel', x, z, rand(0, 6));
  for (const [x, z, r] of [[-16.5, -103.6, 0.1], [-15.9, -104.3, 0.9], [-15.2, -121, 0.3], [4.4, -127.7, 0], [5.2, -127.4, 0.6]]) P('crate', x, z, r);
  P('crate', -16.2, -103.95, 0.5, 0.36 + 0.18 + 0.03);
  for (const [x, z] of [[12.6, -111.6], [-17.8, -126.5], [12.5, -117.6]]) P('trash', x, z, rand(0, 6));
  for (const [x, z] of [[-5.5, -126], [7.2, -109]]) P('drum', x, z, rand(0, 6));
  P('fire', -1.5, -114, 0); P('utility', 13.1, -114.6, -Math.PI / 2);
  for (const [x, z] of [[-18, -118], [10.8, -95.6], [-7.8, -95.4]]) P('bag', x, z, rand(0, 6));
  for (const [x, z] of [[-17.4, -118.8], [9.6, -95.8]]) P('box', x, z, rand(0, 6));
}
