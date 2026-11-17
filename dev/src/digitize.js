// Held = written. When Null takes hold of something she isn't moving matter, she's rewriting where its record says it is,
// so while it's hers the object is rendered by her: a model of light cubes that keeps its own colours (a red barrel stays red),
// edged in her violet. When it comes to rest the city agrees it back: an amber re-render line and it's solid again.
//   grab:    violet scan line sweeps up through it (0.18 s), cubes below the line, then the mesh is gone
//   held:    cubes breathe, a data pulse climbs through it, ~3% blink out, loose cubes shed and drift off
//   thrown:  stays digital in flight and sheds faster
//   settle:  amber line sweeps up (0.24 s); below it the real object is back, the cubes above burst and fade
import * as THREE from 'three';
import { G } from './state.js';

const VIOLET = new THREE.Color(0x9b7bff);
const MAX_VOX = 1800;

// ---------------------------------------------------------------- voxelising (once per prop type, cached)
const texCache = new Map();
function texReader(tex) {
  if (!tex || !tex.image) return null;
  if (texCache.has(tex)) return texCache.get(tex);
  let rd = null;
  try {
    const W = 64, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(tex.image, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, flip = tex.flipY;
    const lin = (v) => Math.pow(v / 255, 2.2);
    rd = (u, v, out) => {
      u -= Math.floor(u); v -= Math.floor(v);
      const px = Math.min(W - 1, Math.floor(u * W)), py = Math.min(H - 1, Math.floor((flip ? 1 - v : v) * H)), i = (py * W + px) * 4;
      return out.setRGB(lin(d[i]), lin(d[i + 1]), lin(d[i + 2]));
    };
  } catch (e) { rd = null; }
  texCache.set(tex, rd); return rd;
}

function voxelize(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const tris = [];                                   // [ax,ay,az, bx,by,bz, cx,cy,cz, uvs|null, material]
  const box = new THREE.Box3(), A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  root.traverse(m => {
    if (!m.isMesh || m.userData.vox || !m.geometry || !m.geometry.attributes.position) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const g = m.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
    const nTri = (idx ? idx.count : pos.count) / 3;
    const mats = Array.isArray(m.material) ? m.material : null;
    const groups = mats && g.groups.length ? g.groups : null;
    for (let t = 0; t < nTri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      A.fromBufferAttribute(pos, i0).applyMatrix4(rel); B.fromBufferAttribute(pos, i1).applyMatrix4(rel); Cc.fromBufferAttribute(pos, i2).applyMatrix4(rel);
      box.expandByPoint(A); box.expandByPoint(B); box.expandByPoint(Cc);
      let mat = m.material;
      if (mats) { const gr = groups ? groups.find(q => t * 3 >= q.start && t * 3 < q.start + q.count) : null; mat = mats[gr ? gr.materialIndex : 0] || mats[0]; }
      if (mat && mat.visible === false) continue;
      tris.push([A.x, A.y, A.z, B.x, B.y, B.z, Cc.x, Cc.y, Cc.z, uv ? [uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2)] : null, mat]);
    }
  });
  if (!tris.length) return null;
  const size = box.getSize(new THREE.Vector3()), maxD = Math.max(size.x, size.y, size.z);
  let cell = THREE.MathUtils.clamp(maxD / 6, 0.16, 0.25);   // big enough to read as cubes from the top-down camera
  const col = new THREE.Color(), tc = new THREE.Color();
  for (let attempt = 0; attempt < 5; attempt++) {
    const NX = Math.max(1, Math.ceil(size.x / cell) + 1), NY = Math.max(1, Math.ceil(size.y / cell) + 1);
    const acc = new Map();
    for (const tr of tris) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz, uvs, mat] = tr;
      const e = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - ax, cy - ay, cz - az), Math.hypot(cx - bx, cy - by, cz - bz));
      const n = Math.min(48, Math.max(1, Math.ceil(e / (cell * 0.5))));
      const base = mat && (mat.userData && mat.userData.baseColor || mat.color) || tc.setRGB(0.3, 0.3, 0.32);
      const rd = mat && mat.map ? texReader(mat.map) : null;
      // the prop's own emissive (tail lights, fire), not whatever hint-glow it happens to wear right now
      const ud = mat && mat.userData || {}, emC = ud.baseEmissive || (mat && mat.emissive), emI = ud.baseEI ?? (mat && mat.emissiveIntensity) ?? 1;
      const em = emC && (emC.r + emC.g + emC.b) * emI > 0.01 ? emC.clone().multiplyScalar(emI) : null;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        const px = ax * w + bx * u + cx * v, py = ay * w + by * u + cy * v, pz = az * w + bz * u + cz * v;
        const ix = Math.floor((px - box.min.x) / cell), iy = Math.floor((py - box.min.y) / cell), iz = Math.floor((pz - box.min.z) / cell);
        const k = ix + iy * NX + iz * NX * NY;
        col.copy(base);
        if (rd && uvs) { rd(uvs[0] * w + uvs[2] * u + uvs[4] * v, uvs[1] * w + uvs[3] * u + uvs[5] * v, tc); col.multiply(tc); }
        if (em) col.add(em);
        let a = acc.get(k); if (!a) { a = [0, 0, 0, 0, ix, iy, iz]; acc.set(k, a); }
        a[0] += col.r; a[1] += col.g; a[2] += col.b; a[3]++;
      }
    }
    if (acc.size > MAX_VOX) { cell *= 1.25; continue; }
    const n = acc.size, P = new Float32Array(n * 3), Cl = new Float32Array(n * 3);
    let i = 0;
    for (const a of acc.values()) {
      P[i * 3] = box.min.x + (a[4] + 0.5) * cell; P[i * 3 + 1] = box.min.y + (a[5] + 0.5) * cell; P[i * 3 + 2] = box.min.z + (a[6] + 0.5) * cell;
      Cl[i * 3] = a[0] / a[3]; Cl[i * 3 + 1] = a[1] / a[3]; Cl[i * 3 + 2] = a[2] / a[3]; i++;
    }
    return { n, P, Cl, cell, minY: box.min.y, maxY: box.max.y, rad: Math.max(size.x, size.z) / 2 };
  }
  return null;
}

