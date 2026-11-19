// Census retro-reflective tape (art_director.md Fix 4): amber hi-vis bands on the upper arms, a strip between the
// shoulder blades, a crest down the helmet. "Who's the enemy?" answers itself without the ring: amber glints are Census,
// violet is Null, mid-grey is people. It flares with the ring during windup / aim / throw. One instanced draw.
import * as THREE from 'three';
import { G } from './state.js';

const TYPES = { counter: 1, marksman: 1, lobber: 1, warden: 1 };
export function makeTape(scene) {
  const N = 6 * 16, geo = new THREE.BoxGeometry(1, 1, 1);
  const hot = new Float32Array(N); geo.setAttribute('aHot', new THREE.InstancedBufferAttribute(hot, 1));
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a2200, emissive: 0xff9a1f, emissiveIntensity: 0.9, roughness: 0.4 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aHot; varying float vHot;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vHot = aHot;');
    sh.fragmentShader = 'varying float vHot;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vHot;');
  };
  mat.customProgramCacheKey = () => 'tape';
  const im = new THREE.InstancedMesh(geo, mat, N); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), A = new THREE.Vector3(), B2 = new THREE.Vector3(), D = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3();
  function update() {
    let n = 0;
    for (const e of G.enemies || []) {
      if (!TYPES[e.type] || !e.bones || e.state === 'spawn' || (e.fade !== undefined && e.fade < 0.35)) continue;
      if (n + 6 > N) break;
      const B = e.bones, sc = e.def.scale || 1, k = e.dead ? 0.3 : (e.state === 'windup' || e.state === 'aim' || e.state === 'throw' || e.state === 'strike') ? 1.8 / 0.9 : 1;
      // two bands round each upper arm at 55% and 80% down it
      for (const [U, Fo] of [[B.lU, B.lF], [B.rU, B.rF]]) {
        if (!U || !Fo) continue;
        U.getWorldPosition(A); Fo.getWorldPosition(B2); D.subVectors(B2, A); const len = D.length() || 0.3; D.normalize(); Q.setFromUnitVectors(Y, D);
        for (const t of [0.55, 0.8]) { P.copy(A).addScaledVector(D, len * t); M.compose(P, Q, S.set(0.125 * sc, 0.08 * sc, 0.125 * sc)); im.setMatrixAt(n, M); hot[n++] = k; }
      }
      Q2.copy(e.root.quaternion); F.set(0, 0, 1).applyQuaternion(Q2);
      if (B.spine) { B.spine.getWorldPosition(P); P.addScaledVector(F, -0.15 * sc); P.y += 0.12 * sc; M.compose(P, Q2, S.set(0.32 * sc, 0.08 * sc, 0.02)); im.setMatrixAt(n, M); hot[n++] = k; }
      if (B.head) { B.head.getWorldPosition(P); P.y += 0.2 * sc; P.addScaledVector(F, -0.02 * sc); M.compose(P, Q2, S.set(0.07 * sc, 0.02, 0.24 * sc)); im.setMatrixAt(n, M); hot[n++] = k; }
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; geo.attributes.aHot.needsUpdate = true;
  }
  return { update };
}
