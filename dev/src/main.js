import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { G, GRP, ALL, NO_HERO, TUNE, clamp, lerp, rand, damp } from './state.js';
import { initAudio, sfx, setHum, setMasterMuted } from './audio.js';
import { FX } from './fx.js';
import { Tether } from './fx.js';
import { buildLevel, buildEnvironment, Wet } from './level.js';
import { makeProp, removeProp, setGlow, applyDamageLook, populateProps, DEFS } from './props.js';
import { createHero, updateHeroVisual } from './hero.js';
import { spawnEnemy, removeEnemy, updateEnemyVisual, setRagdoll, setEnemyGlow, ETYPES } from './enemies.js';
import { initInput, moveVector, input } from './input.js';
import { loadAssets, A } from './assets.js';
import { Powers, Shock } from './powers.js';

// ======================= renderer / scene =======================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080e);
scene.fog = new THREE.FogExp2(0x0a0d16, 0.019);
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 220);
G.scene = scene; G.camera = camera; G.renderer = renderer;

// Filmic finish: colour grade (teal shadows / warm highlights), vignette, fine grain, slight lens fringing
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uShockC: { value: new THREE.Vector2(0.5, 0.5) }, uShockR: { value: 0 }, uShockS: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    uniform vec2 uShockC; uniform float uShockR; uniform float uShockS; uniform float uAspect;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime * 7.0) * 43758.5453); }
    void main(){
      vec2 uv = vUv; float sband = 0.0; vec2 sdir = vec2(0.0);
      if (uShockS > 0.0) {
        vec2 d = uv - uShockC; d.x *= uAspect; float r = length(d);
        sband = exp(-pow((r - uShockR) / 0.05, 2.0)) * smoothstep(0.0, 0.08, uShockR);
        sdir = d / max(r, 1e-4); sdir.x /= uAspect;
        uv -= sdir * sband * uShockS;
      }
      vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec2 off = c * r2 * 0.012 + sdir * sband * uShockS * 0.35;
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col += vec3(0.55, 0.42, 1.0) * sband * uShockS * 5.0;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadows = vec3(0.86, 0.98, 1.10), highs = vec3(1.06, 1.0, 0.92);
      col *= mix(shadows, highs, smoothstep(0.05, 0.6, l));
      col = mix(vec3(l), col, 1.06);
      col = (col - 0.5) * 1.05 + 0.5;
      col *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.55;
      col += (h(vUv * uRes) - 0.5) * 0.035;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.6, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GradeShader); composer.addPass(grade);
const smaa = new SMAAPass(); composer.addPass(smaa);
const wet = new Wet();

let DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(4,4,12,0.88);color:#fff;font:800 16px Inter,sans-serif;text-align:center;padding:30px;z-index:99';
  d.innerHTML = 'The phone reclaimed graphics memory.<br><br><button style="padding:12px 26px;border-radius:30px;border:1px solid #b9a6ff;background:#5b3fd0;color:#fff;font:800 16px Inter,sans-serif">RELOAD</button>';
  d.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(d);
});
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  G.W = w; G.H = h;
  renderer.setPixelRatio(DPR); renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR); composer.setSize(w, h);
  bloom.resolution.set(w * DPR / 2, h * DPR / 2);
  grade.uniforms.uRes.value.set(w * DPR, h * DPR);
  wet.resize(w * DPR, h * DPR);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 54 : 44; camera.updateProjectionMatrix();
  FX.setScale && FX.add && FX.setScale(h * DPR / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
}

// ======================= physics =======================
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -TUNE.GRAV, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.38;
world.defaultContactMaterial.restitution = 0.12;
world.solver.iterations = 8;
G.world = world;
G.charMat = new CANNON.Material('char');
G.propMat = new CANNON.Material('prop');
FX.init(scene, document.getElementById('nums'));
G.fx = FX;
const tethers = [new Tether(scene), new Tether(scene), new Tether(scene)];
Powers.init(scene);
wireSpikes();
// crackling energy arcs (reuse the tether ribbon)
const arcs = Array.from({ length: 8 }, () => ({ t: new Tether(scene), life: 0, ml: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), follow: null, fromHand: 0, w: 0.07 }));
for (const a of arcs) a.t.mat.uniforms.uColor.value.setRGB(0.75, 0.6, 1.0);
function arc(to, life, follow = null, w = 0.07) {
  const A = arcs.find(x => x.life <= 0) || arcs[Math.floor(Math.random() * arcs.length)];
  A.b.copy(to); A.follow = follow; A.life = life; A.ml = life; A.fromHand = Math.random() < 0.5 ? 0 : 1; A.w = w;
}
function updateArcs(dt) {
  for (const A of arcs) {
    if (A.life <= 0) { A.t.set(A.a, A.a, camera.position, G.rt, 0, 0, 0); continue; }
    A.life -= dt;
    const hand = A.fromHand ? hero.bones.lH : hero.bones.rH;
    (hand || hero.root).getWorldPosition(A.a);
    if (A.follow) A.b.set(A.follow.x, A.follow.y + 0.2, A.follow.z);
    const flick = Math.random() < 0.25 ? 0.15 : 1;
    const k = Math.max(0, A.life / A.ml);
    A.t.set(A.a, A.b, camera.position, G.rt * 3 + Math.random() * 10, k * flick * 1.6, A.w * (0.6 + k * 0.6), (Math.random() - 0.5) * 1.6);
  }
}
for (const t of tethers) wet.hide.push(t.mesh);
resize();
window.addEventListener('resize', resize);

let level = null, hero = null;
async function boot() {
  const btn = document.getElementById('startbtn');
  btn.disabled = true;
  try {
    await loadAssets((p) => { btn.textContent = `LOADING ${Math.round(p * 100)}%`; });
  } catch (err) {
    btn.textContent = 'LOAD FAILED — RELOAD'; console.error(err); return;
  }
  buildEnvironment(renderer, scene);
  level = buildLevel(scene, world, wet);
  // Upright characters are velocity-driven with locked rotation; cannon's friction would pin them in place,
  // so they get a frictionless material. Ragdolls drop the material and use normal friction.
  world.addContactMaterial(new CANNON.ContactMaterial(G.charMat, G.groundMat, { friction: 0, restitution: 0 }));
  world.addContactMaterial(new CANNON.ContactMaterial(G.charMat, G.charMat, { friction: 0, restitution: 0 }));
  world.addContactMaterial(new CANNON.ContactMaterial(G.charMat, G.propMat, { friction: 0.02, restitution: 0.05 }));
  hero = createHero();
  G.hero = hero;
  resetProps();
  btn.disabled = false; btn.textContent = 'HOLD YOUR BREATH';
  requestAnimationFrame(frame);
}

// counter-gravity for anything held or under psionic thrust, every substep
world.addEventListener('preStep', () => {
  const lists = [G.props, G.enemies, G.grenades];
  for (const L of lists) for (const o of L) {
    if (o.held || o.antiGrav > 0 || o.vortex) { const b = o.body; b.force.y += b.mass * TUNE.GRAV * (o.held || o.vortex ? 1 : 0.92); }
  }
});

// ======================= helpers =======================
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _sp = new THREE.Vector3();
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenToPlane(x, y, h, out) {
  ndc.set(x / G.W * 2 - 1, -(y / G.H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  plane.constant = -h;
  return raycaster.ray.intersectPlane(plane, out);
}
function toScreen(p, out) {
  _v3.set(p.x, p.y, p.z).project(camera);
  out.x = (_v3.x * 0.5 + 0.5) * G.W; out.y = (-_v3.y * 0.5 + 0.5) * G.H; out.z = _v3.z; return out;
}
function pxPerMeter(p) {
  const d = camera.position.distanceTo(_v3.set(p.x, p.y, p.z));
  return G.H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d);
}
function speedOf(b) { return Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z); }
const heroCenter = () => hero.body.position;
function segSegDist2(px, py, pz, qx, qy, qz, rx, ry, rz, sx, sy, sz) {
  const d1x = qx - px, d1y = qy - py, d1z = qz - pz, d2x = sx - rx, d2y = sy - ry, d2z = sz - rz;
  const r0x = px - rx, r0y = py - ry, r0z = pz - rz;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * r0x + d2y * r0y + d2z * r0z;
  let s, t;
  if (a <= 1e-8 && e <= 1e-8) return r0x * r0x + r0y * r0y + r0z * r0z;
  if (a <= 1e-8) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * r0x + d1y * r0y + d1z * r0z;
    if (e <= 1e-8) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const cx = px + d1x * s - (rx + d2x * t), cy = py + d1y * s - (ry + d2y * t), cz = pz + d1z * s - (rz + d2z * t);
  return cx * cx + cy * cy + cz * cz;
}

// DOM
const $ = (id) => document.getElementById(id);
const ui = {
  top: $('top'), btns: $('btns'), hp: $('hpfill'), focus: $('focusfill'), focusbar: $('focusbar'), wave: $('wavelabel'), left: $('enemyleft'),
  combo: $('combo'), comboNum: $('combonum'), comboName: $('comboname'), surge: $('surgebtn'), ult: $('ultbtn'), ultRing: $('ultring'),
  hint: $('hint'), banner: $('banner'), hurt: $('hurt'), flash: $('flash'), ultveil: $('ultveil'), fps: $('fps'),
};
let flashA = 0, hurtA = 0, bannerT = 0, hintText = '';
function banner(text, sub, dur = 2) { ui.banner.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); ui.banner.classList.add('show'); bannerT = dur; }
function hint(text) { if (text === hintText) return; hintText = text; if (text) ui.hint.innerHTML = text; ui.hint.style.opacity = text ? 1 : 0; }
function screenFlash(a) { flashA = Math.max(flashA, a); }
function num(pos, text, cls, scale) { FX.numbers.spawn(pos, text, cls, scale); }
function addTrauma(t) { G.trauma = Math.min(1, G.trauma + t); }
function hitStop(t) { G.hitStopT = Math.max(G.hitStopT, t); }

// ======================= props & collisions =======================
function attach(o) {
  if (o._l) return; o._l = true;
  o.body.addEventListener('collide', onCollide);
}
function addProp(type, x, z, r, y, chunkOf) { const o = makeProp(type, x, z, r, y, chunkOf); attach(o); return o; }
function resetProps() {
  for (const o of [...G.props]) removeProp(o);
  populateProps();
  for (const o of G.props) attach(o);
}

function contactPoint(ev, out) {
  const c = ev.contact; out.set(c.bi.position.x + c.ri.x, c.bi.position.y + c.ri.y, c.bi.position.z + c.ri.z); return out;
}

function onCollide(ev) {
  const self = ev.target.userData; const otherBody = ev.body; const other = otherBody.userData;
  if (!self) return;
  const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
  const cp = contactPoint(ev, new THREE.Vector3());
  if (self.kind === 'enemy') {
    const e = self;
    if (!other) { // ground / walls
      if ((e.state === 'ragdoll' || e.thrown) && impact > 9 && !e.dead) {
        const dmg = Math.round((impact - 7) * 3.2);
        G.pending.push(() => { damageEnemy(e, dmg, null, 0, 'slam'); FX.dust(cp, 6, 2.2, 0.9); sfx.impact(impact / 20, false); addTrauma(0.12); });
      }
      return;
    }
    if (other.kind === 'prop' || other.kind === 'grenade') {
      if ((other.thrown || other.held || other.vortex || impact > 8) && impact > 4.5) G.pending.push(() => registerHit(e, other, impact, cp));
    } else if (other.kind === 'enemy' && other !== e) {
      if ((other.thrown || other.held || other.vortex || other.state === 'ragdoll') && impact > 5) G.pending.push(() => registerHit(e, other, impact, cp));
    }
  } else if (self.kind === 'prop') {
    const o = self;
    if (impact > 3.5 && (!other || other.kind !== 'enemy')) {
      G.pending.push(() => {
        sfx.impact(clamp(impact / 22, 0.1, 1) * clamp(o.mass / 40, 0.3, 1.2), o.def.metal);
        if (impact > 9 && o.def.metal) FX.sparks(cp, 6 + Math.min(16, impact | 0), 6);
        if (impact > 7 && o.mass > 60) { FX.dust(cp, 5, 2, 1.0); addTrauma(clamp(o.mass / 2000, 0.03, 0.2)); }
      });
    }
    if (o.def.explosive && !o.exploding && impact > 10 && (o.thrown || o.held || o.vortex || (other && (other.thrown || other.vortex)))) {
      o.exploding = true; G.pending.push(() => explodeBarrel(o));
    }
    if (impact > 10 && (o.thrown || o.held || o.vortex || (other && (other.thrown || other.vortex)))) {
      const k = o.mass < 20 ? 2.2 : o.mass < 60 ? 1.1 : 0.25;
      const dmg = Math.round((impact - 9) * k);
      if (dmg > 0) G.pending.push(() => damageProp(o, dmg, cp, 'impact'));
    }
    if (o.thrown) o.antiGrav = 0;
  } else if (self.kind === 'grenade') {
    const g = self;
    if (g.byHero && (g.thrown || g.vortex) && other && other.kind === 'enemy' && !g.exploding) { g.exploding = true; G.pending.push(() => explodeGrenade(g)); }
    else if (impact > 2) G.pending.push(() => sfx.toss());
    g.antiGrav = 0;
  }
}

