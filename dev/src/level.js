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
  const L = { lights: [], update: null, lampHeads: [], gates: [], vents: [], spots: [] };
  // Every lamp, neon and lantern registers a light "spot"; only the POOL nearest the camera get a real
  // point light each frame, so the shader cost stays flat however big the world gets.
  const spots = L.spots;
  const addSpot = (x, y, z, color, intensity, distance, decay = 1.6, flick = 0) => { const s = { p: new THREE.Vector3(x, y, z), c: new THREE.Color(color), i: intensity, d: distance, decay, flick, k: 1 }; spots.push(s); return s; };
  const POOL = [];
  for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); POOL.push(l); }
  const groundMat = new CANNON.Material('ground');
  G.groundMat = groundMat;
  const ground = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.GROUND, collisionFilterMask: ALL });
  ground.addShape(new CANNON.Box(new CANNON.Vec3(70, 0.5, 58.5)), new CANNON.Vec3(25, -0.5, -33.9));      // x -45..95, z 24.6 .. -92.4
  ground.addShape(new CANNON.Box(new CANNON.Vec3(32.7, 0.5, 21.8)), new CANNON.Vec3(47.3, -0.5, -114.2)); // container yard + shed: x 14.6..80, z -92.4..-136
  ground.addShape(new CANNON.Box(new CANNON.Vec3(20.7, 0.5, 8)), new CANNON.Vec3(-41.3, -0.5, -112));     // ferry pier: x -62..-20.6, z -120..-104
  ground.addShape(new CANNON.Box(new CANNON.Vec3(17.6, 0.5, 19.1)), new CANNON.Vec3(-3.0, -0.5, -111.5)); // Pier 9 docks: x -20.6..14.6, z -92.4..-130.6
  world.addBody(ground); G.groundBody = ground;
  const wall = (cx, cy, cz, hx, hy, hz) => {
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(cx, cy, cz); world.addBody(b); return b;
  };
  wall(-13.6, 15, -5, 1, 15, 30); wall(13.6, 15, 9.25, 1, 15, 15.75); wall(13.6, 15, -23.75, 1, 15, 11.25);
  wall(-11.8, 15, -27.4, 4.2, 15, 1); wall(11.8, 15, -27.4, 4.2, 15, 1);
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
  const block = (x0, x1, z0, z1, h, faces, opts = {}) => {
    const w = x1 - x0, d = z1 - z0;
    const mats = [roofMat, roofMat, roofMat, roofMat, roofMat, roofMat];
    const idx = { '+x': 0, '-x': 1, '+z': 4, '-z': 5 };
    for (const f of faces) mats[idx[f]] = brick(f[1] === 'x' ? d : w, h);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    if (opts.collide !== false) wall((x0 + x1) / 2, h / 2, (z0 + z1) / 2, w / 2, h / 2, d / 2);
    for (const f of faces) {
      const alongZ = f[1] === 'x', fw = alongZ ? d : w, pos = f[0] === '+';
      const fx = alongZ ? (pos ? x1 + 0.02 : x0 - 0.02) : 0, fz = !alongZ ? (pos ? z1 + 0.02 : z0 - 0.02) : 0;
      const ry = f === '+x' ? Math.PI / 2 : f === '-x' ? -Math.PI / 2 : f === '+z' ? 0 : Math.PI;
      const cols = Math.floor(fw / 2.6), floors = Math.floor((h - 4.2) / 3.4);
      for (let fl = 0; fl < floors; fl++) for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols * fw - fw / 2, y = 5.2 + fl * 3.4;
        const p = alongZ ? new THREE.Vector3(fx, y, (z0 + z1) / 2 + u) : new THREE.Vector3((x0 + x1) / 2 + u, y, fz);
        const lit = rnd() < (opts.lit ?? 0.34);
        (lit ? winsLit : winsDark).push({ p, ry, col: lit ? new THREE.Color().setHSL(0.08 + rnd() * 0.06, 0.6, 0.35 + rnd() * 0.3).multiplyScalar(rnd() < 0.15 ? 0.6 : 1.4) : null });
      }
      if (opts.noStore && opts.noStore.includes(f)) continue;
      const sw = Math.min(fw - 2, opts.storeW || 7);
      if (sw < 2) continue;
      const off = (opts.storeOff && opts.storeOff[f]) || (rnd() - 0.5) * 2;
      const sf = new THREE.Mesh(new THREE.PlaneGeometry(sw, 2.6), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color().setHSL(0.06 + rnd() * 0.08, 0.35, 0.6), emissiveMap: storeTexture(), emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.5 }));
      sf.position.set(alongZ ? fx : (x0 + x1) / 2 + off, 1.7, alongZ ? (z0 + z1) / 2 + off : fz); sf.rotation.y = ry; scene.add(sf);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.4, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rnd(), 0.4, 0.18), roughness: 0.8 }));
      awn.position.copy(sf.position); awn.position.y = 3.25; awn.rotation.y = ry; awn.translateZ(0.5); scene.add(awn);
    }
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), pbr('concrete_wall_008', (w + d) / 4, 0.3));
    ledge.position.set((x0 + x1) / 2, h + 0.2, (z0 + z1) / 2); scene.add(ledge);
    for (let k = 0; k < Math.min(4, Math.floor(w * d / 120) + 1); k++) {
      const sz = 0.8 + rnd() * 1.6;
      const bx = new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.7, sz * 1.2), new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.5, metalness: 0.6 }));
      bx.position.set(x0 + 1.5 + rnd() * Math.max(0.1, w - 3), h + sz * 0.35, z0 + 1.5 + rnd() * Math.max(0.1, d - 3)); scene.add(bx);
    }
  };
  seed = 4242;
  [[-27, -17.5, 15], [-15.5, -3.5, 11], [-1.5, 11, 17], [13, 25, 10]].forEach(([z0, z1, h]) => bldg(-28, -12.7, z0, z1, h, 'x'));
  [[-27, -12.5, 13], [-6.5, 1, 9], [3, 14, 12], [16, 25, 9]].forEach(([z0, z1, h]) => bldg(12.7, 28, z0, z1, h, 'x'));
  // Neon
  const sign = (text, color, vertical, x, y, z, rotY, w, h, sub) => {
    const t = signTexture(text, color, vertical, sub);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.45, 1.45, 1.45), toneMapped: false, side: vertical ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
    let back = null;
    if (!vertical) { back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.5, roughness: 0.5 })); back.position.set(x, y, z); back.rotation.y = rotY; back.translateZ(-0.07); scene.add(back); }
    return [m, back];
    if (vertical) { const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 0.2, w + 0.2), new THREE.MeshStandardMaterial({ color: 0x111, metalness: 0.6, roughness: 0.4 })); back.position.set(x, y, z); back.rotation.y = rotY - Math.PI / 2; scene.add(back); }
  };
  sign('RAMEN', '#ff2a8a', true, -12.2, 7.5, -9, Math.PI / 2, 1.3, 5.2);
  sign('HOTEL', '#19e3ff', true, 12.2, 8, -20, -Math.PI / 2, 1.3, 5.2);
  sign('BAR', '#ffb03a', true, 12.2, 5.5, 8.5, -Math.PI / 2, 1.1, 3.2);
  sign('WASH', '#7dffb0', true, -12.2, 5.2, 18, Math.PI / 2, 1.1, 3.6);
  const arch = sign('PIER 9 MARKET', '#ffb060', false, 0, 10.5, -26.5, 0, 14, 2.6, 'OPEN LATE · FISH · NOODLES');
  sign('OUTLIERS ARE NOT A CRIME', '#ff2a8a', false, -16.5, 5.2, -26.5, 0, 7.5, 1.0);
  sign('THE CENSUS COUNTS', '#e8f0ff', false, 17, 5.4, -26.5, 0, 7.5, 1.3, '|||| EVERY ONE OF US');
  { const beam = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.7 })); beam.position.set(0, 10.5, -26.85); scene.add(beam); arch.push(beam); }
  // the arch over the market entrance fades out while the camera passes under it
  for (const m of arch) if (m) { m.material.transparent = true; m.userData.baseOpacity = 1; }
  L.archFade = (center) => {
    const target = center.z < -23.5 ? 0 : 1;
    for (const m of arch) if (m) { const o = m.material.opacity + (target - m.material.opacity) * 0.12; m.material.opacity = o; m.visible = o > 0.02; }
  };
  addSpot(-10.8, 5, -9, 0xff2a8a, 22, 15, 1.7); addSpot(10.8, 6, -20, 0x19e3ff, 22, 15, 1.7);

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
    addSpot(lx, 3.45, lz, 0xffb066, 32, 16, 1.5);
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

  // ---- the rest of Chapter 1: Pier 9 Market, Gut Lane, Pier 9 docks ----
  buildPier9({ scene, world, wet, block, sign, addSpot, groundMat, L, haloTex, coneMat, lampSrc });
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
  const _sd = [];
  L.update = (dt, center) => {
    moon.position.set(center.x - 8, 22, center.z + 10); moon.target.position.set(center.x, 0, center.z);
    // light pool: the 8 spots nearest the view get the real lights
    _sd.length = 0;
    for (const sp of spots) { const dx = sp.p.x - center.x, dz = sp.p.z - (center.z - 2); _sd.push([dx * dx + dz * dz, sp]); }
    _sd.sort((u, v) => u[0] - v[0]);
    for (let i = 0; i < POOL.length; i++) {
      const l = POOL[i], e = _sd[i];
      if (!e || e[0] > 34 * 34) { l.intensity = 0; continue; }
      const sp = e[1];
      let k = sp.k;
      if (sp.flick) k *= Math.random() < 0.06 ? 0.15 : (0.9 + Math.sin(G.rt * 31 + sp.p.x) * 0.1);
      l.position.copy(sp.p); l.color.copy(sp.c); l.distance = sp.d; l.decay = sp.decay;
      l.intensity = sp.i * k * Math.min(1, (34 * 34 - e[0]) / 200);
    }
    for (const g of L.gates) g.update(dt);
    if (L.archFade) L.archFade(center);
    if (L.updateExtra) L.updateExtra(dt, center);
    rainMat.uniforms.uTime.value += dt; rainMat.uniforms.uCenter.value.copy(center);
    wet.uniforms.uTime.value += dt;
    if (G.fx && Math.random() < 0.9) for (let k = 0; k < 3; k++) G.fx.add.emit(center.x + rand(-9, 9), 0.04, center.z + rand(-12, 8), 0, rand(0.5, 1.1), 0, 0.45, 0.5, 0.62, 0.22, 0.06, 0.015, 5, 0, 0.6);
  };
  return L;
}