// ---------------------------------------------------------------- the light-cube material
const VS = `
uniform float uTime; uniform float uIn; uniform float uOut; uniform float uMinY; uniform float uMaxY; uniform float uCell;
attribute vec3 aCol; attribute float aRnd;
varying vec3 vCol; varying vec3 vP; varying vec3 vN; varying float vY; varying float vFront; varying float vOutF; varying float vRnd;
float hs(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  vec3 c = instanceMatrix[3].xyz;
  float yN = (c.y - uMinY) / max(0.001, uMaxY - uMinY);
  float show = step(yN, uIn) * step(uOut, yN);                     // between the out line and the in line
  float blink = step(0.97, hs(aRnd * 91.0 + floor(uTime * 8.0)));  // ~3% of cubes drop a frame at a time
  float breathe = 1.0 + 0.07 * sin(uTime * 6.0 + aRnd * 40.0);
  float s = show * (1.0 - blink) * breathe;
  vec3 jit = (vec3(hs(aRnd * 7.0 + floor(uTime * 12.0)), hs(aRnd * 13.0 + floor(uTime * 12.0)), hs(aRnd * 17.0 + floor(uTime * 12.0))) - 0.5) * uCell * 0.12 * step(0.9, hs(aRnd * 3.0 + floor(uTime * 3.0)));
  vec3 p = c + jit + (mat3(instanceMatrix) * position) * s;
  vP = position; vN = normal; vCol = aCol; vY = yN; vRnd = aRnd;
  vFront = (1.0 - smoothstep(0.0, 0.14, abs(yN - uIn))) * step(uIn, 0.999);      // only while the sweep is running: from above you mostly see the top layer
  vOutF = (1.0 - smoothstep(0.0, 0.14, abs(yN - uOut))) * step(0.001, uOut) * step(uOut, 0.999);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FS = `
