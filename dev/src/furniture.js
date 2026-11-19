// Retrofitted street furniture (cyberpunk_addendum.md #17): holo street plates on corners (street name + block number
// only: location, never directions), kiosks with a screen face, e-bike charge posts with a cyan ring.
// Plates are one instanced draw; kiosks and posts are static meshes the static batch folds.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, GRP, ALL } from './state.js';

const CIVIC = '#bff6ff';
const PLATES = [
  [12.4, -6.2, 'SIDE STREET', 9], [-7.9, -26.2, 'PIER 9 MARKET', 22], [4.4, -76.2, 'YARD ROAD', 31], [43.8, -30.4, 'TRAM LINE', 12],
  [7.4, -42.4, 'TRAM CUT', 12], [14.4, -110.2, 'TRANSIT SHED', 40], [-12.4, 24.2, 'HARROW ST', 14], [-20.6, -104.4, 'FERRY PIER', 44],
];
const KIOSKS = [[-11.9, -3, Math.PI / 2], [11.9, 9.5, -Math.PI / 2], [60.4, -16, -Math.PI / 2], [12.9, -100, -Math.PI / 2]];
const POSTS = [[-11.9, 13.2], [-11.9, 14.0], [-11.9, 14.8], [6.9, -30.2], [6.9, -31.0], [12.9, -109.5], [12.9, -110.3], [18, -81.6], [19, -81.6], [20, -81.6]];

export function makeFurniture(scene, world) {
  // ---- plates: an atlas of 8 (512 x 128 cells), cyan-white type on dark glass
  const [c, x] = (() => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; return [cv, cv.getContext('2d')]; })();
  x.clearRect(0, 0, 1024, 512);
  PLATES.forEach(([, , name, blk], i) => {
    const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 128;
    x.fillStyle = 'rgba(8,20,26,0.75)'; x.fillRect(ox + 6, oy + 8, 500, 112);
    x.strokeStyle = CIVIC; x.lineWidth = 3; x.strokeRect(ox + 8, oy + 10, 496, 108);
    x.fillStyle = CIVIC; x.font = "700 52px 'Bebas Neue', Impact, sans-serif"; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(name, ox + 26, oy + 56);
    x.font = "600 22px Inter, sans-serif"; x.globalAlpha = 0.8; x.fillText('BLK ' + blk, ox + 28, oy + 96); x.globalAlpha = 1;
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(1.2, 0.4), n = PLATES.length, cell = new Float32Array(n * 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25), side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute vec2 aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = (uv + aCell) * vec2(0.5, 0.25);'); };
  mat.customProgramCacheKey = () => 'plates';
  const im = new THREE.InstancedMesh(geo, mat, n), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
  PLATES.forEach(([px, pz], i) => {
    M.compose(P.set(px, 2.55, pz), Q.setFromEuler(E.set(-Math.PI / 4, 0, 0)), S); im.setMatrixAt(i, M);
    cell[i * 2] = i % 2; cell[i * 2 + 1] = 3 - Math.floor(i / 2);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), poleM); pole.position.set(px, 1.2, pz); scene.add(pole);
  });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  im.renderOrder = 8; im.frustumCulled = false; scene.add(im);
  // ---- kiosks: a slim box with a screen face (city colours only)
  const kioskM = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.4, metalness: 0.6 });
  const [sc, sx] = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; return [cv, cv.getContext('2d')]; })();
  const g = sx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#062a33'); g.addColorStop(1, '#020a0c'); sx.fillStyle = g; sx.fillRect(0, 0, 128, 256);
  sx.fillStyle = '#19d3e6'; sx.font = "700 30px 'Bebas Neue', Impact, sans-serif"; sx.textAlign = 'center'; sx.fillText('CITY INFO', 64, 46);
  sx.fillStyle = '#bff6ff'; sx.font = '600 14px Inter, sans-serif'; ['TRANSIT', 'PERMITS', 'TOP UP', 'REPORT'].forEach((t, k) => { sx.fillRect(16, 76 + k * 40, 96, 30); sx.fillStyle = '#062a33'; sx.fillText(t, 64, 96 + k * 40); sx.fillStyle = '#bff6ff'; });
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const screenM = new THREE.MeshBasicMaterial({ map: st, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) });
  const body = (bx, by, bz, hx, hy, hz) => { const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(bx, by, bz); world.addBody(b); };
  for (const [kx, kz, ry] of KIOSKS) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), kioskM); k.position.set(kx, 1.1, kz); k.rotation.y = ry; k.castShadow = true; k.receiveShadow = true; scene.add(k);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.4), screenM); s.position.set(kx, 1.3, kz); s.rotation.y = ry; s.translateZ(0.505); scene.add(s);
    body(kx, 1.1, kz, 0.5, 1.1, 0.5);
  }
  // ---- e-bike charge posts with a cyan ring
  const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.3, 1.45), toneMapped: false });
  for (const [px, pz] of POSTS) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), kioskM); p.position.set(px, 0.55, pz); p.castShadow = true; scene.add(p);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 16), ringM); r.rotation.x = Math.PI / 2; r.position.set(px, 1.0, pz); scene.add(r);
    const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(0.09, 0.09, 1.1, 8)); b.position.set(px, 0.55, pz); world.addBody(b);
  }
  return { plates: im };
}