function registerHit(e, o, impact, cp) {
  if (!e.alive || e.dead) return;
  const now = G.t;
  if (now - (o.lastHit.get(e) ?? -9) < 0.35) return;
  o.lastHit.set(e, now);
  let dmg;
  if (o.kind === 'enemy') {
    dmg = impact * 2.3;
    if (!o.dead) damageEnemy(o, Math.round(dmg * 0.6), null, 0, 'collide');
  } else dmg = impact * (0.5 + Math.sqrt(o.mass) * 0.3);
  if (o.held) dmg *= 0.8;
  if (e.type === 'auditor') {
    if (o.kind === 'prop' && o.mass < 25) dmg *= 0.35;
    if (o.kind === 'enemy') dmg *= 0.6;
    if (e.stun > 0) dmg *= 1.8;
  }
  dmg = Math.round(dmg);
  if (dmg < 3) return;
  const b = o.body.velocity; _v1.set(b.x, 0, b.z); if (_v1.lengthSq() < 0.01) _v1.set(e.body.position.x - o.body.position.x, 0, e.body.position.z - o.body.position.z);
  _v1.normalize();
  const force = impact * clamp(o.mass / 35, 0.35, 1.4);
  damageEnemy(e, dmg, _v1.clone(), force, 'hit');
  o.antiGrav = 0;
  FX.sparks(cp, 10 + (dmg / 4 | 0), 7, o.kind === 'enemy' ? [0.9, 0.9, 1] : [1, 0.75, 0.4]);
  FX.psi(cp, 8, 4, 0.2, 0.4);
  sfx.impact(clamp(dmg / 60, 0.25, 1), o.def ? o.def.metal : true);
  if (dmg >= 40) { hitStop(0.06); addTrauma(0.22); FX.rings.spawn(cp.x, 0.1, cp.z, 0.3, 2.2, 0.3, 0xc9b8ff, 0.8); }
  else addTrauma(0.1);
  G.tutorial.hit = true;
}

function damageEnemy(e, dmg, dir, force, src) {
  if (e.dead || !e.alive) return;
  e.hp -= dmg; e.hpShow = 2.5; e.flinch = 0.22;
  if (!G.ultState && G.t > (G.ultLock || 0) && src !== 'ult' && src !== 'tick') G.ult = Math.min(100, G.ult + dmg * 0.24);
  if (src !== 'slam' && src !== 'tick' && src !== 'collide') {
    G.combo++; G.comboT = 2.6; G.stats.hits++;
    G.stats.maxCombo = Math.max(G.stats.maxCombo, G.combo);
  }
  if (src !== 'tick') {
    const p = _v2.set(e.body.position.x, e.body.position.y + 1.1 * e.def.scale, e.body.position.z);
    num(p, String(dmg), dmg >= 40 ? 'big' : '', dmg >= 40 ? 1.15 : 0.9);
  }
  // flash the armor violet
  setEnemyGlow(e, 1.6);
  if (e.hp <= 0) { kill(e, dir, force); return; }
  if (dmg >= e.def.stagger && e.type !== 'auditor' && !e.held && !e.vortex) knockdown(e, dir, force);
  else if (e.type === 'auditor' && dir) { e.body.velocity.x += dir.x * 2; e.body.velocity.z += dir.z * 2; }
}

function knockdown(e, dir, force) {
  cancelAttack(e);
  setRagdoll(e, true);
  e.state = 'ragdoll'; e.downT = 0;
  const b = e.body;
  if (dir) {
    const k = clamp(force, 4, 15);
    b.velocity.x += dir.x * k; b.velocity.z += dir.z * k; b.velocity.y += 2.5 + k * 0.3;
    b.angularVelocity.set(dir.z * k * 0.8 + rand(-2, 2), rand(-3, 3), -dir.x * k * 0.8 + rand(-2, 2));
  }
}

function kill(e, dir, force) {
  e.dead = true; e.hp = 0;
  G.stats.kills++; if (!G.ultState && G.t > (G.ultLock || 0)) G.ult = Math.min(100, G.ult + 5);
  sfx.down();
  const p = e.body.position;
  FX.psi(_v2.set(p.x, p.y + 0.5, p.z), 22, 5, 0.25, 0.8);
  if (e.type === 'auditor') {
    FX.explosion(_v2.set(p.x, 0.5, p.z), 5); sfx.explosion(); addTrauma(0.8); hitStop(0.12); screenFlash(0.5);
    num(_v2.set(p.x, p.y + 2.5, p.z), 'AUDIT FAILED', 'psi', 1.6);
  }
  if (e.state !== 'ragdoll' && e.state !== 'gripped') knockdown(e, dir || new THREE.Vector3(0, 0, -1), Math.max(force, 6));
  e.state = e.held ? 'gripped' : 'ragdoll';
}

function cancelAttack(e) {
  if (e.laser) e.laser.material.opacity = 0;
  if (e.slamRing) { e.slamRing.life = 0; e.slamRing = null; }
  e.charge = null;
}

// ======================= hero damage =======================
function hurtHero(dmg, from, knock = 6) {
  if (hero.dead || hero.invuln > 0 || G.ultState || G.mode !== 'play') return;
  hero.hp -= dmg; hero.lastHurt = G.t; hero.invuln = 0.3;
  hurtA = Math.min(1, hurtA + 0.5 + dmg / 40);
  addTrauma(0.32 + dmg / 80); sfx.hurt();
  const hp = hero.body.position;
  num(_v2.set(hp.x, hp.y + 1.2, hp.z), '-' + Math.round(dmg), 'hurt', 0.9);
  if (from) {
    _v1.set(hp.x - from.x, 0, hp.z - from.z).normalize();
    hero.body.velocity.x += _v1.x * knock; hero.body.velocity.z += _v1.z * knock;
    hero.knockT = 0.18;
  }
  G.combo = 0;
  if (hero.hp <= 0) heroDown();
}

// ======================= telekinesis: grab / hold / throw =======================
function grabbables() {
  const out = [];
  for (const o of G.props) if (o.alive && !o.held && !o.inWater) out.push(o);
  for (const g of G.grenades) if (g.alive && !g.held && !g.exploding) out.push(g);
  for (const e of G.enemies) if (e.alive && !e.held && e.def.grip && e.state !== 'spawn' && e.fade >= 1) out.push(e);
  return out;
}

function liftCost(o) { return o.kind === 'enemy' ? 12 : o.kind === 'grenade' ? 2 : 3 + o.mass * 0.025; }
function holdDrain(o) { return o.kind === 'enemy' ? 9 : o.kind === 'grenade' ? 1 : 2.5 + o.mass * 0.032; }

const api = {
  audio() { initAudio(); },
  tryGrab(id, x, y) {
    if (hero.dead || G.ultState) return false;
    if (G.holds.size >= 2) return false;
    const hp = heroCenter();
    let best = null, bestScore = 1e9;
    for (const o of grabbables()) {
      const p = o.body.position;
      const wd = Math.hypot(p.x - hp.x, p.z - hp.z);
      if (wd > TUNE.GRAB_RANGE) continue;
      toScreen(p, _sp); if (_sp.z > 1) continue;
      const pr = o.radius * pxPerMeter(p);
      const d = Math.hypot(_sp.x - x, _sp.y - y);
      // bottom-left thumb zone favours the movement stick: only grab if the touch is right on it
      const thumbZone = x < G.W * 0.42 && y > G.H * 0.62 && input.joy.id === null;
      const allow = thumbZone ? Math.max(pr * 0.75, 14) + (o.kind === 'grenade' ? 20 : 0) : Math.max(pr * 0.85, 18) + 30 + (o.kind === 'grenade' ? 40 : 0);
      if (d > allow) continue;
      const score = d / allow - (o.kind === 'grenade' ? 0.6 : 0) + (o.kind === 'enemy' ? 0.1 : 0);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (!best) return false;
    const cost = liftCost(best);
    if (hero.focus < Math.max(4, cost * 0.6)) {
      num(_v2.set(hp.x, hp.y + 1.6, hp.z), 'NO FOCUS', 'psi', 0.8);
      ui.focusbar.classList.add('low'); setTimeout(() => ui.focusbar.classList.remove('low'), 400);
      return false;
    }
    hero.focus -= cost; hero.focusDelay = 0.6;
    startHold(id, best, x, y);
    return true;
  },
  moveGrab(id, x, y) { const h = G.holds.get(id); if (h) { h.sx = x; h.sy = y; } },
  releaseGrab(id, x, y, vx, vy) {
    const h = G.holds.get(id); if (!h) return;
    endHold(h);
    const sp = Math.hypot(vx, vy);
    if (sp >= TUNE.FLICK_MIN) throwObj(h.obj, x, y, vx, vy, sp);
    else dropObj(h.obj);
  },
  surge() { doSurge(); },
  ult() { startUlt(); },
  pause() { togglePause(); },
};

function startHold(id, o, x, y) {
  const b = o.body;
  const holdY = o.kind === 'enemy' ? 2.1 : o.kind === 'grenade' ? 1.9 : 1.45 + o.hh + Math.min(0.5, o.mass / 800);
  const h = { id, obj: o, sx: x, sy: y, holdY, target: new THREE.Vector3(b.position.x, holdY, b.position.z), t: 0, tether: null };
  o.held = h; o.thrown = false; o.antiGrav = 0; o.vortex = false;
  b.collisionFilterGroup = GRP.HELD; b.collisionFilterMask = NO_HERO;
  b.wakeUp();
  if (o.kind === 'enemy') {
    cancelAttack(o); setRagdoll(o, true); o.state = 'gripped';
    num(_v2.set(b.position.x, b.position.y + 1.3, b.position.z), 'GRIPPED', 'psi', 0.8);
  } else if (o.kind === 'grenade') {
    o.byHero = true; G.stats.catches++; G.ult = Math.min(100, G.ult + 5);
    num(_v2.set(b.position.x, b.position.y + 0.8, b.position.z), 'CAUGHT!', 'psi', 1);
  }
  b.velocity.y += 2.5;
  G.holds.set(id, h);
  sfx.lift(o.mass);
  FX.psi(_v2.set(b.position.x, b.position.y, b.position.z), 18, 3, 0.26, 0.6);
  FX.rings.spawn(b.position.x, 0.06, b.position.z, 0.2, 1.4 + o.radius, 0.4, 0x9b7bff, 0.9);
  G.tutorial.grabbed = true;
}

function endHold(h) {
  G.holds.delete(h.id);
  const o = h.obj; o.held = null;
  if (o.kind === 'prop') setGlow(o, 0.8);
}

function restoreGroup(o) {
  const b = o.body;
  if (o.kind === 'enemy') { b.collisionFilterGroup = GRP.ENEMY; b.collisionFilterMask = ALL; }
  else { b.collisionFilterGroup = GRP.PROP; b.collisionFilterMask = ALL; }
}

function dropObj(o) {
  o.thrown = true; o.thrownT = 0; o.antiGrav = 0; o.dropped = true;
  o.body.velocity.scale(0.5, o.body.velocity);
  if (o.kind === 'enemy') { o.state = 'ragdoll'; o.downT = 0; }
}

function aimAssist(from, dir, self) {
  let best = null, bestS = 1e9;
  for (const e of G.enemies) {
    if (!e.alive || e.dead || e === self || e.state === 'spawn' || e.held) continue;
    const dx = e.body.position.x - from.x, dz = e.body.position.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6 || dist > 34) continue;
    const ang = Math.acos(clamp((dx * dir.x + dz * dir.z) / dist, -1, 1));
    const cone = TUNE.AIM_CONE + Math.atan(1.0 / dist);
    if (ang > cone) continue;
    const s = ang * 2.2 + dist * 0.025;
    if (s < bestS) { bestS = s; best = e; }
  }
  return best;
}

