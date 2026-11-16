import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { G, GRP, ALL, rand } from './state.js';
import { A } from './assets.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let seed = 1337;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const cloneTex = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

export function signTexture(text, color, vertical, sub) {
  const W = vertical ? 128 : 1024, H = vertical ? 512 : 192;
  const [c, x] = canvas(W, H);
  x.fillStyle = 'rgba(6,6,12,0.92)'; x.fillRect(0, 0, W, H);
  x.strokeStyle = color; x.lineWidth = 6; x.shadowColor = color; x.shadowBlur = 18; x.strokeRect(10, 10, W - 20, H - 20);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (vertical) {
    x.font = '900 74px Inter, Arial, sans-serif';
    const ch = text.split(''); const step = (H - 60) / ch.length;
    ch.forEach((l, i) => { x.shadowBlur = 24; x.fillStyle = color; x.fillText(l, W / 2, 40 + step * (i + 0.5)); x.shadowBlur = 6; x.fillStyle = '#fff'; x.fillText(l, W / 2, 40 + step * (i + 0.5)); });
  } else {
    x.font = '900 96px Inter, Arial, sans-serif';
    x.shadowBlur = 30; x.fillStyle = color; x.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    x.shadowBlur = 8; x.fillStyle = '#fff'; x.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    if (sub) { x.font = '700 34px Inter, Arial, sans-serif'; x.shadowBlur = 12; x.fillStyle = color; x.fillText(sub, W / 2, H * 0.8); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function markingsTexture() {
  const W = 512, H = 1664; const [c, x] = canvas(W, H);
  const m = (v) => v * 32;
  x.fillStyle = 'rgba(214,170,60,0.9)'; x.fillRect(m(8) - 7, 0, 4, H); x.fillRect(m(8) + 3, 0, 4, H);
  x.fillStyle = 'rgba(225,225,220,0.85)';
  for (const lx of [4, 12]) for (let z = 0; z < 52; z += 4) x.fillRect(m(lx) - 3, m(z), 6, m(2));
  x.fillRect(m(0.35), 0, 5, H); x.fillRect(m(15.65) - 5, 0, 5, H);
  for (const cz of [6, 44]) for (let i = 0; i < 16; i += 1.1) x.fillRect(m(i + 0.2), m(cz), m(0.55), m(3));
  x.fillRect(m(0.5), m(9.6), m(7.3), 10); x.fillRect(m(8.2), m(43.2), m(7.3), 10);
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) d[i] *= 0.45 + rnd() * 0.55;
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function windowTexture() {
  const [c, x] = canvas(128, 176);
  const g = x.createRadialGradient(64, 30, 4, 64, 60, 130); g.addColorStop(0, '#fff2d6'); g.addColorStop(0.45, '#c98f55'); g.addColorStop(1, '#3a2414');
  x.fillStyle = g; x.fillRect(0, 0, 128, 176);
  // blinds pulled part way
  const drop = 30 + rnd() * 70;
  for (let y = 0; y < drop; y += 6) { x.fillStyle = 'rgba(40,26,14,0.55)'; x.fillRect(0, y, 128, 3.5); }
  // furniture silhouettes and a plant
  x.fillStyle = 'rgba(20,12,6,0.85)'; x.fillRect(10, 130, 54, 46); x.fillRect(80, 118, 30, 58);
  x.beginPath(); x.ellipse(98, 108, 16, 20, 0, 0, Math.PI * 2); x.fill();
  // mullion
  x.fillStyle = '#120c08'; x.fillRect(62, 0, 4, 176); x.fillRect(0, 86, 128, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function storeTexture() {
  const [c, x] = canvas(512, 192);
  const g = x.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, '#fff6e0'); g.addColorStop(0.5, '#b88a5a'); g.addColorStop(1, '#2a1a10');
  x.fillStyle = g; x.fillRect(0, 0, 512, 192);
  for (let s = 0; s < 4; s++) { x.fillStyle = 'rgba(30,18,10,0.8)'; x.fillRect(0, 50 + s * 34, 512, 5); for (let k = 0; k < 40; k++) { x.fillStyle = `hsla(${rnd() * 360},45%,${30 + rnd() * 30}%,0.9)`; x.fillRect(rnd() * 500, 32 + s * 34, 6 + rnd() * 10, 16 + rnd() * 4); } }
  x.fillStyle = 'rgba(10,8,6,0.9)'; x.fillRect(380, 30, 70, 162);
  x.fillStyle = '#16100a'; for (let k = 0; k <= 4; k++) x.fillRect(k * 128 - 3, 0, 6, 192); x.fillRect(0, 0, 512, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// world-space puddle mask covering the whole block (R = standing water)
function puddleTexture() {
  const S = 512; const [c, x] = canvas(S, S);
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  seed = 99;
  for (let i = 0; i < 70; i++) {
    const px = rnd() * S, py = rnd() * S, r = 6 + rnd() * 30;
    x.save(); x.translate(px, py); x.rotate(rnd() * 3); x.scale(1, 0.4 + rnd() * 0.8);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.restore();
  }
  // gutters along both curbs collect water
  for (const gx of [S * (4.6 / 30), S * (25.4 / 30)]) { const g = x.createLinearGradient(gx - 10, 0, gx + 10, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(gx - 10, 0, 20, S); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// ---------- planar reflection for the wet street ----------
export class Wet {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 0 });
    this.cam = new THREE.PerspectiveCamera();
    this.texMatrix = new THREE.Matrix4();
    this.enabled = true;
    this.uniforms = { tRefl: { value: this.rt.texture }, uTexMatrix: { value: this.texMatrix }, tPuddle: { value: puddleTexture() }, uTime: { value: 0 }, uWet: { value: 1 }, uReflOn: { value: 1 } };
    this.hide = [];
  }
  resize(w, h) { this.rt.setSize(Math.max(64, Math.floor(w * 0.5)), Math.max(64, Math.floor(h * 0.5))); }
  // derived from three's Reflector: mirror the camera about y=0 with an oblique near plane
  render(renderer, scene, camera) {
    if (!this.enabled) { this.uniforms.uReflOn.value = 0; return; }
    this.uniforms.uReflOn.value = 1;
    const mc = this.cam; const n = _n.set(0, 1, 0);
    _rp.set(0, 0, 0); _cp.setFromMatrixPosition(camera.matrixWorld);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_cp);
    _view.subVectors(_rp, _cp); _view.reflect(n).negate(); _view.add(_rp);
    _look.subVectors(_rp, _look); _look.reflect(n).negate(); _look.add(_rp);
    mc.position.copy(_view); mc.up.set(0, 1, 0).applyMatrix4(_rot).reflect(n);
    mc.lookAt(_look); mc.far = camera.far; mc.near = camera.near; mc.fov = camera.fov; mc.aspect = camera.aspect;
    mc.updateMatrixWorld(); mc.projectionMatrix.copy(camera.projectionMatrix);
    this.texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMatrix.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    // oblique clip plane
    _plane.setFromNormalAndCoplanarPoint(n, _rp).applyMatrix4(mc.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = mc.projectionMatrix;
    _q4.x = (Math.sign(_clip.x) + pm.elements[8]) / pm.elements[0];
    _q4.y = (Math.sign(_clip.y) + pm.elements[9]) / pm.elements[5];
    _q4.z = -1; _q4.w = (1 + pm.elements[10]) / pm.elements[14];
    _clip.multiplyScalar(2 / _clip.dot(_q4));
    pm.elements[2] = _clip.x; pm.elements[6] = _clip.y; pm.elements[10] = _clip.z + 1 - 0.003; pm.elements[14] = _clip.w;
    const vis = this.hide.map(o => o.visible); this.hide.forEach(o => (o.visible = false));
    const sAuto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    const fog = scene.fog;
    const prevRT = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, mc);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = sAuto; scene.fog = fog;
    this.hide.forEach((o, i) => (o.visible = vis[i]));
  }
  // inject wetness + reflection into a MeshStandardMaterial
  patch(mat, { reflect = 1, puddles = 1, area = [-15, -30, 30, 60] } = {}) {
    const U = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.uniforms.uArea = { value: new THREE.Vector4(...area) };
      sh.uniforms.uReflect = { value: reflect }; sh.uniforms.uPud = { value: puddles };
      sh.vertexShader = 'uniform mat4 uTexMatrix; varying vec4 vRefl; varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = modelMatrix * vec4(transformed, 1.0); vWPos = wp4.xyz; vRefl = uTexMatrix * wp4;`);
      sh.fragmentShader = `uniform sampler2D tRefl; uniform sampler2D tPuddle; uniform float uTime; uniform float uWet; uniform float uReflOn; uniform vec4 uArea; uniform float uReflect; uniform float uPud;
        varying vec4 vRefl; varying vec3 vWPos; float gPud;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        vec2 ripples(vec2 p){
          vec2 acc = vec2(0.0);
          for (int i = 0; i < 2; i++) {
            vec2 cell = floor(p * (2.4 + float(i))); vec2 f = fract(p * (2.4 + float(i))) - 0.5;
            float r = h21(cell + float(i) * 7.3); vec2 o = vec2(h21(cell + 3.1), h21(cell + 9.7)) - 0.5;
            float t = fract(uTime * (0.9 + r * 0.6) + r);
            vec2 d = f - o * 0.6; float l = length(d);
            float wave = sin((l - t * 0.5) * 48.0) * (1.0 - t) * smoothstep(0.5 * t + 0.06, 0.5 * t, l) * smoothstep(0.0, 0.02, l);
            acc += normalize(d + 1e-4) * wave;
          }
          return acc;
        }
      ` + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 puv = (vWPos.xz - uArea.xy) / uArea.zw;
          gPud = smoothstep(0.5, 0.85, texture2D(tPuddle, puv).r) * uPud * uWet;
          diffuseColor.rgb *= mix(0.8, 0.7, gPud);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor * mix(1.0, 0.62, uWet), 0.05, gPud);`)
        .replace('#include <opaque_fragment>', `
          vec2 rip = ripples(vWPos.xz) * gPud;
          vec4 rc = vRefl; rc.xy += (normal.xy * 0.12 * (1.0 - gPud) + rip * 0.018) * rc.w;
          vec3 refl = texture2DProj(tRefl, rc).rgb;
          float ndv = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
          float rAmt = mix(0.06, 0.9, gPud) * uWet * uReflect * uReflOn;
          outgoingLight = outgoingLight * (1.0 - rAmt * 0.5) + refl * rAmt * mix(0.45, 1.0, fres);
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'wet' + reflect + puddles;
  }
}
const _n = new THREE.Vector3(), _rp = new THREE.Vector3(), _cp = new THREE.Vector3(), _rot = new THREE.Matrix4(), _look = new THREE.Vector3(), _view = new THREE.Vector3();
const _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q4 = new THREE.Vector4();

export function buildEnvironment(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(A.env).texture;
  scene.environmentIntensity = 0.32;
  pm.dispose();
}

function pbr(prefix, rx, ry, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map: cloneTex(A.tex[prefix + '_d'], rx, ry), normalMap: cloneTex(A.tex[prefix + '_n'], rx, ry),
    roughnessMap: cloneTex(A.tex[prefix + '_arm'], rx, ry), aoMap: null, metalnessMap: null, roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(1, 1), ...extra,
  });
}

// ---------- level ----------
export function buildLevel(scene, world, wet) {
  const L = { lights: [], update: null, lampHeads: [] };
  const groundMat = new CANNON.Material('ground');
  G.groundMat = groundMat;
  const ground = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.GROUND, collisionFilterMask: ALL });
  ground.addShape(new CANNON.Box(new CANNON.Vec3(45, 0.5, 42)), new CANNON.Vec3(0, -0.5, -17.4));
  world.addBody(ground); G.groundBody = ground;
  const wall = (cx, cy, cz, hx, hy, hz) => {
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(cx, cy, cz); world.addBody(b); return b;
  };
  wall(-13.6, 15, -5, 1, 15, 40); wall(13.6, 15, -5, 1, 15, 40); wall(0, 15, -27.4, 16, 15, 1);
  wall(0, 0.48, 24.85, 14, 0.48, 0.22);

  // Wet asphalt with real-time reflections, puddles and rain ripples
  const street = new THREE.Mesh(new THREE.PlaneGeometry(17, 52), pbr('asphalt_02', 17 / 3.2, 52 / 3.2, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.9 }));
  wet.patch(street.material, { reflect: 1, puddles: 1 });
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -1); street.receiveShadow = true; scene.add(street);
  wet.hide.push(street);
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(16, 52), new THREE.MeshStandardMaterial({ map: markingsTexture(), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  marks.rotation.x = -Math.PI / 2; marks.position.set(0, 0.004, -1); marks.receiveShadow = true; scene.add(marks); wet.hide.push(marks);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(6, 52), pbr('pavement_03', 6 / 2.2, 52 / 2.2));
    wet.patch(sw.material, { reflect: 0.55, puddles: 0.35 });
    sw.rotation.x = -Math.PI / 2; sw.position.set(sx * 11.5, 0.002, -1); sw.receiveShadow = true; scene.add(sw); wet.hide.push(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 52), pbr('concrete_wall_008', 0.2, 18));
    curb.position.set(sx * 8.56, 0.0, -1); curb.receiveShadow = true; scene.add(curb);
  }
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 1 }));
  fill.rotation.x = -Math.PI / 2; fill.position.set(0, -0.02, -20); scene.add(fill); wet.hide.push(fill);

  // Brick facades with real glass windows (instanced), storefronts and rooftop clutter
  const brick = (w, h, rot) => {
    const m = pbr('dark_brick_wall', w / 2.6, h / 2.6);
    return m;
  };
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.95 });
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x05070b, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6 });
  const glassLit = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: windowTexture(), emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.5 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6, metalness: 0.4 });
  const winGeo = new THREE.PlaneGeometry(1.15, 1.6), frameGeo = new THREE.BoxGeometry(1.35, 1.8, 0.08);
  const winsDark = [], winsLit = [];
  const bldg = (x0, x1, z0, z1, h, axis) => {
    const w = x1 - x0, d = z1 - z0;
    const faceW = axis === 'x' ? d : w;
    const face = brick(faceW, h);
    const mats = axis === 'x'
      ? [x1 < 0 ? face : roofMat, x1 < 0 ? roofMat : face, roofMat, roofMat, roofMat, roofMat]
      : [roofMat, roofMat, roofMat, roofMat, face, roofMat];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    // windows on the street face
    const fx = axis === 'x' ? (x1 < 0 ? x1 + 0.02 : x0 - 0.02) : 0;
    const fz = axis === 'z' ? z1 + 0.02 : 0;
    const ry = axis === 'x' ? (x1 < 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    const cols = Math.floor(faceW / 2.6), floors = Math.floor((h - 4.2) / 3.4);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols * faceW - faceW / 2, y = 5.2 + f * 3.4;
      const p = axis === 'x' ? new THREE.Vector3(fx, y, (z0 + z1) / 2 + u) : new THREE.Vector3((x0 + x1) / 2 + u, y, fz);
      const lit = rnd() < 0.34;
      (lit ? winsLit : winsDark).push({ p, ry, col: lit ? new THREE.Color().setHSL(0.08 + rnd() * 0.06, 0.6, 0.35 + rnd() * 0.3).multiplyScalar(rnd() < 0.15 ? 0.6 : 1.4) : null });
    }
    // ground-floor storefront glow
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(faceW - 2, 7), 2.6), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color().setHSL(0.06 + rnd() * 0.08, 0.35, 0.6), emissiveMap: storeTexture(), emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.5 }));
    sf.position.set(axis === 'x' ? fx : (x0 + x1) / 2, 1.7, axis === 'x' ? (z0 + z1) / 2 + (rnd() - 0.5) * 2 : fz); sf.rotation.y = ry; scene.add(sf);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(Math.min(faceW - 2, 7) + 0.4, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rnd(), 0.4, 0.18), roughness: 0.8 }));
    awn.position.copy(sf.position); awn.position.y = 3.25; awn.rotation.y = ry; awn.translateZ(0.5); awn.rotation.x = 0; scene.add(awn);
    for (let k = 0; k < 3; k++) {
      const s = 0.8 + rnd() * 1.6;
      const box = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s * 1.2), new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.5, metalness: 0.6 }));
      box.position.set(x0 + 1.5 + rnd() * (w - 3), h + s * 0.35, z0 + 1.5 + rnd() * (d - 3)); scene.add(box);
    }
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), pbr('concrete_wall_008', (w + d) / 4, 0.3));
    ledge.position.set((x0 + x1) / 2, h + 0.2, (z0 + z1) / 2); scene.add(ledge);
  };
  seed = 4242;
  [[-27, -17.5, 15], [-15.5, -3.5, 11], [-1.5, 11, 17], [13, 25, 10]].forEach(([z0, z1, h]) => bldg(-28, -12.7, z0, z1, h, 'x'));
  [[-27, -13, 13], [-11, 1, 18], [3, 14, 12], [16, 25, 9]].forEach(([z0, z1, h]) => bldg(12.7, 28, z0, z1, h, 'x'));
  bldg(-28, 28, -42, -26.6, 22, 'z');
  const inst = (geo, mat, list, color) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length); const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    list.forEach((w, i) => { Q.setFromEuler(new THREE.Euler(0, w.ry, 0)); M.compose(w.p, Q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, M); if (color && w.col) im.setColorAt(i, w.col); });
    scene.add(im); return im;
  };
  const all = [...winsDark, ...winsLit];
  inst(frameGeo, frameMat, all.map(w => ({ ...w, p: w.p.clone() })));
  inst(winGeo, glassDark, winsDark.map(w => ({ ...w, p: w.p.clone().add(new THREE.Vector3(Math.sin(w.ry) * 0.05, 0, Math.cos(w.ry) * 0.05)) })));
  // lit windows: warm interiors (instance colour drives emissive via a tiny shader tweak)
  glassLit.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance *= vColor;\n#endif'); };
  inst(winGeo, glassLit, winsLit.map(w => ({ ...w, p: w.p.clone().add(new THREE.Vector3(Math.sin(w.ry) * 0.05, 0, Math.cos(w.ry) * 0.05)) })), true);

  // Neon
  const sign = (text, color, vertical, x, y, z, rotY, w, h, sub) => {
    const t = signTexture(text, color, vertical, sub);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.45, 1.45, 1.45), toneMapped: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
    if (vertical) { const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 0.2, w + 0.2), new THREE.MeshStandardMaterial({ color: 0x111, metalness: 0.6, roughness: 0.4 })); back.position.set(x, y, z); back.rotation.y = rotY - Math.PI / 2; scene.add(back); }
  };
  sign('RAMEN', '#ff2a8a', true, -12.2, 7.5, -9, Math.PI / 2, 1.3, 5.2);
  sign('HOTEL', '#19e3ff', true, 12.2, 8, -20, -Math.PI / 2, 1.3, 5.2);
  sign('BAR', '#ffb03a', true, 12.2, 5.5, 8.5, -Math.PI / 2, 1.1, 3.2);
  sign('WASH', '#7dffb0', true, -12.2, 5.2, 18, Math.PI / 2, 1.1, 3.6);
  sign('PIER 9 MARKET', '#ffb060', false, 0, 10.5, -26.5, 0, 14, 2.6, 'OPEN LATE · FISH · NOODLES');
  sign('OUTLIERS ARE NOT A CRIME', '#ff2a8a', false, -6, 5.2, -26.5, 0, 7.5, 1.0);
  sign('THE CENSUS COUNTS', '#e8f0ff', false, 6.6, 5.4, -26.5, 0, 7.5, 1.3, '|||| EVERY ONE OF US');
  const pinkL = new THREE.PointLight(0xff2a8a, 22, 15, 1.7); pinkL.position.set(-10.8, 5, -9); scene.add(pinkL);
  const cyanL = new THREE.PointLight(0x19e3ff, 22, 15, 1.7); cyanL.position.set(10.8, 6, -20); scene.add(cyanL);

  // Victorian lamp posts (photoscanned) with warm sodium-ish pools and a hint of volumetric haze
  const lampSrc = A.gltf.street_lamp.scene;
  const haloTex = (() => { const [c, x] = canvas(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(1.0, 0.62, 0.3) } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); gl_FragColor = vec4(uCol * 0.08 * vY * vY * edge, 1.0); }',
  });
  const lampSpots = [[-9.4, -17], [9.4, -5], [-9.4, 7], [9.4, 18], [-9.4, -26 + 4], [9.4, -24]];
  for (const [lx, lz] of lampSpots) {
    const lamp = lampSrc.clone(); lamp.position.set(lx, 0, lz); lamp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(lamp);
    const pl = new THREE.PointLight(0xffb066, 32, 16, 1.5); pl.position.set(lx, 3.45, lz); scene.add(pl); L.lights.push(pl);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.2, 1.6, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(lx, 3.55, lz); halo.scale.setScalar(1.6); scene.add(halo);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.4, 24, 1, true), coneMat); cone.position.set(lx, 3.45 - 1.7, lz); scene.add(cone);
    const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(0.14, 0.18, 3.8, 8)); b.position.set(lx, 1.9, lz); world.addBody(b);
  }
  // Hydrants (photoscanned, aged variant)
  const hyd = A.gltf.hydrant.scene;
  for (const [hx, hz] of [[-9.0, -2], [9.0, 12]]) {
    const g = new THREE.Group(); hyd.updateMatrixWorld(true);
    hyd.traverse(o => { if (o.isMesh) { let t = o; while (t.parent && t.parent !== hyd) t = t.parent; if (!/aged/.test(t.name)) return; const m = new THREE.Mesh(o.geometry, o.material); m.applyMatrix4(o.matrixWorld); m.position.x -= 0.3; m.castShadow = m.receiveShadow = true; g.add(m); } });
    g.position.set(hx, 0, hz); g.rotation.y = hx < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
    const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(0.18, 0.18, 0.8, 8)); b.position.set(hx, 0.4, hz); world.addBody(b);
  }

  // Pier edge + harbour
  const conc = pbr('concrete_wall_008', 10, 0.5);
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(28, 0.96, 0.44), conc); barrier.position.set(0, 0.48, 24.85); barrier.castShadow = barrier.receiveShadow = true; scene.add(barrier);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 0.46), new THREE.MeshStandardMaterial({ color: 0xc8a232, roughness: 0.6 })); stripe.position.set(0, 0.86, 24.85); scene.add(stripe);
  const pierFace = new THREE.Mesh(new THREE.BoxGeometry(90, 1.6, 0.6), conc); pierFace.position.set(0, -0.8, 24.9); scene.add(pierFace);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), new THREE.MeshStandardMaterial({ color: 0x020509, roughness: 0.06, metalness: 0.85, envMapIntensity: 2.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -1.1, 65); scene.add(water); wet.hide.push(water);
  G.waterY = -1.1;

  // Light: dim cool moonlight (shadows), city-glow ambient
  const hemi = new THREE.HemisphereLight(0x5a6c95, 0x14110f, 0.45); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.75);
  moon.position.set(-8, 22, 10); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03;
  scene.add(moon); scene.add(moon.target); L.moon = moon;

  // Rain: camera-facing streaks, slight wind, lit additively
  const N = 1400;
  const rg = new THREE.InstancedBufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  rg.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(N * 4); for (let i = 0; i < N; i++) { off[i * 4] = rand(-14, 14); off[i * 4 + 1] = rand(0, 16); off[i * 4 + 2] = rand(-16, 14); off[i * 4 + 3] = Math.random(); }
  const oattr = new THREE.InstancedBufferAttribute(off, 4); rg.setAttribute('aOff', oattr); rg.instanceCount = N;
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() } },
    vertexShader: `attribute vec4 aOff; uniform float uTime; uniform vec3 uCenter; varying float vA; varying float vU;
      void main(){
        float fall = 22.0 + aOff.w * 6.0;
        vec3 p = aOff.xyz; p.y = mod(p.y - uTime * fall, 16.0);
        p.x = uCenter.x + mod(p.x - uCenter.x + 14.0 + uTime * 1.2, 28.0) - 14.0;
        p.z = uCenter.z + mod(p.z - uCenter.z + 18.0, 32.0) - 18.0;
        vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 wp = p + camR * position.x * 0.018 + vec3(0.04, 1.0, 0.0) * position.y * 0.62;
        vA = 0.14 + aOff.w * 0.16; vU = position.x + 0.5;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: 'varying float vA; varying float vU; void main(){ float e = 1.0 - abs(vU - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.55, 0.62, 0.78) * vA * e, 1.0); }',
  });
  const rain = new THREE.Mesh(rg, rainMat); rain.frustumCulled = false; rain.renderOrder = 15; scene.add(rain); wet.hide.push(rain);
  L.update = (dt, center) => {
    moon.position.set(center.x - 8, 22, center.z + 10); moon.target.position.set(center.x, 0, center.z);
    rainMat.uniforms.uTime.value += dt; rainMat.uniforms.uCenter.value.copy(center);
    wet.uniforms.uTime.value += dt;
    if (G.fx && Math.random() < 0.9) for (let k = 0; k < 3; k++) G.fx.add.emit(center.x + rand(-9, 9), 0.04, center.z + rand(-12, 8), 0, rand(0.5, 1.1), 0, 0.45, 0.5, 0.62, 0.22, 0.06, 0.015, 5, 0, 0.6);
  };
  return L;
}
