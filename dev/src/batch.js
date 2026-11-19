// Static batching: the level is built from hundreds of small meshes (block faces, trims, parapets, AC units, kerbs),
// each its own draw call on a phone. Once the level is built, fold every static, opaque, unlit-by-script mesh into
// one mesh per (material look x 32 m cell x shadow flags). Texture repeats are baked into the UVs, so faces that only
// differed by their tiling share one material. Cells keep frustum culling working.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const WHITE = new THREE.Color(1, 1, 1);
const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap'];

function lookKey(m) {
  // colour goes into vertex colours, so it isn't part of the look; roughness/metalness are rounded to 0.05
  const r5 = (v) => v === undefined ? '' : Math.round(v * 20) / 20;
  const parts = [m.type, r5(m.roughness), r5(m.metalness), m.emissive ? m.emissive.getHexString() : '', m.emissiveIntensity, m.envMapIntensity, m.side, m.toneMapped, m.flatShading];
  for (const k of TEX_KEYS) parts.push(m[k] ? (m[k].source ? m[k].source.uuid : m[k].uuid) : '-');
  if (m.normalScale) parts.push(m.normalScale.x, m.normalScale.y);
  parts.push(m.userData.falloff ? 'F' : '');
  return parts.join('|');
}
function texOK(m) {
  // every texture on the material must share one transform (we bake it into the UVs) and repeat-wrap
  let rep = null;
  for (const k of TEX_KEYS) {
    const t = m[k]; if (!t) continue;
    if (t.rotation || t.isCanvasTexture && t.repeat.x !== 1) return null;
    if (!rep) rep = { rx: t.repeat.x, ry: t.repeat.y, ox: t.offset.x, oy: t.offset.y, flipY: t.flipY };
    else if (rep.rx !== t.repeat.x || rep.ry !== t.repeat.y || rep.ox !== t.offset.x || rep.oy !== t.offset.y) return null;
  }
  return rep || { rx: 1, ry: 1, ox: 0, oy: 0 };
}
// grime on every batched wall (environment.md Fix 10): a wet splash band at the base, soot under the parapet, vertical
// water streaks; works in world space (batched geometry is world space) with the building top in a vertex attribute
let _streak = null;
function streakTex() {
  if (_streak) return _streak;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 256);
  let s = 77; const R = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 50; i++) { const px = R() * 128, py = R() * 200, len = 20 + R() * 70, w = 1 + R() * 2, g = x.createLinearGradient(0, py, 0, py + len); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px, py, w, len); }
  _streak = new THREE.CanvasTexture(c); _streak.wrapS = _streak.wrapT = THREE.RepeatWrapping; return _streak;
}
function addGrime(c) {
  c.onBeforeCompile = (sh) => {
    sh.uniforms.tStreak = { value: streakTex() };
    sh.vertexShader = 'attribute float aTop; varying vec3 vWP; varying float vTop;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix * vec4(position, 1.0)).xyz; vTop = aTop;');
    sh.fragmentShader = 'uniform sampler2D tStreak; varying vec3 vWP; varying float vTop;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.2, 1.4, vWP.y)) * mix(1.0, 0.82, smoothstep(vTop - 1.0, vTop, vWP.y)) * mix(1.0, 0.8, texture2D(tStreak, vec2((vWP.x + vWP.z) / 7.0, vWP.y / 9.0)).r);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= mix(0.7, 1.0, smoothstep(0.0, 1.5, vWP.y));`);
  };
  c.customProgramCacheKey = () => 'grime';
}
function canonical(m, cache) {
  const k = lookKey(m);
  if (cache.has(k)) return cache.get(k);
  const c = m.clone(); c.vertexColors = true; if (c.color) c.color.set(1, 1, 1);
  if (m.userData.falloff) addGrime(c);
  for (const t of TEX_KEYS) if (c[t]) { const tx = c[t].clone(); tx.repeat.set(1, 1); tx.offset.set(0, 0); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.needsUpdate = true; c[t] = tx; }
  cache.set(k, c); return c;
}