function throwObj(o, x, y, vx, vy, sp) {
  const b = o.body;
  const a = screenToPlane(x, y, b.position.y, new THREE.Vector3());
  const c = screenToPlane(x + vx * 0.06, y + vy * 0.06, b.position.y, new THREE.Vector3());
  const dir = new THREE.Vector3();
  if (a && c) dir.set(c.x - a.x, 0, c.z - a.z);
  if (dir.lengthSq() < 1e-4) dir.set(b.position.x - hero.body.position.x, 0, b.position.z - hero.body.position.z);
  dir.normalize();
  const power = clamp((sp - TUNE.FLICK_MIN) / 2000, 0, 1);
  const massF = o.kind === 'enemy' ? 0.85 : clamp(1.15 - o.mass / 420, 0.48, 1.12);
  const v = lerp(18, 37, power) * massF;
  const target = aimAssist(b.position, dir, o);
  const d3 = new THREE.Vector3();
  let antiG = 0.55;
  if (target) {
    const tp = target.body.position;
    const dist = Math.hypot(tp.x - b.position.x, tp.z - b.position.z);
    const tt = dist / v;
    const aimY = tp.y + 0.15 * target.def.scale;
    d3.set(tp.x + target.body.velocity.x * tt * 0.8 - b.position.x, aimY - b.position.y, tp.z + target.body.velocity.z * tt * 0.8 - b.position.z).normalize();
    antiG = clamp(tt + 0.2, 0.25, 1.1);
    FX.rings.spawn(tp.x, 0.08, tp.z, 1.6, 0.7, 0.35, 0xff5a8a, 0.9, tp);
  } else d3.set(dir.x, -0.03, dir.z).normalize();
  b.velocity.set(d3.x * v, d3.y * v, d3.z * v);
  if (o === (G.holds.size ? null : o)) hero.flourish = { t: 0, dir: new THREE.Vector3(d3.x, 0, d3.z).normalize() };
  const spin = o.kind === 'enemy' ? 6 : lerp(13, 2, clamp(o.mass / 300, 0, 1));
  b.angularVelocity.set(d3.z * spin + rand(-1, 1), rand(-2, 2), -d3.x * spin + rand(-1, 1));
  o.thrown = true; o.thrownT = 0; o.antiGrav = antiG; o.dropped = false;
  if (o.kind === 'enemy') { o.state = 'ragdoll'; o.downT = 0; }
  G.stats.throws++;
  sfx.throw(power);
  FX.psi(_v2.set(b.position.x, b.position.y, b.position.z), 16, 6, 0.28, 0.5);
  addTrauma(0.06 + Math.min(0.25, o.mass / 1500));
  G.tutorial.thrown = true;
}

function updateHolds(dt) {
  const hp = heroCenter();
  let drain = 0, heavy = 0;
  for (const h of G.holds.values()) {
    const o = h.obj, b = o.body;
    if (!o.alive) { G.holds.delete(h.id); continue; }
    h.t += dt;
    const lifted = Math.min(1, h.t / (0.25 + o.mass / 900));
    const p = screenToPlane(h.sx, h.sy, h.holdY, _v1);
    if (p) {
      let dx = p.x - hp.x, dz = p.z - hp.z; const d = Math.hypot(dx, dz);
      const maxR = TUNE.HOLD_MAX;
      if (d > maxR) { dx *= maxR / d; dz *= maxR / d; }
      else if (d < TUNE.HOLD_MIN) { const k = TUNE.HOLD_MIN / Math.max(0.01, d); dx *= k; dz *= k; }
      h.target.set(hp.x + dx, h.holdY, hp.z + dz);
    }
    h.target.y = lerp(b.position.y, h.holdY, lifted) + Math.sin(G.t * 3 + h.id) * 0.08;
    // P-control on velocity, softened by mass
    const m = clamp(o.mass / 400, 0, 1);
    const k = lerp(15, 6.5, m), maxV = lerp(38, 15, m), blend = lerp(0.55, 0.16, m);
    let tvx = (h.target.x - b.position.x) * k, tvy = (h.target.y - b.position.y) * k, tvz = (h.target.z - b.position.z) * k;
    const s = Math.hypot(tvx, tvy, tvz); if (s > maxV) { tvx *= maxV / s; tvy *= maxV / s; tvz *= maxV / s; }
    b.velocity.x += (tvx - b.velocity.x) * blend; b.velocity.y += (tvy - b.velocity.y) * blend; b.velocity.z += (tvz - b.velocity.z) * blend;
    if (o.kind !== 'enemy') {
      b.angularVelocity.scale(0.86, b.angularVelocity);
      b.angularVelocity.y += (0.9 - b.angularVelocity.y) * 0.05;
      b.angularVelocity.x += Math.sin(G.t * 2.1 + h.id) * 0.04; b.angularVelocity.z += Math.cos(G.t * 1.7 + h.id) * 0.04;
    } else {
      b.angularVelocity.scale(0.9, b.angularVelocity);
      b.angularVelocity.x += Math.sin(G.t * 9) * 0.3; b.angularVelocity.z += Math.cos(G.t * 7) * 0.3;
    }
    b.wakeUp();
    drain += holdDrain(o); heavy = Math.max(heavy, m);
    if (o.kind === 'prop') setGlow(o, 0.32 + Math.sin(G.t * 12) * 0.06);
    if (o.kind === 'enemy') setEnemyGlow(o, 1.2);
    // ambient motes
    if (Math.random() < 0.5) FX.psi(_v2.set(b.position.x + rand(-0.3, 0.3), b.position.y - o.hh, b.position.z + rand(-0.3, 0.3)), 1, 1.2, 0.18, 0.5);
  }
  if (G.holds.size) {
    hero.focus -= drain * dt; hero.focusDelay = 0.5;
    if (hero.focus <= 0) {
      hero.focus = 0;
      for (const h of [...G.holds.values()]) { endHold(h); dropObj(h.obj); }
      for (const [id, p] of input.pointers) if (p.role === 'grab') input.pointers.delete(id);
      num(_v2.set(hp.x, hp.y + 1.6, hp.z), 'FOCUS BROKEN', 'psi', 1);
      addTrauma(0.2);
    }
  }
  setHum(G.holds.size, heavy);
}

// thrown objects: sweep tests, trails, settle
function updateThrown(dt) {
  const lists = [G.props, G.enemies, G.grenades];
  for (const L of lists) for (const o of L) {
    if (!o.alive) continue;
    const b = o.body;
    if (o.antiGrav > 0) o.antiGrav -= dt;
    if (o.thrown) {
      o.thrownT += dt;
      const sp = speedOf(b);
      if (sp > 9 && !o.dropped) {
        // sweep against enemies to avoid tunnelling
        for (const e of G.enemies) {
          if (e === o || !e.alive || e.dead || e.held || e.state === 'spawn') continue;
          const ep = e.body.position, s = e.def.scale;
          const r = 0.42 * s + o.radius * 0.55;
          const d2 = segSegDist2(o.prev.x, o.prev.y, o.prev.z, b.position.x, b.position.y, b.position.z, ep.x, ep.y - 0.45 * s, ep.z, ep.x, ep.y + 0.45 * s, ep.z);
          if (d2 < r * r) {
            const rel = Math.hypot(b.velocity.x - e.body.velocity.x, b.velocity.y - e.body.velocity.y, b.velocity.z - e.body.velocity.z);
            registerHit(e, o, rel * 0.85, _v2.set((b.position.x + ep.x) / 2, (b.position.y + ep.y) / 2, (b.position.z + ep.z) / 2).clone());
            if (o.kind === 'grenade' && o.byHero && !o.exploding) { o.exploding = true; explodeGrenade(o); }
            if (!o.alive) break;
          }
        }
        if (Math.random() < 0.9) FX.add.emit(b.position.x, b.position.y, b.position.z, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5), 0.7, 0.45, 1.6, 0.35, 0.35 + o.radius * 0.3, 0.02, 0, 1, 0.8);
      }
      if ((o.thrownT > 0.3 && sp < 2.2) || o.thrownT > 5) {
        o.thrown = false; o.dropped = false; o.antiGrav = 0;
        if (!o.held && !o.vortex) restoreGroup(o);
      }
    }
    if (o.kind === 'enemy' && !o.held && o.glow > 0) setEnemyGlow(o, Math.max(0, o.glow - dt * 3));
    o.prev.set(b.position.x, b.position.y, b.position.z);
    // fell in the harbor / out of bounds
    if (b.position.y < -0.9 && !o.inWater) {
      o.inWater = true;
      FX.splash(b.position); sfx.splash();
      if (o.kind === 'enemy') {
        if (!o.dead) { o.dead = true; G.stats.kills++; G.ult = Math.min(100, G.ult + 12); num(_v2.set(b.position.x, 1.5, b.position.z), 'OVERBOARD!', 'psi', 1.2); }
      }
    }
    // tunnelled into a building: put it back on the street
    if (b.position.y > -0.5 && (Math.abs(b.position.x) > 13.3 || b.position.z < -27.2)) {
      b.position.x = clamp(b.position.x, -12.1, 12.1); b.position.z = Math.max(b.position.z, -25.9); b.position.y = Math.max(b.position.y, 1.5);
      b.velocity.scale(-0.25, b.velocity);
    }
    if (b.position.y < -4 || Math.abs(b.position.x) > 30 || b.position.z < -40 || b.position.z > 50) {
      if (o.kind === 'prop') removeProp(o);
      else if (o.kind === 'enemy') { if (!o.dead) { o.dead = true; G.stats.kills++; } removeEnemy(o); }
      else if (o.kind === 'grenade') removeGrenade(o);
    }
  }
}

// ======================= explosions / breakables =======================
function explosion(p, r, eDmg, hDmg, byHero) {
  FX.explosion(p, r); sfx.explosion(); addTrauma(0.6); hitStop(0.05); screenFlash(0.08);
  for (const e of [...G.enemies]) {
    if (!e.alive || e.dead) continue;
    const ep = e.body.position; const d = Math.hypot(ep.x - p.x, ep.y - p.y, ep.z - p.z);
    const rr = r + e.radius * 0.4;
    if (d > rr) continue;
    const f = 1 - d / rr;
    const dir = new THREE.Vector3(ep.x - p.x, 0, ep.z - p.z).normalize();
    damageEnemy(e, Math.round(eDmg * (0.35 + 0.65 * f)), dir, 9 + 9 * f, 'boom');
  }
  const hp = hero.body.position; const dh = Math.hypot(hp.x - p.x, hp.y - p.y, hp.z - p.z);
  if (dh < r) hurtHero(hDmg * (0.4 + 0.6 * (1 - dh / r)) * (byHero ? 0.5 : 1), p, 9);
  for (const o of [...G.props]) {
    if (!o.alive) continue;
    const op = o.body.position; const d = Math.hypot(op.x - p.x, op.y - p.y, op.z - p.z);
    if (d > r * 1.5) continue;
    const f = 1 - d / (r * 1.5);
    const k = 15 * f * clamp(60 / o.mass, 0.12, 1.3);
    _v1.set(op.x - p.x, 0, op.z - p.z).normalize();
    o.body.velocity.x += _v1.x * k; o.body.velocity.z += _v1.z * k; o.body.velocity.y += k * 0.7;
    o.body.angularVelocity.set(rand(-6, 6) * f, rand(-6, 6) * f, rand(-6, 6) * f); o.body.wakeUp();
    const pd = Math.round(85 * f);
    if (o.def.explosive && !o.exploding && pd > 4) { o.exploding = true; setTimeout(() => o.alive && explodeBarrel(o), 140 + d * 40); }
    else if (pd > 2) damageProp(o, pd, null, 'boom');
  }
  for (const g of [...G.grenades]) {
    const gp = g.body.position; if (!g.exploding && Math.hypot(gp.x - p.x, gp.z - p.z) < r) { g.exploding = true; setTimeout(() => g.alive && explodeGrenade(g), 120); }
  }
}
function explodeBarrel(o) {
  if (!o.alive) return;
  const p = o.body.position.clone ? new THREE.Vector3(o.body.position.x, o.body.position.y, o.body.position.z) : o.body.position;
  removeProp(o);
  explosion(p, 4.3, 95, 22, true);
}
// ---- durability: every prop is a shield with hit points; light ones fail fast ----
const BOLT_DMG = 8;
function damageProp(o, dmg, at, src) {
  if (!o.alive || o.dying || o.type === 'chunk' && src === 'impact') return;
  o.hp -= dmg; o.dmgShow = 2.2;
  applyDamageLook(o);
  if (at) FX.sparks(at, 5 + Math.min(10, dmg | 0), 4.5, o.def.wood ? [0.85, 0.6, 0.35] : o.def.soft ? [0.6, 0.6, 0.6] : [1, 0.78, 0.45], 0.09);
  if (o.hp <= 0) { o.dying = true; G.pending.push(() => destroyProp(o, src)); }
}
function destroyProp(o, src) {
  if (!o.alive) return;
  const wasHeld = !!o.held;
  if (o.held) { const h = o.held; endHold(h); for (const [id, p] of input.pointers) if (p.role === 'grab' && !G.holds.has(id)) input.pointers.delete(id); }
  const p = new THREE.Vector3(o.body.position.x, o.body.position.y, o.body.position.z);
  const v = o.body.velocity.clone();
  if (wasHeld) num(_v2.set(p.x, p.y + 1, p.z), o.def.explosive ? 'IT BLEW!' : 'SHIELD BROKEN', 'psi', 1.1);
  if (o.def.explosive) { explodeBarrel(o); return; }
  const mat = o.glowMats[0].clone(); mat.color.multiplyScalar(0.75); mat.emissive.set(0, 0, 0);
  const size = o.size.clone();
  removeProp(o);
  sfx.impact(0.9, !!o.def.metal);
  addTrauma(0.12 + Math.min(0.3, o.mass / 900));
  if (o.def.soft) {
    // trash bags and boxes burst into litter
    for (let i = 0; i < 40; i++) FX.smoke.emit(p.x, p.y, p.z, rand(-4, 4) + v.x * 0.2, rand(1, 5), rand(-4, 4) + v.z * 0.2, rand(0.12, 0.3), rand(0.12, 0.25), rand(0.1, 0.2), rand(0.6, 1.4), 0.1, 0.05, 12, 1.5, 1);
    FX.dust(p, 5, 2, 0.7);
    return;
  }
  FX.dust(p, 8, 2.5, Math.min(2, 0.6 + o.mass / 150));
  FX.sparks(p, 16, 7, o.def.wood ? [0.8, 0.55, 0.3] : [1, 0.75, 0.4]);
  const n = o.mass > 200 ? 8 : o.mass > 60 ? 6 : 4;
  const chunks = G.props.filter(q => q.type === 'chunk');
  for (let i = 0; i < chunks.length - 34 + n; i++) if (chunks[i]) removeProp(chunks[i]);
  for (let i = 0; i < n; i++) {
    const cs = new THREE.Vector3(size.x * rand(0.25, 0.45), size.y * rand(0.2, 0.4), size.z * rand(0.25, 0.45));
    const q = addProp('chunk', p.x + rand(-0.4, 0.4) * size.x, p.z + rand(-0.4, 0.4) * size.z, rand(0, 6), p.y + rand(-0.2, 0.3) * size.y, { size: cs, mat });
    q.mass = q.body.mass = Math.max(1.5, o.mass / n * 0.6); q.body.updateMassProperties();
    q.body.velocity.set(v.x * 0.4 + rand(-5, 5), rand(2, 6), v.z * 0.4 + rand(-5, 5));
    q.body.angularVelocity.set(rand(-10, 10), rand(-10, 10), rand(-10, 10));
    q.thrown = true; q.thrownT = 0; q.dropped = true; q.body.collisionFilterGroup = GRP.HELD; q.body.collisionFilterMask = NO_HERO;
  }
}