// =====================================================================================
// Chapter 1 beyond Harrow Street: Pier 9 Market (z -26.6..-64.4), Gut Lane (z -64.4..-92.4)
// and the Pier 9 docks (z -92.4..-130.6) with open water on the west and north edges.
// =====================================================================================
export const ZONES = [
  { id: 'harrow', name: 'HARROW STREET', rects: [[-12.4, 12.4, -26.9, 24.4]], start: [0, 12] },
  { id: 'plaza', name: 'CHECKPOINT PLAZA', rects: [[12.4, 30, -12.5, -6.5, { pitch: 76 }], [30, 62, -30, 4]], start: [15.5, -9.5] },
  { id: 'tram', name: 'TRAM CUT', rects: [[44, 50, -48, -30], [7.1, 50, -48, -42, { pitch: 76 }]], start: [47, -32.5] },
  { id: 'market', name: 'PIER 9 MARKET', rects: [[-7.1, 7.1, -64, -26.9]], start: [4.5, -45] },
  { id: 'cold', name: 'COLD STORAGE', rects: [[-29.6, -7.9, -64, -46.4, { pitch: 66 }]], start: [-10, -55] },
  { id: 'alley', name: 'GUT LANE', rects: [[-4.15, 4.15, -92, -64]], start: [0, -67.5] },
  { id: 'rail', name: 'THE RAIL YARD', rects: [[4.15, 30, -82, -76, { pitch: 76 }], [30, 78, -92, -66, { pitch: 58 }]], start: [7.5, -79] },
  { id: 'yard', name: 'CONTAINER YARD', rects: [[40, 80, -136, -92, { openN: true }], [14.2, 40, -122, -110, { pitch: 72 }]], start: [65, -95] },
  { id: 'docks', name: 'PIER 9', rects: [[-20.3, 14.2, -130.3, -92, { openW: true, openN: true }]], start: [11, -116] },
  { id: 'ferry', name: 'FERRY PIER', rects: [[-62, -20.3, -120, -104, { openN: true, openS: true, openW: true }]], start: [-23.5, -112] },
];
// gate i opens when zone i is cleared; the last two never open (Census locks on the old shortcuts)
export const GATES = [
  { x0: -12.5, x1: -6.5, at: 12.6, alongZ: true },    // harrow -> plaza side street
  { x0: 44, x1: 50, at: -30 },                         // plaza -> tram cut
  { x0: -48, x1: -42, at: 7.6, alongZ: true },        // tram cut -> market
  { x0: -58, x1: -52, at: -7.75, alongZ: true },      // market -> cold storage
  { x0: -4.6, x1: 4.6, at: -64.4 },                    // market -> gut lane
  { x0: -82, x1: -76, at: 4.6, alongZ: true },        // gut lane -> rail yard
  { x0: 60, x1: 70, at: -92 },                         // rail yard -> container yard
  { x0: -122, x1: -110, at: 14.6, alongZ: true },     // transit shed -> docks
  { x0: -120, x1: -104, at: -20.8, alongZ: true },    // docks -> ferry pier
  { x0: -7.6, x1: 7.6, at: -26.9 },                    // (locked) harrow -> market arch
  { x0: -4.6, x1: 4.6, at: -92.4 },                    // (locked) gut lane -> docks
];
export function rectOf(x, z, pad = 0.4) {
  for (let i = 0; i < ZONES.length; i++) for (const r of ZONES[i].rects) if (x >= r[0] - pad && x <= r[1] + pad && z >= r[2] - pad && z <= r[3] + pad) return [i, r];
  return null;
}
export function zoneAt(x, z) { const h = rectOf(x, z); return h ? h[0] : -1; }