uniform float uTime; uniform float uOut; uniform float uFade;
varying vec3 vCol; varying vec3 vP; varying vec3 vN; varying float vY; varying float vFront; varying float vOutF; varying float vRnd;
void main(){
  vec3 a = abs(vP);
  float mx = max(a.x, max(a.y, a.z)), mn = min(a.x, min(a.y, a.z)), mid = a.x + a.y + a.z - mx - mn;
  float edge = smoothstep(0.36, 0.47, mid);                         // the cube's own edges
  vec3 vio = vec3(0.61, 0.48, 1.0);
  // the object's colour, lifted so it reads as light, never as a dark lump
  vec3 body = vCol * 0.85 + vio * 0.07 + 0.008;
  body *= 0.62 + 0.38 * max(vN.y, 0.0) + 0.1 * abs(vN.x);
  float pulse = smoothstep(0.09, 0.0, abs(fract(uTime * 0.9 + 0.13) - vY));    // a data pulse climbing through it
  float spark = step(0.985, fract(sin(vRnd * 77.0 + floor(uTime * 10.0)) * 43758.5453));
  vec3 col = mix(body, vec3(0.42, 0.24, 1.0) * 0.85, edge * 0.9) + vec3(0.6, 0.5, 1.0) * (pulse * 0.35 + spark * 0.8) * (0.25 + 0.75 * edge);
  col += vec3(0.8, 0.7, 1.0) * vFront * 1.2;                     // her scan line on the way in
  col += vec3(1.0, 0.6, 0.12) * vOutF * 2.2;   // the city's re-render line on the way out
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export function makeDigitizer(scene) {
  const cache = new Map();
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const baseMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uIn: { value: 0 }, uOut: { value: 0 }, uMinY: { value: 0 }, uMaxY: { value: 1 }, uCell: { value: 0.2 }, uFade: { value: 1 } }, vertexShader: VS, fragmentShader: FS });
  const live = new Map();   // prop -> state
  const stats = { ms: 0 };

  // shed cubes: loose light cubes that peel off and drift away
  const SHED_N = 260, shed = [], shedIM = new THREE.InstancedMesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), SHED_N);
  shedIM.count = 0; shedIM.frustumCulled = false; shedIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shedIM.setColorAt(0, new THREE.Color()); shedIM.instanceColor.setUsage(THREE.DynamicDrawUsage); scene.add(shedIM);
  // ground anchors: a dark blob and a violet ring under anything she holds, so its height reads from above
  const ANC_N = 40, ancGeo = new THREE.PlaneGeometry(1, 1); ancGeo.rotateX(-Math.PI / 2);
  ancGeo.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(ANC_N * 2), 2));
  const ancIM = new THREE.InstancedMesh(ancGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'attribute vec2 aK; varying vec2 vU; varying vec2 vK; void main(){ vU = uv * 2.0 - 1.0; vK = aK; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vU; varying vec2 vK; void main(){ float r = length(vU); if (r > 1.0) discard; float blob = (1.0 - smoothstep(0.0, 0.62, r)) * vK.x; float ring = smoothstep(0.06, 0.0, abs(r - 0.8)) * vK.y; gl_FragColor = vec4(vec3(0.56, 0.36, 1.0) * ring * 1.4, max(blob, ring)); }' }), ANC_N);
  ancIM.count = 0; ancIM.frustumCulled = false; ancIM.renderOrder = 4; ancIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ancIM.geometry.attributes.aK.setUsage(THREE.DynamicDrawUsage); scene.add(ancIM);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), W = new THREE.Vector3(), _c = new THREE.Color();

  const keyOf = (o) => (o.type === 'chunk' || o.type === 'wallslab') ? null : o.type;   // torn slabs differ per tear: voxelise each one
  function dataFor(o) {
    const k = keyOf(o);
    if (k && cache.has(k)) return cache.get(k);
    const d = voxelize(o.mesh);
    if (k) cache.set(k, d);
    return d;
  }
  const setMeshVisible = (o, v) => o.mesh.traverse(m => { if (m.isMesh && !m.userData.vox) m.visible = v; });

  function build(o) {
    const d = dataFor(o); if (!d) return null;
    const geo = cubeGeo.clone();
    geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(d.Cl, 3));
    const rnd = new Float32Array(d.n); for (let i = 0; i < d.n; i++) rnd[i] = Math.random() * 100;
    geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 1));
    const mat = baseMat.clone();
    mat.uniforms.uMinY.value = d.minY - 0.001; mat.uniforms.uMaxY.value = d.maxY + 0.001; mat.uniforms.uCell.value = d.cell;
    const im = new THREE.InstancedMesh(geo, mat, d.n);
    for (let i = 0; i < d.n; i++) { M.compose(P.set(d.P[i * 3], d.P[i * 3 + 1], d.P[i * 3 + 2]), Q.identity(), S.setScalar(d.cell * 0.86)); im.setMatrixAt(i, M); }
    im.userData.vox = true; im.castShadow = false; im.frustumCulled = false;
    o.mesh.add(im);
    return { im, mat, d, phase: 'in', t: 0, shedAcc: 0 };
  }
  function drop(o, st) { o.mesh.remove(st.im); st.im.geometry.dispose(); st.mat.dispose(); live.delete(o); }

  const shedFrom = (o, st, n, burst) => {
    const d = st.d;
    for (let k = 0; k < n && shed.length < SHED_N; k++) {
      const i = Math.floor(Math.random() * d.n);
      W.set(d.P[i * 3], d.P[i * 3 + 1], d.P[i * 3 + 2]); o.mesh.localToWorld(W);
      const out = new THREE.Vector3(W.x - o.body.position.x, 0, W.z - o.body.position.z).normalize();
      const sp = burst ? 1.5 + Math.random() * 2.5 : 0.3 + Math.random() * 0.5;
      shed.push({ x: W.x, y: W.y, z: W.z, vx: out.x * sp + (Math.random() - 0.5) * 0.4, vy: burst ? Math.random() * 2 : 0.6 + Math.random() * 0.8, vz: out.z * sp + (Math.random() - 0.5) * 0.4,
        t: 0, life: burst ? 0.35 + Math.random() * 0.3 : 0.6 + Math.random() * 0.5, s: d.cell * (0.5 + Math.random() * 0.4), amber: burst && Math.random() < 0.35 });
    }
  };

  function update(dt, props) {
    const t = G.rt || 0;
    // pre-voxelise one new prop type per frame, so the first grab of anything never hitches
    for (const o of props) { const k = o.kind === 'prop' && o.alive && keyOf(o); if (k && !cache.has(k)) { const t0 = performance.now(); cache.set(k, voxelize(o.mesh)); stats.ms = Math.max(stats.ms, performance.now() - t0); break; } }
    for (const o of props) {
      if (o.kind !== 'prop') continue;
      let st = live.get(o);
      if (!o.alive) { if (st) drop(o, st); continue; }
      const want = !!(o.held || (o.vortex && G.ultState) || o.thrown);
      if (want && !st) { st = build(o); if (!st) continue; live.set(o, st); }
      if (!st) continue;
      const u = st.mat.uniforms;
      u.uTime.value = t;
      if (want && st.phase === 'out') { st.phase = 'held'; u.uOut.value = 0; u.uIn.value = 1; setMeshVisible(o, false); }
      if (!want && st.phase !== 'out') { st.phase = 'out'; st.t = 0; setMeshVisible(o, true); shedFrom(o, st, 10 + Math.min(20, st.d.n >> 4), true); }
      st.t += dt;
      if (st.phase === 'in') {
        u.uIn.value = Math.min(1.001, st.t / 0.18);
        if (st.t >= 0.18) { st.phase = 'held'; setMeshVisible(o, false); }
      } else if (st.phase === 'out') {
        u.uOut.value = Math.min(1.001, st.t / 0.24);
        if (st.t >= 0.26) { drop(o, st); continue; }
      }
      // shed: a few loose cubes a second while held, more in flight
      if (st.phase !== 'out') {
        const sp = Math.hypot(o.body.velocity.x, o.body.velocity.z);
        st.shedAcc += dt * (3 + Math.min(14, sp * 0.9)) * Math.min(2, 0.5 + st.d.rad);
        while (st.shedAcc > 1) { st.shedAcc -= 1; shedFrom(o, st, 1, false); }
      }
    }
    // loose cubes
    let n = 0;
    for (let i = shed.length - 1; i >= 0; i--) {
      const c = shed[i]; c.t += dt; if (c.t > c.life) { shed.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vx *= 0.96; c.vz *= 0.96; c.vy *= 0.97;
      const k = 1 - c.t / c.life;
      M.compose(P.set(c.x, c.y, c.z), Q.identity(), S.setScalar(c.s * (0.4 + 0.6 * k))); shedIM.setMatrixAt(n, M);
      shedIM.setColorAt(n, c.amber ? _c.setRGB(2.0 * k, 1.2 * k, 0.25 * k) : _c.setRGB(VIOLET.r * 2.2 * k, VIOLET.g * 2.2 * k, VIOLET.b * 2.2 * k)); n++;
    }
    shedIM.count = n; shedIM.instanceMatrix.needsUpdate = true; if (n) shedIM.instanceColor.needsUpdate = true;
    // anchors under everything currently digital and off the ground
    let a = 0; const aK = ancIM.geometry.attributes.aK;
    for (const [o, st] of live) {
      if (a >= ANC_N || st.phase === 'out') continue;
      const p = o.body.position, h = Math.max(0, p.y - o.hh);
      if (h < 0.15) continue;
      const r = st.d.rad * 1.25 * (1 + Math.min(0.6, h * 0.15));
      M.compose(P.set(p.x, 0.025, p.z), Q.identity(), S.set(r * 2, 1, r * 2)); ancIM.setMatrixAt(a, M);
      aK.setXY(a, 0.55 - Math.min(0.35, h * 0.09), o.held ? 0.6 : 0.3); a++;
    }
    ancIM.count = a; ancIM.instanceMatrix.needsUpdate = true; aK.needsUpdate = true;
  }

  // voxelise the zone's prop types ahead of time so the first grab never hitches
  function warm(props) { for (const o of props) if (o.kind === 'prop' && keyOf(o) && !cache.has(keyOf(o))) cache.set(keyOf(o), voxelize(o.mesh)); }

  return { update, warm, live, cache, stats };
}