// ======================= grenades & bolts =======================
const grenadeGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12);
const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x2f3a2a, metalness: 0.6, roughness: 0.4 });
function spawnGrenade(from, target, T) {
  const mesh = new THREE.Group();
  const can = new THREE.Mesh(grenadeGeo, grenadeMat); can.castShadow = true; mesh.add(can);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.06, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2), toneMapped: false }));
  mesh.add(band);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xff3322, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.7); mesh.add(halo);
  scene.add(mesh);
  const body = new CANNON.Body({ mass: 2, collisionFilterGroup: GRP.PROP, collisionFilterMask: ALL, linearDamping: 0.02, angularDamping: 0.2 });
  body.addShape(new CANNON.Cylinder(0.09, 0.09, 0.26, 8));
  body.position.set(from.x, from.y, from.z);
  const g = GRAV();
  body.velocity.set((target.x - from.x) / T, (target.y - from.y) / T + 0.5 * g * T, (target.z - from.z) / T);
  body.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
  world.addBody(body);
  const o = { kind: 'grenade', body, mesh, band, halo, mass: 2, radius: 0.22, hh: 0.13, fuse: 2.25, alive: true, held: null, thrown: false, thrownT: 0, antiGrav: 0,
    lastHit: new Map(), prev: new THREE.Vector3(from.x, from.y, from.z), byHero: false, exploding: false, def: { metal: true, scale: 1 }, beepT: 0 };
  body.userData = o; attach(o);
  G.grenades.push(o);
  return o;
}
const GRAV = () => TUNE.GRAV;
let _dot = null;
function softDot() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); return _dot;
}
function removeGrenade(g) {
  if (!g.alive) return; g.alive = false;
  if (g.held) { G.holds.delete(g.held.id); for (const [id, p] of input.pointers) if (p.role === 'grab' && !G.holds.has(id)) input.pointers.delete(id); g.held = null; }
  scene.remove(g.mesh); world.removeBody(g.body);
  const i = G.grenades.indexOf(g); if (i >= 0) G.grenades.splice(i, 1);
}
function explodeGrenade(g) {
  if (!g.alive) return;
  const p = new THREE.Vector3(g.body.position.x, g.body.position.y, g.body.position.z);
  const byHero = g.byHero;
  removeGrenade(g);
  explosion(p, 3.8, byHero ? 85 : 60, 24, byHero);
}
function updateGrenades(dt) {
  for (const g of [...G.grenades]) {
    g.fuse -= dt;
    const b = g.body;
    g.mesh.position.set(b.position.x, b.position.y, b.position.z);
    g.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const rate = g.fuse < 0.8 ? 14 : g.fuse < 1.5 ? 7 : 3.5;
    const on = Math.sin(G.t * rate * Math.PI * 2) > 0;
    g.band.visible = on; g.halo.material.opacity = on ? 0.85 : 0.15; g.halo.scale.setScalar(g.held ? 1.1 : 0.75);
    g.beepT -= dt; if (g.beepT <= 0) { g.beepT = 1 / rate; sfx.beep(g.fuse < 0.8); }
    if (g.fuse <= 0 && !g.exploding) { g.exploding = true; explodeGrenade(g); }
  }
}

const boltGeo = new THREE.CapsuleGeometry(0.06, 0.55, 3, 6); boltGeo.rotateX(Math.PI / 2);
const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.5), toneMapped: false });
const rayResult = new CANNON.RaycastResult();
const _cf = new CANNON.Vec3(), _ct = new CANNON.Vec3();
function spawnBolt(from, dir) {
  const m = new THREE.Mesh(boltGeo, boltMat); m.position.copy(from); scene.add(m);
  m.lookAt(from.x + dir.x, from.y + dir.y, from.z + dir.z);
  G.bolts.push({ m, p: from.clone(), v: dir.clone().multiplyScalar(17), life: 2.4 });
  sfx.bolt();
}
function updateBolts(dt) {
  const hp = heroCenter();
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    const B = G.bolts[i];
    const px = B.p.x, py = B.p.y, pz = B.p.z;
    B.p.addScaledVector(B.v, dt); B.life -= dt; B.m.position.copy(B.p);
    if (Math.random() < 0.7) FX.add.emit(B.p.x, B.p.y, B.p.z, 0, 0, 0, 1.6, 0.8, 0.2, 0.18, 0.2, 0.02);
    let dead = B.life <= 0;
    // blocked by anything Iris holds in the line of fire (judged top-down, like the player sees it)
    if (!dead) for (const h of G.holds.values()) {
      const o = h.obj, c = o.body.position;
      const rh = (o.kind === 'prop' ? o.hRad : o.kind === 'enemy' ? 0.55 : 0.3) + 0.2;
      const hh = o.kind === 'prop' ? o.hh : 0.6;
      const midY = (py + B.p.y) / 2;
      if (midY > c.y + hh + 0.35 || midY < c.y - hh - 1.4) continue;
      if (segSegDist2(px, 0, pz, B.p.x, 0, B.p.z, c.x, 0, c.z, c.x, 0, c.z) < rh * rh) {
        dead = true; G.stats.blocks++; sfx.block();
        FX.sparks(B.p, 12, 6, [1, 0.72, 0.3]); FX.psi(B.p, 8, 3, 0.2, 0.35);
        if (o.kind === 'prop') { damageProp(o, BOLT_DMG, B.p.clone(), 'bolt'); if (o.alive && !o.dying) num(_v2.set(c.x, c.y + hh + 0.5, c.z), 'BLOCKED', 'psi', 0.75); }
        else if (o.kind === 'enemy') { damageEnemy(o, 12, null, 0, 'collide'); num(_v2.set(c.x, c.y + 1, c.z), 'HUMAN SHIELD', 'psi', 0.8); }
        else if (o.kind === 'grenade' && !o.exploding) { o.exploding = true; G.pending.push(() => explodeGrenade(o)); }
        G.ult = Math.min(100, G.ult + 1.5);
        break;
      }
    }
    // hero
    if (!dead && segSegDist2(px, py, pz, B.p.x, B.p.y, B.p.z, hp.x, 0.3, hp.z, hp.x, 1.55, hp.z) < 0.42 * 0.42) {
      dead = true; hurtHero(7, _v2.set(px, py, pz), 2.5); FX.sparks(B.p, 10, 5);
    }
    // world / props / other enemies
    if (!dead) {
      _cf.set(px, py, pz); _ct.set(B.p.x, B.p.y, B.p.z); rayResult.reset();
      world.raycastClosest(_cf, _ct, { collisionFilterMask: GRP.GROUND | GRP.PROP | GRP.STATIC | GRP.HELD, skipBackfaces: true }, rayResult);
      if (rayResult.hasHit) {
        dead = true; FX.sparks(B.p, 8, 4); sfx.impact(0.12, true);
        const ho = rayResult.body && rayResult.body.userData;
        if (ho && ho.kind === 'prop') damageProp(ho, BOLT_DMG, B.p.clone(), 'bolt');
      }
    }
    if (dead) { scene.remove(B.m); G.bolts.splice(i, 1); }
  }
}

// ======================= enemy AI =======================
function updateEnemies(dt) {
  for (const e of [...G.enemies]) {
    try { updateEnemy(e, dt); } catch (err) { reportError(err); e.errs = (e.errs || 0) + 1; if (e.errs > 30) { e.dead = true; removeEnemy(e); } }
  }
}
function updateEnemy(e, dt) {
  const hp = heroCenter();
  {
    const b = e.body, s = e.def.scale;
    e.stateT += dt; e.atkCD -= dt;
    if (e.stun > 0) e.stun -= dt;
    if (e.chargeCD !== undefined) e.chargeCD -= dt;
    const dx = hp.x - b.position.x, dz = hp.z - b.position.z, dist = Math.hypot(dx, dz);
    const nx = dx / (dist || 1), nz = dz / (dist || 1);
    let want = null; // desired horizontal velocity
    if (e.state === 'spawn') {
      e.spawnT += dt; if (e.spawnT > 0.55) { e.state = 'move'; e.stateT = 0; }
      want = [0, 0];
    } else if (e.state === 'ragdoll' || e.state === 'gripped') {
      if (e.held || e.vortex) return;
      e.downT += dt;
      const sp = speedOf(b);
      e.restT = (e.downT > 0.9 && sp < 1.4) ? (e.restT || 0) + dt : 0;
      if ((e.restT > 0.1 && (b.position.y < 1.4 * s || e.restT > 1.2)) || (e.dead && e.downT > 4)) {
        if (e.dead) {
          e.fade -= dt * 1.4;
          if (e.fade <= 0) { FX.psi(_v2.set(b.position.x, 0.6, b.position.z), 16, 2.5, 0.25, 0.7); removeEnemy(e); }
        } else { e.state = 'getup'; e.stateT = 0; e.upFrom = new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); }
      }
      return;
    } else if (e.state === 'getup') {
      const t = clamp(e.stateT / 0.45, 0, 1);
      _q.setFromAxisAngle(_up, Math.atan2(nx, nz));
      _q2.copy(e.upFrom).slerp(_q, t);
      b.quaternion.set(_q2.x, _q2.y, _q2.z, _q2.w);
      b.angularVelocity.set(0, 0, 0); b.velocity.x *= 0.8; b.velocity.z *= 0.8;
      if (b.position.y < 0.85 * s) b.position.y += (0.85 * s + 0.02 - b.position.y) * 0.3;
      if (t >= 1) {
        setRagdoll(e, false); e.yaw = Math.atan2(nx, nz); b.quaternion.setFromEuler(0, 0, 0); e.root.quaternion.setFromAxisAngle(_up, e.yaw);
        restoreGroup(e); e.state = 'move'; e.stateT = 0; e.atkCD = Math.max(e.atkCD, 0.6); e.thrown = false;
      }
      return;
    } else if (e.dead) { return; }
    else {
      e.yaw = Math.atan2(nx, nz);
      want = aiBrain(e, dt, dist, nx, nz, hp);
    }
    if (want && b.fixedRotation) {
      // separation
      for (const o of G.enemies) {
        if (o === e || o.dead) continue;
        const ox = b.position.x - o.body.position.x, oz = b.position.z - o.body.position.z; const d = Math.hypot(ox, oz);
        const R = 1.3 * (s + o.def.scale) / 2;
        if (d < R && d > 0.01) { want[0] += ox / d * (R - d) * 3; want[1] += oz / d * (R - d) * 3; }
      }
      // unstick
      const wsp = Math.hypot(want[0], want[1]), asp = Math.hypot(b.velocity.x, b.velocity.z);
      if (wsp > 1.2 && asp < 0.4) e.stuckT += dt; else e.stuckT = Math.max(0, e.stuckT - dt);
      if (e.stuckT > 0.6) { e.sideSteer = (Math.random() < 0.5 ? -1 : 1) * 1.1; e.stuckT = 0; }
      if (e.sideSteer) {
        const sg = Math.sign(e.sideSteer), c = Math.cos(1.2 * sg), sn = Math.sin(1.2 * sg);
        const wx = want[0] * c - want[1] * sn, wz = want[0] * sn + want[1] * c; want[0] = wx; want[1] = wz;
        e.sideSteer -= dt * sg; if (Math.abs(e.sideSteer) < 0.05) e.sideSteer = 0;
      }
      const acc = damp(e.state === 'charge' ? 20 : 9, dt);
      b.velocity.x += (want[0] - b.velocity.x) * acc;
      b.velocity.z += (want[1] - b.velocity.z) * acc;
    }
  }
}
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