export function containerTexture(base, label) {
  const [c, x] = canvas(512, 256);
  x.fillStyle = base; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 512; i += 16) { const g = x.createLinearGradient(i, 0, i + 16, 0); g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.28)'); x.fillStyle = g; x.fillRect(i, 0, 16, 256); }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 512, 10); x.fillRect(0, 246, 512, 10);
  for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(90,45,20,${0.08 + Math.random() * 0.18})`; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 256, 4 + Math.random() * 30, 2 + Math.random() * 9, 0, 0, 6.28); x.fill(); }
  x.font = '900 46px Inter, Arial, sans-serif'; x.fillStyle = 'rgba(235,235,235,0.75)'; x.textAlign = 'center'; x.fillText(label, 256, 120);
  x.font = '700 18px Inter, Arial, sans-serif'; x.fillText('CSFU 409117 · 22G1', 256, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function gateTextTexture() {
  const [c, x] = canvas(1024, 128);
  x.clearRect(0, 0, 1024, 128);
  x.font = '800 44px Inter, Arial, sans-serif'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
  x.fillText('CENSUS CHECKPOINT  ·  PRESENT YOUR TALLY  ·  ', 8, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function decalTexture(draw, w = 512, h = 256) { const [c, x] = canvas(w, h); x.clearRect(0, 0, w, h); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function softRectTexture() {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// A Census checkpoint: amber hologram wall with scrolling text that blocks the way until the zone is clear.
function makeGate(scene, world, groundMat, x0, x1, z, alongZ = false) {
  // alongZ: the gate spans z0..z1 (given as x0..x1) at x = z
  const w = x1 - x0, H = 3.4, cx = (x0 + x1) / 2;
  const tex = gateTextTexture();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uT: { value: 0 }, uOpen: { value: 0 }, tText: { value: tex }, uRep: { value: w / 9 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform float uOpen; uniform sampler2D tText; uniform float uRep; varying vec2 vUv;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float row = floor(uv.y * 14.0);
        uv.x += (step(0.93, hh(vec2(row, floor(uT * 9.0)))) - 0.0) * 0.03;
        float scan = 0.55 + 0.45 * sin(uv.y * 140.0 - uT * 7.0);
        float grid = max(step(0.95, fract(uv.x * uRep * 6.0)), step(0.92, fract(uv.y * 7.0))) * 0.45;
        float txt = texture2D(tText, vec2(fract(uv.x * uRep - uT * 0.06), (uv.y - 0.42) * 5.0 + 0.5)).a * step(0.32, uv.y) * step(uv.y, 0.52);
        float edge = smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.85, uv.y);
        float rim = step(uv.y, 0.025) * 2.0 + step(0.975, uv.x) + step(uv.x, 0.025);
        float alive = step(uOpen * 1.02, hh(floor(vUv * vec2(uRep * 10.0, 9.0))));
        vec3 col = vec3(1.0, 0.5, 0.12) * ((0.12 * scan + grid) * edge + txt * 1.3 + rim * 0.6);
        gl_FragColor = vec4(col * alive, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat); m.renderOrder = 26; scene.add(m);
  if (alongZ) { m.position.set(z, H / 2, cx); m.rotation.y = Math.PI / 2; } else m.position.set(cx, H / 2, z);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.7, emissive: 0xff7a20, emissiveIntensity: 0 });
  const posts = [];
  for (const px of [x0, x1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, H + 0.3, 0.28), postMat); if (alongZ) p.position.set(z, (H + 0.3) / 2, px); else p.position.set(px, (H + 0.3) / 2, z); p.castShadow = true; scene.add(p); posts.push(p); }
  const body = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
  if (alongZ) { body.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 2.5, w / 2))); body.position.set(z, 2.5, cx); }
  else { body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 2.5, 0.3))); body.position.set(cx, 2.5, z); }
  world.addBody(body);
  const g = {
    x0, x1, z, cx, alongZ, open: false, k: 0, inWorld: true,
    get pos() { return alongZ ? new THREE.Vector3(z, 0, cx) : new THREE.Vector3(cx, 0, z); },
    openNow() { if (this.open) return; this.open = true; if (this.inWorld) { world.removeBody(body); this.inWorld = false; } },
    snapOpen() { this.openNow(); this.k = 1; mat.uniforms.uOpen.value = 1; m.visible = false; },
    close() { this.open = false; this.k = 0; mat.uniforms.uOpen.value = 0; m.visible = true; if (!this.inWorld) { world.addBody(body); this.inWorld = true; } },
    update(dt) {
      mat.uniforms.uT.value = G.rt;
      if (this.open && this.k < 1) { this.k = Math.min(1, this.k + dt * 1.6); mat.uniforms.uOpen.value = this.k; if (this.k >= 1) m.visible = false; }
      postMat.emissiveIntensity = this.open ? 0 : 0.6 + Math.sin(G.rt * 5) * 0.2;
    },
  };
  return g;
}

function buildPier9(C) {
  const { scene, world, wet, block, sign, addSpot, groundMat, L, haloTex, coneMat, lampSrc } = C;
  const metal = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.75 });
  const rusty = new THREE.MeshStandardMaterial({ color: 0x2b2421, roughness: 0.8, metalness: 0.5 });
  const stat = (x, y, z, hx, hy, hz, ry = 0, mask = ALL) => {
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: mask });
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz))); b.position.set(x, y, z); if (ry) b.quaternion.setFromEuler(0, ry, 0);
    world.addBody(b); return b;
  };
  const statCyl = (x, y, z, r, h) => { const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Cylinder(r, r, h, 8)); b.position.set(x, y, z); world.addBody(b); };
  const mesh = (geo, mat, x, y, z, ry = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; if (shadow) { m.castShadow = true; m.receiveShadow = true; } scene.add(m); return m; };
  const floor = (prefix, x0, x1, z0, z1, tile, reflect, puddles, extra = {}) => {
    const w = x1 - x0, d = z1 - z0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pbr(prefix, w / tile, d / tile, extra));
    wet.patch(m.material, { reflect, puddles, area: [x0, z0, 30, 60] });
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); wet.hide.push(m); return m;
  };
  const decal = (tex, w, h, x, y, z, ry, opacity = 0.9) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
  seed = 9191;

  // ---------------- PIER 9 MARKET: a covered night market lane ----------------
  floor('pavement_03', -7.6, 7.6, -64.4, -26.6, 2.2, 0.55, 0.35);
  block(-28, -7.6, -46, -26.6, 11, ['+z', '+x'], { storeOff: { '+z': -2 } });
  block(7.6, 28, -42, -26.6, 10, ['+z', '-x', '-z'], { storeOff: { '+z': 2 } });
  block(7.6, 28, -66, -48, 13, ['-x', '+z'], { noStore: ['-x'] });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.85 });
  const canvasCols = [0x5a1a1d, 0x184549, 0x6b4e17, 0x24335a, 0x452445, 0x284425];
  const crateGeo = new THREE.BoxGeometry(0.55, 0.2, 0.4), iceMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e0, roughness: 0.3 });
  const boxMats = [new THREE.MeshStandardMaterial({ color: 0x1f5f9a, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0xb84a1e, roughness: 0.5 })];
  const lanternMat = glowMat(2.4, 0.55, 0.25);
  let ci = 0;
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    if ((side < 0 && i === 3) || (side > 0 && i === 1)) continue;   // gaps = side doors
    const z = -31.6 - i * 5.5 + (side > 0 ? 1.6 : 0), x = side * 6.0;
    mesh(new THREE.BoxGeometry(1.3, 0.95, 2.6), counterMat, x, 0.475, z); stat(x, 0.5, z, 0.65, 0.5, 1.3);
    const canv = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 3.1), new THREE.MeshStandardMaterial({ color: canvasCols[ci++ % canvasCols.length], roughness: 0.9, side: THREE.DoubleSide }));
    canv.position.set(x - side * 0.35, 2.55, z); canv.rotation.z = side * 0.16; canv.castShadow = true; scene.add(canv);
    for (const dz of [-1.45, 1.45]) mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6), metal, x - side * 1.35, 1.25, z + dz, 0, false);
    for (let k = 0; k < 3; k++) { const cz = z - 0.8 + k * 0.8; mesh(crateGeo, boxMats[(i + k) % 2], x, 1.05, cz, 0, false); mesh(new THREE.BoxGeometry(0.48, 0.05, 0.34), iceMat, x, 1.16, cz, 0, false); }
    mesh(new THREE.SphereGeometry(0.17, 12, 8), lanternMat, x - side * 1.4, 2.2, z + 1.2, 0, false);
    mesh(new THREE.SphereGeometry(0.17, 12, 8), lanternMat, x - side * 1.4, 2.2, z - 1.2, 0, false);
  }
  // festoon lights strung across the lane
  const bulbs = [];
  for (let k = 0; k < 6; k++) {
    const z = -29.5 - k * 6.4, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; const p = new THREE.Vector3(-7.5 + 15 * t, 6.3 - Math.sin(t * Math.PI) * 1.2, z + t * 2.2); pts.push(p); if (i > 0 && i < 12) bulbs.push(p); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x0b0b0b })); scene.add(line);
    if (k % 2 === 0) addSpot(0, 5.2, z + 1.1, 0xffbe70, 20, 13, 1.6);
  }
  const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), glowMat(2.6, 1.7, 0.85), bulbs.length);
  bulbs.forEach((p, i) => bulbIM.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(bulbIM);
  sign('NOODLES', '#ff2a8a', true, -7.64, 6.2, -37, Math.PI / 2, 1.2, 4.6); addSpot(-6.6, 5.5, -37, 0xff2a8a, 16, 11, 1.7);
  sign('FISH', '#19e3ff', true, 7.64, 5.6, -55, -Math.PI / 2, 1.1, 3.4); addSpot(6.6, 5, -55, 0x19e3ff, 16, 11, 1.7);
  sign('PAWN', '#ffb03a', true, -7.64, 5.4, -58, Math.PI / 2, 1.1, 3.6);
  sign('ENUMERATION 99.9997%', '#e8f0ff', false, 7.64, 9.6, -47, -Math.PI / 2, 10, 1.9, 'THANK YOU FOR BEING COUNTED');
  sign('EVERYONE COUNTS', '#e8f0ff', false, -7.64, 10.5, -52, Math.PI / 2, 7, 1.3);

  // ---------------- GUT LANE: a narrow wet service alley ----------------
  floor('asphalt_02', -4.6, 4.6, -92.4, -64.4, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.9 });
  block(-28, -4.6, -92.4, -64.4, 12, ['+x', '+z', '-z'], { noStore: ['+x', '+z'], storeW: 6, lit: 0.22 });
  block(4.6, 30, -76, -64.4, 9, ['-x', '+z', '-z', '+x'], { noStore: ['-x', '+z'], storeW: 5, lit: 0.22 });
  block(4.6, 30, -92.4, -82, 11, ['-x', '+z', '-z', '+x'], { noStore: ['-x'], storeW: 5, lit: 0.22 });
  const dumpMat = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.6, metalness: 0.5 });
  for (const [x, z, ry] of [[-3.55, -70.5, 0], [3.5, -82.5, 0], [-3.5, -88.6, 0]]) {
    mesh(new THREE.BoxGeometry(1.0, 1.25, 2.0), dumpMat, x, 0.625, z, ry);
    const lid = mesh(new THREE.BoxGeometry(1.05, 0.06, 2.05), dumpMat, x + Math.sign(x) * 0.2, 1.35, z, ry); lid.rotation.z = Math.sign(x) * 0.35;
    stat(x, 0.65, z, 0.5, 0.65, 1.0, ry);
  }
  // fire escapes
  const fe = (wx, dir, z0, z1) => {
    const x = wx + dir * 0.55, len = z1 - z0, zc = (z0 + z1) / 2;
    for (const y of [4.4, 7.8, 11.2]) {
      mesh(new THREE.BoxGeometry(1.1, 0.06, len), metal, x, y, zc, 0, true);
      mesh(new THREE.BoxGeometry(0.05, 0.05, len), metal, x + dir * 0.52, y + 1.0, zc, 0, false);
      for (let k = 0; k <= 6; k++) mesh(new THREE.BoxGeometry(0.035, 1.0, 0.035), metal, x + dir * 0.52, y + 0.5, z0 + (len * k) / 6, 0, false);
      const st = mesh(new THREE.BoxGeometry(0.7, 0.05, 4.4), metal, x, y - 1.7, zc - len * 0.18, 0, false); st.rotation.x = 0.66;
    }
  };
  fe(-4.6, 1, -79, -73); fe(4.6, -1, -87, -81);
  for (const [x, z] of [[-4.5, -67.5], [4.5, -74], [-4.5, -84], [4.5, -90]]) mesh(new THREE.CylinderGeometry(0.09, 0.09, 14, 8), rusty, x, 7, z, 0, false);
  for (const [x, z, flick] of [[-4.45, -69, 0], [4.45, -78, 1], [-4.45, -87, 0]]) {
    mesh(new THREE.BoxGeometry(0.2, 0.25, 0.5), metal, x, 3.6, z, 0, false);
    mesh(new THREE.BoxGeometry(0.02, 0.16, 0.4), glowMat(1.8, 1.9, 2.2), x + Math.sign(-x) * 0.11, 3.5, z, 0, false);
    addSpot(x - Math.sign(x) * 0.6, 3.3, z, 0xbcd0ff, 14, 10, 1.7, flick);
  }
  L.vents.push([-3.8, -76.2], [3.9, -69.3], [0.6, -90.1]);
  const grateTex = decalTexture((x, w, h) => { x.fillStyle = '#26282c'; x.fillRect(0, 0, w, h); x.fillStyle = '#060607'; for (let i = 8; i < w - 8; i += 14) x.fillRect(i, 8, 7, h - 16); x.strokeStyle = '#3a3d42'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); }, 128, 128);
  const grateMat = new THREE.MeshStandardMaterial({ map: grateTex, roughness: 0.45, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z] of L.vents) { const g = mesh(new THREE.PlaneGeometry(0.9, 0.9), grateMat, x, 0.006, z, 0, false); g.rotation.x = -Math.PI / 2; }
  // her mark, and a way to Moth's
  decal(decalTexture((x, w, h) => { x.strokeStyle = '#9b6bff'; x.lineWidth = 16; x.shadowColor = '#9b6bff'; x.shadowBlur = 12; x.beginPath(); x.arc(w / 2, h / 2, 80, 0, 6.28); x.stroke(); x.beginPath(); x.moveTo(w / 2 - 110, h / 2 + 110); x.lineTo(w / 2 + 110, h / 2 - 110); x.stroke(); }, 512, 256), 3.2, 1.6, -4.58, 2.4, -76, Math.PI / 2, 0.85);
  decal(decalTexture((x, w, h) => { x.font = '900 72px Inter, Arial'; x.fillStyle = '#e9e4da'; x.textAlign = 'center'; x.globalAlpha = 0.85; x.fillText('COUNT ME OUT', w / 2, h / 2 + 24); }, 512, 128), 3.4, 0.85, 4.58, 2.1, -71, -Math.PI / 2, 0.8);
  decal(decalTexture((x, w, h) => { x.font = '800 60px Inter, Arial'; x.fillStyle = '#ffb060'; x.textAlign = 'center'; x.fillText('INK  ▾  PIER 9', w / 2, h / 2 + 20); }, 512, 128), 2.6, 0.65, 4.58, 1.8, -88.5, -Math.PI / 2, 0.85);

  // ---------------- PIER 9: the docks ----------------
  floor('asphalt_02', -20.6, 14.6, -130.6, -92.4, 3.6, 1, 1, { normalScale: new THREE.Vector2(1.1, 1.1), envMapIntensity: 1.7 });
  block(15.0, 40, -136, -122, 12, ['-x', '+z', '+x'], { storeW: 9, lit: 0.18, noStore: ['+z'] });
  block(15.0, 40, -110, -92.4, 9, ['-x', '-z', '+z', '+x'], { storeW: 9, lit: 0.18, noStore: ['-z'] });
  const conc = pbr('concrete_wall_008', 12, 0.6);
  mesh(new THREE.BoxGeometry(0.6, 1.8, 38.8), conc, -20.9, -0.9, -111.5, 0, false);
  mesh(new THREE.BoxGeometry(35.8, 1.8, 0.6), conc, -3.0, -0.9, -130.9, 0, false);
  const lip = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.8 });
  mesh(new THREE.BoxGeometry(0.35, 0.16, 38.2), lip, -20.42, 0.08, -111.5, 0, false);
  mesh(new THREE.BoxGeometry(35.2, 0.16, 0.35), lip, -3.2, 0.08, -130.42, 0, false);
  const yellow = new THREE.MeshStandardMaterial({ color: 0xc8a232, roughness: 0.6 });
  mesh(new THREE.BoxGeometry(0.16, 0.01, 37.6), yellow, -19.6, 0.005, -111.5, 0, false);
  mesh(new THREE.BoxGeometry(34.4, 0.01, 0.16), yellow, -3.4, 0.005, -129.6, 0, false);
  // the hero can't step off the edge (everyone else can go overboard)
  stat(-21.0, 2, -98.2, 0.4, 2, 5.8, 0, GRP.HERO); stat(-21.0, 2, -125.4, 0.4, 2, 5.4, 0, GRP.HERO); stat(-3.0, 2, -131.0, 17.8, 2, 0.4, 0, GRP.HERO);
  for (let z = -96; z >= -128; z -= 6.4) { mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), metal, -19.95, 0.27, z, 0); statCyl(-19.95, 0.27, z, 0.22, 0.55); }
  for (let x = -14; x <= 10; x += 6) { mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), metal, x, 0.27, -129.95, 0); statCyl(x, 0.27, -129.95, 0.22, 0.55); }
  // shipping containers (static stacks; two loose ones are liftable props)
  const contMats = [['#7a2a1c', 'CANTOR SOUND'], ['#1f4a73', 'TALLYFREIGHT'], ['#2f5a3a', 'CANTOR SOUND'], ['#8a6d2a', 'HALDEN MED']].map(([c, l]) => new THREE.MeshStandardMaterial({ map: containerTexture(c, l), roughness: 0.6, metalness: 0.45 }));
  const contGeo = new THREE.BoxGeometry(6.06, 2.59, 2.44);
  const cont = (x, z, ry, n, mi) => { for (let k = 0; k < n; k++) { mesh(contGeo, contMats[(mi + k) % contMats.length], x, 1.295 + k * 2.59, z, ry + (k ? 0.03 : 0)); } stat(x, 1.295 * n, z, 3.03, 1.295 * n, 1.22, ry); };
  cont(11.3, -99.5, Math.PI / 2, 2, 0); cont(11.3, -106.6, Math.PI / 2, 1, 1); cont(-15.8, -96.4, 0, 2, 2); cont(8.6, -124.2, 0.05, 1, 3); cont(-15.6, -99.0, 0, 1, 1);
  // gantry crane on the west edge, legs on the dock and in the water
  const craneMat = new THREE.MeshStandardMaterial({ color: 0x8f6f18, roughness: 0.55, metalness: 0.6 });
  for (const [x, z] of [[-19.2, -104], [-19.2, -120], [-30, -104], [-30, -120]]) { mesh(new THREE.BoxGeometry(0.7, 15, 0.7), craneMat, x, 7.5 - (x < -25 ? 1.1 : 0), z, 0); if (x > -25) stat(x, 7.5, z, 0.35, 7.5, 0.35); }
  for (const z of [-104, -120]) mesh(new THREE.BoxGeometry(11.5, 0.9, 0.9), craneMat, -24.6, 15, z);
  mesh(new THREE.BoxGeometry(1.2, 1.2, 17.5), craneMat, -24.6, 15.6, -112); mesh(new THREE.BoxGeometry(1.0, 0.8, 26), craneMat, -24.6, 16.4, -112 - 0, Math.PI / 2);
  mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), metal, -21.5, 14.4, -112);
  const redLights = [];
  for (const [x, y, z] of [[-12.0, 16.9, -112], [-37.2, 16.9, -112], [-24.6, 16.2, -103.6]]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(3, 0.2, 0.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(x, y, z); s.scale.setScalar(0.9); scene.add(s); redLights.push(s); }
  // sodium mast lights
  for (const [x, z] of [[-8, -101], [5, -113.5], [-12, -124.5]]) {
    mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), metal, x, 4.5, z, 0); statCyl(x, 2, z, 0.2, 4);
    mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), metal, x, 9.05, z, 0, false);
    mesh(new THREE.BoxGeometry(0.8, 0.04, 0.42), glowMat(3, 1.7, 0.6), x, 8.9, z, 0, false);
    addSpot(x, 8.6, z, 0xffa648, 46, 22, 1.4);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.4, 1.4, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(x, 8.85, z); halo.scale.setScalar(2.2); scene.add(halo);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 8.6, 24, 1, true), coneMat); cone.position.set(x, 8.8 - 4.3, z); scene.add(cone);
  }
  // Moth's: a stairwell kiosk at the end of the pier, warm light leaking from below
  const kx = 11.6, kz = -127.2;
  block(kx - 1.6, kx + 1.6, kz - 1.6, kz + 1.6, 3.0, ['-x'], { noStore: ['-x'], lit: 0 });
  mesh(new THREE.PlaneGeometry(1.3, 2.3), glowMat(1.9, 1.05, 0.45), kx - 1.62, 1.15, kz, -Math.PI / 2, false);
  sign('MOTH · INK', '#ffb060', false, kx - 1.66, 2.75, kz, -Math.PI / 2, 2.6, 0.5);
  addSpot(kx - 2.6, 1.6, kz, 0xffa050, 18, 8, 1.6);
  L.mothDoor = new THREE.Vector3(kx - 2.4, 0, kz);
  // lights under the harbour: windows of something below the water
  const winTex = softRectTexture();
  const uw = [];
  for (const [bx, bz, cols, rows] of [[-36, -140, 6, 3], [-12, -146, 5, 3], [10, -142, 4, 2], [-44, -112, 3, 6], [-38, -96, 2, 4]]) {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (Math.random() < 0.6) uw.push([bx + c * 2.6 + (bz > -130 ? 0 : 0), bz - r * 3.2, Math.random()]);
  }
  const uwMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(0.35, 0.6, 0.75), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const uwIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 2.2).rotateX(-Math.PI / 2), uwMat, uw.length);
  uw.forEach(([x, z], i) => uwIM.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, -1.06, z))); uwIM.renderOrder = 3; scene.add(uwIM);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshStandardMaterial({ color: 0x020509, roughness: 0.06, metalness: 0.85, envMapIntensity: 2.2 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-50, -1.1, -170); scene.add(sea); wet.hide.push(sea);

  buildExpansion(C, { metal, rusty, stat, statCyl, mesh, floor, decal, glowMat, conc, lip, yellow, cont, contMats, contGeo, counterMat, canvasCols, lanternMat, redLights, haloTex, coneMat, lampSrc, crateGeo, boxMats, iceMat });
  L.updateExtra = (dt, center) => {
    if (G.fx) for (const [vx, vz] of L.vents) if (Math.abs(vz - center.z) < 22 && Math.random() < 0.55) G.fx.smoke.emit(vx + rand(-0.3, 0.3), 0.1, vz + rand(-0.3, 0.3), rand(-0.15, 0.15), rand(0.8, 1.6), rand(-0.15, 0.15), 0.32, 0.33, 0.37, rand(1.2, 2.2), 0.18, 0.9, -0.15, 0.5, 0.55);
    const blink = (G.rt % 1.6) < 0.5 ? 1 : 0.05;
    for (const s of redLights) s.material.opacity = blink;
    uwMat.opacity = 0.26 + Math.sin(G.rt * 0.7) * 0.06 + Math.sin(G.rt * 2.3) * 0.03;
  };
}

// =====================================================================================
// The rest of Chapter 1: Checkpoint Plaza, Tram Cut, Cold Storage, the Rail Yard,
// the Container Yard + transit shed and the Ferry Pier. Plus every Census gate, in route order.
// =====================================================================================
function chainTexture() {
  const [c, x] = canvas(128, 128); x.clearRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(190,195,200,0.85)'; x.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function buildExpansion(C, H) {
  const { scene, world, wet, block, sign, addSpot, groundMat, L } = C;
  const { metal, rusty, stat, statCyl, mesh, floor, decal, glowMat, conc, cont, contMats, contGeo, counterMat, haloTex, coneMat, lampSrc, crateGeo, boxMats, iceMat } = H;
  seed = 7171;
  // dark fill under the east of the city so nothing shows through the gaps
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(110, 200), new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.set(45, -0.03, -60); scene.add(f); wet.hide.push(f); }
  const lampPost = (x, z, ry = 0) => {
    const lamp = lampSrc.clone(); lamp.position.set(x, 0, z); lamp.rotation.y = ry; lamp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(lamp);
    addSpot(x, 3.45, z, 0xffb066, 30, 15, 1.5);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.2, 1.6, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(x, 3.55, z); halo.scale.setScalar(1.6); scene.add(halo);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.4, 24, 1, true), coneMat); cone.position.set(x, 1.75, z); scene.add(cone);
    statCyl(x, 1.9, z, 0.16, 3.8);
  };
  const mast = (x, z, h = 10, col = 0xffa648, inten = 44) => {
    mesh(new THREE.CylinderGeometry(0.13, 0.17, h, 8), metal, x, h / 2, z, 0); statCyl(x, 2, z, 0.2, 4);
    mesh(new THREE.BoxGeometry(1.0, 0.28, 0.55), metal, x, h + 0.05, z, 0, false);
    mesh(new THREE.BoxGeometry(0.9, 0.04, 0.45), glowMat(3, 1.8, 0.7), x, h - 0.1, z, 0, false);
    addSpot(x, h - 0.4, z, col, inten, 22, 1.4);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(2.4, 1.5, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(x, h - 0.15, z); halo.scale.setScalar(2.3); scene.add(halo);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.48, h, 24, 1, true), coneMat); cone.position.set(x, h / 2, z); scene.add(cone);
  };
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    const tex = chainTexture(); tex.repeat.set(len / 1.2, 2.5 / 1.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.5), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }));
    m.position.set((x0 + x1) / 2, 1.25, (z0 + z1) / 2); m.rotation.y = ry - Math.PI / 2; scene.add(m);
    for (let k = 0; k <= Math.ceil(len / 3); k++) { const t = k / Math.ceil(len / 3); mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), metal, x0 + (x1 - x0) * t, 1.3, z0 + (z1 - z0) * t, 0, false); }
    const b = new CANNON.Body({ mass: 0, material: groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
    b.addShape(new CANNON.Box(new CANNON.Vec3(len / 2, 1.3, 0.12))); b.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2); b.quaternion.setFromEuler(0, ry - Math.PI / 2, 0); world.addBody(b);
  };
  const rails = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5c5650, metalness: 0.9, roughness: 0.35 });
    for (const off of [-0.72, 0.72]) { const r = mesh(new THREE.BoxGeometry(0.08, 0.1, len), railMat, cx + Math.cos(ry) * off, 0.05, cz - Math.sin(ry) * off, ry, false); }
    const n = Math.floor(len / 0.9);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.07, 0.24), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.9 }), n);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; M.compose(new THREE.Vector3(cx + Math.sin(ry) * len * t, 0.02, cz + Math.cos(ry) * len * t), Q, new THREE.Vector3(1, 1, 1)); sl.setMatrixAt(i, M); }
    sl.receiveShadow = true; scene.add(sl);
  };
  const tex2 = (draw, w = 512, h = 256) => { const [c, x] = canvas(w, h); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

  // ================= CHECKPOINT PLAZA =================
  floor('asphalt_02', 12.4, 30, -12.5, -6.5, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.9 });
  block(12.9, 30, -27, -12.55, 12.9, ['+z'], { noStore: ['+z'] });
  block(12.9, 30, -6.45, 1, 8.9, ['-z'], { storeW: 5 });
  floor('pavement_03', 30, 62, -30, 4, 2.6, 0.55, 0.35);
  block(20, 30, -30, -12.55, 14, ['+x'], { storeW: 6 });
  block(20, 30, -6.45, 6, 12, ['+x'], { storeW: 6 });
  block(28, 44, -42, -30, 10, ['+z', '-z', '+x'], { noStore: ['-z'] });
  block(50, 70, -42, -30, 20, ['+z', '-z', '-x'], { noStore: ['-z', '-x'] });
  block(62, 80, -30, 6, 18, ['-x'], { storeW: 9 });
  block(28, 80, 4, 20, 7, ['-z'], { storeW: 8 });
  // Census checkpoint booth + scanner arches at the side-street mouth
  const glassBooth = new THREE.MeshStandardMaterial({ color: 0x0a0f14, metalness: 0.4, roughness: 0.08, transparent: true, opacity: 0.55, envMapIntensity: 2 });
  mesh(new THREE.BoxGeometry(2.4, 2.6, 2.4), glassBooth, 34.5, 1.3, -15.5, 0); stat(34.5, 1.3, -15.5, 1.2, 1.3, 1.2);
  mesh(new THREE.BoxGeometry(2.6, 0.2, 2.6), metal, 34.5, 2.7, -15.5, 0); mesh(new THREE.BoxGeometry(2.62, 0.06, 2.62), glowMat(2.6, 1.2, 0.3), 34.5, 2.55, -15.5, 0, false);
  addSpot(34.5, 3.2, -15.5, 0xff9a40, 14, 9, 1.6);
  for (const az of [-11.6, -7.4]) {
    for (const ax of [32.4, 35.6]) mesh(new THREE.BoxGeometry(0.25, 3, 0.4), metal, ax, 1.5, az, 0);
    mesh(new THREE.BoxGeometry(3.45, 0.3, 0.42), metal, 34, 3.05, az, 0);
    mesh(new THREE.BoxGeometry(3.0, 0.06, 0.3), glowMat(2.6, 1.2, 0.3), 34, 2.88, az, 0, false);
  }
  // Registrar's broadcast screen on the east face
  const weilTex = tex2((x, w, h) => {
    x.fillStyle = '#05070c'; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w * 0.28, h * 0.5, 10, w * 0.28, h * 0.5, h * 0.55); g.addColorStop(0, '#2b3b55'); g.addColorStop(1, '#05070c'); x.fillStyle = g; x.fillRect(0, 0, w * 0.56, h);
    x.fillStyle = '#c9d6ea'; x.beginPath(); x.ellipse(w * 0.28, h * 0.42, 34, 44, 0, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(w * 0.28, h * 0.98, 78, 60, 0, 3.14, 6.28); x.fill();
    x.fillStyle = '#e8f0ff'; x.font = '900 34px Inter, Arial'; x.textAlign = 'left'; x.fillText('EVERYONE', w * 0.56, h * 0.38); x.fillText('COUNTS.', w * 0.56, h * 0.56);
    x.font = '700 15px Inter, Arial'; x.fillStyle = '#9fb4d8'; x.fillText('REGISTRAR C. WEIL · LIVE', w * 0.56, h * 0.74);
    for (let y = 0; y < h; y += 3) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y, w, 1); }
  });
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: weilTex, color: new THREE.Color(1.3, 1.3, 1.4), toneMapped: false })); m.position.set(61.95, 8.5, -12); m.rotation.y = -Math.PI / 2; scene.add(m); addSpot(58.5, 8, -12, 0x9fc0ff, 16, 14, 1.6); }
  sign('TALLY CLINIC', '#19e3ff', true, 30.05, 6, -24, Math.PI / 2, 1.2, 5);
  // planters + benches + tram shelter
  const planterMat = pbr('concrete_wall_008', 1, 0.4);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x1d2a1a, roughness: 0.9 });
  for (const [px, pz] of [[40, -6], [52, -6], [40, -20], [52, -20]]) {
    mesh(new THREE.BoxGeometry(3, 0.7, 3), planterMat, px, 0.35, pz, 0); stat(px, 0.35, pz, 1.5, 0.35, 1.5);
    mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6), rusty, px, 1.6, pz, 0, false);
    mesh(new THREE.SphereGeometry(1.25, 10, 8), leaf, px, 3.2, pz, 0);
  }
  for (const [bx, bz, r] of [[46, -2.5, 0], [46, -23.5, 0]]) { mesh(new THREE.BoxGeometry(2.4, 0.45, 0.6), counterMat, bx, 0.45, bz, r); stat(bx, 0.3, bz, 1.2, 0.3, 0.3, r); }
  mesh(new THREE.BoxGeometry(5.6, 0.12, 2.2), metal, 47, 2.8, -28.6, 0); mesh(new THREE.BoxGeometry(5.4, 2.6, 0.06), glassBooth, 47, 1.4, -29.6, 0, false);
  for (const sx of [44.4, 49.6]) mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), metal, sx, 1.4, -27.6, 0);
  sign('TRAM · LINE 3 · PIER', '#e8f0ff', false, 47, 3.3, -27.5, 0, 4.4, 0.55);
  for (const [lx, lz] of [[33, -3], [59, -3], [33, -27], [59, -27]]) lampPost(lx, lz);

  // ================= TRAM CUT =================
  floor('asphalt_02', 44, 50, -48, -30, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.9 });
  floor('asphalt_02', 7.6, 44, -48, -42, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.9 });
  block(28, 70, -66, -48, 7, ['+z', '-z'], { noStore: ['-z'] });
  block(50, 70, -48, -42, 12, ['-x'], { noStore: ['-x'] });
  block(70, 80, -66, -30, 7, ['-z'], { noStore: ['-z'] });
  rails(47, -30.5, 47, -46.3); rails(8, -46.3, 49, -46.3);
  // abandoned tram car
  const tramTex = tex2((x, w, h) => {
    x.fillStyle = '#8a8f96'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d4f7a'; x.fillRect(0, h * 0.62, w, h * 0.16);
    x.fillStyle = '#0b1016'; for (let i = 0; i < 7; i++) x.fillRect(18 + i * 70, h * 0.18, 52, h * 0.34);
    x.fillStyle = '#e8f0ff'; x.font = '800 22px Inter, Arial'; x.fillText('CANTOR SOUND TRANSIT · 3', 20, h * 0.9);
    x.fillStyle = 'rgba(255,40,140,0.85)'; x.font = '900 40px Inter, Arial'; x.fillText('∅', w * 0.78, h * 0.58);
  });
  { const tm = new THREE.MeshStandardMaterial({ map: tramTex, roughness: 0.5, metalness: 0.5 });
    mesh(new THREE.BoxGeometry(9, 3.0, 2.5), [tm, tm, new THREE.MeshStandardMaterial({ color: 0x3d4248, roughness: 0.6, metalness: 0.6 }), metal, tm, tm], 33, 1.65, -46.3, 0);
    stat(33, 1.6, -46.3, 4.5, 1.6, 1.25);
    mesh(new THREE.BoxGeometry(1.2, 0.5, 2.0), metal, 33, 3.4, -46.3, 0); }
  // catenary wires
  for (const [ax, az, bx, bz] of [[8, -45, 49, -45], [47, -31, 47, -45]]) {
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(ax + (bx - ax) * t, 6.2 - Math.sin(t * Math.PI) * 0.4, az + (bz - az) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x0b0b0b })));
  }
  addSpot(20, 4.5, -45, 0xbcd0ff, 14, 11, 1.7, 1); addSpot(40, 4.5, -45, 0xffb066, 16, 12, 1.6); addSpot(47, 4.5, -36, 0xffb066, 16, 12, 1.6);
  decal(decalTexture((x, w, h) => { x.font = '900 64px Inter, Arial'; x.fillStyle = '#e9e4da'; x.textAlign = 'center'; x.globalAlpha = 0.8; x.fillText('WHO COUNTS THE COUNTERS?', w / 2, h / 2 + 22); }, 1024, 128), 6, 0.75, 20, 2.6, -47.95, 0, 0.8);

  // ================= COLD STORAGE (roofless cutaway) =================
  const frostFloor = floor('pavement_03', -30, -7.6, -64.4, -46, 2.0, 0.55, 0.35);
  frostFloor.material.color = new THREE.Color(0.75, 0.85, 1.0);
  block(-50, -30, -66, -44, 14, []);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.85, metalness: 0.1 });
  const cw = (x0, x1, z0, z1, h = 4.6) => { mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), wallMat, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0); stat((x0 + x1) / 2, h / 2, (z0 + z1) / 2, (x1 - x0) / 2, h / 2, (z1 - z0) / 2); };
  cw(-30.4, -30, -64.4, -46); cw(-30.4, -7.6, -46.4, -46); cw(-30.4, -7.6, -64.4, -64.0);
  cw(-7.9, -7.6, -64.4, -58); cw(-7.9, -7.6, -52, -46);
  // the market-facing facade above the loading door
  mesh(new THREE.BoxGeometry(0.3, 3.2, 6), wallMat, -7.75, 6.2, -55, 0, false);
  sign('COLD STORAGE · NO ENTRY', '#bfe0ff', false, -7.58, 5.2, -55, Math.PI / 2, 5.2, 0.6);
  // racks with ice crates
  for (const rz of [-50, -55.5]) for (const rx of [-26, -19.5]) {
    mesh(new THREE.BoxGeometry(5, 0.08, 1.2), metal, rx, 1.0, rz, 0); mesh(new THREE.BoxGeometry(5, 0.08, 1.2), metal, rx, 2.1, rz, 0);
    for (const ex of [-2.4, 2.4]) for (const ez of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), metal, rx + ex, 1.2, rz + ez, 0, false);
    for (let k = 0; k < 4; k++) { mesh(crateGeo, boxMats[k % 2], rx - 1.8 + k * 1.2, 1.15, rz, 0, false); mesh(new THREE.BoxGeometry(0.48, 0.05, 0.34), iceMat, rx - 1.8 + k * 1.2, 1.27, rz, 0, false); }
    stat(rx, 1.2, rz, 2.5, 1.2, 0.6);
  }
  // cold-room light strips
  for (const [lx, lz, f] of [[-24, -49, 0], [-15, -57, 1], [-24, -60.5, 0]]) { mesh(new THREE.BoxGeometry(2.4, 0.06, 0.15), glowMat(2.0, 2.4, 2.8), lx, 4.4, lz, 0, false); addSpot(lx, 4.0, lz, 0xc8e4ff, 16, 11, 1.7, f); }
  // strip curtain at the door
  for (let k = 0; k < 9; k++) { const s2 = mesh(new THREE.BoxGeometry(0.02, 2.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.35, roughness: 0.2 }), -8.3, 1.4, -57.6 + k * 0.7, 0, false); s2.renderOrder = 5; }
  L.coldSpots = [[-27, -62.6], [-22, -62.6], [-17, -62.6], [-12, -62.6]];   // cage positions (missions.js builds them)

  // ================= LANE TO THE RAIL YARD =================
  floor('asphalt_02', 4.6, 30, -82, -76, 3.2, 1, 1, { normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.9 });
  addSpot(16, 3.5, -79, 0xbcd0ff, 12, 10, 1.7);

  // ================= THE RAIL YARD =================
  const gravel = floor('asphalt_02', 30, 78, -92, -66, 2.4, 0.55, 0.35);
  gravel.material.color = new THREE.Color(0.62, 0.58, 0.55);
  block(78, 95, -104, -60, 14, ['-x'], { noStore: ['-x'] });
  for (const rz of [-86.5, -79, -71.5]) rails(30, rz, 78, rz);
  const boxcar = (x, z, mi) => {
    const m = new THREE.MeshStandardMaterial({ map: containerTexture(['#5a2a1c', '#2b3a4a', '#4a4a2a'][mi % 3], ['CS&P RAIL', 'TALLYFREIGHT', 'CANTOR SOUND'][mi % 3]), roughness: 0.7, metalness: 0.4 });
    const g = new THREE.BoxGeometry(12.5, 3.4, 2.9); g.rotateY(Math.PI / 2);
    mesh(g, m, x, 2.25, z, Math.PI / 2); stat(x, 2.0, z, 6.25, 2.0, 1.45);
    mesh(new THREE.BoxGeometry(11.5, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 }), x, 0.4, z, 0);
  };
  boxcar(38, -86.5, 0); boxcar(51.5, -86.5, 1); boxcar(64, -71.5, 2); boxcar(70, -79, 0);
  // signal tower + gantry
  mesh(new THREE.BoxGeometry(2.6, 6, 2.6), new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.8 }), 74.5, 3, -68.5, 0); stat(74.5, 3, -68.5, 1.3, 3, 1.3);
  mesh(new THREE.BoxGeometry(2.62, 0.9, 2.62), glowMat(1.8, 1.3, 0.6), 74.5, 5.2, -68.5, 0, false);
  mesh(new THREE.BoxGeometry(0.3, 7, 0.3), metal, 33, 3.5, -75.4, 0); mesh(new THREE.BoxGeometry(0.3, 7, 0.3), metal, 33, 3.5, -67, 0);
  mesh(new THREE.BoxGeometry(0.4, 0.4, 9), metal, 33, 7, -71.2, 0);
  for (const [sx, sz, red] of [[33, -71.5, 1], [33, -79, 0], [33, -86.5, 1]]) { const s3 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: red ? new THREE.Color(3, 0.25, 0.2) : new THREE.Color(0.3, 3, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s3.position.set(sx, 6.5, sz); s3.scale.setScalar(0.8); scene.add(s3); }
  mast(42, -76, 11); mast(66, -83, 11); mast(56, -68.5, 10);
  fence(40, -92, 60, -92); fence(70, -92, 80, -92);
  sign('LOCKDOWN ZONE 4', '#ff5a3a', false, 77.95, 5, -79, -Math.PI / 2, 5, 0.8);

  // ================= CONTAINER YARD + TRANSIT SHED =================
  floor('asphalt_02', 40, 80, -136, -92, 3.6, 1, 1, { normalScale: new THREE.Vector2(1.1, 1.1), envMapIntensity: 1.7 });
  floor('pavement_03', 14.6, 40, -122, -110, 2.4, 0.55, 0.35);
  block(80, 95, -140, -92, 14, ['-x'], { noStore: ['-x'] });
  mesh(new THREE.BoxGeometry(40.6, 1.8, 0.6), conc, 60, -0.9, -136.3, 0, false);
  mesh(new THREE.BoxGeometry(40, 0.16, 0.35), H.lip, 60, 0.08, -135.8, 0, false);
  stat(60, 2, -136.4, 20.4, 2, 0.4, 0, GRP.HERO);
  // container maze (static stacks); the informant runs the gaps
  const stacks = [
    [46, -100, 0, 2], [46, -110, 0, 1], [53, -98.5, Math.PI / 2, 2], [61, -105, 0, 3], [70, -100, Math.PI / 2, 1],
    [75, -110, Math.PI / 2, 2], [53, -117, 0, 2], [64, -116, Math.PI / 2, 1], [44, -126, 0, 2], [56, -129, 0, 1], [70, -126, Math.PI / 2, 2], [76, -131, 0, 1],
  ];
  stacks.forEach(([x, z, ry, n], i) => cont(x, z, ry, n, i));
  mast(58, -110.5, 12); mast(48, -131, 11); mast(74, -119, 11);
  // straddle carrier
  const sc = new THREE.MeshStandardMaterial({ color: 0x9a7a1a, roughness: 0.55, metalness: 0.6 });
  for (const [lx, lz] of [[66.2, -122.2], [66.2, -128.8], [72.8, -122.2], [72.8, -128.8]]) { mesh(new THREE.BoxGeometry(0.5, 8, 0.5), sc, lx, 4, lz, 0); stat(lx, 4, lz, 0.25, 4, 0.25); }
  mesh(new THREE.BoxGeometry(7.2, 0.8, 0.6), sc, 69.5, 8, -122.2, 0); mesh(new THREE.BoxGeometry(7.2, 0.8, 0.6), sc, 69.5, 8, -128.8, 0); mesh(new THREE.BoxGeometry(2.4, 1.6, 2.2), metal, 69.5, 9.1, -125.5, 0);
  // the shed: roll-up door frames, pallets, a parked forklift
  for (const dx of [15.0, 39.6]) { mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), metal, dx, 2.6, -121.7, 0); mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), metal, dx, 2.6, -110.3, 0); mesh(new THREE.BoxGeometry(0.6, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x5a6068, metalness: 0.7, roughness: 0.45 }), dx, 4.6, -116, 0); }
  for (const [px, pz] of [[20, -112], [24, -120.5], [33, -112.2], [36, -120.4]]) { mesh(new THREE.BoxGeometry(1.2, 0.15, 1.0), counterMat, px, 0.08, pz, 0, false); mesh(new THREE.BoxGeometry(1.1, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9 }), px, 0.6, pz, 0); stat(px, 0.55, pz, 0.6, 0.55, 0.5); }
  { const fk = new THREE.MeshStandardMaterial({ color: 0xc8901a, roughness: 0.5, metalness: 0.4 });
    mesh(new THREE.BoxGeometry(1.2, 1.4, 2.2), fk, 29, 0.9, -119.8, 0); mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), metal, 29.4, 1.2, -118.5, 0, false); mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), metal, 28.6, 1.2, -118.5, 0, false); stat(29, 0.9, -119.8, 0.6, 0.9, 1.1); }
  for (const [lx, lz] of [[21, -116], [33, -116]]) { mesh(new THREE.ConeGeometry(0.5, 0.4, 12, 1, true), metal, lx, 5.0, lz, 0, false); addSpot(lx, 4.6, lz, 0xffc070, 18, 11, 1.6); }

  // ================= FERRY PIER =================
  const deck = floor('pavement_03', -62, -20.6, -120, -104, 2.0, 0.55, 0.35);
  deck.material.color = new THREE.Color(0.72, 0.62, 0.52);
  mesh(new THREE.BoxGeometry(41.4, 1.8, 0.5), conc, -41.3, -0.9, -120.25, 0, false); mesh(new THREE.BoxGeometry(41.4, 1.8, 0.5), conc, -41.3, -0.9, -103.75, 0, false); mesh(new THREE.BoxGeometry(0.5, 1.8, 16.5), conc, -62.25, -0.9, -112, 0, false);
  for (let x = -60; x <= -24; x += 4.5) for (const z of [-120.6, -103.4]) mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.9 }), x, -1.4, z, 0, false);
  stat(-41.3, 2, -120.5, 20.7, 2, 0.35, 0, GRP.HERO); stat(-41.3, 2, -103.5, 20.7, 2, 0.35, 0, GRP.HERO); stat(-62.5, 2, -112, 0.35, 2, 8, 0, GRP.HERO);
  for (let x = -57; x <= -26; x += 6.2) { mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 10), metal, x, 0.27, -119.5, 0); statCyl(x, 0.27, -119.5, 0.22, 0.55); }
  statCyl(-30, 7.5, -104, 0.4, 15); statCyl(-30, 7.5, -120, 0.4, 15);
  // terminal hut (roofless cutaway) at the end of the pier
  const hutMat = new THREE.MeshStandardMaterial({ color: 0x2e3a44, roughness: 0.6, metalness: 0.3 });
  for (const [x0, x1, z0, z1] of [[-61.8, -61.4, -118, -106], [-61.8, -52, -118, -117.6], [-61.8, -52, -106.4, -106]]) { mesh(new THREE.BoxGeometry(x1 - x0, 3.2, z1 - z0), hutMat, (x0 + x1) / 2, 1.6, (z0 + z1) / 2, 0); stat((x0 + x1) / 2, 1.6, (z0 + z1) / 2, (x1 - x0) / 2, 1.6, (z1 - z0) / 2); }
  for (const bz of [-109, -112, -115]) { mesh(new THREE.BoxGeometry(0.6, 0.45, 2.6), counterMat, -58.5, 0.45, bz, 0); stat(-58.5, 0.3, bz, 0.3, 0.3, 1.3); }
  sign('FERRY · HALDEN ISLAND', '#e8f0ff', false, -52, 3.6, -112, Math.PI / 2, 5.6, 0.7, 'LAST SAILING CANCELLED');
  addSpot(-56, 3, -112, 0xd8e8ff, 14, 10, 1.6, 1);
  // the docked ferry along the north side
  const hull = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.5, metalness: 0.3 });
  const hullDark = new THREE.MeshStandardMaterial({ color: 0x1d3550, roughness: 0.5, metalness: 0.3 });
  mesh(new THREE.BoxGeometry(34, 2.6, 8), hullDark, -42, 0.2, -126.5, 0, false);
  mesh(new THREE.BoxGeometry(32, 2.4, 7.4), hull, -42.5, 2.5, -126.5, 0, false);
  mesh(new THREE.BoxGeometry(14, 2.2, 6.2), hull, -40, 4.8, -126.5, 0, false);
  const winStrip = glowMat(1.6, 1.5, 1.3);
  mesh(new THREE.BoxGeometry(30, 0.5, 7.5), winStrip, -42.5, 2.7, -126.5, 0, false);
  mesh(new THREE.BoxGeometry(4, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4 }), -36, 6.2, -126.5, 0, false);
  addSpot(-42, 4, -122.5, 0xfff0d0, 18, 14, 1.6);
  lampPost(-30.5, -105.2); lampPost(-46, -105.2); lampPost(-46, -118.8);

  // ================= GATES, in route order =================
  for (const g of GATES) L.gates.push(makeGate(scene, world, groundMat, g.x0, g.x1, g.at, !!g.alongZ));
}
