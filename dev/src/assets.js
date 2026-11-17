import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// All art is real: photoscanned CC0 props/textures/HDRI (Poly Haven), realistic rigged humans with
// motion-capture clips (Microsoft Rocketbox, MIT), heavy armour unit (Mixamo Vanguard).
export const A = { gltf: {}, clips: {}, tex: {}, env: null, ready: false };

const MODELS = ['iris', 'counter', 'marksman', 'auditor', 'civ_m', 'civ_f', 'trashcan', 'barrel_red', 'barrel_blue', 'crate', 'barrier', 'covered_car',
  'utility_box', 'trashbag', 'cardboard', 'hydrant', 'street_lamp', 'fire_barrel'];
const ANIMS = ['f_idle_neutral_01', 'f_walk_cool_01', 'f_run_fast_01', 'm_idle_neutral_01', 'm_walk_cool_01', 'm_run_fast_01',
  'm_idle_angry_01', 'f_idle_angry_01', 'm_crouch_idle', 'f_crouch_idle', 'm_walk_bruised', 'm_run_injured', 'f_walk_bruised', 'f_run_injured'];
const TEXTURES = ['asphalt_02_d', 'asphalt_02_n', 'asphalt_02_arm', 'pavement_03_d', 'pavement_03_n', 'pavement_03_arm',
  'dark_brick_wall_d', 'dark_brick_wall_n', 'dark_brick_wall_arm', 'red_brick_d', 'red_brick_n', 'red_brick_arm', 'factory_brick_d', 'factory_brick_n', 'factory_brick_arm', 'plaster_wall_d', 'plaster_wall_n', 'plaster_wall_arm', 'concrete_wall_008_d', 'concrete_wall_008_n', 'concrete_wall_008_arm'];

// Asset bytes ship inside script "packs" (base64) so the game runs anywhere a plain page can —
// including hosts that won't serve .glb/.hdr. Falls back to fetching loose files.
const PACKS = ['pack1.js', 'pack2.js', 'pack3.js'];
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function b64ToBuf(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
async function getBuf(name) {
  const AP = window.__AP || {};
  if (AP[name]) { const b = b64ToBuf(AP[name]); AP[name] = null; return b; }
  const r = await fetch(name); if (!r.ok) throw new Error('missing ' + name); return r.arrayBuffer();
}

export async function loadAssets(onProgress) {
  const total = PACKS.length + MODELS.length + ANIMS.length + TEXTURES.length + 1;
  let done = 0;
  const tick = () => { done++; onProgress && onProgress(done / total); };
  for (const p of PACKS) { try { await loadScript(p); } catch (e) { /* loose files fallback */ } tick(); }
  const gl = new GLTFLoader();
  const tl = new THREE.TextureLoader();
  const parseGLB = async (name) => gl.parseAsync(await getBuf(name), '');
  const jobs = [];
  for (const m of MODELS) jobs.push(parseGLB(`${m}.glb`).then(g => { A.gltf[m] = g; tick(); }));
  for (const a of ANIMS) jobs.push(parseGLB(`anim_${a}.glb`).then(g => { A.clips[a] = prepClip(g.animations[0], a); tick(); }));
  for (const t of TEXTURES) jobs.push(getBuf(`${t}.webp`).then(buf => {
    const url = URL.createObjectURL(new Blob([buf], { type: 'image/webp' }));
    return tl.loadAsync(url).then(tx => {
      URL.revokeObjectURL(url);
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8;
      if (t.endsWith('_d')) tx.colorSpace = THREE.SRGBColorSpace;
      A.tex[t] = tx; tick();
    });
  }));
  jobs.push(getBuf('env_night.hdr').then(buf => {
    const d = new HDRLoader().parse(buf);
    const tex = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
    tex.colorSpace = THREE.LinearSRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false; tex.flipY = true; tex.needsUpdate = true;
    tex.mapping = THREE.EquirectangularReflectionMapping; A.env = tex; tick();
  }));
  await Promise.all(jobs);
  for (const c of A.gltf.auditor.animations) A.clips['aud_' + c.name.toLowerCase()] = c;
  A.ready = true;
}

// Motion-capture clips carry root travel; strip the horizontal drift so they play in place.
function prepClip(clip, name) {
  clip.name = name;
  for (const tr of clip.tracks) {
    if (!tr.name.endsWith('.position')) continue;
    const isRoot = /^Bip01\.position$/.test(tr.name) || /Bip01$/.test(tr.name.split('.')[0]);
    if (!isRoot) continue;
    const v = tr.values, n = v.length / 3;
    for (let c = 0; c < 3; c++) {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < n; i++) { mn = Math.min(mn, v[i * 3 + c]); mx = Math.max(mx, v[i * 3 + c]); }
      if (mx - mn > 0.22) { const v0 = v[c]; for (let i = 0; i < n; i++) v[i * 3 + c] = v0; }
    }
  }
  // drop the biped "Footsteps" helper
  clip.tracks = clip.tracks.filter(t => !/Footsteps/.test(t.name));
  return clip;
}

// Clone a skinned character and bind an animation mixer
export function makeCharacter(key, clipKeys) {
  const src = A.gltf[key];
  const obj = SkeletonUtils.clone(src.scene);
  const mats = [];
  obj.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = o.material.clone(); mats.push(o.material);
      o.material.envMapIntensity = 1.1;
      if (o.material.roughness !== undefined) o.material.roughness *= 0.78; // rain-damp sheen
    }
  });
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const [label, ck] of Object.entries(clipKeys)) {
    const clip = A.clips[ck];
    if (!clip) continue;
    const act = mixer.clipAction(clip); act.play(); act.setEffectiveWeight(label === 'idle' ? 1 : 0);
    actions[label] = act;
  }
  const bones = {};
  obj.traverse(o => { if (o.isBone || o.type === 'Bone' || /Bip01|mixamorig/.test(o.name)) bones[o.name] = o; });
  return { obj, mixer, actions, bones, mats };
}

// A fresnel rim in emissive: readable silhouettes from the top-down camera (violet on Null, amber on the Census)
export function addRim(mat, color, k = 0.6, pw = 2.4) {
  const u = { uRimCol: { value: new THREE.Color(color) }, uRimK: { value: k }, uRimP: { value: pw }, uDis: { value: 0 }, uDisCol: { value: new THREE.Color(2.6, 1.25, 0.32) } };
  mat.userData.rim = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimCol; uniform float uRimK; uniform float uRimP; uniform float uDis; uniform vec3 uDisCol;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fr = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0); totalEmissiveRadiance += uRimCol * pow(fr, uRimP) * uRimK; }\nif (uDis > 0.0) { vec2 dc = floor(gl_FragCoord.xy / 5.0); float dn = fract(sin(dot(dc, vec2(12.9898, 78.233))) * 43758.5453); if (dn < uDis) discard; if (dn < uDis + 0.14) totalEmissiveRadiance += uDisCol; }');
  };
  mat.customProgramCacheKey = () => 'rim';
  mat.needsUpdate = true;
}

let _blob = null;
export function blobShadow(size) {
  if (!_blob) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.5, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); _blob = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: _blob, transparent: true, depthWrite: false, opacity: 0.8 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m;
}

export function findBone(bones, ...names) {
  for (const n of names) {
    const k = Object.keys(bones).find(b => b === n || b.replace(/[_\s:]/g, '') === n.replace(/[_\s:]/g, ''));
    if (k) return bones[k];
  }
  return null;
}
