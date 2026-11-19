// Null's scarf (characters.md "Next after the ten"): a 1.1 m verlet ribbon from the back of her neck. From above it's a
// violet stroke trailing behind her: it shows her heading and is the one shape no Census can share. It floats (low
// gravity), drags in the wind of her own movement, and freezes in mid-air during Root Access.
import * as THREE from 'three';
import { G } from './state.js';

const NP = 10, SEG = 0.11;
export function makeScarf(scene, h) {
  const P = [], Q = [];
  for (let i = 0; i < NP; i++) { P.push(new THREE.Vector3()); Q.push(new THREE.Vector3()); }
  const pos = new Float32Array(NP * 2 * 3), side = new Float32Array(NP * 2), idx = [];
  for (let i = 0; i < NP; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); geo.setIndex(idx);
  const U = { uEdge: { value: 0.15 } };
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a2470, roughness: 0.7, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = U.uEdge;
    sh.vertexShader = 'attribute float aSide; varying float vSide;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSide = aSide;');
    sh.fragmentShader = 'uniform float uEdge; varying float vSide;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.48, 0.30, 1.0) * uEdge * smoothstep(0.55, 1.0, abs(vSide));');
  };
  mat.customProgramCacheKey = () => 'scarf';
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = false; mesh.renderOrder = 3; scene.add(mesh);
  const B = h.bones, nk = B.neck || B.head, sp = B.spine;
  const a = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), d = new THREE.Vector3(), c1 = new THREE.Vector3(), c2 = new THREE.Vector3(), wind = new THREE.Vector3();
  let init = false;
  const anchor = () => {
    nk.getWorldPosition(a); fwd.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    a.addScaledVector(fwd, -0.06); a.y += 0.02;
  };
  return {
    mesh,
    update(dt) {
      if (!nk) return;
      dt = Math.min(dt, 1 / 30);
      anchor();
      if (!init) { for (let i = 0; i < NP; i++) { P[i].copy(a).addScaledVector(fwd, -SEG * i * 0.7); P[i].y -= SEG * i * 0.7; Q[i].copy(P[i]); } init = true; }
      mesh.visible = !h.dead;
      const frozen = !!G.ultState;
      if (!frozen) {
        const v = h.body.velocity, t = G.rt || 0;
        wind.set(-v.x * 0.6 + Math.sin(t * 0.9) * 0.5, Math.sin(t * 1.7) * 0.2, -v.z * 0.6 + Math.cos(t * 1.1) * 0.5);
        const damp = Math.max(0, 1 - 2.2 * dt);
        if (sp) sp.getWorldPosition(c1); c2.copy(h.root.position); c2.y += 0.95;
        P[0].copy(a); Q[0].copy(a);
        for (let i = 1; i < NP; i++) {
          d.subVectors(P[i], Q[i]).multiplyScalar(damp); Q[i].copy(P[i]);
          P[i].add(d); P[i].y += -3.5 * dt * dt; P[i].addScaledVector(wind, dt * dt * 4);
        }
        for (let it = 0; it < 3; it++) {
          for (let i = 1; i < NP; i++) { d.subVectors(P[i], P[i - 1]); const L = d.length() || 1e-4; P[i].copy(P[i - 1]).addScaledVector(d, SEG / L); }
          for (let i = 1; i < NP; i++) for (const [cc, r] of [[c1, 0.2], [c2, 0.18]]) { d.subVectors(P[i], cc); const L = d.length(); if (L < r && L > 1e-4) P[i].copy(cc).addScaledVector(d, r / L); }
        }
        if (P[NP - 1].y < 0.05) P[NP - 1].y = 0.05;
      }
      // rebuild the ribbon: width across her right vector, tapering 0.15 -> 0.09 m
      right.set(Math.cos(h.yaw), 0, -Math.sin(h.yaw));
      for (let i = 0; i < NP; i++) {
        const w = (0.15 - 0.06 * i / (NP - 1)) / 2;
        pos.set([P[i].x - right.x * w, P[i].y, P[i].z - right.z * w, P[i].x + right.x * w, P[i].y, P[i].z + right.z * w], i * 6);
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
      U.uEdge.value = 0.15 + (h.power || 0) * 0.8;
    },
  };
}
