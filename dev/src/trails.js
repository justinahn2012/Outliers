// Readability from above (lighting panel, Fix 7): position comes from the ground, direction comes from trails.
//  - every bolt gets a tapered streak behind it and a glow on the street under it (amber = Census fire, violet = hers)
//  - thrown things get a violet ribbon instead of a dotted line
// One instanced draw for all streaks, one for all ground glows.
import * as THREE from 'three';
import { G } from './state.js';

const VS = `
attribute vec3 aA; attribute vec3 aB; attribute float aW; attribute vec3 aC0; attribute vec3 aC1;
varying vec3 vC; varying float vT; varying float vS;
void main(){
  float t = position.x, side = position.y;
  vec3 dir = aB - aA; float len = max(length(dir), 1e-4); dir /= len;
  vec3 camPos = cameraPosition; vec3 p = mix(aA, aB, t);
  vec3 sideV = normalize(cross(dir, normalize(camPos - p)) + vec3(1e-5));
  float w = aW * (1.0 - t * 0.85);
  p += sideV * side * w * 0.5;
  vC = mix(aC0, aC1, t); vT = t; vS = side;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FS = `
varying vec3 vC; varying float vT; varying float vS;
void main(){ float a = pow(1.0 - vT, 1.6) * (1.0 - vS * vS * 0.65); gl_FragColor = vec4(vC * a, 1.0); }`;

export function makeTrails(scene) {
  const N = 64;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  const A = {};
  for (const [k, n] of [['aA', 3], ['aB', 3], ['aW', 1], ['aC0', 3], ['aC1', 3]]) { A[k] = new THREE.InstancedBufferAttribute(new Float32Array(N * n), n); A[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, A[k]); }
  geo.instanceCount = 0;
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 8; scene.add(mesh);

  // street glow under each bolt
  const GN = 48, gg = new THREE.PlaneGeometry(1, 1); gg.rotateX(-Math.PI / 2);
  gg.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(GN * 3), 3)); gg.attributes.aCol.setUsage(THREE.DynamicDrawUsage);
  const glow = new THREE.InstancedMesh(gg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aCol; varying vec3 vC; varying vec2 vU; void main(){ vC = aCol; vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying vec2 vU; void main(){ float r = length(vU); gl_FragColor = vec4(vC * pow(max(0.0, 1.0 - r), 2.0), 1.0); }' }), GN);
  glow.count = 0; glow.frustumCulled = false; glow.renderOrder = 3; glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(glow);

  const HEAD_C = new THREE.Color(0xfff1d6).multiplyScalar(2.6), TAIL_C = new THREE.Color(0xff9a1a).multiplyScalar(1.1);
  const HEAD_H = new THREE.Color(0xefe6ff).multiplyScalar(2.6), TAIL_H = new THREE.Color(0x8f5cff).multiplyScalar(1.5);
  const AMB = new THREE.Color(0xff9a1a), VIO = new THREE.Color(0x8f5cff);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), D = new THREE.Vector3();
  let n = 0, gn = 0;
  const streak = (a, b, w, c0, c1) => {
    if (n >= N) return;
    A.aA.setXYZ(n, a.x, a.y, a.z); A.aB.setXYZ(n, b.x, b.y, b.z); A.aW.setX(n, w);
    A.aC0.setXYZ(n, c0.r, c0.g, c0.b); A.aC1.setXYZ(n, c1.r, c1.g, c1.b); n++;
  };
  const ground = (p, col, k, size) => {
    if (gn >= GN) return;
    const f = k / (1 + Math.max(0, p.y));
    M.compose(P.set(p.x, 0.022, p.z), Q.identity(), S.set(size, 1, size)); glow.setMatrixAt(gn, M);
    gg.attributes.aCol.setXYZ(gn, col.r * f, col.g * f, col.b * f); gn++;
  };

  function update(bolts, props) {
    n = 0; gn = 0;
    for (const B of bolts) {
      if (B.caught) { ground(B.p, VIO, 0.3, 0.7); continue; }     // a caught bolt's trail has collapsed; it just hangs
      const sp = B.v.length(); if (sp < 0.1) continue;
      const len = B.hero ? 2.2 : 1.6;
      D.copy(B.v).multiplyScalar(-len / sp).add(B.p);
      streak(B.p, D, B.hero ? 0.11 : 0.09, B.hero ? HEAD_H : HEAD_C, B.hero ? TAIL_H : TAIL_C);
      ground(B.p, B.hero ? VIO : AMB, 0.35, 0.9);
    }
    for (const o of props) {
      if (!o.alive || !o.thrown || o.dropped || o.held) continue;
      const v = o.body.velocity, sp = Math.hypot(v.x, v.y, v.z); if (sp < 6) continue;
      const len = Math.min(3.2, sp * 0.09), p = o.body.position;
      P.set(p.x, p.y, p.z); D.set(p.x - v.x / sp * len, p.y - v.y / sp * len, p.z - v.z / sp * len);
      streak(P, D, Math.max(0.25, o.radius * 0.8), HEAD_H, TAIL_H);
    }
    geo.instanceCount = n;
    for (const k in A) { A[k].needsUpdate = true; A[k].clearUpdateRanges(); A[k].addUpdateRange(0, Math.max(1, n) * A[k].itemSize); }
    glow.count = gn; glow.instanceMatrix.needsUpdate = true; gg.attributes.aCol.needsUpdate = true;
  }
  return { update };
}