function aiBrain(e, dt, dist, nx, nz, hp) {
  const b = e.body, sp = e.def.speed;
  const T = e.type;
  if (T === 'counter') {
    if (e.state === 'move') {
      if (dist < 1.6 && e.atkCD <= 0) { e.state = 'windup'; e.stateT = 0; sfx.windup(); return [0, 0]; }
      return [nx * sp, nz * sp];
    }
    if (e.state === 'windup') {
      if (e.stateT > 0.42) {
        e.state = 'strike'; e.stateT = 0;
        if (dist < 2.0) hurtHero(9, b.position, 7);
        FX.sparks(_v2.set(b.position.x + nx * 0.9, 1.2, b.position.z + nz * 0.9), 8, 4, [1, 0.6, 0.2]);
      }
      return [nx * 0.8, nz * 0.8];
    }
    if (e.state === 'strike') { if (e.stateT > 0.45) { e.state = 'move'; e.atkCD = rand(1.0, 1.6); } return [0, 0]; }
  }
  if (T === 'marksman' || T === 'lobber') {
    const near = T === 'marksman' ? 7.5 : 7, far = T === 'marksman' ? 12.5 : 13.5;
    if (e.state === 'move') {
      if (e.stateT > 2.4) { e.strafe *= -1; e.stateT = 0; }
      let wx, wz;
      if (dist > far) { wx = nx * sp; wz = nz * sp; }
      else if (dist < near) { wx = -nx * sp; wz = -nz * sp; }
      else { wx = -nz * e.strafe * sp * 0.55; wz = nx * e.strafe * sp * 0.55; }
      if (e.atkCD <= 0 && dist < 18 && dist > 3) {
        if (T === 'marksman') { e.state = 'aim'; e.stateT = 0; e.atkCD = rand(2.5, 3.4); }
        else { e.state = 'throw'; e.stateT = 0; e.atkCD = rand(3.8, 4.8); }
      }
      return [wx, wz];
    }
    if (e.state === 'aim') {
      // telegraph laser
      const L = e.laser; const from = gunPos(e);
      const to = _v3.set(hp.x, 1.05, hp.z);
      const len = from.distanceTo(to);
      L.position.copy(from).lerp(to, 0.5); L.lookAt(to); L.scale.set(1, 1, len);
      L.material.opacity = (0.25 + e.stateT * 0.9) * (Math.sin(G.rt * 40) > -0.3 ? 1 : 0.4);
      if (e.stateT > 0.8) { L.material.opacity = 0; e.state = 'burst'; e.stateT = 0; e.shots = 0; }
      return [0, 0];
    }
    if (e.state === 'burst') {
      if (e.stateT > e.shots * 0.13 && e.shots < 3) {
        const from = gunPos(e);
        const lead = hero.body.velocity;
        const tgt = new THREE.Vector3(hp.x + lead.x * 0.22 + rand(-0.25, 0.25), 1.15, hp.z + lead.z * 0.22 + rand(-0.25, 0.25));
        spawnBolt(from.clone(), tgt.sub(from).normalize());
        FX.sparks(from, 5, 3, [1, 0.7, 0.2], 0.08); FX.flash(from, 0xffb050, 6);
        e.shots++;
      }
      if (e.shots >= 3 && e.stateT > 0.45) { e.state = 'recover'; e.stateT = 0; }
      return [0, 0];
    }
    if (e.state === 'throw') {
      if (e.stateT > 0.55) {
        const from = _v2.set(b.position.x + nx * 0.3, b.position.y + 1.0, b.position.z + nz * 0.3).clone();
        const hv = hero.body.velocity;
        const tgt = new THREE.Vector3(hp.x + hv.x * 0.6 + rand(-0.8, 0.8), 0.2, hp.z + hv.z * 0.6 + rand(-0.8, 0.8));
        spawnGrenade(from, tgt, clamp(dist / 11, 0.8, 1.25));
        sfx.toss();
        e.state = 'recover'; e.stateT = 0;
      }
      return [0, 0];
    }
    if (e.state === 'recover') { if (e.stateT > 0.5) { e.state = 'move'; e.stateT = 0; } return [0, 0]; }
  }
  if (T === 'auditor') {
    if (e.chargeCD === undefined) e.chargeCD = 4;
    if (e.state === 'move') {
      if (dist < 3.4 && e.atkCD <= 0) {
        e.state = 'slamWind'; e.stateT = 0; e.atkCD = 2.6; sfx.windup();
        e.slamRing = FX.rings.spawn(b.position.x, 0.07, b.position.z, 4.2, 4.2, 1.0, 0xff3030, 0.9, b.position);
        return [0, 0];
      }
      if (dist > 6.5 && e.chargeCD <= 0) { e.state = 'chargeWind'; e.stateT = 0; sfx.windup(); return [0, 0]; }
      return [nx * e.def.speed, nz * e.def.speed];
    }
    if (e.state === 'slamWind') {
      if (e.stateT > 0.95) {
        e.state = 'slam'; e.stateT = 0; e.slamRing = null;
        sfx.slam(); addTrauma(0.55);
        FX.dust(b.position, 18, 5, 1.4); FX.rings.spawn(b.position.x, 0.08, b.position.z, 0.5, 4.6, 0.4, 0xff7050, 1);
        if (dist < 4.3) hurtHero(24, b.position, 12);
        for (const o of G.props) { const op = o.body.position; const d = Math.hypot(op.x - b.position.x, op.z - b.position.z); if (d < 5 && !o.held) { o.body.velocity.y += 6 * (1 - d / 5) * clamp(60 / o.mass, 0.2, 1); o.body.wakeUp(); } }
      }
      return [0, 0];
    }
    if (e.state === 'slam') { if (e.stateT > 0.7) { e.state = 'move'; e.stateT = 0; } return [0, 0]; }
    if (e.state === 'chargeWind') {
      if (e.stateT > 0.7) { e.state = 'charge'; e.stateT = 0; e.charge = { x: nx, z: nz }; e.chargeCD = 7; }
      return [0, 0];
    }
    if (e.state === 'charge') {
      const c = e.charge;
      if (c) {
        e.yaw = Math.atan2(c.x, c.z);
        if (Math.random() < 0.6) FX.dust(b.position, 1, 1.5, 0.8);
        if (dist < 1.7 && !e.chargeHit) { e.chargeHit = true; hurtHero(20, b.position, 14); }
        const asp = Math.hypot(b.velocity.x, b.velocity.z);
        if (e.stateT > 0.35 && asp < 4) { // slammed into something heavy
          e.state = 'stunned'; e.stun = 1.8; e.stateT = 0; e.charge = null; sfx.slam(); addTrauma(0.4);
          num(_v2.set(b.position.x, 3, b.position.z), 'STUNNED', 'psi', 1); FX.sparks(_v2.set(b.position.x + c.x, 1.6, b.position.z + c.z), 20, 6);
          return [0, 0];
        }
        if (e.stateT > 1.4) { e.state = 'move'; e.stateT = 0; e.charge = null; e.chargeHit = false; }
        return [c.x * 11, c.z * 11];
      }
    }
    if (e.state === 'stunned') {
      if (Math.random() < 0.3) FX.add.emit(b.position.x + rand(-0.5, 0.5), 3.2, b.position.z + rand(-0.5, 0.5), 0, 1, 0, 2, 2, 0.5, 0.4, 0.15, 0.05);
      if (e.stun <= 0) { e.state = 'move'; e.stateT = 0; e.chargeHit = false; }
      return [0, 0];
    }
  }
  return [0, 0];
}
function gunPos(e) {
  if (e.gear && e.gear.rifle) { const r = e.gear.rifle; r.updateMatrixWorld(); return new THREE.Vector3(0, 0, 0.42).applyMatrix4(r.matrixWorld); }
  const b = e.body;
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  return new THREE.Vector3(b.position.x + fx * 0.75 + fz * 0.25, b.position.y + 0.55, b.position.z + fz * 0.75 - fx * 0.25);
}

// ======================= SURGE & UNDERTOW =======================
function doSurge() {
  if (G.mode !== 'play' || hero.dead || G.ultState || G.surge) return;
  const hp = heroCenter();
  if (G.surgeCD > 0) return;
  if (hero.focus < 20) { num(_v2.set(hp.x, hp.y + 1.6, hp.z), 'NO FOCUS', 'psi', 0.8); return; }
  hero.focus -= 20; hero.focusDelay = 0.6; G.surgeCD = 3.2;
  // a beat of anticipation: light drains inward to her chest
  G.surge = { t: 0, fired: false };
  G.slowT = 0.14; G.slowScale = 0.45;
  Powers.halos.spawn(_v2.set(hp.x, hp.y + 0.45, hp.z), 4.5, 0.7, 0.16, new THREE.Color(1.6, 1.1, 3.2), 1.3, { follow: hero.body.position, yOff: 0.45, ease: 'in' });
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = rand(2.5, 4.5); FX.add.emit(hp.x + Math.cos(a) * r, hp.y + rand(-0.6, 1.2), hp.z + Math.sin(a) * r, -Math.cos(a) * r * 6, 0, -Math.sin(a) * r * 6, 0.7, 0.5, 1.8, 0.16, 0.22, 0.06, 0, 0); }
  sfx.surgeCharge();
  hero.surgePose = 0;
}
function updateSurge(rdt) {
  const S = G.surge; if (!S) return;
  S.t += rdt;
  if (!S.fired && S.t > 0.14) { S.fired = true; S.t0 = S.t; surgeRelease(S); }
  if (S.fired) {
    const age = S.t - S.t0;
    for (const h of S.hits) if (!h.done && age >= h.at) { h.done = true; h.fn(); }
    if (age > 1.6 && S.hits.every(h => h.done)) G.surge = null;
  }
}
// spike eruption + shatter feedback (shared by Surge and Undertow)
let lastCrunch = 0, lastShatter = 0;
function wireSpikes() {
  Powers.spikes.onErupt = (it) => {
    const p = it.pos;
    for (let k = 0; k < 4; k++) FX.smoke.emit(p.x, 0.1, p.z, rand(-2.5, 2.5), rand(3, 7), rand(-2.5, 2.5), 0.07, 0.07, 0.08, rand(0.5, 0.9), rand(0.06, 0.12), 0.05, 20, 0.3, 1);
    for (let k = 0; k < 3; k++) FX.add.emit(p.x, 0.2, p.z, rand(-2, 2), rand(2, 5), rand(-2, 2), 1.0, 0.7, 2.2, rand(0.2, 0.4), 0.14, 0.02, 10, 0.5, 1);
    if (G.rt - lastCrunch > 0.045) { lastCrunch = G.rt; sfx.crunch(); }
  };
  Powers.spikes.onShatter = (it) => {
    const p = it.pos, top = it.h * 0.6;
    for (let k = 0; k < 7; k++) FX.add.emit(p.x + rand(-0.15, 0.15), rand(0.2, top), p.z + rand(-0.15, 0.15), rand(-3, 3), rand(1, 4), rand(-3, 3), 0.9, 0.65, 2.3, rand(0.35, 0.7), rand(0.08, 0.16), 0.02, 14, 0.8, 1);
    if (G.rt - lastShatter > 0.06) { lastShatter = G.rt; sfx.shatter(); }
  };
}
function eruption(center, scale, opts = {}) {
  const R = 6.6 * scale;
  const rings = [];
  const nR = Math.round(5 * Math.sqrt(scale));
  for (let i = 0; i < nR; i++) {
    const r = R * (0.2 + 0.8 * (i / (nR - 1)));
    rings.push({ r, n: Math.round(8 + r * 2.6), h: (1.1 + Math.sin((i / (nR - 1)) * Math.PI * 0.8) * 1.3) * Math.min(1.6, 0.8 + scale * 0.25), w: 0.16 + (i / nR) * 0.12 });
  }
  Powers.spikes.burst(center, rings, opts.speed || 17, opts.hold || 0.32);
  Powers.fissures.spawn(center, R * 1.12, opts.fissureLife || 1.6, new THREE.Color(0.75, 0.5, 1.6));
  Powers.walls.spawn(center, R * 1.08, 1.5 * Math.min(1.6, scale), R / (opts.speed || 17) + 0.3);
  Powers.beams.spawn(center, 0.9 * Math.min(2, scale), 12 * Math.min(2, scale), 0.45, new THREE.Color(1.2, 0.9, 2.4));
  Powers.shocks.spawn(center, R * 1.1, R / (opts.speed || 17) + 0.25, new THREE.Color(0.75, 0.6, 1.5), 0.7);
  return R;
}
function surgeRelease(S) {
  const hp = heroCenter();
  const chest = new THREE.Vector3(hp.x, hp.y + 0.45, hp.z);
  sfx.surge(); addTrauma(0.65); hitStop(0.06); screenFlash(0.04);
  G.bloomKick = 0.6; camState.punch = 1; hero.surgePose = 1;
  // the lamp-style halo, in her violet
  Powers.halos.spawn(chest, 0.8, 6.5, 0.45, new THREE.Color(1.1, 0.75, 2.4), 0.9, { hold: 0.05 });
  Powers.halos.spawn(chest, 0.4, 2.4, 0.26, new THREE.Color(2.0, 1.8, 2.8), 1.1);
  Powers.halos.spawn(chest, 2.0, 4.0, 1.0, new THREE.Color(0.8, 0.5, 1.8), 0.5, { follow: hero.body.position, yOff: 0.45 });
  Shock.fire(chest, 0.55, 0.5, 0.035);
  FX.flash(hp, 0xa58cff, 70);
  const speed = 17;
  const R = eruption(hp, 1, { speed });
  // spray kicked up by the wave front
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2 + rand(-0.03, 0.03), sp = rand(10, 16);
    FX.add.emit(hp.x + Math.cos(a) * 0.5, 0.08, hp.z + Math.sin(a) * 0.5, Math.cos(a) * sp, rand(2, 6), Math.sin(a) * sp, 0.55, 0.62, 0.9, rand(0.35, 0.7), rand(0.07, 0.13), 0.03, 16, 1.2, 0.85);
  }
  // each enemy is struck when the spike wave reaches them: launched skyward, arcs crackle to them
  S.hits = [];
  for (const e of [...G.enemies]) {
    if (e.dead || !e.alive || e.held) continue;
    const ep = e.body.position; const d = Math.hypot(ep.x - hp.x, ep.z - hp.z); if (d > R + 0.4) continue;
    const dir = new THREE.Vector3(ep.x - hp.x, 0, ep.z - hp.z).normalize();
    const f = 1 - Math.min(1, d / R);
    S.hits.push({ at: d / speed, done: false, fn: () => {
      if (e.dead || !e.alive) return;
      arc(new THREE.Vector3(ep.x, ep.y, ep.z), 0.3, ep, 0.09);
      FX.sparks(_v2.set(ep.x, ep.y + 0.3, ep.z), 16, 7, [0.85, 0.65, 1.0]);
      Powers.halos.spawn(_v2.set(ep.x, ep.y + 0.3, ep.z), 0.4, 2.2, 0.3, new THREE.Color(1.4, 1.0, 2.6), 0.7);
      setEnemyGlow(e, 0.9);
      if (e.type === 'auditor') { damageEnemy(e, 22, dir, 0, 'surge'); e.body.velocity.x += dir.x * 4; e.body.velocity.z += dir.z * 4; e.body.velocity.y += 3; return; }
      damageEnemy(e, Math.round(14 + 14 * f), dir, 0, 'surge');
      if (e.dead || e.state !== 'ragdoll') { setRagdoll(e, true); e.state = 'ragdoll'; e.downT = 0; cancelAttack(e); }
      e.body.velocity.set(dir.x * (5 + 5 * f), 9 + 5 * f, dir.z * (5 + 5 * f));
      e.body.angularVelocity.set(dir.z * 7 + rand(-3, 3), rand(-4, 4), -dir.x * 7 + rand(-3, 3));
      e.thrown = true; e.thrownT = 0;
    } });
  }
  for (const o of [...G.props, ...G.grenades]) {
    if (o.held) continue;
    const op = o.body.position; const d = Math.hypot(op.x - hp.x, op.z - hp.z); if (d > R) continue;
    const f = 1 - d / R;
    S.hits.push({ at: d / speed, done: false, fn: () => {
      if (!o.alive) return;
      const k = 16 * f * clamp(45 / o.mass, 0.15, 1.2);
      _v1.set(op.x - hp.x, 0, op.z - hp.z).normalize();
      o.body.velocity.x += _v1.x * k; o.body.velocity.z += _v1.z * k; o.body.velocity.y += 5 + k * 0.5; o.body.wakeUp();
      o.body.angularVelocity.set(rand(-7, 7) * f, rand(-7, 7) * f, rand(-7, 7) * f);
      o.thrown = true; o.thrownT = 0; o.dropped = false; o.body.collisionFilterGroup = GRP.HELD; o.body.collisionFilterMask = NO_HERO;
      if (o.kind === 'grenade') o.byHero = true;
    } });
  }
  for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, r = rand(2.5, 5.5); arc(new THREE.Vector3(hp.x + Math.cos(a) * r, rand(0.2, 1.5), hp.z + Math.sin(a) * r), 0.22); }
}