export function staticBatch(scene, { exclude = new Set(), cell = 48 } = {}) {
  scene.updateMatrixWorld(true);
  const buckets = new Map(), mats = new Map(), victims = [];
  const box = new THREE.Box3(), ctr = new THREE.Vector3();
  const prep = (geo, mesh, rep, col, mat) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    { const n = g.attributes.position.count, ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (rep && (rep.rx !== 1 || rep.ry !== 1 || rep.ox || rep.oy)) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep.rx + rep.ox, uv.getY(i) * rep.ry + rep.oy); }
    g.applyMatrix4(mesh.matrixWorld); g.groups = []; g.morphAttributes = {};
    if (mat && mat.userData.falloff) {   // facade height falloff: street-level bright, upper floors dark
      const P = g.attributes.position, C = g.attributes.color;
      let top = 0; for (let i = 0; i < P.count; i++) top = Math.max(top, P.getY(i));
      g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(P.count).fill(top), 1));
      for (let i = 0; i < P.count; i++) { const t = Math.min(1, Math.max(0, (P.getY(i) - 3.5) / 7.5)), f = 1 - 0.62 * t * t * (3 - 2 * t); C.setXYZ(i, C.getX(i) * f, C.getY(i) * f, C.getZ(i) * f); }
    }
    return g;
  };
  const cands = [];
  for (const o of scene.children) {
    if (o.isGroup && o.userData.static && !exclude.has(o)) o.traverse(c => { if (c.isMesh) cands.push(c); });
    else cands.push(o);
  }
  for (const m of cands) {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || exclude.has(m) || !m.visible || m.children.length || m.userData.noBatch || (m.parent !== scene && !m.parent.visible)) continue;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    if (list.some(mt => !mt || mt.isShaderMaterial || mt.isRawShaderMaterial || mt.transparent || mt.alphaTest > 0 || mt.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || mt.userData.noBatch || !(mt.isMeshStandardMaterial || mt.isMeshBasicMaterial || mt.isMeshLambertMaterial || mt.isMeshPhongMaterial))) continue;
    const geo = m.geometry; if (!geo.attributes.position || !geo.attributes.normal || geo.morphAttributes.position) continue;
    if (list.some(mt => !texOK(mt) || mt.vertexColors)) continue;
    box.setFromObject(m); box.getCenter(ctr);
    const where = Math.floor(ctr.x / cell) + ',' + Math.floor(ctr.z / cell) + '|' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0) + '|' + m.renderOrder;
    const add = (mat, g) => { const cm = canonical(mat, mats), k = where + '|' + cm.uuid; if (!buckets.has(k)) buckets.set(k, { mat: cm, geos: [], cast: m.castShadow, recv: m.receiveShadow, ro: m.renderOrder }); buckets.get(k).geos.push(g); };
    if (Array.isArray(m.material)) {
      const flat = geo.index ? geo.toNonIndexed() : geo;
      const groups = geo.groups.length ? geo.groups : [{ start: 0, count: (geo.index ? geo.index.count : geo.attributes.position.count), materialIndex: 0 }];
      for (const gr of groups) {
        const mat = m.material[gr.materialIndex]; if (!mat || mat.visible === false) continue;
        const sub = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'uv']) { const a = flat.attributes[k]; if (!a) continue; sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize)); }
        add(mat, prep(sub, m, texOK(mat), mat.color || WHITE, mat));
      }
    } else add(m.material, prep(geo, m, texOK(m.material), m.material.color || WHITE, m.material));
    victims.push(m);
  }
  let made = 0;
  for (const b of buckets.values()) {
    const g = b.geos.length > 1 ? mergeGeometries(b.geos) : b.geos[0];
    if (!g) continue;
    const mesh = new THREE.Mesh(g, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.ro; mesh.matrixAutoUpdate = false; mesh.userData.batched = true;
    scene.add(mesh); made++;
  }
  for (const m of victims) m.parent.remove(m);
  return { removed: victims.length, made };
}

// fold a group's meshes into one mesh per material (keeps the group itself, so anything holding a reference still works)
export function mergeGroupByMaterial(g, keep = []) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), by = new Map(), rel = new THREE.Matrix4();
  const meshes = []; g.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !keep.includes(o) && !Array.isArray(o.material)) meshes.push(o); });
  for (const m of meshes) {
    rel.multiplyMatrices(inv, m.matrixWorld);
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.applyMatrix4(rel); geo.groups = []; geo.morphAttributes = {};
    const k = m.material.uuid + (m.castShadow ? 'c' : '') + (m.receiveShadow ? 'r' : '');
    if (!by.has(k)) by.set(k, { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, geos: [] });
    by.get(k).geos.push(geo); m.parent.remove(m);
  }
  for (const b of by.values()) { const mm = new THREE.Mesh(b.geos.length > 1 ? mergeGeometries(b.geos) : b.geos[0], b.mat); mm.castShadow = b.cast; mm.receiveShadow = b.recv; g.add(mm); }
  return g;
}