function startUlt() {
  if (G.mode !== 'play' || hero.dead || G.ultState || G.ult < 100) return;
  G.ult = 0;
  for (const h of [...G.holds.values()]) { endHold(h); dropObj(h.obj); }
  for (const [id, p] of input.pointers) if (p.role === 'grab') input.pointers.delete(id);
  G.ultState = { phase: 'inhale', t: 0, caught: [] };
  G.slowT = 0.55; G.slowScale = 0.3;
  const hpU = heroCenter();
  Powers.halos.spawn(_v2.set(hpU.x, hpU.y + 0.9, hpU.z), 9, 1.4, 0.7, new THREE.Color(1.3, 0.9, 2.8), 1.1, { follow: hero.body.position, yOff: 0.9, ease: 'in' });
  Powers.shocks.spawn(hpU, 9, 0.7, new THREE.Color(0.7, 0.5, 1.5), 0.6);
  banner('HOLD YOUR BREATH.', '', 1.4);
  sfx.inhale();
}
function updateUlt(rdt, dt) {
  const U = G.ultState; if (!U) { hero.levitate += (0 - hero.levitate) * damp(4, rdt); return; }
  U.t += rdt;
  const hp = heroCenter();
  hero.levitate += (1 - hero.levitate) * damp(5, rdt);
  if (U.phase === 'inhale') {
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = rand(6, 14); FX.add.emit(hp.x + Math.cos(a) * r, rand(0.2, 3), hp.z + Math.sin(a) * r, -Math.cos(a) * r * 1.6, 0.5, -Math.sin(a) * r * 1.6, 0.6, 0.45, 1.7, 0.6, 0.35, 0.05, 0, 0); }
    if (U.t > 0.7) {
      U.phase = 'vortex'; U.t = 0; sfx.vortex();
      // her own halo while the tide turns around her
      Powers.halos.spawn(hp, 2.2, 4.6, 2.15, new THREE.Color(1.0, 0.65, 2.2), 0.8, { follow: hero.body.position, yOff: 1.4, hold: 0.85, pulse: 1 });
      Powers.halos.spawn(hp, 0.7, 1.5, 2.15, new THREE.Color(1.8, 1.6, 2.6), 0.9, { follow: hero.body.position, yOff: 1.4, hold: 0.85, pulse: 1 });
      G.bloomKick = 0.5;
      const R = 18;
      const cand = [...G.props, ...G.grenades, ...G.enemies];
      let i = 0;
      for (const o of cand) {
        if (!o.alive || o.inWater || (o.kind === 'enemy' && (o.state === 'spawn' || o.fade < 1))) continue;
        const p = o.body.position; const d = Math.hypot(p.x - hp.x, p.z - hp.z); if (d > R) continue;
        const heavyAud = o.kind === 'enemy' && o.type === 'auditor';
        o.vortex = { ang: Math.atan2(p.z - hp.z, p.x - hp.x), r: d, rT: heavyAud ? 5.5 : clamp(2.6 + Math.sqrt(o.mass) * 0.22 + (i % 3) * 0.5, 2.6, 7), y: 1.2 + (i % 4) * 0.7 + (o.kind === 'enemy' ? 0.5 : 0), w: rand(2.8, 3.8), heavy: heavyAud };
        o.thrown = false; o.antiGrav = 0;
        o.body.collisionFilterGroup = GRP.HELD; o.body.collisionFilterMask = NO_HERO; o.body.wakeUp();
        if (o.kind === 'enemy' && !heavyAud) { cancelAttack(o); setRagdoll(o, true); o.state = 'gripped'; }
        if (o.kind === 'grenade') o.byHero = true;
        U.caught.push(o); i++;
      }
    }
  } else if (U.phase === 'vortex') {
    const k = Math.min(1, U.t / 0.6);
    for (const o of U.caught) {
      if (!o.alive || !o.vortex) continue;
      const V = o.vortex, b = o.body;
      if (V.heavy) { // the Auditor resists: dragged, not lifted
        const dx = hp.x - b.position.x, dz = hp.z - b.position.z; const d = Math.hypot(dx, dz);
        if (d > 3) { b.velocity.x += (dx / d * 4 - b.velocity.x) * 0.1; b.velocity.z += (dz / d * 4 - b.velocity.z) * 0.1; }
        continue;
      }
      V.ang += V.w * rdt * (0.6 + k * 0.6);
      V.r += (V.rT - V.r) * damp(2.2, rdt);
      const ty = V.y + U.t * 0.6;
      const tx = hp.x + Math.cos(V.ang) * V.r, tz = hp.z + Math.sin(V.ang) * V.r;
      const kk = 9, maxV = 34;
      let vx = (tx - b.position.x) * kk, vy = (ty - b.position.y) * kk, vz = (tz - b.position.z) * kk;
      const s = Math.hypot(vx, vy, vz); if (s > maxV) { vx *= maxV / s; vy *= maxV / s; vz *= maxV / s; }
      b.velocity.x += (vx - b.velocity.x) * 0.3; b.velocity.y += (vy - b.velocity.y) * 0.3; b.velocity.z += (vz - b.velocity.z) * 0.3;
      b.angularVelocity.x += rand(-0.6, 0.6); b.angularVelocity.z += rand(-0.6, 0.6);
      if (o.kind === 'prop') setGlow(o, 0.14);
      if (o.kind === 'enemy' && !o.dead) { setEnemyGlow(o, 0.5); o.tickAcc = (o.tickAcc || 0) + 9 * dt; if (o.tickAcc > 6) { damageEnemy(o, 6, null, 0, 'tick'); o.tickAcc = 0; } }
    }
    // swirl particles
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.28, r = rand(1.5, 7.5);
      FX.add.emit(hp.x + Math.cos(a) * r, rand(0.3, 4.5), hp.z + Math.sin(a) * r, -Math.sin(a) * 9, rand(0.5, 2), Math.cos(a) * 9, 0.55, 0.4, 1.6, 0.5, 0.3, 0.05, 0, 0.5);
    }
    addTrauma(0.02);
    if (Math.random() < 0.35 && U.caught.length) { const o = U.caught[Math.floor(Math.random() * U.caught.length)]; if (o.alive) arc(new THREE.Vector3(), 0.12, o.body.position, 0.06); }
    G.bloomKick = Math.max(G.bloomKick, 0.35);
    if (U.t > 2.1) {
      U.phase = 'release'; U.t = 0;
      sfx.release(); addTrauma(1); hitStop(0.09); screenFlash(0.18);
      
      FX.flash(hp, 0x9b7bff, 110);
      const ch = new THREE.Vector3(hp.x, hp.y + 1.2, hp.z);
      Powers.halos.spawn(ch, 1.5, 13, 0.85, new THREE.Color(1.1, 0.75, 2.4), 1.0, { hold: 0.06 });
      Powers.halos.spawn(ch, 0.8, 5, 0.45, new THREE.Color(2.0, 1.8, 2.8), 1.2);
      Powers.domes.spawn(hp, 1.0, 15, 0.8, new THREE.Color(0.7, 0.5, 1.4), 0.9);
      eruption(hp, 2.0, { speed: 26, hold: 0.45, fissureLife: 2.2 });
      Shock.fire(ch, 0.9, 0.95, 0.06);
      G.bloomKick = 0.8; camState.punch = 1.4;
      for (let i = 0; i < 240; i++) { const a = (i / 240) * Math.PI * 2, sp = rand(12, 22); FX.add.emit(hp.x + Math.cos(a) * 0.8, 0.08, hp.z + Math.sin(a) * 0.8, Math.cos(a) * sp, rand(2, 7), Math.sin(a) * sp, 0.62, 0.7, 0.95, rand(0.4, 0.8), rand(0.08, 0.16), 0.03, 16, 1, 0.9); }
      for (const e of G.enemies) if (!e.dead) arc(new THREE.Vector3(), 0.4, e.body.position, 0.1);
      for (let i = 0; i < 140; i++) { const a = Math.random() * 6.28, s = rand(10, 30); FX.add.emit(hp.x, rand(0.5, 3), hp.z, Math.cos(a) * s, rand(-1, 4), Math.sin(a) * s, 0.7, 0.5, 1.9, rand(0.4, 0.9), rand(0.3, 0.6), 0.05, 0, 2); }
      for (const o of U.caught) {
        if (!o.alive) continue;
        const b = o.body; const V = o.vortex; o.vortex = null;
        const dx = b.position.x - hp.x, dz = b.position.z - hp.z; const d = Math.hypot(dx, dz) || 1;
        const rx = dx / d, rz = dz / d;
        if (V && V.heavy) { damageEnemy(o, 90, new THREE.Vector3(rx, 0, rz), 0, 'ult'); o.stun = 1.5; if (!o.dead) { o.state = 'stunned'; o.stateT = 0; } restoreGroup(o); continue; }
        const v = rand(26, 34) * (o.kind === 'enemy' ? 0.8 : clamp(1.2 - o.mass / 500, 0.55, 1.1));
        b.velocity.set(rx * v - rz * 6, rand(1, 4), rz * v + rx * 6);
        o.thrown = true; o.thrownT = 0; o.antiGrav = 0.45; o.dropped = false;
        if (o.kind === 'enemy') { o.state = 'ragdoll'; o.downT = 0; o.thrown = true; if (!o.dead) damageEnemy(o, 42, new THREE.Vector3(rx, 0, rz), 0, 'ult'); }
      }
    }
  } else if (U.phase === 'release') {
    if (U.t > 0.6) { G.ultState = null; G.ultLock = G.t + 2.5; }
  }
}

// ======================= waves & flow =======================
const WAVES = [
  { name: 'WAVE 1', sub: 'THE CENSUS IS COUNTING', list: ['counter', 'counter', 'counter', 'counter'] },
  { name: 'WAVE 2', sub: 'MARKSMEN — HOLD SOMETHING UP TO BLOCK', list: ['counter', 'marksman', 'counter', 'marksman', 'counter'] },
  { name: 'WAVE 3', sub: 'LOBBERS — CATCH THE GRENADES', list: ['lobber', 'counter', 'counter', 'lobber', 'marksman'] },
  { name: 'WAVE 4', sub: 'THEY BROUGHT FRIENDS', list: ['counter', 'marksman', 'counter', 'lobber', 'marksman', 'counter', 'counter'] },
  { name: 'THE AUDITOR', sub: 'HEAVY. USE HEAVY THINGS. MAKE IT CHARGE INTO A CAR.', list: ['auditor', 'counter', 'lobber', 'counter', 'marksman'] },
];
const SPAWNS = [[-4, -23.5], [4, -23.5], [0, -21], [-11.6, -16.5], [11.6, -12], [-11.6, -2.5], [11.6, 2], [-11.6, 12], [11.6, 15], [-3, 21.5], [3, 21.5]];
let spawnTimer = 0, breakT = 0;
const colGeo = new THREE.CylinderGeometry(0.7, 0.7, 14, 20, 1, true);
const columns = [];
function spawnColumn(x, z) {
  const m = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.9, 2.4), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(x, 7, z); scene.add(m); columns.push({ m, t: 0 });
  FX.rings.spawn(x, 0.08, z, 0.2, 2.2, 0.6, 0xe8f0ff, 1);
}
function updateColumns(dt) {
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i]; c.t += dt;
    c.m.scale.set(1 - c.t * 1.4, 1, 1 - c.t * 1.4); c.m.material.opacity = 0.8 * (1 - c.t / 0.7);
    if (c.t > 0.7) { scene.remove(c.m); columns.splice(i, 1); }
  }
}
function pickSpawn(type) {
  const hp = heroCenter();
  let opts = SPAWNS.filter(([x, z]) => Math.hypot(x - hp.x, z - hp.z) > (type === 'auditor' ? 12 : 9));
  if (G.wave === 0) { const north = opts.filter(([x, z]) => z < -10); if (north.length) opts = north; }
  const pool = opts.length ? opts : SPAWNS;
  if (type === 'auditor') { // dramatic: from the market end
    const s = pool.find(p => p[1] < -20) || pool[0]; return s;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
function startWave(i) {
  G.wave = i; G.waveQueue = [...WAVES[i].list]; spawnTimer = 0.4;
  banner(WAVES[i].name, WAVES[i].sub, 2.4);
  ui.wave.textContent = i === WAVES.length - 1 ? 'FINAL WAVE' : `WAVE ${i + 1}/${WAVES.length}`;
}
function updateWaves(dt) {
  if (G.mode === 'play') {
    if (G.waveQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const t = G.waveQueue.shift(); const [x, z] = pickSpawn(t);
        const e = spawnEnemy(t, x + rand(-0.6, 0.6), z + rand(-0.6, 0.6)); attach(e);
        spawnColumn(e.body.position.x, e.body.position.z); sfx.spawn();
        spawnTimer = t === 'auditor' ? 1.6 : 0.65;
      }
    }
    const alive = G.enemies.filter(e => !e.dead).length;
    ui.left.textContent = `${alive + G.waveQueue.length} CENSUS LEFT`;
    if (!G.waveQueue.length && alive === 0 && G.enemies.length === 0) {
      if (G.wave >= WAVES.length - 1) win();
      else { G.mode = 'break'; breakT = 2.2; banner('CLEAR', 'BREATHE OUT.', 1.6); hero.hp = Math.min(hero.maxHp, hero.hp + 25); resupply(); }
    }
  } else if (G.mode === 'break') {
    breakT -= dt;
    if (breakT <= 0) { G.mode = 'play'; startWave(G.wave + 1); }
  }
}

// harbor crews leave more junk on the street between waves
function resupply() {
  const hp = heroCenter();
  const spots = [[-4.2, -17.4], [5.2, 4.2], [4.5, 18.6], [7.4, -20.5], [-6.5, 17.2], [6.2, -14.2], [-1.8, -3.2], [-8.6, -12], [8.4, 6.5]];
  const cnt = (t) => G.props.filter(o => o.type === t).length;
  const want = [['barrel', 3 - cnt('barrel')], ['crate', 3 - cnt('crate')], ['trash', 6 - cnt('trash') - cnt('trashR')], ['bag', 4 - cnt('bag')], ['drum', 2 - cnt('drum')]];
  for (const [type, n] of want) for (let i = 0; i < n; i++) {
    const free = spots.filter(([x, z]) => Math.hypot(x - hp.x, z - hp.z) > 4 && !G.props.some(o => Math.hypot(o.body.position.x - x, o.body.position.z - z) < 1.2));
    if (!free.length) return;
    const [x, z] = free[Math.floor(Math.random() * free.length)];
    addProp(type, x + rand(-0.3, 0.3), z + rand(-0.3, 0.3), rand(0, 6), 1.8 + Math.random() * 0.5);
    FX.rings.spawn(x, 0.06, z, 0.2, 1.6, 0.6, 0x9b7bff, 0.7);
  }
}

function heroDown() {
  hero.dead = true; hero.hp = 0; G.mode = 'dead';
  G.slowT = 1.5; G.slowScale = 0.25;
  for (const h of [...G.holds.values()]) { endHold(h); dropObj(h.obj); }
  const run = G.runId; setTimeout(() => { if (G.runId === run && G.mode === 'dead') showEnd(false); }, 1400);
}
function win() {
  G.mode = 'win'; sfx.win();
  banner('BLOCK CLEARED', 'THE CENSUS LOST COUNT', 3);
  const run = G.runId; setTimeout(() => { if (G.runId === run && G.mode === 'win') showEnd(true); }, 1800);
}
function showEnd(won) {
  $('endtitle').textContent = won ? 'BLOCK CLEARED' : 'IRIS IS DOWN';
  $('endquote').textContent = won ? '"Breathe out."' : '"Not like this. Not again."';
  const s = G.stats; const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
  $('endstats').innerHTML = [
    [s.kills, 'CENSUS DOWN'], [s.throws, 'THROWS'], [s.maxCombo, 'BEST COMBO'], [s.catches, 'GRENADES CAUGHT'], [s.blocks, 'SHOTS BLOCKED'], [`${m}:${String(sec).padStart(2, '0')}`, 'TIME'],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  $('end').classList.remove('hidden');
}

function resetGame() {
  for (const e of [...G.enemies]) removeEnemy(e);
  for (const g of [...G.grenades]) removeGrenade(g);
  for (const B of G.bolts) scene.remove(B.m); G.bolts.length = 0;
  G.holds.clear(); input.pointers.clear();
  resetProps();
  hero.hp = hero.maxHp; hero.focus = hero.maxFocus; hero.dead = false; hero.levitate = 0; hero.invuln = 0;
  hero.body.position.set(0, 0.85, 12); hero.body.velocity.set(0, 0, 0);
  G.ult = 0; G.ultState = null; G.combo = 0; G.surgeCD = 0; G.trauma = 0;
  G.stats = { throws: 0, hits: 0, kills: 0, maxCombo: 0, time: 0, blocks: 0, catches: 0 };
  camState.init = false;
}

// ======================= camera =======================
const camState = { look: new THREE.Vector3(0, 0, 8), init: false, dist: 20, orbit: 0 };
function updateCamera(rdt) {
  const hp = heroCenter();
  const aspect = G.W / G.H;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const pitch = THREE.MathUtils.degToRad(aspect < 1 ? 51 : 48);
  let dist = aspect < 1 ? clamp(5.5 / (Math.tan(fov / 2) * aspect), 11, 21) : 14;
  if (G.ultState) dist *= G.ultState.phase === 'vortex' ? 1.18 : 1.1;
  if (G.closeup) {
    const hp2 = heroCenter(); const c = G.closeup; const a = hero.yaw + c.yawOff;
    camera.position.set(hp2.x + Math.sin(a) * c.dist, c.h + 0.3, hp2.z + Math.cos(a) * c.dist);
    camera.lookAt(hp2.x, c.h, hp2.z); return;
  }
  if (G.mode === 'title') {
    camState.orbit += rdt * 0.08;
    const tx = Math.sin(camState.orbit) * 3, tz = -6 + Math.cos(camState.orbit * 0.7) * 3;
    camState.look.set(tx, 1.5, tz);
    camera.position.set(tx + Math.sin(camState.orbit * 0.5) * 6, 8.5, tz + 20);
    camera.lookAt(camState.look);
    return;
  }
  const v = hero.body.velocity;
  const tgt = _v1.set(clamp(hp.x + v.x * 0.18, -7.5, 7.5), 0, clamp(hp.z - 2.0 + v.z * 0.18, -21, 18));
  if (!camState.init) { camState.look.copy(tgt); camState.dist = dist + 14; camState.init = true; }
  camState.look.lerp(tgt, damp(5, rdt));
  camState.dist += (dist - camState.dist) * damp(G.mode === 'intro' ? 2.2 : 4, rdt);
  camState.punch = Math.max(0, (camState.punch || 0) - rdt * 3.5);
  const d = camState.dist * (1 - Math.sin(Math.min(1, camState.punch) * Math.PI) * 0.06);
  camera.position.set(camState.look.x, camState.look.y + Math.sin(pitch) * d, camState.look.z + Math.cos(pitch) * d);
  camera.lookAt(camState.look);
  // trauma shake
  const tr = G.trauma * G.trauma;
  if (tr > 0.0005) {
    const t = G.rt * 38;
    camera.position.x += (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5) * tr * 0.55;
    camera.position.y += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * 0.5) * tr * 0.45;
    camera.rotation.z += Math.sin(t * 0.9 + 2) * tr * 0.03;
  }
  G.trauma = Math.max(0, G.trauma - rdt * 1.5);
}

// ======================= UI =======================
const COMBO_NAMES = [[10, 'TSUNAMI'], [7, 'RIPTIDE'], [4, 'BREAKER'], [2, 'SWELL']];
const shieldEls = [...document.querySelectorAll('#shields .sh')].map(el => ({ el, label: el.querySelector('span'), fill: el.querySelector('i'), on: false }));
const _sb = new THREE.Vector3();
function updateShieldBars() {
  const holds = [...G.holds.values()];
  for (let i = 0; i < 2; i++) {
    const S = shieldEls[i], h = holds[i];
    const o = h && h.obj.kind === 'prop' ? h.obj : null;
    if (!o) { if (S.on) { S.el.style.display = 'none'; S.on = false; } continue; }
    if (!S.on) { S.el.style.display = 'block'; S.on = true; }
    const b = o.body.position;
    _sb.set(b.x, b.y + o.hh + 0.45, b.z).project(camera);
    const x = (_sb.x * 0.5 + 0.5) * G.W, y = (-_sb.y * 0.5 + 0.5) * G.H;
    S.el.style.transform = `translate(${x - 42}px,${y - 22}px)`;
    const f = clamp(o.hp / o.maxHp, 0, 1);
    S.fill.style.transform = `scaleX(${f})`;
    S.fill.style.background = f > 0.55 ? '#8dffb8' : f > 0.28 ? '#ffd166' : '#ff5b70';
    S.label.textContent = o.def.label + '  ' + Math.max(0, Math.ceil(o.hp));
  }
}
function updateUI(rdt) {
  updateShieldBars();
  ui.hp.style.transform = `scaleX(${clamp(hero.hp / hero.maxHp, 0, 1)})`;
  ui.focus.style.transform = `scaleX(${clamp(hero.focus / hero.maxFocus, 0, 1)})`;
  ui.focusbar.classList.toggle('low', hero.focus < 20);
  ui.ultRing.style.strokeDashoffset = String(238.8 * (1 - G.ult / 100));
  ui.ult.classList.toggle('ready', G.ult >= 100 && !G.ultState);
  ui.surge.classList.toggle('cd', G.surgeCD > 0 || hero.focus < 20);
  if (G.combo >= 2) {
    ui.combo.style.opacity = 1; ui.comboNum.textContent = 'x' + G.combo;
    ui.comboName.textContent = COMBO_NAMES.find(([n]) => G.combo >= n)[1];
  } else ui.combo.style.opacity = 0;
  flashA = Math.max(0, flashA - rdt * 2.5); ui.flash.style.opacity = flashA;
  const low = hero.hp < 30 ? 0.35 + Math.sin(G.rt * 6) * 0.15 : 0;
  hurtA = Math.max(low, hurtA - rdt * 1.8); ui.hurt.style.opacity = hurtA;
  ui.ultveil.style.opacity = G.ultState ? (G.ultState.phase === 'release' ? 0.3 : 1) : Math.max(0, parseFloat(ui.ultveil.style.opacity || 0) - rdt * 2);
  if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) ui.banner.classList.remove('show'); }
  // tutorial
  const T = G.tutorial;
  if (G.mode === 'play' || G.mode === 'break') {
    if (!T.grabbed) hint('Touch a trash can, car or barrel to <b>lift</b> it<small>Drag empty space to move</small>');
    else if (!T.thrown) hint('Now <b>flick</b> it toward the Census');
    else if (!T.hit && G.stats.throws < 4) hint('Flick in their direction — aim assist does the rest<small>Swing it through them while held, too</small>');
    else hint('');
  } else hint('');
}

// guide the first grab: pulse the nearest liftable thing
let guideT = 0;
function updateGuide(dt) {
  if (G.tutorial.grabbed || G.mode !== 'play') return;
  guideT -= dt; if (guideT > 0) return; guideT = 0.9;
  const hp = heroCenter(); let best = null, bd = 1e9;
  for (const o of G.props) { if (o.mass > 40) continue; const d = Math.hypot(o.body.position.x - hp.x, o.body.position.z - hp.z); if (d < bd) { bd = d; best = o; } }
  if (best) { const p = best.body.position; FX.rings.spawn(p.x, 0.06, p.z, 0.4, 1.8, 0.8, 0xb39bff, 1); FX.psi(_v2.set(p.x, p.y + 0.3, p.z), 6, 1.5, 0.25, 0.7); }
}

// ======================= hero movement & regen =======================
function updateHero(dt) {
  const [mx, my] = (G.mode === 'play' || G.mode === 'break') && !hero.dead ? moveVector() : [0, 0];
  const b = hero.body;
  let speed = TUNE.HERO_SPEED * (G.holds.size ? 0.82 : 1);
  if (G.ultState) speed = 0;
  // screen-up == world -Z (camera yaw fixed)
  const tvx = mx * speed, tvz = my * speed;
  hero.knockT = Math.max(0, (hero.knockT || 0) - dt);
  if (hero.knockT <= 0) {
    const a = damp(Math.hypot(mx, my) > 0.01 ? 14 : 18, dt);
    b.velocity.x += (tvx - b.velocity.x) * a; b.velocity.z += (tvz - b.velocity.z) * a;
  }
  if (G.ultState) { b.position.y += ((0.85 + 0.0) - b.position.y) * 0.1; b.velocity.y = Math.max(b.velocity.y, 0); }
  hero.invuln = Math.max(0, hero.invuln - dt);
  hero.focusDelay -= dt;
  if (hero.focusDelay <= 0 && !G.holds.size) hero.focus = Math.min(hero.maxFocus, hero.focus + TUNE.FOCUS_REGEN * dt);
  if (G.t - hero.lastHurt > 4 && !hero.dead) hero.hp = Math.min(hero.maxHp, hero.hp + 2.5 * dt);
  G.surgeCD = Math.max(0, G.surgeCD - dt);
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.mode === 'play') G.stats.time += dt;
}

// ======================= buttons / screens =======================
function bindBtn(el, fn) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); fn(); });
}
bindBtn(ui.surge, () => doSurge());
bindBtn(ui.ult, () => startUlt());
bindBtn($('pausebtn'), () => togglePause());
let muted = false;
function togglePause() {
  if (G.mode !== 'play' && G.mode !== 'break' && !G.paused) return;
  G.paused = !G.paused; $('pause').classList.toggle('hidden', !G.paused);
}
$('resumebtn').addEventListener('click', () => { sfx.ui(); togglePause(); });
$('restartbtn').addEventListener('click', () => { G.paused = false; $('pause').classList.add('hidden'); resetGame(); beginRun(); });
$('mutebtn').addEventListener('click', (e) => { muted = !muted; setMasterMuted(muted); e.target.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON'; });
$('againbtn').addEventListener('click', () => { sfx.ui(); $('end').classList.add('hidden'); resetGame(); beginRun(); });
$('startbtn').addEventListener('click', () => { initAudio(); sfx.ui(); $('title').classList.add('hidden'); beginRun(); });

function beginRun() {
  G.mode = 'intro'; camState.init = false;
  ui.top.style.display = 'flex'; ui.btns.style.display = 'flex';
  G.wave = -1;
  const run = (G.runId = (G.runId || 0) + 1);
  setTimeout(() => { if (G.runId !== run || G.mode !== 'intro') return; G.mode = 'play'; startWave(0); }, 1300);
  FX.rings.spawn(0, 0.1, 12, 0.3, 4, 0.8, 0x9b7bff, 1);
  hero.levitate = 1;
}

initInput(canvas, api);

// ======================= main loop =======================
let last = performance.now(), fpsAcc = 0, fpsN = 0, slowFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  const rdt = Math.min(0.05, rawDt); last = now;
  G.rt += rdt;
  // adaptive resolution
  fpsAcc += Math.min(rawDt, 0.5); fpsN++;
  if (fpsAcc > 1) {
    const fps = fpsN / fpsAcc; ui.fps.textContent = Math.round(fps) + ' fps' + (G.lastErr ? ' · ' + G.lastErr : '');
    if (fps < 42 && G.mode !== 'title') { slowFrames++; if (slowFrames >= 2) { if (wet.enabled && DPR <= 1.6) wet.enabled = false; else if (DPR > 1) { DPR = Math.max(1, DPR - 0.25); resize(); } slowFrames = 0; } } else slowFrames = 0;
    fpsAcc = 0; fpsN = 0;
  }
  let ts = 1;
  if (G.paused) ts = 0;
  else if (G.hitStopT > 0) { G.hitStopT -= rdt; ts = 0.05; }
  else if (G.slowT > 0) { G.slowT -= rdt; ts = G.slowScale; }
  const dt = rdt * ts;
  G.dt = dt; G.t += dt;
  const _t0 = performance.now();

  try { stepGame(dt, rdt); } catch (err) { reportError(err); }
  try { renderFrame(dt, rdt); } catch (err) { reportError(err); }
  try { G.bloomKick = Math.max(0, (G.bloomKick || 0) - rdt * 2.2); bloom.strength = 0.7 + G.bloomKick; Shock.update(rdt, grade.uniforms, camera, G.W, G.H); grade.uniforms.uTime.value = G.rt % 100; wet.render(renderer, scene, camera); composer.render(); } catch (err) { reportError(err); }
  const _t2 = performance.now();
  PERF.js = PERF.js * 0.9 + (_t2 - _t0) * 0.1; PERF.rdt = rdt;
}
let errShown = 0;
function reportError(err) {
  console.error(err);
  if (errShown < 3) { errShown++; G.lastErr = String(err && err.message || err).slice(0, 70); }
}
const safe = (fn, ...a) => { try { fn(...a); } catch (err) { reportError(err); } };
function stepGame(dt, rdt) {
  if (dt > 0) {
    safe(updateHero, dt);
    safe(updateHolds, dt);
    safe(updateEnemies, dt);
    safe(updateUlt, rdt, dt);
    safe(updateSurge, rdt);
    world.step(1 / 90, dt, 6);
    const P = G.pending; G.pending = []; for (const f of P) safe(f);
    safe(updateThrown, dt);
    safe(updateGrenades, dt);
    safe(updateBolts, dt);
    safe(updateWaves, dt);
    safe(updateGuide, dt);
    safe(updateColumns, dt);
    // sync visuals; everything within reach hums faintly violet so it reads as liftable
    const hpp = heroCenter();
    for (const o of G.props) {
      const b = o.body;
      if (!o.held && !o.vortex) {
        const inR = (G.mode === 'play' || G.mode === 'break') && Math.hypot(b.position.x - hpp.x, b.position.z - hpp.z) < TUNE.GRAB_RANGE;
        const base = 0;
        const g = Math.max(base, o.glow - dt * (o.thrown ? 0.6 : 2.5));
        if (Math.abs(g - o.glow) > 0.004) setGlow(o, g);
      }
      o.mesh.position.set(b.position.x, b.position.y, b.position.z);
      o.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      if (o.hp < o.maxHp * 0.5 && Math.random() < 0.12) FX.smoke.emit(b.position.x, b.position.y + o.hh, b.position.z, rand(-0.2, 0.2), rand(0.6, 1.2), rand(-0.2, 0.2), 0.08, 0.08, 0.09, rand(1, 1.8), 0.25, 0.9, -0.2, 0.6, 0.6);
      if (o.dmgShow > 0) o.dmgShow -= dt;
      if (o.fireLight) { o.fireLight.intensity = 10 + Math.sin(G.rt * 23) * 2.5 + Math.sin(G.rt * 37) * 2; if (Math.random() < 0.8) { FX.add.emit(b.position.x + rand(-0.15, 0.15), b.position.y + o.hh, b.position.z + rand(-0.15, 0.15), rand(-0.3, 0.3), rand(1.5, 2.8), rand(-0.3, 0.3), 2.2, 0.9, 0.25, rand(0.35, 0.6), rand(0.25, 0.4), 0.05, -1, 1, 0.9); } }
    }
    for (const o of [...G.props]) if (o.type === 'chunk' && !o.held && G.t - o.bornT > 14) removeProp(o);
  } else if (!G.paused) updateUlt(rdt, 0);
}
function renderFrame(dt, rdt) {
  for (const e of G.enemies) updateEnemyVisual(e, rdt, camera);
  updateHeroVisual(hero, rdt, [...G.holds.values()]);
  // tethers run from Iris's mind (her brow) to whatever she holds
  const holds = [...G.holds.values()];
  for (let i = 0; i < tethers.length; i++) {
    const h = holds[i];
    if (h) {
      if (hero.browPos) _v1.copy(hero.browPos); else hero.root.getWorldPosition(_v1);
      const p = h.obj.body.position; _v2.set(p.x, p.y, p.z);
      tethers[i].set(_v1, _v2, camera.position, G.rt, 1, 0.12 + Math.min(0.12, h.obj.mass / 1500), 0.6 + Math.sin(G.rt * 3) * 0.2);
    } else tethers[i].set(_v1, _v1, camera.position, G.rt, 0, 0, 0);
  }
  // ambient: liftables shimmer faintly so players read them as interactive
  if (G.mode === 'play' && Math.random() < 0.35 && G.props.length) {
    const o = G.props[Math.floor(Math.random() * G.props.length)];
    const p = o.body.position; const hp = heroCenter();
    if (!o.held && Math.hypot(p.x - hp.x, p.z - hp.z) < TUNE.GRAB_RANGE) FX.add.emit(p.x + rand(-0.3, 0.3), p.y + o.hh, p.z + rand(-0.3, 0.3), 0, rand(0.5, 1.2), 0, 0.5, 0.35, 1.3, 0.9, 0.16, 0.02, 0, 0, 0.7);
  }
  FX.update(dt > 0 ? dt : rdt * 0.2);
  Powers.update(dt > 0 ? dt : rdt * 0.2);
  updateArcs(rdt);
  updateCamera(rdt);
  FX.numbers.update(rdt, camera);
  level.update(rdt, camState.look);
  updateUI(rdt);
}
const PERF = { js: 0, render: 0, rdt: 0 }; window.__perf = PERF;
boot();
window.__G = G; // debug hook
window.__dbg = {
  toScreen: (x, y, z) => { const o = {}; toScreen({ x, y, z }, o); return [o.x, o.y]; },
  spawn: (t, x, z) => { const e = spawnEnemy(t, x, z); attach(e); return G.enemies.length; },
  wave: (i) => { for (const e of [...G.enemies]) removeEnemy(e); G.waveQueue = []; G.mode = 'play'; startWave(i); },
  surge: () => doSurge(), ult: () => { G.ult = 100; startUlt(); },
  grabEnemy: () => { const e = G.enemies.find(e => !e.dead && e.def.grip && e.state !== 'spawn'); if (!e) return false; startHold(77, e, G.W / 2, G.H / 2); return true; },
  release: (vx, vy) => { const h = G.holds.get(77); if (!h) return false; endHold(h); if (vx) throwObj(h.obj, G.W / 2, G.H / 2, vx, vy, Math.hypot(vx, vy)); else dropObj(h.obj); return true; },
  closeup: (on, dist = 3.2, h = 1.4, yawOff = 0) => { G.closeup = on ? { dist, h, yawOff } : null; },
  dmgHeld: (d) => { for (const h of [...G.holds.values()]) damageProp(h.obj, d, null, 'bolt'); },
  dmgType: (t, d) => { const o = G.props.find(o => o.type === t); if (o) damageProp(o, d, null, 'bolt'); return !!o; },
  grenade: (x, z) => { spawnGrenade(new THREE.Vector3(x, 1.2, z - 6), new THREE.Vector3(x, 0.3, z), 1.0); },
};
