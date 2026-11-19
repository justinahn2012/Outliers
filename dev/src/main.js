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
import { makeCyber } from './cyber.js';
import { makeDigitizer } from './digitize.js';
import { staticBatch, mergeGroupByMaterial } from './batch.js';
import { makeTrails } from './trails.js';
import { makeTally } from './tally.js';
import { makeProp, removeProp, setGlow, applyDamageLook, populateZone, DEFS } from './props.js';
import { createHero, updateHeroVisual, blendLocomotion } from './hero.js';
import { spawnEnemy, removeEnemy, updateEnemyVisual, setRagdoll, setEnemyGlow, ETYPES } from './enemies.js';
import { initInput, moveVector, input } from './input.js';
import { loadAssets, A, makeCharacter } from './assets.js';
import { Powers, Shock, Front, sharedHaloTexture as sharedHalo } from './powers.js';
import { ZONES, GATES, zoneAt, rectOf } from './level.js';
import { CHAPTER } from './chapter1.js';
import { P as PROG, SKILLS, MAX_RANK, xpToNext, load as loadProgress, save as saveProgress, addXP, buy as buySkill, rank, stat, resetAll } from './progress.js';

// ======================= renderer / scene =======================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080e);
scene.fog = new THREE.FogExp2(0x0a0d16, 0.019);
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 220);
G.scene = scene; G.camera = camera; G.renderer = renderer;

// Filmic finish: colour grade (teal shadows / warm highlights), vignette, fine grain, slight lens fringing
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uShockC: { value: new THREE.Vector2(0.5, 0.5) }, uShockR: { value: 0 }, uShockS: { value: 0 }, uAspect: { value: 1 },
    uGlitch: { value: 0 }, uFreeze: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    uniform vec2 uShockC; uniform float uShockR; uniform float uShockS; uniform float uAspect; uniform float uGlitch; uniform float uFreeze;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime * 7.0) * 43758.5453); }
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; float sband = 0.0; vec2 sdir = vec2(0.0);
      // digital glitch: torn horizontal bands, displaced blocks, RGB split
      float tear = 0.0, split = 0.0;
      if (uGlitch > 0.001) {
        float tq = floor(uTime * 24.0);
        float band = floor(vUv.y * 28.0);
        float hb = hs(vec2(band, tq));
        tear = step(1.0 - 0.5 * uGlitch, hb);
        uv.x += tear * (hs(vec2(band, tq + 1.7)) - 0.5) * 0.09 * uGlitch;
        vec2 blk = floor(vUv * vec2(10.0, 18.0));
        float hk = hs(blk + tq * 1.31);
        if (hk > 1.0 - 0.1 * uGlitch) uv += (vec2(hs(blk + 3.1 + tq), hs(blk + 7.7 + tq)) - 0.5) * 0.06 * uGlitch;
        split = 0.006 * uGlitch + tear * 0.012 * uGlitch;
      }
      if (uShockS > 0.0) {
        vec2 d = uv - uShockC; d.x *= uAspect; float r = length(d);
        sband = exp(-pow((r - uShockR) / 0.05, 2.0)) * smoothstep(0.0, 0.08, uShockR);
        sdir = d / max(r, 1e-4); sdir.x /= uAspect;
        uv -= sdir * sband * uShockS;
      }
      vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec2 off = c * r2 * 0.012 + sdir * sband * uShockS * 0.35;
      vec3 col = vec3(texture2D(tDiffuse, uv + off + vec2(split, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off - vec2(split, 0.0)).b);
      col += vec3(0.55, 0.42, 1.0) * sband * uShockS * 5.0;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      if (uGlitch > 0.001) {
        col += vec3(0.5, 0.3, 1.0) * tear * 0.22 * uGlitch;
        col *= 1.0 - 0.22 * uGlitch * step(0.5, fract(vUv.y * uRes.y * 0.25));
      }
      if (uFreeze > 0.001) {
        // frozen frame: drained colour, cold tint, scanlines, but her violet survives
        float keep = smoothstep(0.08, 0.3, col.b - col.g);
        vec3 frozen = vec3(l) * vec3(0.82, 0.86, 1.08);
        col = mix(col, mix(frozen, col, keep), uFreeze * 0.8);
        col *= 1.0 - 0.12 * uFreeze * step(0.5, fract(vUv.y * uRes.y * 0.33 - uTime * 2.0));
        l = dot(col, vec3(0.299, 0.587, 0.114));
      }
      // grade (art panel): night contrast pivot, teal-ink shadows, warm paper highs; everything gives up saturation
      // except violet (Null) and amber (the Census); ink blacks; aspect-correct vignette; grain weighted to shadows
      col = 0.18 * pow(max(col, 0.0) / 0.18, vec3(1.10));
      vec3 shI = vec3(0.877, 1.052, 1.052), hiP = vec3(1.029, 0.995, 0.951);
      col *= mix(shI, vec3(1.0), smoothstep(0.02, 0.30, l));
      col *= mix(vec3(1.0), hiP, smoothstep(0.40, 0.90, l));
      float vio = clamp((col.b - col.g) * 3.0, 0.0, 1.0) * clamp((col.r - col.g) * 3.0 + 0.2, 0.0, 1.0);
      float amb = clamp((col.r - col.b) * 2.0, 0.0, 1.0) * clamp((col.g - col.b) * 2.5, 0.0, 1.0) * step(col.g, col.r);
      l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, mix(0.82, 1.12, max(vio, amb)));
      col = col * 0.975 + vec3(0.010, 0.016, 0.018);
      vec2 vg = (vUv - 0.5) * vec2(uAspect, 1.0);
      col *= 1.0 - smoothstep(0.20, 0.62, dot(vg, vg)) * 0.38;
      col += (h(vUv * uRes) - 0.5) * mix(0.04, 0.015, l);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 1.05);   // only emitters, power and danger bloom
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GradeShader); composer.addPass(grade);
const smaa = new SMAAPass(); composer.addPass(smaa);
const wet = new Wet(); G.wet = wet;

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
  grade.uniforms.uRes.value.set(w * DPR, h * DPR); grade.uniforms.uAspect.value = w / h;
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

let level = null, hero = null, cyber = null;
async function boot() {
  const btn = document.getElementById('startbtn');
  btn.disabled = true;
  try {
    await loadAssets((p) => { btn.textContent = `LOADING ${Math.round(p * 100)}%`; });
  } catch (err) {
    btn.textContent = 'LOAD FAILED — RELOAD'; console.error(err); return;
  }
  buildEnvironment(renderer, scene);
  level = buildLevel(scene, world, wet); G.level = level; level.facade.sfx = sfx;
  // breaking glass is a reward beat: cold glitter (not metal sparks) and a pale flash ring on the ground (lighting Fix 10)
  level.facade.onShatter = (P) => {
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4, u = Math.random(); FX.add.emit(P.c.x + (Math.random() - 0.5) * P.w * 0.8, P.c.y + (Math.random() - 0.5) * P.h * 0.8, P.c.z, Math.cos(a) * sp + P.n.x * 2, u * 3, Math.sin(a) * sp + P.n.z * 2, 1.6, 1.8, 2.0, 0.4 + Math.random() * 0.5, 0.05, 0.02, 18, 1.5); }
    FX.rings.spawn(P.c.x + P.n.x * 0.9, 0.04, P.c.z + P.n.z * 0.9, 0.2, 1.4, 0.18, 0xcfe6ff, 0.6);
  };
  cyber = makeCyber(scene, level, wet, world); G.cyber = cyber;
  G.digit = makeDigitizer(scene);
  G.trails = makeTrails(scene);
  G.tally = makeTally(scene);
  { // fold the static city into a few big meshes per 32 m cell (draw calls are the phone's bottleneck)
    const nb = new Set([...wet.hide, ...(level.noBatch || [])]); for (const F of level.fades) for (const o of F.objs) nb.add(o);
    G.batchStats = staticBatch(scene, { exclude: nb });
  }
  // Upright characters are velocity-driven with locked rotation; cannon's friction would pin them in place,
  // so they get a frictionless material. Ragdolls drop the material and use normal friction.
  world.addContactMaterial(new CANNON.ContactMaterial(G.charMat, G.groundMat, { friction: 0, restitution: 0 }));
  world.addContactMaterial(new CANNON.ContactMaterial(G.charMat, G.charMat, { friction: 0, restitution: 0 }));
  world.addContactMaterial(new CANNON.ContactMaterial(G.charMat, G.propMat, { friction: 0.02, restitution: 0.05 }));
  hero = createHero();
  G.hero = hero;
  loadProgress(); applyStats(false); hero.hp = hero.maxHp; hero.focus = hero.maxFocus; buildFragments();
  { const st = ZONES[PROG.checkpoint || 0].start; hero.body.position.set(st[0], 0.85, st[1]); }
  resetProps();
  syncPowerButtons();
  btn.disabled = false; titleButtons();
  requestAnimationFrame(frame);
}

// counter-gravity for anything held or under psionic thrust, every substep
world.addEventListener('preStep', () => {
  const lists = [G.props, G.enemies, G.grenades];
  for (const L of lists) for (const o of L) {
    if (o.held || o.antiGrav > 0 || o.vortex) { const b = o.body; b.force.y += b.mass * TUNE.GRAV * (o.held || o.vortex ? 1 : 0.92); }
    else if (o.fly && !o.dead && o.state !== 'ragdoll' && o.state !== 'gripped') o.body.force.y += o.body.mass * TUNE.GRAV;
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
  dlg: $('dlg'), dlgWho: $('dlgwho'), dlgLine: $('dlgline'), xp: $('xpfill'), arm: $('armbtn'),
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
    if (other.kind === 'relay') { if ((e.thrown || e.state === 'ragdoll') && impact > 5) G.pending.push(() => hitRelay(other, impact * 3, cp)); return; }
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
    if (other && other.kind === 'relay' && (o.thrown || o.held || o.vortex) && impact > 4) G.pending.push(() => hitRelay(other, impact * (0.6 + Math.sqrt(o.mass) * 0.35) * stat.throwDmg(), cp));
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
  } else dmg = impact * (0.5 + Math.sqrt(o.mass) * 0.3) * stat.throwDmg();
  if (o.held) dmg *= 0.8;
  if (e.type === 'auditor') {
    if (o.kind === 'prop' && o.mass < 25) dmg *= 0.35;
    if (o.kind === 'enemy') dmg *= 0.6;
    if (e.stun > 0) dmg *= 1.8;
  }
  if (e.shieldUp) {
    const ex = Math.sin(e.yaw), ez = Math.cos(e.yaw);
    const ox = o.body.position.x - e.body.position.x, oz = o.body.position.z - e.body.position.z, ol = Math.hypot(ox, oz) || 1;
    if ((ox * ex + oz * ez) / ol > 0.25) {
      dmg *= 0.12; G.stats.blocks = G.stats.blocks;
      if (now - (e.lastBlockNum || -9) > 0.6) { e.lastBlockNum = now; num(_v2.set(e.body.position.x, e.body.position.y + 1.4, e.body.position.z), 'SHIELDED', 'psi', 0.75); }
      FX.sparks(cp, 12, 6, [1, 0.7, 0.3]); sfx.block();
      o.body.velocity.x *= -0.4; o.body.velocity.z *= -0.4;
      if (dmg < 3) return;
    } else if (dmg >= 18) G.pending.push(() => dropShield(e, o.body.velocity));
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
  if (e.retreating) return;
  e.hp -= dmg; e.hpShow = 2.5; e.flinch = 0.22; e.pop = 0.08; e.hitDir = dir ? (e.hitDir || new THREE.Vector3()).set(dir.x, 0, dir.z).normalize() : e.hitDir;
  if (e.type === 'auditor' && G.mission && G.mission.kind === 'auditor1' && e.hp < e.maxHp * 0.5) { e.hp = Math.max(e.hp, e.maxHp * 0.45); startRetreat(e); }
  if (e.type === 'lamplighter' && !e.half && e.hp < e.maxHp * 0.5) {
    e.half = true; sayList(CHAPTER.lamplighterHalf);
    const S = STEP(); if (S && S.adds) G.waveQueue.push(...S.adds);
  }
  if (!G.ultState && G.t > (G.ultLock || 0) && src !== 'ult' && src !== 'tick') G.ult = hasPower('root') ? Math.min(100, G.ult + dmg * 0.24 * stat.ultGain()) : 0;
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

function startRetreat(e) {
  e.retreating = true; cancelAttack(e); e.state = 'retreat'; e.stateT = 0;
  num(_v2.set(e.body.position.x, 3.4, e.body.position.z), 'RE-PROVISIONING', 'psi', 1.3);
  sayList(CHAPTER.auditorRetreat); restoreGroup(e);
  const z = e.body.position.z > -112 ? -97 : -127;
  e.retreatTo = [-25, z];
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
  G.stats.kills++; if (!G.ultState && G.t > (G.ultLock || 0)) G.ult = hasPower('root') ? Math.min(100, G.ult + 5 * stat.ultGain()) : 0;
  gainXP(e.type === 'auditor' ? 220 : e.type === 'lamplighter' ? 260 : e.type === 'warden' ? 34 : e.type === 'lobber' ? 26 : e.type === 'clerk' ? 16 : 22, e.body.position);
  if (e.type === 'auditor') G.pending.push(() => sayList(CHAPTER.auditorDown));
  sfx.down();
  const p = e.body.position;
  FX.psi(_v2.set(p.x, p.y + 0.5, p.z), 22, 5, 0.25, 0.8);
  if (e.type === 'auditor') {
    FX.explosion(_v2.set(p.x, 0.5, p.z), 5); sfx.explosion(); addTrauma(0.8); hitStop(0.12); screenFlash(0.5);
    num(_v2.set(p.x, p.y + 2.5, p.z), 'AUDIT FAILED', 'psi', 1.6);
  }
  if (e.def.drone) {
    const big = e.type === 'lamplighter';
    FX.explosion(_v2.set(p.x, p.y, p.z), big ? 4 : 1.2); sfx.explosion(); addTrauma(big ? 0.9 : 0.2);
    for (let k = 0; k < (big ? 90 : 14); k++) Powers.voxels.emit(p.x, p.y, p.z, rand(-6, 6), rand(0, 6), rand(-6, 6), rand(0.08, 0.2), rand(0.6, 1.2), 2.4, 1.2, 0.3, 9);
    if (big) { num(_v2.set(p.x, p.y + 1, p.z), 'LIGHTS OUT', 'psi', 1.6); hitStop(0.12); screenFlash(0.3); G.glitch = 1; }
    if (e.gear.spot) { e.gear.spot.visible = false; e.gear.cone.visible = false; if (e.gear.arc) e.gear.arc.visible = false; }
    if (e.beamSpot) e.beamSpot.k = 0;
  }
  if (e.type === 'informant' && G.chase && G.chase.e === e) chaseCaught();
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
  addTrauma(0.32 + dmg / 80); sfx.hurt(); G.glitch = Math.max(G.glitch || 0, 0.18 + dmg / 60);
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
  for (const o of G.props) if (o.alive && !o.held && !o.inWater && !(o.lockT > 0)) out.push(o);
  for (const g of G.grenades) if (g.alive && !g.held && !g.exploding) out.push(g);
  for (const e of G.enemies) if (e.alive && !e.held && e.def.grip && !e.shieldUp && e.state !== 'spawn' && e.fade >= 1) out.push(e);
  return out;
}

function liftCost(o) { return (o.kind === 'enemy' ? 12 : o.kind === 'grenade' ? 2 : 3 + o.mass * 0.025) * stat.liftCost(); }
function holdDrain(o) { return (o.kind === 'enemy' ? 9 : o.kind === 'grenade' ? 1 : 2.5 + o.mass * 0.032) * stat.liftCost(); }

// ======================= glass: anything heavy moving fast through a pane breaks it =======================
const _gA = new THREE.Vector3(), _gP = new THREE.Vector3(), _gV = new THREE.Vector3();
function updateGlass(dt) {
  const F = level.facade; if (!F) return;
  // swept from last frame's position, using last frame's speed too (a wall may already have stopped it)
  const sweep = (o, body, rad) => {
    const v = body.velocity, p = body.position, sp2 = v.x * v.x + v.y * v.y + v.z * v.z, last = o._gs || 0;
    if (sp2 > 12 || last > 3.5) {
      _gP.set(p.x, p.y, p.z); _gV.set(v.x, v.y, v.z);
      if (!o._gp) o._gp = new THREE.Vector3(p.x, p.y, p.z);
      if (F.hitSphere(_gP, rad, _gV, o._gp, last) && o.mass > 30) { body.velocity.x *= 0.8; body.velocity.z *= 0.8; }
    }
    if (!o._gp) o._gp = new THREE.Vector3(); o._gp.set(p.x, p.y, p.z); o._gs = Math.sqrt(sp2);
  };
  for (const o of G.props) if (o.alive) sweep(o, o.body, Math.max(0.25, o.hRad || 0.4));
  for (const e of G.enemies) if (e.alive && !e.def.drone) sweep(e, e.body, 0.45);
}

// ======================= rewrite: walls and street =======================
// She writes into the record directly (Rule 2). Every edit costs heat (Rule 3), and the city agrees it back once
// nothing needs the new version (Rule 4): a torn wall heals and the torn piece was never there; raised cover sinks.
const EDITS = [];
const editTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#05040a'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 70; i++) { const v = Math.random(); x.fillStyle = v < 0.5 ? 'rgba(123,92,255,0.55)' : v < 0.8 ? 'rgba(80,50,190,0.5)' : 'rgba(220,210,255,0.8)'; x.fillRect((Math.random() * 16 | 0) * 4, (Math.random() * 16 | 0) * 4, 4, 4); }
  x.strokeStyle = 'rgba(165,139,255,0.9)'; x.lineWidth = 1;
  for (let k = 0; k <= 64; k += 16) { x.beginPath(); x.moveTo(k + 0.5, 0); x.lineTo(k + 0.5, 64); x.stroke(); x.beginPath(); x.moveTo(0, k + 0.5); x.lineTo(64, k + 0.5); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const editLineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 0.9, 3.2), toneMapped: false, transparent: true });
const slabMat = new THREE.MeshStandardMaterial({ color: 0x6f6a64, roughness: 0.92, metalness: 0.05 });
const holeGeo = new THREE.BoxGeometry(1.45, 1.25, 0.5);
const COVER_W = 2.8, COVER_H = 1.75, COVER_T = 0.4;
const coverGeo = new THREE.BoxGeometry(COVER_W, COVER_H, COVER_T).translate(0, COVER_H / 2, 0);
function edgeLines(geo) { return new THREE.LineSegments(new THREE.EdgesGeometry(geo), editLineMat); }
function noFocus() {
  const hp = heroCenter(); num(_v2.set(hp.x, hp.y + 1.6, hp.z), 'NO FOCUS', 'psi', 0.8);
  ui.focusbar.classList.add('low'); setTimeout(() => ui.focusbar.classList.remove('low'), 400);
}
function spendHeat(c) { if (hero.focus < c) { noFocus(); return false; } hero.focus -= c; hero.focusDelay = 0.8; return true; }
// tall static boxes are walls (buildings, yard walls, sheds); gates and raised cover are not
function wallBodies() {
  const gates = new Set(level.gates.map(g => g.body));
  return world.bodies.filter(b => b.mass === 0 && (b.collisionFilterGroup & GRP.STATIC) && !gates.has(b) && !(b.userData && b.userData.edit) &&
    b.shapes.length === 1 && b.shapes[0] instanceof CANNON.Box && b.shapes[0].halfExtents.y >= 1.1 && Math.max(b.shapes[0].halfExtents.x, b.shapes[0].halfExtents.z) >= 0.9 &&
    b.position.y + b.shapeOffsets[0].y - b.shapes[0].halfExtents.y < 0.6);
}
function toBodyLocal(b, x, y, z) {
  const r = b.quaternion.inverse().vmult(new CANNON.Vec3(x - b.position.x, y - b.position.y, z - b.position.z));
  return r.vsub(b.shapeOffsets[0]);
}
function boxDistXZ(b, p) {
  const he = b.shapes[0].halfExtents, l = toBodyLocal(b, p.x, b.position.y, p.z);
  return Math.hypot(Math.max(0, Math.abs(l.x) - he.x), Math.max(0, Math.abs(l.z) - he.z));
}
function gateDist(g, p) {
  const lo = Math.min(g.x0, g.x1), hi = Math.max(g.x0, g.x1);
  return g.alongZ ? Math.hypot(p.x - g.z, p.z - clamp(p.z, lo, hi)) : Math.hypot(p.x - clamp(p.x, lo, hi), p.z - g.z);
}
function rewriteAt(id, x, y) {
  if (!api.canRewrite()) return false;
  const p1 = screenToPlane(x, y, 1.2, new THREE.Vector3()), p0 = screenToPlane(x, y, 0, new THREE.Vector3());
  if (!p1 || !p0) return false;
  for (const g of level.gates) if (!g.open && (gateDist(g, p1) < 1.6 || gateDist(g, p0) < 1.6)) { rewriteGate(g, gateDist(g, p1) < gateDist(g, p0) ? p1 : p0); return 'done'; }
  let wall = null, wd = 1e9;
  for (const b of wallBodies()) { const d = Math.min(boxDistXZ(b, p1), boxDistXZ(b, p0) + 0.3); if (d < wd) { wd = d; wall = b; } }
  const street = zoneAt(p0.x, p0.z) >= 0;
  if (wall && (wd < 0.5 || (!street && wd < 7))) return tearWall(id, wall, wd < 0.5 && boxDistXZ(wall, p1) < 0.5 ? p1 : p0, x, y);
  if (street) return raiseCover(p0) ? 'done' : false;
  return false;
}
// a cordon is renewed by every chip on station: she can write it open, but it's written back the same instant
function rewriteGate(g, at) {
  if (!spendHeat(4)) return;
  g.flicker();
  if (cyber) { const gp = g.pos, gw = g.x1 - g.x0, gy = g.alongZ ? Math.PI / 2 : 0; cyber.writeBorder(gp.x, 0.05, gp.z, gw, 3.6, gy); cyber.later(0.55, () => cyber.healSweep(gp.x, gp.z, gw, 0.4, gy, 0.05, 3.8)); }
  const n = G.enemies.filter(e => e.alive && !e.dead).length + RELAYS.filter(R => R.alive).length;
  num(_v2.set(at.x, 2.6, at.z), n ? `RENEWED ×${n}` : 'SWEEP STILL OPEN', 'psi', 1.3);
  if (g.renewed) g.renewed(n);
  voxelPuff(at.x, 1.6, at.z, 14, 1.5, 1.5, 0.08, 0.5); sfx.stamp(); G.glitch = Math.max(G.glitch || 0, 0.25);
  if (!G.saidGate) { G.saidGate = true; sayList(CHAPTER.rewriteGate); }
}
function tearWall(id, b, touch, sx, sy) {
  if (G.holds.size >= 2) return false;
  const he = b.shapes[0].halfExtents, hp = heroCenter();
  const hl = toBodyLocal(b, hp.x, b.position.y, hp.z), tl = toBodyLocal(b, touch.x, b.position.y, touch.z);
  // the face that looks at her, at the spot she touched (but within her reach)
  let nx = 0, nz = 0;
  if (Math.abs(hl.x) - he.x > Math.abs(hl.z) - he.z) nx = Math.sign(hl.x) || 1; else nz = Math.sign(hl.z) || 1;
  const lat = (t, h, hv) => h > 1.0 ? clamp(clamp(t, hv - 8, hv + 8), -h + 0.85, h - 0.85) : 0;
  const L = new CANNON.Vec3(nx ? nx * he.x : lat(tl.x, he.x, hl.x), 0, nz ? nz * he.z : lat(tl.z, he.z, hl.z)).vadd(b.shapeOffsets[0]);
  const W = b.quaternion.vmult(L).vadd(b.position), N = b.quaternion.vmult(new CANNON.Vec3(nx, 0, nz));
  const n = new THREE.Vector3(N.x, 0, N.z).normalize(), face = new THREE.Vector3(W.x, 1.3, W.z);
  if (Math.hypot(face.x - hp.x, face.z - hp.z) > TUNE.GRAB_RANGE * stat.reach()) { num(_v2.set(face.x, 2.4, face.z), 'TOO FAR', 'psi', 0.8); return 'done'; }
  if (!spendHeat(10 * stat.liftCost())) return 'done';
  const yaw = Math.atan2(n.x, n.z);
  const o = addProp('wallslab', face.x + n.x * 0.5, face.z + n.z * 0.5, yaw, 1.3, { size: new THREE.Vector3(1.3, 1.05, 0.6), mat: slabMat });
  o.mesh.children[0].add(edgeLines(o.mesh.children[0].geometry));
  // the gap is a box half sunk into the wall, so it reads from the top-down camera too (lane walls are seen edge-on)
  const hole = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ map: editTex, color: new THREE.Color(1.5, 1.1, 2.6), toneMapped: false, transparent: true, depthWrite: false }));
  hole.position.set(face.x - n.x * 0.2, 1.3, face.z - n.z * 0.2); hole.rotation.y = yaw; hole.renderOrder = 6; hole.add(edgeLines(holeGeo)); scene.add(hole);
  FX.rings.spawn(face.x + n.x * 0.5, 0.06, face.z + n.z * 0.5, 0.2, 1.8, 0.4, 0x9b7bff, 1);
  const E = { kind: 'tear', mesh: hole, prop: o, t: 0, life: 10, p: face.clone(), n };
  EDITS.push(E); o.edit = E;
  if (cyber) cyber.writeBorder(face.x + n.x * 0.04, 0.75, face.z + n.z * 0.04, 1.4, 1.1, yaw);
  voxelPuff(face.x + n.x * 0.5, 1.3, face.z + n.z * 0.5, 30, 3.5, 2.5, 0.1, 0.8);
  FX.dust(_v2.set(face.x + n.x * 0.6, 1.0, face.z + n.z * 0.6), 6, 2, 0.9);
  sfx.impact(0.8, false); sfx.stamp(); addTrauma(0.16); G.glitch = Math.max(G.glitch || 0, 0.2);
  num(_v2.set(face.x + n.x, 2.6, face.z + n.z), 'REWRITE', 'psi', 0.9);
  startHold(id, o, sx, sy);
  return 'grab';
}
function raiseCover(p) {
  const hp = heroCenter();
  let dx = p.x - hp.x, dz = p.z - hp.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { dx = Math.sin(hero.yaw); dz = Math.cos(hero.yaw); d = 1; }
  const ux = dx / d, uz = dz / d, dd = clamp(d, 1.8, 11);
  const cx = hp.x + ux * dd, cz = hp.z + uz * dd;
  if (zoneAt(cx, cz) < 0) return false;
  if (!spendHeat(14 * stat.liftCost())) return true;
  const covers = EDITS.filter(E => E.kind === 'cover');
  if (covers.length >= 2) covers[0].t = Math.max(covers[0].t, covers[0].life - 0.5);   // the oldest is agreed back first
  const yaw = Math.atan2(ux, uz);
  const body = new CANNON.Body({ mass: 0, material: G.groundMat, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL });
  body.addShape(new CANNON.Box(new CANNON.Vec3(COVER_W / 2, COVER_H / 2, COVER_T / 2))); body.position.set(cx, COVER_H / 2, cz);
  body.quaternion.setFromEuler(0, yaw, 0); body.userData = { edit: true }; world.addBody(body);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b0914, roughness: 0.3, metalness: 0.3, emissive: 0xffffff, emissiveMap: editTex, emissiveIntensity: 1.1 });
  const mesh = new THREE.Mesh(coverGeo, mat); mesh.position.set(cx, 0, cz); mesh.rotation.y = yaw; mesh.scale.y = 0.02; mesh.castShadow = true; mesh.add(edgeLines(coverGeo)); scene.add(mesh);
  EDITS.push({ kind: 'cover', mesh, body, mat, t: 0, life: 8, p: new THREE.Vector3(cx, 0, cz), yaw });
  if (cyber) { cyber.writeBorder(cx + ux * (COVER_T / 2 + 0.03), 0, cz + uz * (COVER_T / 2 + 0.03), COVER_W, COVER_H, yaw); cyber.writeBorder(cx - ux * (COVER_T / 2 + 0.03), 0, cz - uz * (COVER_T / 2 + 0.03), COVER_W, COVER_H, yaw); }
  // whatever is standing where the street stands up gets thrown off it
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const e of G.enemies) {
    if (!e.alive || e.dead || e.def.drone) continue;
    const ox = e.body.position.x - cx, oz = e.body.position.z - cz, lx = ox * c - oz * s, lz = ox * s + oz * c, r = e.radius || 0.5;
    if (Math.abs(lx) < COVER_W / 2 + r && Math.abs(lz) < COVER_T / 2 + r + 0.2) {
      const dir = new THREE.Vector3(s * (Math.sign(lz) || 1), 0, c * (Math.sign(lz) || 1));
      e.body.velocity.y = 8; damageEnemy(e, 14, dir, 7, 'hit');
    }
  }
  for (const o of G.props) {
    if (!o.alive || o.held) continue;
    const ox = o.body.position.x - cx, oz = o.body.position.z - cz, lx = ox * c - oz * s, lz = ox * s + oz * c;
    if (Math.abs(lx) < COVER_W / 2 + o.hRad && Math.abs(lz) < COVER_T / 2 + o.hRad) { o.body.wakeUp(); o.body.velocity.set(s * Math.sign(lz || 1) * 4, 7, c * Math.sign(lz || 1) * 4); }
  }
  for (let k = 0; k < 3; k++) voxelPuff(cx + (k - 1) * Math.cos(yaw) * 1.1, 0.2, cz - (k - 1) * Math.sin(yaw) * 1.1, 10, 1.2, 4, 0.1, 0.6);
  FX.rings.spawn(cx, 0.06, cz, 0.3, 2.4, 0.4, 0x9b7bff, 1); FX.dust(_v2.set(cx, 0.3, cz), 6, 2, 1);
  sfx.impact(0.9, false); sfx.stamp(); addTrauma(0.18);
  return true;
}
function letGoOf(o) {
  if (!o.held) return;
  endHold(o.held); restoreGroup(o);
  for (const [id, p] of input.pointers) if (p.role === 'grab' && !G.holds.has(id)) input.pointers.delete(id);
}
function updateEdits(dt) {
  for (let i = EDITS.length - 1; i >= 0; i--) {
    const E = EDITS[i]; E.t += dt;
    const closing = Math.max(0, E.t - (E.life - 0.8)) / 0.8;
    if (closing > 0 && !E.swept && cyber) {          // the city agrees it back: an amber re-render line rises through it
      E.swept = true;
      if (E.kind === 'tear') cyber.healSweep(E.p.x - E.n.x * 0.2, E.p.z - E.n.z * 0.2, 1.4, 0.5, Math.atan2(E.n.x, E.n.z), 0.75, 1.85);
      else cyber.healSweep(E.p.x, E.p.z, COVER_W + 0.1, COVER_T + 0.1, E.yaw || 0, 0.02, COVER_H);
    }
    if (E.kind === 'tear') {
      E.mesh.material.opacity = Math.min(1, E.t * 5) * (0.8 + 0.2 * Math.sin(G.rt * 23 + i));
      E.mesh.scale.setScalar(Math.max(0.02, 1 - closing));
      if (closing > 0 && Math.random() < 0.5) voxelPuff(E.p.x + E.n.x * 0.1, 1.3 + rand(-0.5, 0.5), E.p.z + E.n.z * 0.1, 1, 0.4, 0.4, 0.07, 0.4);
      if (E.t >= E.life) {
        // agreed back: the wall is whole, so the piece of it she's holding was never torn out
        const o = E.prop;
        if (o && o.alive) { letGoOf(o); const q = o.body.position; voxelPuff(q.x, q.y, q.z, 24, 2.2, 2, 0.1, 0.7); removeProp(o); }
        scene.remove(E.mesh); E.mesh.material.dispose(); EDITS.splice(i, 1);
      }
    } else {
      const rise = Math.min(1, E.t / 0.2);
      E.mesh.scale.y = Math.max(0.02, rise * (1 - closing));
      E.mat.emissiveIntensity = 0.9 + 0.3 * Math.sin(G.rt * 9 + i) + (E.t < 0.3 ? 2 * (0.3 - E.t) / 0.3 : 0);
      if (closing > 0 && E.body.world) world.removeBody(E.body);
      if (closing > 0 && Math.random() < 0.6) voxelPuff(E.p.x + rand(-1.2, 1.2), 0.2 + rand(0, 1.3) * (1 - closing), E.p.z + rand(-1.2, 1.2), 1, 0.5, 1, 0.08, 0.4);
      if (E.t >= E.life) { if (E.body.world) world.removeBody(E.body); scene.remove(E.mesh); E.mat.dispose(); EDITS.splice(i, 1); }
    }
  }
}
function clearEdits() {
  for (const E of EDITS) { scene.remove(E.mesh); if (E.body && E.body.world) world.removeBody(E.body); if (E.prop && E.prop.alive) { letGoOf(E.prop); removeProp(E.prop); } }
  EDITS.length = 0;
}

const api = {
  audio() { initAudio(); },
  tryGrab(id, x, y) {
    if (hero.dead || G.ultState) return false;
    {
      // bullets first: a generous touch target, since they're small and fast
      let best = null, bd = 1e9;
      for (const B of G.bolts) {
        if (B.caught || B.hero) continue;
        toScreen(B.p, _sp); if (_sp.z > 1) continue;
        const d = Math.hypot(_sp.x - x, _sp.y - y);
        if (d < 70 && d < bd) { bd = d; best = B; }
      }
      if (best && hero.focus >= 2) {
        hero.focus -= 2; hero.focusDelay = 0.4;
        catchBolt(best, id);
        for (const B of G.bolts) { if (B === best || B.caught || B.hero) continue; toScreen(B.p, _sp); if (_sp.z <= 1 && Math.hypot(_sp.x - x, _sp.y - y) < 110) catchBolt(B, id); }
        return true;
      }
    }
    if (G.holds.size >= 2) return false;
    const hp = heroCenter();
    // traffic overhead: touch a drone or a spinner and she drags it out of the sky
    if (cyber && cyber.fliers) {
      let bf = null, bs = 1e9;
      for (const f of cyber.fliers) {
        if (!f.on) continue; const p = f.o.position;
        if (Math.hypot(p.x - hp.x, p.z - hp.z) > TUNE.GRAB_RANGE * stat.reach() + 6) continue;
        toScreen(p, _sp); if (_sp.z > 1) continue;
        const allow = (f.o.userData.kind === 'spinner' ? 2.2 : 0.7) * pxPerMeter(p) + 28, d = Math.hypot(_sp.x - x, _sp.y - y);
        if (d < allow && d / allow < bs) { bs = d / allow; bf = f; }
      }
      if (bf) {
        const cost = liftCost({ kind: 'prop', mass: DEFS[bf.o.userData.kind === 'drone' ? 'skydrone' : 'spinner'].mass });
        if (hero.focus < Math.max(4, cost * 0.6)) { num(_v2.set(hp.x, hp.y + 1.6, hp.z), 'NO FOCUS', 'psi', 0.8); return false; }
        const s = cyber.pluck(bf), o = makeProp(s.type, s.x, s.z, s.rotY, s.y);
        o.body.velocity.set(s.vx * 0.6, 0, s.vz * 0.6);
        hero.focus -= cost; hero.focusDelay = 0.6;
        startHold(id, o, x, y);
        num(_v2.set(s.x, s.y + 0.8, s.z), s.type === 'spinner' ? 'PULLED DOWN' : 'GOT IT', 'psi', 0.9);
        addTrauma(s.type === 'spinner' ? 0.35 : 0.1);
        return true;
      }
    }
    let best = null, bestScore = 1e9;
    for (const o of grabbables()) {
      const p = o.body.position;
      const wd = Math.hypot(p.x - hp.x, p.z - hp.z);
      if (wd > TUNE.GRAB_RANGE * stat.reach()) continue;
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
    const mine = G.bolts.filter(B => B.caught === id);
    if (mine.length) {
      const sp = Math.hypot(vx, vy); let dir = null;
      if (sp >= TUNE.FLICK_MIN) {
        const a = screenToPlane(x, y, 1, new THREE.Vector3()), c = screenToPlane(x + vx * 0.06, y + vy * 0.06, 1, new THREE.Vector3());
        if (a && c) dir = new THREE.Vector3(c.x - a.x, 0, c.z - a.z);
      }
      mine.forEach((B, k) => setTimeout(() => { if (G.bolts.includes(B)) sendBolt(B, dir); }, k * 60));
      return;
    }
    const h = G.holds.get(id); if (!h) return;
    endHold(h);
    const sp = Math.hypot(vx, vy);
    if (sp >= TUNE.FLICK_MIN) throwObj(h.obj, x, y, vx, vy, sp);
    else dropObj(h.obj);
  },
  canRewrite() { return hasPower('rewrite') && G.mode === 'play' && !G.ultState && !hero.dead; },
  rewrite(id, x, y) { return rewriteAt(id, x, y); },
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
    o.byHero = true; G.stats.catches++; G.ult = Math.min(100, G.ult + 5 * stat.ultGain()); gainXP(6);
    num(_v2.set(b.position.x, b.position.y + 0.8, b.position.z), 'CAUGHT!', 'psi', 1);
  }
  b.velocity.y += 2.5;
  G.holds.set(id, h);
  if (o.kind === 'prop') Powers.brackets.attach(o, o.size, 0);
  else if (o.kind === 'enemy') { const sc = o.def.scale; Powers.brackets.attach(o, _v2.set(0.85 * sc, 1.75 * sc, 0.85 * sc), -0.05 * sc); }
  else Powers.brackets.attach(o, _v2.set(0.32, 0.32, 0.32), 0);
  sfx.lift(o.mass);
  FX.psi(_v2.set(b.position.x, b.position.y, b.position.z), 18, 3, 0.26, 0.6);
  FX.rings.spawn(b.position.x, 0.06, b.position.z, 0.2, 1.4 + o.radius, 0.4, 0x9b7bff, 0.9);
  G.tutorial.grabbed = true;
}

function endHold(h) {
  G.holds.delete(h.id);
  const o = h.obj; o.held = null;
  Powers.brackets.detach(o);
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
  const v = lerp(18, 37, power) * massF * stat.throwSpeed();
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
        if (Math.random() < 0.3) FX.add.emit(b.position.x, b.position.y, b.position.z, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5), 0.7, 0.45, 1.6, 0.35, 0.25 + o.radius * 0.2, 0.02, 0, 1, 0.8);
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
      if (o.kind === 'enemy' && o.retreating) {
        o.dead = true; G.mission && (G.mission.retreated = true); gainXP(120, b.position);
        FX.psi(_v2.set(b.position.x, 0, b.position.z), 30, 4, 0.3, 1);
        setTimeout(() => { if (o.alive) removeEnemy(o); }, 900);
      } else if (o.kind === 'enemy') {
        if (!o.dead && o.type === 'auditor' && G.mission && G.mission.kind === 'auditor1') G.mission.retreated = true;
        if (!o.dead && o.type === 'auditor') { num(_v2.set(b.position.x, 2.5, b.position.z), 'AUDIT FAILED', 'psi', 1.6); G.pending.push(() => sayList(CHAPTER.auditorDown)); }
        if (!o.dead && o.type === 'informant' && G.chase && G.chase.e === o) chaseCaught();
        if (!o.dead) { o.dead = true; G.stats.kills++; G.ult = Math.min(100, G.ult + 12 * stat.ultGain()); num(_v2.set(b.position.x, 1.5, b.position.z), 'OVERBOARD!', 'psi', 1.2); gainXP(o.type === 'auditor' ? 220 : 30, b.position); }
      }
    }
    // tunnelled into a building: put it back on the street
    if (b.position.y > -0.5 && !rectOf(b.position.x, b.position.z, 1.0) && !o.fly) {
      let best = null, bd = 1e9;
      for (const Z of ZONES) for (const r of Z.rects) {
        const op = r[4] || {};
        let x = clamp(b.position.x, r[0], r[1]), z = clamp(b.position.z, r[2], r[3]);
        if (op.openW && b.position.x < r[0]) x = b.position.x;
        if (op.openN && b.position.z < r[2]) z = b.position.z;
        if (op.openS && b.position.z > r[3]) z = b.position.z;
        const d = Math.hypot(x - b.position.x, z - b.position.z);
        if (d < bd) { bd = d; best = [x, z]; }
      }
      if (best && bd > 0.05 && bd < 12) { b.position.x = best[0]; b.position.z = best[1]; b.position.y = Math.max(b.position.y, 1.5); b.velocity.scale(-0.25, b.velocity); }
    }
    if (b.position.y < -4 || Math.abs(b.position.x) > 70 || b.position.z < -175 || b.position.z > 60) {
      if (o.kind === 'prop') removeProp(o);
      else if (o.kind === 'enemy') { if (!o.dead) { o.dead = true; G.stats.kills++; } removeEnemy(o); }
      else if (o.kind === 'grenade') removeGrenade(o);
    }
  }
}

// ======================= explosions / breakables =======================
function explosion(p, r, eDmg, hDmg, byHero) {
  FX.explosion(p, r); sfx.explosion(); addTrauma(0.6); hitStop(0.05); screenFlash(0.08);
  if (level.facade) level.facade.blast(p, r * 1.8, 1.3);
  for (const e of [...G.enemies]) {
    if (!e.alive || e.dead) continue;
    const ep = e.body.position; const d = Math.hypot(ep.x - p.x, ep.y - p.y, ep.z - p.z);
    const rr = r + e.radius * 0.4;
    if (d > rr) continue;
    const f = 1 - d / rr;
    const dir = new THREE.Vector3(ep.x - p.x, 0, ep.z - p.z).normalize();
    if (e.shieldUp) dropShield(e, dir.clone().multiplyScalar(8));
    damageEnemy(e, Math.round(eDmg * (0.35 + 0.65 * f)), dir, 9 + 9 * f, 'boom');
  }
  for (const R of RELAYS) if (R.alive) { const d = Math.hypot(R.x - p.x, R.z - p.z); if (d < r + 1) hitRelay(R, eDmg * (1 - d / (r + 1)) * 1.2, null); }
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
  G.glitch = Math.max(G.glitch || 0, 0.3);
  if (!o.alive) return;
  const p = o.body.position.clone ? new THREE.Vector3(o.body.position.x, o.body.position.y, o.body.position.z) : o.body.position;
  removeProp(o);
  explosion(p, 4.3, 95, 22, true);
}
// ---- durability: every prop is a shield with hit points; light ones fail fast ----
const BOLT_DMG = 8;
function damageProp(o, dmg, at, src) {
  if (!o.alive || o.dying || o.type === 'chunk' && src === 'impact') return;
  if (o.held) dmg *= stat.shield();
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
  G.glitch = Math.max(G.glitch || 0, 0.3);
  if (!g.alive) return;
  const p = new THREE.Vector3(g.body.position.x, g.body.position.y, g.body.position.z);
  const byHero = g.byHero;
  removeGrenade(g);
  const bl = byHero ? stat.blast() : 1;
  explosion(p, 3.8 * Math.sqrt(bl), (byHero ? 85 : 60) * bl, 24, byHero);
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
function spawnBolt(from, dir, dmg = 7, shooter = null) { spawnBolt_(from, dir); const B = G.bolts[G.bolts.length - 1]; B.dmg = dmg; B.shooter = shooter; }
// --- caught bullets: a bullet is a tiny record, so stopping one costs almost nothing (Rule 3) ---
const boltMatHero = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 3.6), toneMapped: false });
function catchBolt(B, owner) {
  B.caught = owner; B.v0 = B.v.clone(); B.v.set(0, 0, 0); B.m.material = boltMatHero; B.life = Math.max(B.life, 6);
  FX.rings.spawn(B.p.x, B.p.y, B.p.z, 0.1, 0.8, 0.3, 0x9b7bff, 1); FX.psi(B.p, 6, 2, 0.15, 0.3); sfx.stamp();
  num(_v2.set(B.p.x, B.p.y + 0.5, B.p.z), 'CAUGHT', 'psi', 0.7);
  if (!G.saidCatch) { G.saidCatch = true; sayList([['null', 'Return to sender.']]); }
}
// let go: with a flick it goes where she flicks it (aim assist), without one it goes home to whoever fired it
function sendBolt(B, dir) {
  B.caught = null; B.hero = true; B.life = 2.2; B.dmg = 22;
  let target = null;
  if (dir) target = aimAssist(B.p, dir, null);
  if (!target && B.shooter && B.shooter.alive && !B.shooter.dead) target = B.shooter;
  if (!target) target = aimAssist(B.p, (B.v0 ? B.v0.clone().multiplyScalar(-1) : new THREE.Vector3(0, 0, -1)), null);
  let d;
  if (target) { const tp = target.body.position; d = new THREE.Vector3(tp.x - B.p.x, tp.y + 0.2 - B.p.y, tp.z - B.p.z).normalize(); }
  else d = dir ? dir.clone().normalize() : (B.v0 ? B.v0.clone().multiplyScalar(-1).normalize() : new THREE.Vector3(0, 0, -1));
  B.v.copy(d).multiplyScalar(32);
  B.m.lookAt(B.p.x + d.x, B.p.y + d.y, B.p.z + d.z);
  sfx.bolt();
}
function spawnBolt_(from, dir) {
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
    if (B.caught) {
      B.life -= dt * 0.25;
      B.m.position.set(B.p.x + (Math.random() - 0.5) * 0.03, B.p.y + Math.sin(G.rt * 6 + i) * 0.03, B.p.z);
      if (Math.random() < 0.3) FX.add.emit(B.p.x, B.p.y, B.p.z, 0, 0.2, 0, 0.9, 0.5, 2.2, 0.15, 0.25, 0.02);
      if (B.life <= 0) { FX.psi(B.p, 6, 2, 0.15, 0.3); scene.remove(B.m); G.bolts.splice(i, 1); }
      continue;
    }
    B.p.addScaledVector(B.v, dt); B.life -= dt; B.m.position.copy(B.p);
    if (level.facade) { _gA.set(px, py, pz); const gh = level.facade.hitSegment(_gA, B.p, !!B.hero); if (gh && !B.hero) { FX.sparks(gh, 6, 3, [0.8, 0.9, 1]); } }
    if (B.hero) {
      if (Math.random() < 0.3) FX.add.emit(B.p.x, B.p.y, B.p.z, 0, 0, 0, 0.9, 0.5, 2.4, 0.2, 0.22, 0.02);
      let hit = B.life <= 0;
      if (!hit) for (const e of G.enemies) {
        if (e.dead || !e.alive) continue;
        const ep = e.body.position, r = (e.radius || 0.6) * 0.8 + 0.25;
        if (segSegDist2(px, py, pz, B.p.x, B.p.y, B.p.z, ep.x, ep.y - (e.hh || 0.8) * 0.8, ep.z, ep.x, ep.y + (e.hh || 0.8) * 0.8, ep.z) < r * r) {
          hit = true;
          const dir = B.v.clone().setY(0).normalize();
          if (e.shieldUp) {
            const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
            if (-(dir.x * fx + dir.z * fz) > 0.25) { FX.sparks(B.p, 10, 5, [0.8, 0.6, 1]); sfx.block(); num(_v2.set(ep.x, ep.y + 1.4, ep.z), 'SHIELDED', 'psi', 0.7); break; }
          }
          damageEnemy(e, B.dmg, dir, 6, 'hit');
          FX.sparks(B.p, 14, 6, [0.8, 0.6, 1]); FX.psi(B.p, 8, 3, 0.2, 0.4); sfx.impact(0.5, true); addTrauma(0.08);
          if (B.shooter === e) num(_v2.set(ep.x, ep.y + 1.6, ep.z), 'RETURNED', 'psi', 0.9);
          break;
        }
      }
      if (!hit) {
        _cf.set(px, py, pz); _ct.set(B.p.x, B.p.y, B.p.z); rayResult.reset();
        world.raycastClosest(_cf, _ct, { collisionFilterMask: GRP.GROUND | GRP.STATIC, skipBackfaces: true }, rayResult);
        if (rayResult.hasHit) { hit = true; FX.sparks(B.p, 8, 4, [0.8, 0.6, 1]); }
        for (const R of RELAYS) if (R.alive && Math.hypot(R.x - B.p.x, R.z - B.p.z) < 0.9 && B.p.y < 7.5) { hit = true; R.lastHit = -9; hitRelay(R, 12, B.p.clone()); }
      }
      if (hit) { scene.remove(B.m); G.bolts.splice(i, 1); }
      continue;
    }
    if (Math.random() < 0.25) FX.add.emit(B.p.x, B.p.y, B.p.z, 0, 0, 0, 1.6, 0.8, 0.2, 0.18, 0.2, 0.02);
    let dead = B.life <= 0;
    // blocked by anything Null holds in the line of fire (judged top-down, like the player sees it)
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
      dead = true; hurtHero(B.dmg || 7, _v2.set(px, py, pz), 2.5); FX.sparks(B.p, 10, 5);
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
          // counted out: the record is deleted block by block and the pieces lift away in Census amber
          if (!e.deleting) { e.deleting = true; sfx.stamp(); FX.rings.spawn(b.position.x, 0.05, b.position.z, 0.3, 1.8, 0.5, 0xffa040, 0.9); }
          e.fade -= dt * 1.25;
          const bl = e.bones ? Object.values(e.bones).filter(Boolean) : null;
          if (bl && bl.length) for (let k = 0; k < 3; k++) { bl[(Math.random() * bl.length) | 0].getWorldPosition(_v3); Powers.voxels.emit(_v3.x + rand(-0.1, 0.1), _v3.y, _v3.z + rand(-0.1, 0.1), rand(-0.5, 0.5), rand(1.0, 2.4), rand(-0.5, 0.5), rand(0.05, 0.1), rand(0.5, 0.9), 2.4, 1.15, 0.3, -1.5); }
          if (e.fade <= 0) { voxelPuff(b.position.x, 0.6, b.position.z, 8, 1.5, 1.5, 0.08, 0.5); removeEnemy(e); }
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
      want = G.booth ? (e.boothState ? (e.state = e.boothState, e.stateT = 0.2, [0, 0]) : [0, 0]) : aiBrain(e, dt, dist, nx, nz, hp);
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
  if (T === 'warden') {
    if (e.state === 'move') {
      if (dist < 1.9 && e.atkCD <= 0) { e.state = 'windup'; e.stateT = 0; sfx.windup(); return [0, 0]; }
      const k = e.shieldUp ? 1 : 1.35;
      return [nx * sp * k, nz * sp * k];
    }
    if (e.state === 'windup') {
      if (e.stateT > 0.5) {
        e.state = 'strike'; e.stateT = 0;
        if (dist < 2.3) hurtHero(12, b.position, 9);
        FX.sparks(_v2.set(b.position.x + nx * 0.9, 1.2, b.position.z + nz * 0.9), 10, 4, [1, 0.6, 0.2]);
      }
      return [nx * 1.6, nz * 1.6];
    }
    if (e.state === 'strike') { if (e.stateT > 0.5) { e.state = 'move'; e.atkCD = rand(1.2, 1.9); } return [0, 0]; }
    return [0, 0];
  }
  if (T === 'informant') {
    const C = G.chase;
    if (!C || !C.path) return [0, 0];
    const wp = C.path[Math.min(C.wi, C.path.length - 1)];
    const dx = wp[0] - b.position.x, dz = wp[1] - b.position.z, d = Math.hypot(dx, dz);
    if (d < 1.3) { C.wi++; if (C.wi >= C.path.length) { chaseEscaped(); return [0, 0]; } }
    const panic = dist < 7 ? 1.18 : 1;
    e.yaw = Math.atan2(dx, dz);
    return [dx / (d || 1) * sp * panic, dz / (d || 1) * sp * panic];
  }
  if (T === 'clerk') {
    const tgtY = e.def.hover;
    b.velocity.y += ((tgtY + Math.sin(G.rt * 3 + e.flailPh) * 0.15 - b.position.y) * 3 - b.velocity.y) * 0.15;
    if (e.state === 'move') {
      // pick something near her to stamp
      if (!e.stampT || !e.stampT.alive || e.stampT.held || e.stampT.lockT > 0 || e.retarget <= 0) {
        e.retarget = 2.5; e.stampT = null; let bd = 1e9;
        for (const o of G.props) {
          if (!o.alive || o.held || o.lockT > 0 || o.mass > 950 || o.type === 'chunk') continue;
          const op = o.body.position; const dh = Math.hypot(op.x - hp.x, op.z - hp.z); if (dh > 11) continue;
          const de = Math.hypot(op.x - b.position.x, op.z - b.position.z); if (de < bd) { bd = de; e.stampT = o; }
        }
      }
      e.retarget -= dt;
      const t = e.stampT;
      if (t) {
        const tx = t.body.position.x - b.position.x, tz = t.body.position.z - b.position.z, td = Math.hypot(tx, tz);
        e.yaw = Math.atan2(tx, tz);
        if (td < 0.7) { e.state = 'stamp'; e.stateT = 0; return [0, 0]; }
        return [tx / td * sp, tz / td * sp];
      }
      // nothing to stamp: buzz her and zap
      if (e.atkCD <= 0 && dist < 9) { e.atkCD = rand(2.6, 3.6); spawnBolt(new THREE.Vector3(b.position.x, b.position.y - 0.2, b.position.z), new THREE.Vector3(hp.x - b.position.x, 1.1 - b.position.y, hp.z - b.position.z).normalize(), 4, e); }
      const want = dist > 4 ? 1 : dist < 2.5 ? -1 : 0;
      return [nx * sp * want - nz * e.strafe * 1.5, nz * sp * want + nx * e.strafe * 1.5];
    }
    if (e.state === 'stamp') {
      const t = e.stampT;
      if (!t || !t.alive || t.held) { e.state = 'move'; return [0, 0]; }
      b.velocity.y += ((t.body.position.y + t.hh + 0.6 - b.position.y) * 4 - b.velocity.y) * 0.3;
      if (e.stateT > 0.55) { lockProp(t, 9); e.state = 'move'; e.stampT = null; e.retarget = 0.8; }
      return [(t.body.position.x - b.position.x) * 3, (t.body.position.z - b.position.z) * 3];
    }
    if (e.state === 'stunned') { if (e.stun <= 0) e.state = 'move'; return [0, 0]; }
    return [0, 0];
  }
  if (T === 'lamplighter') return lampBrain(e, dt, dist, nx, nz, hp);
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
        spawnBolt(from.clone(), tgt.sub(from).normalize(), 7, e);
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
    if (e.retreating) {
      const [rx, rz] = e.retreatTo, dx = rx - b.position.x, dz = rz - b.position.z, d = Math.hypot(dx, dz);
      e.yaw = Math.atan2(dx, dz);
      if (e.stateT > 14) { b.position.set(rx, b.position.y, rz); }
      return [dx / (d || 1) * 3.2, dz / (d || 1) * 3.2];
    }
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
function lampBrain(e, dt, dist, nx, nz, hp) {
  const b = e.body;
  b.velocity.y += ((e.def.hover + Math.sin(G.rt * 0.9) * 0.4 - b.position.y) * 2 - b.velocity.y) * 0.1;
  if (e.state === 'stunned') { if (e.stun <= 0) e.state = 'move'; return [0, 0]; }
  e.orbit = (e.orbit || Math.random() * 6) + dt * 0.35;
  const tx = hp.x + Math.cos(e.orbit) * 5.5, tz = hp.z + Math.sin(e.orbit) * 5.5 - 2;
  const dx = tx - b.position.x, dz = tz - b.position.z, d = Math.hypot(dx, dz);
  // the searchlight hunts her across the ground
  const sp = e.spotP, spd = e.half ? 4.6 : 3.3;
  if (e.coolT > 0) e.coolT -= dt;
  const sx = hp.x - sp.x, sz = hp.z - sp.z, sd = Math.hypot(sx, sz);
  if (sd > 0.05) { const k = Math.min(sd, spd * dt * (e.coolT > 0 ? 0.35 : 1)); sp.x += sx / sd * k; sp.z += sz / sd * k; }
  e.spotR = 2.6;
  if (!(e.coolT > 0) && sd < e.spotR) { e.countT += dt; if (e.countT > 1.4) lampCounted(e, hp); }
  else e.countT = Math.max(0, e.countT - dt * 0.8);
  e.yaw = Math.atan2(hp.x - b.position.x, hp.z - b.position.z);
  return [dx / (d || 1) * Math.min(e.def.speed, d), dz / (d || 1) * Math.min(e.def.speed, d)];
}
function lampCounted(e, hp) {
  e.countT = 0; e.coolT = 6.5;
  num(_v2.set(hp.x, hp.y + 1.8, hp.z), 'COUNTED', 'hurt', 1.3); sfx.radio(); G.glitch = Math.max(G.glitch, 0.45);
  const hit = rectOf(hp.x, hp.z);
  for (let k = 0; k < 2; k++) {
    if (aliveCount() >= 7 || !hit) break;
    const r = hit[1], a = Math.random() * 6.28;
    const x = clamp(hp.x + Math.cos(a) * 6, r[0] + 1, r[1] - 1), z = clamp(hp.z + Math.sin(a) * 6, r[2] + 1, r[3] - 1);
    const n = spawnEnemy('counter', x, z); attach(n); spawnColumn(x, z); sfx.spawn();
  }
  const run = G.runId;
  for (let k = 0; k < 5; k++) setTimeout(() => {
    if (G.runId !== run || e.dead || !e.alive) return;
    const b = e.body, h = heroCenter();
    const from = new THREE.Vector3(b.position.x, b.position.y - 1, b.position.z);
    spawnBolt(from, new THREE.Vector3(h.x - from.x + rand(-0.5, 0.5), 1.1 - from.y, h.z - from.z + rand(-0.5, 0.5)).normalize(), 6, e);
  }, 150 + k * 130);
}
function gunPos(e) {
  if (e.gear && e.gear.rifle) { const r = e.gear.rifle; r.updateMatrixWorld(); return new THREE.Vector3(0, 0.012, 0.97).applyMatrix4(r.matrixWorld); }
  const b = e.body;
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  return new THREE.Vector3(b.position.x + fx * 0.75 + fz * 0.25, b.position.y + 0.55, b.position.z + fz * 0.75 - fx * 0.25);
}

// ======================= SURGE & ROOT ACCESS =======================
const VIO = new THREE.Color(1.0, 0.65, 2.2);
// a burst of data cubes in her palette: mostly violet, some white-hot, a few deep
function voxelPuff(x, y, z, n, sp, up, size = 0.12, life = 0.7) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = rand(0.3, 1) * sp, r = Math.random();
    const c = r < 0.22 ? [2.4, 2.2, 3.2] : r < 0.75 ? [1.1, 0.6, 2.8] : [0.55, 0.3, 1.6];
    Powers.voxels.emit(x, y, z, Math.cos(a) * s, rand(0.3, 1) * up, Math.sin(a) * s, size * rand(0.6, 1.4), life * rand(0.6, 1.2), c[0], c[1], c[2], 9);
  }
}
function glitchEnemy(e, t = 0.4) { e.glitchT = Math.max(e.glitchT || 0, t); }

const hasPower = (k) => !!(PROG.unlock && PROG.unlock[k]);
const POWER_INFO = {
  surge: { name: 'SURGE', sub: 'BREAKS LOCK ORDERS · KNOCKS EVERYTHING BACK', lines: () => CHAPTER.unlockSurge },
  rewrite: { name: 'REWRITE', sub: 'HOLD A WALL: TEAR A PIECE OUT · HOLD THE STREET: RAISE COVER', lines: () => CHAPTER.unlockRewrite },
  root: { name: 'ROOT ACCESS', sub: 'TIME STOPS · EVERYTHING GETS TAGGED · LET GO', lines: () => CHAPTER.unlockRoot },
};
function unlockPower(k, quiet = false) {
  if (hasPower(k)) return;
  PROG.unlock = PROG.unlock || {}; PROG.unlock[k] = true; saveProgress();
  syncPowerButtons();
  if (quiet) return;
  const I = POWER_INFO[k];
  sayList(I.lines());
  const btn = k === 'root' ? ui.ult : k === 'surge' ? ui.surge : null;
  setTimeout(() => { banner(I.name, I.sub, 2.6); sfx.levelUp(); G.glitch = Math.max(G.glitch || 0, 0.5); if (btn) { btn.classList.add('fresh'); setTimeout(() => btn.classList.remove('fresh'), 6000); } }, 2200);
  if (k === 'root') G.ult = 100;          // the first one is free
}
// restarting past the point where she remembered a power keeps it
function syncUnlocksForCheckpoint(z) { if (z >= 1) unlockPower('surge', true); if (z >= 3) unlockPower('rewrite', true); if (z >= 7) unlockPower('root', true); }
function syncPowerButtons() {
  ui.surge.style.display = hasPower('surge') ? '' : 'none';
  ui.ult.style.display = hasPower('root') ? '' : 'none';
}
function doSurge() {
  if (!hasPower('surge')) return;
  if (G.mode !== 'play' || hero.dead || G.ultState || G.surge) return;
  const hp = heroCenter();
  if (G.surgeCD > 0) return;
  if (hero.focus < 20) { num(_v2.set(hp.x, hp.y + 1.6, hp.z), 'NO FOCUS', 'psi', 0.8); return; }
  hero.focus -= 20; hero.focusDelay = 0.6; G.surgeCD = stat.surgeCD();
  if (level.facade) level.facade.blast(hp, 6.5, 1);
  // a beat of anticipation: light and data drain inward to her chest
  G.surge = { t: 0, fired: false };
  G.slowT = 0.14; G.slowScale = 0.45;
  Powers.halos.spawn(_v2.set(hp.x, hp.y + 0.45, hp.z), 4.5, 0.7, 0.16, new THREE.Color(1.6, 1.1, 3.2), 1.3, { follow: hero.body.position, yOff: 0.45, ease: 'in' });
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = rand(2.5, 4.5); Powers.voxels.emit(hp.x + Math.cos(a) * r, hp.y + rand(-0.4, 1.2), hp.z + Math.sin(a) * r, -Math.cos(a) * r * 6, 0, -Math.sin(a) * r * 6, rand(0.06, 0.12), 0.16, 1.1, 0.6, 2.8, 0); }
  G.glitch = Math.max(G.glitch || 0, 0.25);
  sfx.surgeCharge();
  hero.surgePose = 0;
}
let SURGE_R = 7.2; const SURGE_SCAN = 0.6;
function updateSurge(rdt) {
  const S = G.surge; if (!S) return;
  S.t += rdt;
  if (!S.fired && S.t > 0.14) { S.fired = true; S.t0 = S.t; surgeRelease(S); }
  if (S.fired) {
    const age = S.t - S.t0;
    // the street voxelizes as the front passes: cubes pop up along it
    if (age < SURGE_SCAN) {
      const r = Front.radiusAt(SURGE_R, age / SURGE_SCAN), n = Math.round(4 + r * 1.1);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, rr = r + rand(-0.3, 0.2), c = Math.random() < 0.2 ? [2.4, 2.2, 3.2] : [1.0, 0.55, 2.6];
        Powers.voxels.emit(S.c.x + Math.cos(a) * rr, 0.1, S.c.z + Math.sin(a) * rr, Math.cos(a) * rand(1, 4), rand(2.5, 7), Math.sin(a) * rand(1, 4), rand(0.09, 0.2), rand(0.5, 0.95), c[0], c[1], c[2], 11);
      }
    }
    for (const h of S.hits) if (!h.done && age >= h.at) { h.done = true; h.fn(); }
    if (age > 1.6 && S.hits.every(h => h.done)) G.surge = null;
  }
}
function surgeRelease(S) {
  const hp = heroCenter();
  S.c = new THREE.Vector3(hp.x, 0, hp.z);
  const chest = new THREE.Vector3(hp.x, hp.y + 0.45, hp.z);
  sfx.surge(); addTrauma(0.65); hitStop(0.06); screenFlash(0.04);
  G.bloomKick = 0.32; camState.punch = 1; hero.surgePose = 1;
  G.glitch = 0.9;
  // the lamp-style halo, in her violet
  Powers.halos.spawn(chest, 0.8, 5.0, 0.35, new THREE.Color(1.0, 0.65, 2.2), 0.45, { hold: 0.04 });
  Powers.halos.spawn(chest, 0.4, 1.8, 0.2, new THREE.Color(1.8, 1.6, 2.6), 0.5);
  Shock.fire(chest, 0.5, 0.5, 0.03);
  FX.flash(hp, 0xa58cff, 25);
  SURGE_R = 7.2 * stat.surgeR();
  const R = SURGE_R;
  Powers.grids.spawn(hp, R, SURGE_SCAN, 1.5, new THREE.Color(0.85, 0.5, 2.3), 0.45);
  Powers.walls.spawn(hp, R * 1.02, 1.7, SURGE_SCAN * 1.25, new THREE.Color(0.5, 0.28, 1.45));
  Powers.beams.spawn(hp, 0.7, 10, 0.35, new THREE.Color(1.0, 0.8, 2.2));
  const hitAt = (d) => Front.timeToReach(R, d, SURGE_SCAN);
  // the burst itself: a shell of data cubes thrown off her body
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2 + rand(-0.05, 0.05), sp = rand(9, 15), r = Math.random();
    const c = r < 0.1 ? [2.0, 1.8, 2.8] : r < 0.7 ? [0.9, 0.48, 2.3] : [0.5, 0.28, 1.4];
    Powers.voxels.emit(chest.x + Math.cos(a) * 1.1, chest.y + rand(-0.5, 0.5), chest.z + Math.sin(a) * 0.4, Math.cos(a) * sp, rand(1, 5), Math.sin(a) * sp, rand(0.08, 0.22), rand(0.45, 0.9), c[0], c[1], c[2], 6);
  }
  // each enemy is hit when the front reaches them: glitches out, bursts into cubes, launched
  S.hits = [];
  for (const e of [...G.enemies]) {
    if (e.dead || !e.alive || e.held) continue;
    const ep = e.body.position; const d = Math.hypot(ep.x - hp.x, ep.z - hp.z); if (d > R + 0.4) continue;
    const dir = new THREE.Vector3(ep.x - hp.x, 0, ep.z - hp.z).normalize();
    const f = 1 - Math.min(1, d / R);
    S.hits.push({ at: hitAt(d), done: false, fn: () => {
      if (e.dead || !e.alive) return;
      arc(new THREE.Vector3(ep.x, ep.y, ep.z), 0.3, ep, 0.09);
      voxelPuff(ep.x, ep.y + 0.2, ep.z, 18, 5, 5, 0.12, 0.7);
      Powers.halos.spawn(_v2.set(ep.x, ep.y + 0.3, ep.z), 0.4, 2.2, 0.3, new THREE.Color(1.4, 1.0, 2.6), 0.7);
      setEnemyGlow(e, 0.9); glitchEnemy(e, 0.5);
      if (e.shieldUp) dropShield(e, dir.clone().multiplyScalar(6));
      if (e.type === 'lamplighter') { damageEnemy(e, Math.round(30 * stat.surgeDmg()), dir, 0, 'surge'); return; }
      if (e.type === 'auditor') { damageEnemy(e, Math.round(22 * stat.surgeDmg()), dir, 0, 'surge'); e.body.velocity.x += dir.x * 4; e.body.velocity.z += dir.z * 4; e.body.velocity.y += 3; return; }
      damageEnemy(e, Math.round((14 + 14 * f) * stat.surgeDmg()), dir, 0, 'surge');
      if (e.dead || e.state !== 'ragdoll') { setRagdoll(e, true); e.state = 'ragdoll'; e.downT = 0; cancelAttack(e); }
      e.body.velocity.set(dir.x * (9 + 5 * f), 5 + 4 * f, dir.z * (9 + 5 * f));
      e.body.angularVelocity.set(dir.z * 7 + rand(-3, 3), rand(-4, 4), -dir.x * 7 + rand(-3, 3));
      e.thrown = true; e.thrownT = 0;
    } });
  }
  for (const o of [...G.props, ...G.grenades]) {
    if (o.held) continue;
    const op = o.body.position; const d = Math.hypot(op.x - hp.x, op.z - hp.z); if (d > R) continue;
    const f = 1 - d / R;
    S.hits.push({ at: hitAt(d), done: false, fn: () => {
      if (!o.alive) return;
      const k = 16 * f * clamp(45 / o.mass, 0.15, 1.2);
      _v1.set(op.x - hp.x, 0, op.z - hp.z).normalize();
      o.body.velocity.x += _v1.x * k; o.body.velocity.z += _v1.z * k; o.body.velocity.y += 5 + k * 0.5; o.body.wakeUp();
      o.body.angularVelocity.set(rand(-7, 7) * f, rand(-7, 7) * f, rand(-7, 7) * f);
      o.thrown = true; o.thrownT = 0; o.dropped = false; o.body.collisionFilterGroup = GRP.HELD; o.body.collisionFilterMask = NO_HERO;
      if (o.kind === 'grenade') o.byHero = true;
      if (o.kind === 'prop') { setGlow(o, 0.9); voxelPuff(op.x, op.y, op.z, 5, 3, 4, 0.1, 0.5); }
    } });
  }
  for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, r = rand(2.5, 5.5); arc(new THREE.Vector3(hp.x + Math.cos(a) * r, rand(0.2, 1.5), hp.z + Math.sin(a) * r), 0.22); }
}

// ROOT ACCESS: time stops, a scan sweeps the block and locks onto everything,
// it all hangs in the air, then she sends every tagged thing flying at once.
const ROOT_R = 18, ROOT_SCAN = 0.85;
function startUlt() {
  if (!hasPower('root')) return;
  if (G.mode !== 'play' || hero.dead || G.ultState || G.ult < 100) return;
  G.ult = 0;
  for (const h of [...G.holds.values()]) { endHold(h); dropObj(h.obj); }
  for (const [id, p] of input.pointers) if (p.role === 'grab') input.pointers.delete(id);
  const hpU = heroCenter();
  const U = G.ultState = { phase: 'inhale', t: 0, caught: [], tags: [], c: new THREE.Vector3(hpU.x, 0, hpU.z) };
  G.slowT = ROOT_SCAN + 0.15; G.slowScale = 0.04;     // the world all but stops
  G.freeze = 1; G.glitch = Math.max(G.glitch || 0, 0.6);
  Powers.halos.spawn(_v2.set(hpU.x, hpU.y + 0.9, hpU.z), 6, 1.4, 0.6, new THREE.Color(1.3, 0.9, 2.8), 0.55, { follow: hero.body.position, yOff: 0.9, ease: 'in' });
  Powers.grids.spawn(hpU, ROOT_R, ROOT_SCAN, 3.4, new THREE.Color(0.6, 0.36, 1.7), 0.6);
  Powers.walls.spawn(hpU, ROOT_R, 1.2, ROOT_SCAN * 1.15, new THREE.Color(0.4, 0.24, 1.2));
  // everything the scan will reach, in the order the front reaches it
  let i = 0;
  for (const o of [...G.props, ...G.grenades, ...G.enemies]) {
    if (!o.alive || o.inWater || (o.kind === 'enemy' && (o.dead || o.state === 'spawn' || o.fade < 1))) continue;
    const p = o.body.position; const d = Math.hypot(p.x - hpU.x, p.z - hpU.z); if (d > ROOT_R) continue;
    U.tags.push({ o, at: Front.timeToReach(ROOT_R, d, ROOT_SCAN), done: false, i: i++ });
  }
  U.tags.sort((a, b) => a.at - b.at);
  banner('ROOT ACCESS', 'EVERYTHING IS EDITABLE', 1.6);
  sfx.inhale();
}
function tagObj(U, o, n) {
  const p = o.body.position, isE = o.kind === 'enemy', s = isE ? o.def.scale : 1;
  const heavyAud = isE && (o.type === 'auditor' || o.type === 'lamplighter');
  if (isE && o.shieldUp) dropShield(o, null);
  Powers.reticles.spawn(p, isE ? -0.05 * s : 0, isE ? 1.7 * s : Math.max(0.7, o.radius * 1.7), heavyAud ? new THREE.Color(2.6, 0.9, 1.6) : new THREE.Color(1.3, 0.85, 2.8));
  if (isE) { setEnemyGlow(o, 0.8); glitchEnemy(o, 0.25); if (!heavyAud) num(_v2.set(p.x, p.y + 1.3 * s, p.z), 'TAGGED', 'psi', 0.6); }
  else if (o.kind === 'prop') setGlow(o, 0.6);
  voxelPuff(p.x, p.y, p.z, isE ? 6 : 3, 2, 2, 0.08, 0.4);
  if (n % 2 === 0 || n < 6) sfx.tag(n);
  // freeze it where it stands
  o.vortex = { ang: Math.atan2(p.z - U.c.z, p.x - U.c.x), r: Math.hypot(p.x - U.c.x, p.z - U.c.z), x0: p.x, z0: p.z, y0: p.y,
    lift: heavyAud ? 0 : (isE ? rand(1.4, 2.2) : rand(0.9, 1.8) + Math.min(0.8, 20 / o.mass)), heavy: heavyAud, seed: Math.random() * 10 };
  o.thrown = false; o.antiGrav = 0;
  if (!heavyAud) { o.body.collisionFilterGroup = GRP.HELD; o.body.collisionFilterMask = NO_HERO; }
  o.body.wakeUp();
  if (isE && !heavyAud) { cancelAttack(o); setRagdoll(o, true); o.state = 'gripped'; }
  if (isE && heavyAud) { cancelAttack(o); o.stun = Math.max(o.stun || 0, 3.5); o.state = 'stunned'; o.stateT = 0; }
  if (o.kind === 'grenade') o.byHero = true;
  U.caught.push(o);
}
function updateUlt(rdt, dt) {
  const U = G.ultState; if (!U) { G.freeze = 0; hero.levitate += (0 - hero.levitate) * damp(4, rdt); return; }
  U.t += rdt;
  const hp = heroCenter();
  hero.levitate += (1 - hero.levitate) * damp(5, rdt);
  // tagged things hang in the air, twitching like a paused video
  const hover = (k) => {
    for (const o of U.caught) {
      if (!o.alive || !o.vortex) continue;
      const V = o.vortex, b = o.body;
      if (V.heavy) { b.velocity.x *= 0.8; b.velocity.z *= 0.8; continue; }
      const jit = Math.random() < 0.08 ? 0.12 : 0;
      const tx = V.x0 + Math.sin(G.rt * 1.3 + V.seed) * 0.15 * k + (Math.random() - 0.5) * jit;
      const tz = V.z0 + Math.cos(G.rt * 1.1 + V.seed) * 0.15 * k + (Math.random() - 0.5) * jit;
      const ty = Math.max(V.y0, (o.hh || 0.5) + 0.05) + V.lift * k + Math.sin(G.rt * 2 + V.seed) * 0.08 * k;
      b.velocity.x = (tx - b.position.x) * 8; b.velocity.y = (ty - b.position.y) * 8; b.velocity.z = (tz - b.position.z) * 8;
      b.angularVelocity.x *= 0.9; b.angularVelocity.y = 0.6 * k; b.angularVelocity.z *= 0.9;
    }
  };
  if (U.phase === 'inhale') {
    // the scan front: lock onto everything it passes, erase incoming fire
    for (const tg of U.tags) if (!tg.done && U.t >= tg.at) { tg.done = true; if (tg.o.alive && !tg.o.held) tagObj(U, tg.o, tg.i); }
    const fr = Front.radiusAt(ROOT_R, U.t / ROOT_SCAN);
    for (let i = G.bolts.length - 1; i >= 0; i--) {
      const B = G.bolts[i];
      if (!B.caught && !B.hero && Math.hypot(B.p.x - U.c.x, B.p.z - U.c.z) < fr) catchBolt(B, 'ult');
    }
    for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; Powers.voxels.emit(U.c.x + Math.cos(a) * fr, 0.1, U.c.z + Math.sin(a) * fr, 0, rand(1.5, 4), 0, rand(0.08, 0.16), 0.6, 0.9, 0.5, 2.4, 2); }
    hover(0);
    if (U.t > ROOT_SCAN + 0.1) {
      for (const tg of U.tags) if (!tg.done) { tg.done = true; if (tg.o.alive && !tg.o.held) tagObj(U, tg.o, tg.i); }
      U.phase = 'vortex'; U.t = 0; sfx.vortex();
      G.freeze = 0.65;
      Powers.halos.spawn(hp, 2.2, 4.6, 1.7, new THREE.Color(1.0, 0.65, 2.2), 0.8, { follow: hero.body.position, yOff: 1.4, hold: 0.85, pulse: 1 });
      Powers.halos.spawn(hp, 0.7, 1.5, 1.7, new THREE.Color(1.8, 1.6, 2.6), 0.9, { follow: hero.body.position, yOff: 1.4, hold: 0.85, pulse: 1 });
      G.bloomKick = 0.5;
    }
  } else if (U.phase === 'vortex') {
    const k = 1 - Math.pow(1 - Math.min(1, U.t / 0.5), 3);
    hover(k);
    for (const o of U.caught) {
      if (!o.alive || !o.vortex) continue;
      if (o.kind === 'prop') setGlow(o, 0.18 + Math.sin(G.rt * 14 + o.vortex.seed) * 0.06);
      if (o.kind === 'enemy' && !o.dead) { setEnemyGlow(o, 0.5); if (Math.random() < 0.03) glitchEnemy(o, 0.12); o.tickAcc = (o.tickAcc || 0) + 9 * dt; if (o.tickAcc > 6) { damageEnemy(o, 6, null, 0, 'tick'); o.tickAcc = 0; } }
      // data bleeding upward off everything she has tagged
      if (Math.random() < 0.25) { const p = o.body.position; Powers.voxels.emit(p.x + rand(-0.3, 0.3), p.y + rand(-0.2, 0.4), p.z + rand(-0.3, 0.3), 0, rand(0.8, 2), 0, rand(0.05, 0.1), 0.7, 1.0, 0.55, 2.6, -1); }
    }
    addTrauma(0.015);
    if (Math.random() < 0.3 && U.caught.length) { const o = U.caught[Math.floor(Math.random() * U.caught.length)]; if (o.alive) arc(new THREE.Vector3(), 0.12, o.body.position, 0.06); }
    if (Math.random() < 0.04) G.glitch = Math.max(G.glitch, 0.35);
    G.bloomKick = Math.max(G.bloomKick, 0.3);
    if (U.t > 1.6) {
      U.phase = 'release'; U.t = 0;
      sfx.release(); addTrauma(1); hitStop(0.09); screenFlash(0.08);
      G.freeze = 0; G.glitch = 1.2;
      FX.flash(hp, 0x9b7bff, 110);
      const ch = new THREE.Vector3(hp.x, hp.y + 1.2, hp.z);
      Powers.halos.spawn(ch, 1.5, 13, 0.85, new THREE.Color(1.1, 0.75, 2.4), 0.75, { hold: 0.06 });
      Powers.halos.spawn(ch, 0.8, 5, 0.45, new THREE.Color(2.0, 1.8, 2.8), 0.8);
      Powers.grids.spawn(hp, 20, 0.5, 1.6, new THREE.Color(1.0, 0.55, 2.6), 0.6);
      Powers.walls.spawn(hp, 19, 2.8, 0.75, new THREE.Color(0.9, 0.5, 2.4));
      Powers.beams.spawn(hp, 1.2, 16, 0.5, new THREE.Color(1.2, 0.9, 2.4));
      Powers.reticles.clear(true);
      G.bolts.filter(B => B.caught === 'ult').forEach((B, k) => setTimeout(() => { if (G.bolts.includes(B)) sendBolt(B, null); }, k * 40));
      Shock.fire(ch, 0.9, 0.95, 0.06);
      G.bloomKick = 0.5; camState.punch = 1.4;
      for (let i = 0; i < 220; i++) {
        const a = (i / 220) * Math.PI * 2 + rand(-0.03, 0.03), sp = rand(12, 24), r = Math.random();
        const c = r < 0.1 ? [2.0, 1.8, 2.8] : r < 0.7 ? [0.9, 0.48, 2.3] : [0.5, 0.28, 1.4];
        Powers.voxels.emit(hp.x + Math.cos(a) * 1.4, rand(0.3, 2.6), hp.z + Math.sin(a) * 0.6, Math.cos(a) * sp, rand(1, 6), Math.sin(a) * sp, rand(0.1, 0.28), rand(0.6, 1.1), c[0], c[1], c[2], 7);
      }
      for (const e of G.enemies) if (!e.dead) arc(new THREE.Vector3(), 0.4, e.body.position, 0.1);
      for (const o of U.caught) {
        if (!o.alive) continue;
        const b = o.body; const V = o.vortex; o.vortex = null;
        const dx = b.position.x - hp.x, dz = b.position.z - hp.z; const d = Math.hypot(dx, dz) || 1;
        const rx = dx / d, rz = dz / d;
        voxelPuff(b.position.x, b.position.y, b.position.z, o.kind === 'enemy' ? 12 : 5, 4, 4, 0.12, 0.6);
        if (V && V.heavy) { damageEnemy(o, Math.round(90 * stat.ultDmg()), new THREE.Vector3(rx, 0, rz), 0, 'ult'); glitchEnemy(o, 0.6); o.stun = 1.5; if (!o.dead) { o.state = 'stunned'; o.stateT = 0; } restoreGroup(o); continue; }
        const v = rand(26, 34) * (o.kind === 'enemy' ? 0.8 : clamp(1.2 - o.mass / 500, 0.55, 1.1));
        b.velocity.set(rx * v - rz * 4, rand(2, 5), rz * v + rx * 4);
        b.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
        o.thrown = true; o.thrownT = 0; o.antiGrav = 0.45; o.dropped = false;
        if (o.kind === 'enemy') { o.state = 'ragdoll'; o.downT = 0; o.thrown = true; glitchEnemy(o, 0.5); if (!o.dead) damageEnemy(o, Math.round(42 * stat.ultDmg()), new THREE.Vector3(rx, 0, rz), 0, 'ult'); }
      }
    }
  } else if (U.phase === 'release') {
    if (U.t > 0.6) { G.ultState = null; G.ultLock = G.t + 2.5; }
  }
}

// ======================= chapter flow: zones, steps, missions =======================
let spawnTimer = 0, zoneBreak = 0;
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
const ZD = (i) => CHAPTER.zones[i];
const STEP = () => (G.zone >= 0 && G.stepI >= 0 ? ZD(G.zone).steps[G.stepI] : null);
function pickSpawn(type) {
  const hp = heroCenter();
  const list = ZD(G.zone).spawns;
  let opts = list.filter(([x, z]) => Math.hypot(x - hp.x, z - hp.z) > (type === 'auditor' || type === 'lamplighter' ? 12 : 8.5));
  const pool = opts.length ? opts : list;
  if (type === 'auditor' || type === 'lamplighter') return pool.reduce((a, b) => (Math.hypot(b[0] - hp.x, b[1] - hp.z) > Math.hypot(a[0] - hp.x, a[1] - hp.z) ? b : a));
  return pool[Math.floor(Math.random() * pool.length)];
}
function spawnNow(t) {
  const [x, z] = pickSpawn(t);
  const e = spawnEnemy(t, x + rand(-0.6, 0.6), z + rand(-0.6, 0.6)); attach(e);
  spawnColumn(e.body.position.x, e.body.position.z); sfx.spawn();
  if (t === 'warden' && !G.seenWarden) { G.seenWarden = true; }
  return e;
}
function setObjective(text, pos, label = null) {
  G.objective = text ? { text, pos: pos ? pos.clone() : null, label } : null;
  beacon.visible = !!(pos && text);
  if (pos && text) beacon.position.set(pos.x, 0, pos.z);
}
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 12, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.55, 2.2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
beacon.geometry.translate(0, 6, 0); beacon.visible = false; scene.add(beacon);
let beaconT = 0;
function updateBeacon(dt) {
  if (!beacon.visible) return;
  beacon.material.opacity = 0.22 + Math.sin(G.rt * 3) * 0.08;
  beaconT -= dt; if (beaconT <= 0) { beaconT = 0.9; FX.rings.spawn(beacon.position.x, 0.08, beacon.position.z, 0.3, 2.2, 0.8, 0x9b7bff, 0.9); }
}
const OPENABLE = ZONES.length - 1;      // gates 0..8 open in order; the last two are permanent Census locks

// ======================= where am I: place names, minimap, route arrow, full map =======================
// Every zone is a list of rects; a rect can carry its own name (TRANSIT SHED). This only tells her where she is;
// it doesn't point the way.
const NAV = (() => {
  const R = [];
  ZONES.forEach((Z, zi) => Z.rects.forEach((r, ri) => R.push({ zi, main: ri === Z.rects.length - 1 || Z.rects.length === 1, x0: r[0], x1: r[1], z0: r[2], z1: r[3], name: (r[4] && r[4].name) || Z.name })));
  const at = (x, z, pad = 0.3) => R.find(r => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad) || null;
  return { R, at, last: null };
})();
const nav = { place: null, toastT: 0, mmT: 0, open: false, wasPaused: false };
const mm = $('minimap'), mmx = mm.getContext('2d');
function placeToast(name) {
  const el = $('place'); el.innerHTML = `<small>${ZONES[G.zone] && ZONES[G.zone].name !== name ? ZONES[G.zone].name : 'CANTOR SOUND'}</small>${name}`;
  el.classList.add('show'); nav.toastT = 2.4;
}
function updateNav(dt) {
  const live = (G.mode === 'play' || G.mode === 'break') && !nav.open;
  const show = live ? 'block' : 'none';
  if (mm.style.display !== show) { mm.style.display = show; $('mmcap').style.display = show; }
  if (nav.toastT > 0) { nav.toastT -= dt; if (nav.toastT <= 0) $('place').classList.remove('show'); }
  if (!live) return;
  const hp = heroCenter();
  const r = NAV.at(hp.x, hp.z, 0); if (r) NAV.last = r;
  const cur = NAV.last;
  if (cur && cur.name !== nav.place) {
    const first = nav.place === null; nav.place = cur.name; ui.wave.textContent = cur.name;
    if (!first && bannerT <= 0) placeToast(cur.name);
  }
  nav.mmT -= dt; if (nav.mmT <= 0) { nav.mmT = 0.1; drawMinimap(hp); }
}
function rectFill(r, big) {
  if (r.zi === G.zone) return big ? 'rgba(155,123,255,0.45)' : 'rgba(155,123,255,0.5)';
  if (r.zi < G.zone) return 'rgba(205,200,235,0.24)';
  return big ? 'rgba(205,200,235,0.1)' : 'rgba(205,200,235,0.12)';
}
function drawMarks(c, X, Y, hp, s) {
  for (let gi = 0; gi < GATES.length; gi++) {
    const g = GATES[gi], lv = level.gates[gi]; if (!lv || lv.open) continue;
    c.strokeStyle = gi >= OPENABLE ? 'rgba(255,90,60,0.9)' : 'rgba(255,150,40,1)'; c.lineWidth = 2.2 * s; c.beginPath();
    if (g.alongZ) { c.moveTo(X(g.at), Y(g.x0)); c.lineTo(X(g.at), Y(g.x1)); } else { c.moveTo(X(g.x0), Y(g.at)); c.lineTo(X(g.x1), Y(g.at)); }
    c.stroke();
  }
  c.fillStyle = 'rgba(255,80,90,0.95)';
  for (const e of G.enemies) if (e.alive && !e.dead) { c.beginPath(); c.arc(X(e.body.position.x), Y(e.body.position.z), 1.8 * s, 0, 6.29); c.fill(); }
  // her, pointing where she faces
  const fx = Math.sin(hero.yaw), fz = Math.cos(hero.yaw), px = X(hp.x), py = Y(hp.z), a = 6 * s;
  c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(155,123,255,1)'; c.lineWidth = 1.5 * s; c.beginPath();
  c.moveTo(px + fx * a, py + fz * a); c.lineTo(px - fx * a * 0.6 - fz * a * 0.6, py - fz * a * 0.6 + fx * a * 0.6); c.lineTo(px - fx * a * 0.6 + fz * a * 0.6, py - fz * a * 0.6 - fx * a * 0.6); c.closePath(); c.fill(); c.stroke();
}
function drawMinimap(hp) {
  const S = 98, d = Math.min(2, window.devicePixelRatio || 1);
  if (mm.width !== S * d) { mm.width = mm.height = S * d; }
  const c = mmx, k = 1.15;
  c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, S, S);
  c.save(); c.beginPath(); c.roundRect ? c.roundRect(0, 0, S, S, 13) : c.rect(0, 0, S, S); c.clip();
  const X = (x) => S / 2 + (x - hp.x) * k, Y = (z) => S / 2 + (z - hp.z) * k;
  for (const r of NAV.R) { c.fillStyle = rectFill(r, false); c.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); }
  drawMarks(c, X, Y, hp, 1);
  c.restore();
  c.fillStyle = 'rgba(220,210,255,0.8)'; c.font = '800 8px Inter, sans-serif'; c.textAlign = 'center'; c.fillText('N', S / 2, 9);
}
function drawBigMap() {
  const cv = $('bigmapc'), d = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * d; cv.height = H * d;
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const r of NAV.R) { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); z0 = Math.min(z0, r.z0); z1 = Math.max(z1, r.z1); }
  const k = Math.min((W - 24) / (x1 - x0), (H - 24) / (z1 - z0)), ox = (W - (x1 - x0) * k) / 2, oz = (H - (z1 - z0) * k) / 2;
  const X = (x) => ox + (x - x0) * k, Y = (z) => oz + (z - z0) * k;
  for (const r of NAV.R) {
    c.fillStyle = rectFill(r, true); c.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
    c.strokeStyle = r.zi === G.zone ? 'rgba(200,180,255,0.9)' : 'rgba(200,195,235,0.25)'; c.lineWidth = 1; c.strokeRect(X(r.x0) + 0.5, Y(r.z0) + 0.5, (r.x1 - r.x0) * k - 1, (r.z1 - r.z0) * k - 1);
  }
  const hp = heroCenter();
  drawMarks(c, X, Y, hp, 1.6);
  // names, written along long thin streets
  for (const r of NAV.R) {
    const w = (r.x1 - r.x0) * k, h = (r.z1 - r.z0) * k, cx = X((r.x0 + r.x1) / 2), cz = Y((r.z0 + r.z1) / 2);
    c.save(); c.translate(cx, cz); if (h > w * 1.6 && w < 70) c.rotate(-Math.PI / 2);
    c.font = (r.main ? '800 11px' : '700 9px') + ' Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = r.zi === G.zone ? '#ffffff' : r.zi < G.zone ? 'rgba(235,230,255,0.85)' : 'rgba(235,230,255,0.5)';
    c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 4; c.fillText(r.name, 0, 0); c.restore();
  }
  // a "YOU" tag beside her marker, on whichever side has room
  const yx = X(hp.x), yy = Y(hp.z), left = yx > W - 60;
  c.font = '800 10px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tx = yx + (left ? -26 : 26), ty = yy - 14;
  c.fillStyle = 'rgba(155,123,255,0.95)'; c.beginPath(); c.roundRect ? c.roundRect(tx - 17, ty - 8, 34, 16, 8) : c.rect(tx - 17, ty - 8, 34, 16); c.fill();
  c.strokeStyle = 'rgba(155,123,255,0.95)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tx + (left ? 14 : -14), ty + 5); c.lineTo(yx, yy); c.stroke();
  c.fillStyle = '#fff'; c.fillText('YOU', tx, ty + 0.5);
  $('bigmapsub').textContent = (nav.place || '') + (G.objective ? '  ·  ▸ ' + G.objective.text : '');
}
function openMap() {
  if (nav.open || (G.mode !== 'play' && G.mode !== 'break')) return;
  nav.open = true; nav.wasPaused = G.paused; G.paused = true;
  $('bigmap').classList.remove('hidden'); sfx.ui();
  requestAnimationFrame(drawBigMap);
}
function closeMap() {
  if (!nav.open) return;
  nav.open = false; $('bigmap').classList.add('hidden'); G.paused = nav.wasPaused; sfx.ui();
}
mm.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); openMap(); });
$('bigmapclose').addEventListener('click', closeMap);
$('bigmap').addEventListener('click', (e) => { if (e.target.id === 'bigmap' || e.target.id === 'bigmapc') closeMap(); });
function setGates(upTo) { level.gates.forEach((g, i) => { if (i < upTo && i < OPENABLE) g.snapOpen(); else g.close(); }); }
function openGate(i) {
  const g = level.gates[i]; if (!g || g.open) return;
  g.openNow(); sfx.gate();
  const P = g.pos;
  for (let k = 0; k < 70; k++) { const u = rand(g.x0, g.x1); const x = g.alongZ ? P.x : u, z = g.alongZ ? u : P.z; Powers.voxels.emit(x, rand(0.2, 3.2), z, rand(-1.5, 1.5), rand(0.5, 3), rand(-1.5, 1.5), rand(0.08, 0.18), rand(0.5, 1.0), 2.4, 1.1, 0.25, 7); }
  G.glitch = Math.max(G.glitch, 0.4);
}

// ---- lazy props: only the current area and its neighbours exist in the physics world ----
const zoneLoaded = new Set();
function ensureZoneProps(center) {
  for (let i = 0; i < ZONES.length; i++) {
    const want = Math.abs(i - center) <= 1;
    if (want && !zoneLoaded.has(i)) { zoneLoaded.add(i); for (const o of populateZone(i)) attach(o); if (i === 4) buildCages(); if (i === 1) buildRelays(); }
    else if (!want && zoneLoaded.has(i) && Math.abs(i - center) >= 2) {
      zoneLoaded.delete(i);
      for (const o of [...G.props]) if (o.zone === i && !o.held) removeProp(o);
      if (i === 4) clearCages(); if (i === 1) clearRelays();
    }
  }
}
function resetProps() {
  clearEdits();
  for (const o of [...G.props]) removeProp(o);
  zoneLoaded.clear(); clearCages(); clearRelays();
  ensureZoneProps(PROG.checkpoint || 0);
}

function enterZone(i) {
  G.zone = i; G.zState = 'fight'; G.stepI = -1; G.reinforced = false; G.mission = null;
  PROG.checkpoint = i; saveProgress();
  ensureZoneProps(i);
  nav.place = null;
  banner(ZONES[i].name, i === 0 ? `CHAPTER ${CHAPTER.num} · ${CHAPTER.title}` : '', 2.2);
  setObjective(null);
  DLG.q.length = 0;   // stale lines from the last area are dropped
  sayList(ZD(i).enter);
  zoneBreak = 2.2;
}
function startNextStep() {
  const Z = ZD(G.zone);
  if (G.stepI + 1 >= Z.steps.length) { zoneCleared(); return; }
  G.stepI++;
  const S = Z.steps[G.stepI];
  G.waveQueue = [...(S.list || [])]; spawnTimer = 0.4; G.reinforced = false;
  G.mission = { kind: S.kind, t: 0, trickleT: S.every || 0, done: false };
  banner(S.sub, '', 1.9);
  if (S.unlock) unlockPower(S.unlock);
  if (S.say) sayList(S.say);
  if (S.kind === 'relays') G.mission.target = RELAYS.length;
  if (S.kind === 'rescue') G.mission.target = CAGES.length;
  if (S.kind === 'lockdown') G.mission.left = S.time;
  if (S.kind === 'chase') startChase(S);
}
function zoneCleared() {
  const i = G.zone; G.zState = 'clear'; G.mission = null;
  banner(i < OPENABLE ? 'CHECKPOINT DOWN' : 'SWEEP TERMINATED', ZD(i).next, 2.0);
  sayList(ZD(i).clear);
  hero.hp = Math.min(hero.maxHp, hero.hp + 35);
  gainXP(80);
  if (i < OPENABLE) { openGate(i); G.unlocked = i + 1; const P = level.gates[i].pos; setObjective(ZD(i).next, P, ZONES[i + 1].name); ensureZoneProps(i + 1); }
  else {
    // the sweep is over: every checkpoint left in the district loses its count
    setObjective(ZD(i).next, level.mothDoor, "MOTH'S DOOR");
    level.gates.forEach((g, k) => { if (k >= OPENABLE) g.openNow(); });
  }
}
function aliveCount() { return G.enemies.filter(e => !e.dead && e.type !== 'informant').length; }
function stepDone() {
  const S = STEP(), M = G.mission; if (!S || !M) return false;
  const clear = !G.waveQueue.length && aliveCount() === 0;
  switch (S.kind) {
    case 'wave': case 'lamplighter': case 'auditor2': return clear;
    case 'relays': return RELAYS.every(r => !r.alive) && clear;
    case 'rescue': return CAGES.every(c => c.freed) && clear;
    case 'lockdown': return M.left <= 0 && clear;
    case 'chase': return M.done;
    case 'auditor1': return M.retreated && clear;
  }
  return clear;
}
function updateWaves(dt) {
  if (G.mode !== 'play') return;
  const hp = heroCenter();
  updateFragments(dt);
  updateCivs(dt);
  safe(() => updateCrowd(dt));
  safe(() => updateRelays());
  updateLocks(dt);
  updateChase(dt);
  if (G.zState === 'fight') {
    if (zoneBreak > 0) { zoneBreak -= dt; if (zoneBreak <= 0) startNextStep(); return; }
    const S = STEP(), M = G.mission; if (!S || !M) return;
    M.t += dt;
    // continuous pressure while an objective is open
    const objectiveOpen = (S.kind === 'relays' && RELAYS.some(r => r.alive)) || (S.kind === 'rescue' && CAGES.some(c => !c.freed)) || (S.kind === 'lockdown' && M.left > 0);
    if (S.trickle && objectiveOpen) {
      M.trickleT -= dt;
      if (M.trickleT <= 0 && aliveCount() + G.waveQueue.length < (S.cap || 5)) { M.trickleT = S.every; G.waveQueue.push(S.trickle[Math.floor(Math.random() * S.trickle.length)]); }
    }
    if (S.unlockAt && M.left > 0 && M.left <= S.unlockAt[1]) unlockPower(S.unlockAt[0]);
    if (S.kind === 'lockdown' && M.left > 0) { M.left -= dt; if (M.left <= 0) { banner("IT'S HERE", 'CLEAR THE YARD', 1.6); sfx.radio(); } }
    if (G.waveQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) { const t = G.waveQueue.shift(); spawnNow(t); spawnTimer = (t === 'auditor' || t === 'lamplighter') ? 1.6 : 0.7; }
    }
    if (S.reinforce && !G.reinforced) {
      const aud = G.enemies.find(e => e.type === 'auditor' && !e.dead);
      if (aud && aud.hp < aud.maxHp * 0.62) { G.reinforced = true; G.waveQueue.push(...S.reinforce); sayList(CHAPTER.reinforce); }
    }
    ui.left.textContent = missionText(S, M);
    if (stepDone()) {
      const last = G.stepI >= ZD(G.zone).steps.length - 1;
      if (last) zoneCleared();
      else { zoneBreak = 2.4; banner('CLEAR', 'COOLING DOWN', 1.3); hero.hp = Math.min(hero.maxHp, hero.hp + 15); resupply(); }
    }
  } else if (G.zState === 'clear') {
    ui.left.textContent = G.objective ? '▸ ' + G.objective.text : '';
    const nx = G.zone + 1;
    if (nx < ZONES.length && zoneAt(hp.x, hp.z) === nx) enterZone(nx);
    else if (nx >= ZONES.length && level.mothDoor && Math.hypot(hp.x - level.mothDoor.x, hp.z - level.mothDoor.z) < 1.9) startEnding();
  }
}
function missionText(S, M) {
  const n = aliveCount() + G.waveQueue.length;
  const enemies = `${n} CENSUS LEFT`;
  const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  switch (S.kind) {
    case 'relays': { const d = RELAYS.filter(r => !r.alive).length; return d < RELAYS.length ? `RELAYS ${d}/${RELAYS.length} · ${enemies}` : enemies; }
    case 'rescue': { const d = CAGES.filter(c => c.freed).length; return d < CAGES.length ? `FREED ${d}/${CAGES.length} · ${enemies}` : enemies; }
    case 'lockdown': return M.left > 0 ? `LAMPLIGHTER IN ${mmss(M.left)} · ${enemies}` : enemies;
    case 'chase': return G.chase ? `INFORMANT ${mmss(G.chase.left)}` : '';
    default: return enemies;
  }
}
function resupply() {
  const hp = heroCenter(); const hit = rectOf(hp.x, hp.z); if (!hit) return; const r = hit[1];
  const cnt = (t) => G.props.filter(o => o.type === t && zoneAt(o.body.position.x, o.body.position.z) === G.zone).length;
  const want = [['barrel', 2 - cnt('barrel')], ['crate', 3 - cnt('crate')], ['trash', 4 - cnt('trash') - cnt('trashR')], ['bag', 2 - cnt('bag')]];
  for (const [type, n] of want) for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 14; tries++) {
      const x = clamp(hp.x + rand(-8, 8), r[0] + 1, r[1] - 1), z = clamp(hp.z + rand(-9, 5), r[2] + 1.5, r[3] - 1.5);
      if (Math.hypot(x - hp.x, z - hp.z) < 3.5 || G.props.some(o => Math.hypot(o.body.position.x - x, o.body.position.z - z) < 1.4)) continue;
      const o = addProp(type, x, z, rand(0, 6), 1.8 + Math.random() * 0.5); o.zone = G.zone;
      FX.rings.spawn(x, 0.06, z, 0.2, 1.6, 0.6, 0x9b7bff, 0.7); break;
    }
  }
}

// ---- Warden shields ----
function dropShield(e, vel) {
  if (!e.shieldUp) return;
  e.shieldUp = false;
  const wp = new THREE.Vector3(); e.shield.getWorldPosition(wp);
  e.root.remove(e.shield);
  const o = addProp('riotshield', wp.x, wp.z, e.yaw, Math.max(1.0, wp.y)); o.zone = G.zone;
  if (vel) { o.body.velocity.set(vel.x * 0.6, 3, vel.z * 0.6); o.body.angularVelocity.set(rand(-5, 5), rand(-5, 5), rand(-5, 5)); }
  num(_v2.set(e.body.position.x, e.body.position.y + 1.4, e.body.position.z), 'SHIELD DOWN', 'psi', 0.9);
  sfx.block(); FX.sparks(wp, 16, 6, [1, 0.7, 0.3]);
  if (!G.saidShield) { G.saidShield = true; sayList(CHAPTER.wardenShield); }
}

// ---- Clerk locks: stamped things can't be lifted for a while ----
const lockTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(32, 26, 11, Math.PI, 0); x.stroke(); x.fillStyle = '#fff'; x.fillRect(16, 26, 32, 24); x.fillStyle = '#000'; x.fillRect(29, 33, 6, 10); return new THREE.CanvasTexture(c); })();
const lockIcons = [];
for (let i = 0; i < 10; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lockTex, color: new THREE.Color(2.4, 1.2, 0.3), transparent: true, depthTest: false, toneMapped: false })); sp.scale.setScalar(0.5); sp.visible = false; sp.renderOrder = 41; scene.add(sp); lockIcons.push(sp); }
function lockProp(o, t) {
  o.lockT = t; sfx.stamp();
  const p = o.body.position; FX.rings.spawn(p.x, 0.06, p.z, 0.3, 1.6, 0.5, 0xff9a30, 1);
  for (const m of o.glowMats) { m.emissive.setRGB(0.9, 0.42, 0.05); m.emissiveIntensity = 0.9; }
}
function updateLocks(dt) {
  let k = 0;
  for (const o of G.props) {
    if (!(o.lockT > 0)) continue;
    o.lockT -= dt;
    if (o.lockT <= 0) { setGlow(o, 0); continue; }
    if (k < lockIcons.length) { const sp = lockIcons[k++]; const p = o.body.position; sp.position.set(p.x, p.y + o.hh + 0.5 + Math.sin(G.rt * 4) * 0.05, p.z); sp.visible = true; sp.material.opacity = o.lockT < 2 ? (Math.sin(G.rt * 20) > 0 ? 1 : 0.3) : 1; }
  }
  for (; k < lockIcons.length; k++) lockIcons[k].visible = false;
}

// ---- Tally relays (Checkpoint Plaza) ----
const RELAYS = []; G.relays = RELAYS;
const relayMat = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.8, roughness: 0.35 });
function buildRelays() {
  if (RELAYS.length) return;
  for (const [x, z] of [[42.5, -22.5], [56, -10.5], [41.5, 0]]) {
    const g = new THREE.Group();
    for (const [ox, oz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 7, 0.1), relayMat); l.position.set(ox, 3.5, oz); l.castShadow = true; g.add(l); }
    for (let y = 0.8; y < 7; y += 1.1) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.8), relayMat); r.position.y = y; g.add(r); }
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.2, 0.25, 16), relayMat); dish.position.y = 7.2; dish.rotation.x = 0.5; g.add(dish);
    // the relay's eye is Census amber, pulsing at 1.2 Hz, with an amber pool on the ground (lighting_vfx.md Fix 9)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.3), toneMapped: false })); eye.position.y = 6.4; g.add(eye);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 1 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz / 2.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(vec3(1.0, 0.6, 0.1) * 0.22 * uA * (1.0 - r) * (1.0 - r), 1.0); }' }));
    pool.position.y = 0.03; pool.renderOrder = 2; g.add(pool);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), relayMat); base.position.y = 0.25; g.add(base);
    g.position.set(x, 0, z); scene.add(g);
    const body = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); body.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 3.6, 0.6))); body.position.set(x, 3.6, z); world.addBody(body);
    const R = { kind: 'relay', x, z, g, eye, pool, body, hp: 160, maxHp: 160, alive: true, lastHit: 0, deadT: -1 };
    body.userData = R; RELAYS.push(R);
  }
}
// relay eyes pulse while they count; a downed relay's eye goes out over 0.25 s and its pool over 0.6 s
function updateRelays() {
  for (const R of RELAYS) {
    if (R.alive) { const p = 0.75 + 0.25 * Math.sin(G.rt * 7.54); R.eye.material.color.setRGB(3 * p, 1.8 * p, 0.3 * p); R.pool.material.uniforms.uA.value = 0.8 + 0.2 * p; }
    else if (R.deadT >= 0) { const t = G.t - R.deadT; const e = Math.max(0, 1 - t / 0.25); R.eye.material.color.setRGB(3 * e, 1.8 * e, 0.3 * e); R.eye.visible = e > 0; R.pool.material.uniforms.uA.value = Math.max(0, 1 - t / 0.6); R.pool.visible = t < 0.6; }
  }
}
function clearRelays() { for (const R of RELAYS) { scene.remove(R.g); world.removeBody(R.body); } RELAYS.length = 0; }
function hitRelay(R, dmg, at) {
  if (!R.alive || G.t - R.lastHit < 0.25) return;
  R.lastHit = G.t; dmg = Math.round(dmg); if (dmg < 4) return;
  R.hp -= dmg;
  num(_v2.set(R.x, 5.5, R.z), String(dmg), dmg >= 40 ? 'big' : '', 1);
  FX.sparks(at || _v2.set(R.x, 3, R.z), 14, 6, [0.9, 0.95, 1]); sfx.impact(0.7, true); addTrauma(0.12);
  R.g.rotation.z = rand(-0.06, 0.06);
  if (R.hp <= 0) {
    R.alive = false; world.removeBody(R.body);
    FX.explosion(_v2.set(R.x, 4, R.z), 3); sfx.explosion(); addTrauma(0.5); G.glitch = Math.max(G.glitch, 0.7);
    for (let k = 0; k < 60; k++) Powers.voxels.emit(R.x, rand(1, 7), R.z, rand(-5, 5), rand(1, 6), rand(-5, 5), rand(0.1, 0.24), rand(0.6, 1.2), 2.3, 2.3, 2.6, 8);
    R.g.rotation.z = 1.35; R.g.position.y = -0.3; R.deadT = G.t; R.pool.position.y = 0.33;   // eye and pool die out below
    FX.sparks(_v2.set(R.x, 6.4, R.z), 20, 6, [1, 0.6, 0.1]);
    if (level.floodFlicker) level.floodFlicker(R.x, R.z);
    num(_v2.set(R.x, 4.5, R.z), 'RELAY DOWN', 'psi', 1.3); gainXP(50, _v2.set(R.x, 3, R.z));
    const left = RELAYS.filter(r => r.alive).length;
    sayList([left ? ['radio', `Relay down. ${left} remaining.`] : ['radio', 'All relays down. We are blind on the plaza.']]);
  }
}

// ---- Cold storage cages + the uncounted ----
const CAGES = [];
const cageMat = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.85, roughness: 0.35 });
function buildCages() {
  if (CAGES.length) return;
  for (const [x, z] of level.coldSpots) {
    const g = new THREE.Group();
    const bar = (w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cageMat); m.position.set(px, py, pz); g.add(m); };
    for (const sx of [-1.1, 1.1]) for (let k = 0; k < 6; k++) bar(0.04, 2.4, 0.04, sx, 1.2, -0.95 + k * 0.38);
    for (let k = 0; k < 11; k++) bar(0.04, 2.4, 0.04, -1.05 + k * 0.21, 1.2, -1.0);
    bar(2.3, 0.08, 2.1, 0, 2.42, 0);
    g.position.set(x, 0, z); mergeGroupByMaterial(g); scene.add(g);
    const bodies = [];
    for (const [hx, hz, cx, cz] of [[0.06, 1.05, -1.1, 0], [0.06, 1.05, 1.1, 0], [1.15, 0.06, 0, -1.0]]) { const b = new CANNON.Body({ mass: 0, collisionFilterGroup: GRP.STATIC, collisionFilterMask: ALL }); b.addShape(new CANNON.Box(new CANNON.Vec3(hx, 1.2, hz))); b.position.set(x + cx, 1.2, z + cz); world.addBody(b); bodies.push(b); }
    const door = addProp('cagedoor', x, z + 1.12, 0, 1.22); door.zone = 4; door.body.mass = 0; door.body.updateMassProperties(); door.body.type = CANNON.Body.STATIC; door.pinned = true;
    const civ = makeCiv(x, z - 0.2, CAGES.length);
    CAGES.push({ x, z, g, bodies, door, home: new THREE.Vector3(x, 1.22, z + 1.12), civ, freed: false });
  }
}
function clearCages() {
  for (const C of CAGES) { scene.remove(C.g); for (const b of C.bodies) world.removeBody(b); if (C.door.alive) removeProp(C.door); if (C.civ) removeCiv(C.civ); }
  CAGES.length = 0;
}
// the door is pinned until she lifts it; once it's dragged clear, the person inside walks out
function updateCageDoors() {
  for (const C of CAGES) {
    if (C.freed) continue;
    const d = C.door;
    if (d.pinned && d.held) { d.pinned = false; d.body.type = CANNON.Body.DYNAMIC; d.body.mass = DEFS.cagedoor.mass; d.body.updateMassProperties(); d.body.wakeUp(); }
    const gone = !d.alive || Math.hypot(d.body.position.x - C.home.x, d.body.position.z - C.home.z) > 1.8;
    if (gone && !d.pinned) {
      C.freed = true; C.civ.state = 'free'; gainXP(40, _v2.set(C.x, 1.5, C.z));
      num(_v2.set(C.x, 2.6, C.z), 'FREED', 'psi', 1.2);
      const n = CAGES.filter(c => c.freed).length;
      sayList(n === 1 ? CHAPTER.rescueOne : [['moth', n < CAGES.length ? `${n} of ${CAGES.length}.` : "That's all of them."]]);
    }
  }
}
const CIVS = []; G.civs = CIVS;
function makeCiv(x, z, i) {
  const fem = i % 2 === 1;
  // Moth's uncounted: ordinary people in ordinary clothes (no chips, no Census kit)
  // caged: crouched and cowering (motion capture); freed: they run for it
  const c = makeCharacter(fem ? 'civ_f' : 'civ_m', fem ? { idle: 'f_crouch_idle', walk: 'f_walk_cool_01', run: 'f_run_fast_01' } : { idle: 'm_crouch_idle', walk: 'm_walk_cool_01', run: 'm_run_fast_01' });
  for (const m of c.mats) if (m.color && !(m.alphaTest > 0) && /body/.test(m.name)) m.color.multiply(new THREE.Color(...[[1, 1, 1], [1, 1, 1], [1.12, 0.95, 0.85], [0.85, 0.95, 1.1]][i % 4]));
  const root = new THREE.Group(); root.add(c.obj); c.obj.position.y = 0; scene.add(root);
  root.position.set(x, 0, z); root.rotation.y = 0;
  const v = { c, root, state: 'caged', t: 0, path: [[x, z + 2.4], [-10.5, -55], [-6, -55], [-2, -48], [-1, -40]], wi: 0, fade: 1 };
  CIVS.push(v); return v;
}

// ======================= Consensus extras: people on the street (Harrow and the market only) =======================
// Counted citizens going about the evening. They clear the street when the Census starts a fight, and once in a while one of
// them skips a frame: a render seam (story seed, never more than that in Act 1).
const CROWD = []; G.crowd = CROWD; CROWD.zone = -1; CROWD.calm = 0; CROWD.spawnT = 0; CROWD.seamT = 15;
const CROWD_ZONES = {
  0: { lanes: [[-10.5, -24, 22], [10.5, -24, 22], [-9.7, -24, 22], [9.7, -24, 22]], n: 5 },
  3: { lanes: [[-3.6, -61, -29.5], [3.6, -61, -29.5], [-2.4, -61, -29.5], [2.4, -61, -29.5]], n: 5, browse: 6.0 },
};
const TINTS = [[1, 1, 1], [1.12, 0.95, 0.85], [0.85, 0.95, 1.1], [0.95, 1.05, 0.92], [1.08, 1.0, 1.08]];
let crowdN = 0;
function spawnCitizen(spec, anywhere) {
  const lane = spec.lanes[Math.floor(Math.random() * spec.lanes.length)], [lx, z0, z1] = lane;
  const fem = Math.random() < 0.5, i = crowdN++;
  const c = makeCharacter(fem ? 'civ_f' : 'civ_m', fem ? { idle: 'f_idle_neutral_01', walk: 'f_walk_cool_01', run: 'f_run_fast_01' } : { idle: 'm_idle_neutral_01', walk: 'm_walk_cool_01', run: 'm_run_fast_01' });
  const tint = TINTS[i % TINTS.length];
  for (const m of c.mats) if (m.color && !(m.alphaTest > 0) && /body/.test(m.name)) m.color.multiply(new THREE.Color(...tint));
  c.obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  const root = new THREE.Group(); root.add(c.obj); scene.add(root);
  const dir = Math.random() < 0.5 ? 1 : -1, z = anywhere ? z0 + Math.random() * (z1 - z0) : (dir > 0 ? z0 : z1);
  root.position.set(lx + (Math.random() - 0.5) * 0.4, 0, z);
  const v = { c, root, lane, dir, state: 'walk', t: 0, pause: 0, side: 0, seam: 0, fade: anywhere ? 1 : 0, tagI: i, speed: 1.05 + Math.random() * 0.35 };
  CROWD.push(v); return v;
}
function clearCrowd() { for (const v of CROWD) scene.remove(v.root); CROWD.length = 0; }
function updateCrowd(dt) {
  const spec = CROWD_ZONES[G.zone];
  if (!spec || G.mode !== 'play') { if (CROWD.length) clearCrowd(); CROWD.zone = -1; return; }
  if (CROWD.zone !== G.zone) { clearCrowd(); CROWD.zone = G.zone; CROWD.calm = 0; CROWD.filled = false; }
  const fight = G.enemies.some(e => e.alive && !e.dead && e.state !== 'spawn');
  CROWD.calm = fight ? 0 : CROWD.calm + dt;
  if (!fight && CROWD.length < spec.n) {
    if (!CROWD.filled) { CROWD.filled = true; while (CROWD.length < spec.n) spawnCitizen(spec, true); }      // the street is already busy when you arrive
    else if (CROWD.calm > 2 && (CROWD.spawnT -= dt) <= 0) { spawnCitizen(spec, false); CROWD.spawnT = 2 + Math.random() * 3; }
  }
  CROWD.seamT -= dt;
  if (CROWD.seamT <= 0 && CROWD.length) { CROWD[Math.floor(Math.random() * CROWD.length)].seam = 0.1; CROWD.seamT = 16 + Math.random() * 8; }
  const hp = hero.body.position;
  for (const v of [...CROWD]) {
    const [lx, z0, z1] = v.lane, r = v.root;
    v.t += dt; let speed = 0;
    if (fight && v.state !== 'flee') { v.state = 'flee'; v.dir = (r.position.z - z0) < (z1 - r.position.z) ? -1 : 1; }
    if (v.state === 'flee') { speed = 3.4; v.fade = Math.min(1, v.fade + dt); }
    else if (v.pause > 0) { v.pause -= dt; r.rotation.y += ((lx < 0 ? -Math.PI / 2 : Math.PI / 2) - r.rotation.y) * Math.min(1, dt * 4); }
    else {
      speed = v.speed; v.fade = Math.min(1, v.fade + dt * 1.5);
      if (spec.browse && Math.random() < dt / spec.browse) v.pause = 2 + Math.random() * 2.5;     // stop at a stall
    }
    if (speed > 0) {
      // step aside for her
      const dxh = hp.x - r.position.x, dzh = hp.z - r.position.z, dh = Math.hypot(dxh, dzh);
      v.side += ((dh < 1.4 ? -Math.sign(dxh || 1) * 0.9 : 0) - v.side) * Math.min(1, dt * 3);
      r.position.z += v.dir * speed * dt; r.position.x += ((lx + v.side) - r.position.x) * Math.min(1, dt * 2);
      r.rotation.y = v.dir > 0 ? 0 : Math.PI;
      const end = v.dir > 0 ? z1 : z0;
      if ((v.dir > 0 && r.position.z >= end) || (v.dir < 0 && r.position.z <= end)) {
        if (v.state === 'flee') { scene.remove(r); CROWD.splice(CROWD.indexOf(v), 1); continue; }
        v.dir = -v.dir;
      }
    }
    if (v.seam > 0) { v.seam -= dt; r.visible = false; } else r.visible = true;
    r.scale.setScalar(0.6 + 0.4 * v.fade);
    blendLocomotion(v.c, speed, dt, 1.45, 5.0); v.c.mixer.update(dt);
  }
}

function removeCiv(v) { scene.remove(v.root); const i = CIVS.indexOf(v); if (i >= 0) CIVS.splice(i, 1); }
function updateCivs(dt) {
  if (!CAGES.length) return;
  updateCageDoors();
  for (const v of [...CIVS]) {
    v.t += dt;
    let speed = 0;
    if (v.state === 'caged') { v.root.rotation.y = Math.PI + Math.sin(v.t * 0.7 + v.wi) * 0.4; }
    else if (v.state === 'free') {
      const wp = v.path[Math.min(v.wi, v.path.length - 1)];
      const dx = wp[0] - v.root.position.x, dz = wp[1] - v.root.position.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { v.wi++; if (v.wi >= v.path.length) { v.state = 'gone'; } }
      speed = 3.6;
      v.root.position.x += dx / (d || 1) * speed * dt; v.root.position.z += dz / (d || 1) * speed * dt;
      v.root.rotation.y += (Math.atan2(dx, dz) - v.root.rotation.y) * Math.min(1, dt * 8);
    } else if (v.state === 'gone') { v.fade -= dt * 1.5; v.root.scale.setScalar(Math.max(0.01, v.fade)); if (v.fade <= 0) { FX.psi(_v2.set(v.root.position.x, 1, v.root.position.z), 12, 2, 0.25, 0.6); removeCiv(v); continue; } }
    blendLocomotion(v.c, speed, dt, 1.45, 5.0); v.c.mixer.update(dt);
  }
}

// ---- the informant chase (Container Yard) ----
function startChase(S) {
  const path = [[48, -95], [57, -103], [57, -111], [50, -114], [50, -121], [62, -121.5], [64, -131], [78, -133.5]];
  const e = spawnEnemy('informant', 44, -94.5); attach(e); e.state = 'move'; e.fade = 1; e.model.scale.setScalar(1);
  G.chase = { e, path, wi: 0, left: S.time, done: false };
  setObjective(null);
}
function chaseCaught() {
  const C = G.chase; if (!C || C.done) return;
  C.done = true; G.mission.done = true; G.mission.caught = true;
  num(_v2.set(C.e.body.position.x, 2.4, C.e.body.position.z), 'ROUTE KEY', 'psi', 1.3); gainXP(120, C.e.body.position);
  sayList(CHAPTER.chaseCaught); G.chase = null;
}
function chaseEscaped() {
  const C = G.chase; if (!C || C.done) return;
  C.done = true; G.mission.done = true;
  if (C.e.alive) { FX.psi(_v2.set(C.e.body.position.x, 1, C.e.body.position.z), 16, 2.5, 0.25, 0.7); removeEnemy(C.e); }
  sayList(CHAPTER.chaseLost);
  const S = ZD(G.zone).steps[G.stepI + 1]; if (S && S.list) S.list.push('counter', 'marksman', 'counter');
  G.chase = null;
}
function updateChase(dt) {
  const C = G.chase; if (!C || C.done) return;
  C.left -= dt;
  const e = C.e;
  if (!e.alive || e.dead || e.held || e.state === 'ragdoll' || e.state === 'gripped') { chaseCaught(); return; }
  if (C.left <= 0) chaseEscaped();
}

// ---- memory fragments: hidden in every area ----
const FRAGS = [];
const fragMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 3.0), toneMapped: false, transparent: true });
function buildFragments() {
  CHAPTER.zones.forEach((Z, zi) => (Z.frags || []).forEach(([x, z, text], k) => {
    const id = `c1z${zi}f${k}`;
    if (PROG.frags && PROG.frags.includes(id)) return;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), fragMat); m.position.set(x, 1.0, z); scene.add(m);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: sharedHalo(), color: new THREE.Color(0.8, 0.5, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(1.3); m.add(h);
    FRAGS.push({ id, m, x, z, text, zone: zi });
  }));
}
function updateFragments(dt) {
  const hp = heroCenter();
  for (let i = FRAGS.length - 1; i >= 0; i--) {
    const f = FRAGS[i];
    f.m.rotation.y += dt * 2; f.m.position.y = 1.0 + Math.sin(G.rt * 2 + i) * 0.12;
    if (Math.hypot(hp.x - f.x, hp.z - f.z) < 1.3) {
      scene.remove(f.m); FRAGS.splice(i, 1);
      PROG.frags = PROG.frags || []; PROG.frags.push(f.id); saveProgress();
      gainXP(45, _v2.set(f.x, 1.2, f.z)); sfx.levelUp(); G.glitch = Math.max(G.glitch, 0.25);
      num(_v2.set(f.x, 2.2, f.z), 'MEMORY RECOVERED', 'psi', 1.0);
      DLG.q.unshift({ w: 'memory', t: f.text });
      if (!G.saidFrag && fragCount() === 1) { G.saidFrag = true; sayList(CHAPTER.firstFragment); }
    }
  }
}
function fragCount() { return (PROG.frags || []).filter(id => id.startsWith('c1')).length; }
function fragTotal() { return CHAPTER.zones.reduce((n, Z) => n + (Z.frags ? Z.frags.length : 0), 0); }

// ======================= XP =======================
let lvlToastT = 0;
function gainXP(n, at) {
  const up = addXP(n);
  if (at) num(_v2.set(at.x, at.y + 1.9, at.z), '+' + Math.round(n) + ' XP', 'xp', 0.7);
  if (up) {
    applyStats(true);
    banner('LEVEL ' + PROG.level, 'NEW INK AVAILABLE · TAP THE ARM', 2.2); sfx.levelUp();
    const hp = heroCenter(); Powers.halos.spawn(_v2.set(hp.x, hp.y + 0.6, hp.z), 0.5, 4, 0.5, new THREE.Color(1.2, 0.8, 2.6), 0.6);
    lvlToastT = 6;
  }
}
function applyStats(refill) {
  const mh = stat.maxHp(), mf = stat.maxFocus();
  if (refill) { hero.hp += mh - hero.maxHp; hero.focus += mf - hero.maxFocus; }
  hero.maxHp = mh; hero.maxFocus = mf;
  hero.hp = Math.min(hero.hp, mh); hero.focus = Math.min(hero.focus, mf);
}

// ======================= dialogue =======================
const DLG = { q: [], cur: null, t: 0, shown: 0 };
const WHO = { null: 'NULL', rem: 'REM', radio: 'CENSUS RADIO', auditor: 'THE AUDITOR', moth: 'MOTH', rook: 'INSPECTOR ROOK', weil: 'REGISTRAR WEIL', memory: 'MEMORY' };
function sayList(lines) { if (lines) for (const [w, t] of lines) DLG.q.push({ w, t }); }
function updateDialogue(rdt) {
  const box = ui.dlg;
  if (!DLG.cur) {
    if (!DLG.q.length) { if (box.classList.contains('show')) box.classList.remove('show'); return; }
    DLG.cur = DLG.q.shift(); DLG.t = 0; DLG.shown = -1;
    box.className = 'show ' + DLG.cur.w; ui.dlgWho.textContent = WHO[DLG.cur.w] || DLG.cur.w.toUpperCase();
    if (DLG.cur.w === 'radio') sfx.radio(); else if (DLG.cur.w === 'rem') sfx.rem();
  }
  DLG.t += rdt;
  const n = Math.min(DLG.cur.t.length, Math.floor(DLG.t * 48));
  if (n !== DLG.shown) { DLG.shown = n; ui.dlgLine.textContent = DLG.cur.t.slice(0, n); }
  const hold = 1.4 + DLG.cur.t.length * 0.045;
  if (DLG.t > DLG.cur.t.length / 48 + hold) { DLG.cur = null; if (!DLG.q.length) box.classList.remove('show'); }
}
function clearDialogue() { DLG.q.length = 0; DLG.cur = null; ui.dlg.classList.remove('show'); }

// ======================= ending: below Pier 9 =======================
function startEnding() {
  G.mode = 'ending'; setObjective(null); clearDialogue();
  for (const h of [...G.holds.values()]) { endHold(h); dropObj(h.obj); }
  PROG.checkpoint = 0; PROG.done = true; saveProgress();
  const run = G.runId;
  $('fade').classList.add('on');
  setTimeout(() => { if (G.runId !== run) return; showMoth(); }, 1300);
}
function showMoth() {
  const el = $('moth'), box = $('mothlines');
  el.classList.remove('hidden'); box.innerHTML = '';
  $('mothtally').textContent = '';
  let i = 0;
  const lines = CHAPTER.ending;
  const next = () => {
    if (i >= lines.length) { el.onclick = null; setTimeout(() => { el.classList.add('hidden'); $('fade').classList.remove('on'); showEnd(true); }, 900); return; }
    const [w, t] = lines[i++];
    const d = document.createElement('div'); d.className = 'ml ' + w; d.innerHTML = `<b>${WHO[w]}</b><span>${t}</span>`; box.appendChild(d);
    requestAnimationFrame(() => d.classList.add('in'));
    if (/Forty-two/.test(t)) $('mothtally').textContent = tally(42);
    sfx.ui();
  };
  next();
  let timer = setInterval(() => { if (el.classList.contains('hidden')) { clearInterval(timer); return; } next(); if (i > lines.length) clearInterval(timer); }, 2600);
  el.onclick = () => { next(); };
}
function tally(n) { let s = ''; for (let k = 0; k < n; k++) s += (k % 5 === 4) ? '̸ ' : '|'; return s; }

function heroDown() {
  hero.dead = true; hero.hp = 0; G.mode = 'dead';
  G.slowT = 1.5; G.slowScale = 0.25;
  for (const h of [...G.holds.values()]) { endHold(h); dropObj(h.obj); }
  const run = G.runId; setTimeout(() => { if (G.runId === run && G.mode === 'dead') showEnd(false); }, 1400);
}
function showEnd(won) {
  G.mode = won ? 'win' : G.mode;
  if (won) sfx.win();
  $('endtitle').textContent = won ? `CHAPTER ${CHAPTER.num} COMPLETE` : 'SIGNAL LOST';
  $('endquote').textContent = won ? '"Count me out."' : '"Not like this. Not again."';
  $('endnext').textContent = won ? 'NEXT · CHAPTER 2: THE DEPOSITORY · IN DEVELOPMENT' : `RESTART AT ${ZONES[PROG.checkpoint].name}`;
  $('againbtn').textContent = won ? 'REPLAY CHAPTER' : 'AGAIN';
  const s = G.stats; const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
  $('endstats').innerHTML = [
    [s.kills, 'CENSUS DOWN'], [s.throws, 'THROWS'], [s.maxCombo, 'BEST COMBO'], [s.catches, 'GRENADES CAUGHT'], [`${fragCount()}/${fragTotal()}`, 'MEMORIES'], ['LV ' + PROG.level, 'LEVEL'],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  $('end').classList.remove('hidden');
}

function resetGame() {
  for (const e of [...G.enemies]) removeEnemy(e);
  for (const g of [...G.grenades]) removeGrenade(g);
  for (const B of G.bolts) scene.remove(B.m); G.bolts.length = 0;
  G.holds.clear(); input.pointers.clear();
  for (const b of Powers.brackets.list) { b.obj = null; b.out = 0; b.m.visible = false; }
  Powers.reticles.clear(); G.freeze = 0; G.glitch = 0; G.surge = null;
  resetProps();
  applyStats(false);
  hero.hp = hero.maxHp; hero.focus = hero.maxFocus; hero.dead = false; hero.levitate = 0; hero.invuln = 0;
  const st = ZONES[PROG.checkpoint].start;
  hero.body.position.set(st[0], 0.85, st[1]); hero.body.velocity.set(0, 0, 0);
  G.ult = 0; G.ultState = null; G.combo = 0; G.surgeCD = 0; G.trauma = 0;
  G.waveQueue = []; G.zState = 'none'; G.chase = null; G.mission = null;
  for (const v of [...CIVS]) removeCiv(v);
  clearDialogue(); setObjective(null);
  if (!G.stats || G.mode !== 'dead') G.stats = { throws: 0, hits: 0, kills: 0, maxCombo: 0, time: 0, blocks: 0, catches: 0 };
  camState.init = false;
}

// ======================= camera =======================
const camState = { look: new THREE.Vector3(0, 0, 8), init: false, dist: 20, orbit: 0 };
function updateCamera(rdt) {
  if (G.camOverride) { const o = G.camOverride; camera.position.set(o[0], o[1], o[2]); camera.lookAt(o[3], o[4], o[5]); return; }   // debug photo booth
  const hp = heroCenter();
  const aspect = G.W / G.H;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const pr = rectOf(hp.x, hp.z, 0.2), wantPitch = (pr && pr[1][4] && pr[1][4].pitch) || (aspect < 1 ? 51 : 48);
  camState.pitchDeg = camState.pitchDeg || wantPitch;
  camState.pitchDeg += (wantPitch - camState.pitchDeg) * damp(4, rdt);
  const pitch = THREE.MathUtils.degToRad(camState.pitchDeg);
  let dist = aspect < 1 ? clamp(5.5 / (Math.tan(fov / 2) * aspect), 11, 19.5) : 14;   // a touch closer on phones: characters read bigger
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
  const hit = rectOf(hp.x, hp.z, 0) || rectOf(hp.x, hp.z, 1.5);   // the rect she's actually in first: a padded neighbour at a junction would clamp her off-screen
  let cx = hp.x + v.x * 0.18, cz = hp.z - 2.0 + v.z * 0.18;
  if (hit) {
    const r = hit[1], o = r[4] || {};
    const mx = Math.min(5.2, (r[1] - r[0]) / 2), mzN = o.openN ? 3.5 : 6, mzS = 6.4;
    cx = (r[1] - r[0]) <= 2 * mx ? (r[0] + r[1]) / 2 : clamp(cx, r[0] + mx, r[1] - mx);
    cz = (r[3] - r[2]) <= mzN + mzS ? (r[2] + r[3]) / 2 - 1 : clamp(cz, r[2] + mzN, r[3] - mzS);
    if (o.openW) cx = Math.max(cx, r[0] + 2.5) ;
  }
  const tgt = _v1.set(cx, 0, cz);
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
const COMBO_NAMES = [[10, 'KERNEL PANIC'], [7, 'OVERFLOW'], [4, 'CASCADE'], [2, 'PING']];
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
  updateDialogue(rdt); updateBeacon(rdt);
  ui.xp.style.transform = `scaleX(${PROG.level >= 20 ? 1 : clamp(PROG.xp / xpToNext(PROG.level), 0, 1)})`;
  const lvTxt = 'LV ' + PROG.level; if (ui.arm.textContent !== lvTxt) ui.arm.textContent = lvTxt;
  ui.arm.classList.toggle('pts', PROG.points > 0);
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
  if (hero.focusDelay <= 0 && !G.holds.size) hero.focus = Math.min(hero.maxFocus, hero.focus + TUNE.FOCUS_REGEN * stat.focusRegen() * dt);
  if (G.t - hero.lastHurt > 4 && !hero.dead) hero.hp = Math.min(hero.maxHp, hero.hp + 2.5 * stat.regen() * dt);
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

function titleButtons() {
  const has = PROG.checkpoint > 0 || PROG.level > 1;
  $('startbtn').textContent = PROG.checkpoint > 0 ? 'CONTINUE · ' + ZONES[PROG.checkpoint].name : 'OVERCLOCK';
  $('newbtn').classList.toggle('hidden', !has);
}
let confirmNew = false, armWasPaused = false;
$('newbtn').addEventListener('click', () => {
  if (!confirmNew) { confirmNew = true; $('newbtn').textContent = 'TAP AGAIN TO WIPE SAVE'; return; }
  resetAll(); confirmNew = false; $('newbtn').textContent = 'START OVER (WIPES SAVE)'; applyStats(false); syncPowerButtons(); titleButtons(); sfx.ui();
});
function openArm() {
  armWasPaused = G.paused;
  if (G.mode === 'play' || G.mode === 'intro') G.paused = true;
  $('pause').classList.add('hidden');
  renderArm(); $('arm').classList.remove('hidden'); sfx.ui();
}
function closeArm() {
  $('arm').classList.add('hidden');
  if (armWasPaused) $('pause').classList.remove('hidden'); else G.paused = false;
  sfx.ui();
}
function renderArm() {
  $('armpts').textContent = PROG.points > 0 ? `LEVEL ${PROG.level} · ${PROG.points} INK TO SPEND` : `LEVEL ${PROG.level} · ${Math.round(PROG.xp)} / ${xpToNext(PROG.level)} XP TO NEXT`;
  $('armlist').innerHTML = SKILLS.map(sk => {
    const r = rank(sk.id), marks = '|'.repeat(r) + '<i>' + '|'.repeat(MAX_RANK - r) + '</i>';
    const gate = sk.id === 'surge' ? 'surge' : sk.id === 'root' ? 'root' : null;
    if (gate && !hasPower(gate)) return `<div class="sk locked"><div class="t"><div class="n">? ? ?</div><div class="d">A power you haven't remembered yet.</div></div><div class="r"><i>|||</i></div><button disabled>LOCKED</button></div>`;
    return `<div class="sk"><div class="t"><div class="n">${sk.ink}</div><div class="d">${sk.what}</div></div><div class="r">${marks}</div><button data-sk="${sk.id}" ${PROG.points > 0 && r < MAX_RANK ? '' : 'disabled'}>INK</button></div>`;
  }).join('');
  $('armtally').textContent = 'IRIS CALLOWAY. THAT’S YOU.  ' + tally(PROG.done ? 42 : 41);
  for (const b of $('armlist').querySelectorAll('button')) b.addEventListener('click', () => { if (buySkill(b.dataset.sk)) { applyStats(true); sfx.ink(); renderArm(); } });
}
$('armbtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); openArm(); });
$('armbtn2').addEventListener('click', () => openArm());
$('armclose').addEventListener('click', () => closeArm());

function beginRun() {
  const from = PROG.checkpoint || 0;
  syncUnlocksForCheckpoint(from); syncPowerButtons();
  G.mode = 'intro'; camState.init = false;
  ui.top.style.display = 'flex'; ui.btns.style.display = 'flex';
  G.unlocked = from; setGates(from);
  const run = (G.runId = (G.runId || 0) + 1);
  setTimeout(() => { if (G.runId !== run || G.mode !== 'intro') return; G.mode = 'play'; enterZone(from); }, 1300);
  const st = ZONES[from].start;
  FX.rings.spawn(st[0], 0.1, st[1], 0.3, 4, 0.8, 0x9b7bff, 1);
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
  try { G.bloomKick = Math.max(0, (G.bloomKick || 0) - rdt * 2.2); bloom.strength = 0.55 + Math.min(0.45, G.bloomKick); Shock.update(rdt, grade.uniforms, camera, G.W, G.H); grade.uniforms.uTime.value = G.rt % 100; G.glitch = Math.max(0, (G.glitch || 0) - rdt * 2.4); grade.uniforms.uGlitch.value = Math.min(1, G.glitch); G.freeze = G.freeze || 0; G.freezeV = (G.freezeV || 0) + (G.freeze - (G.freezeV || 0)) * Math.min(1, rdt * 9); grade.uniforms.uFreeze.value = G.freezeV; renderer.info.reset(); wet.render(renderer, scene, camera); G.wetCalls = renderer.info.render.calls; composer.render(); G.rinfo = [renderer.info.render.calls, renderer.info.render.triangles, G.wetCalls]; } catch (err) { reportError(err); }
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
    safe(updateEdits, dt);
    safe(updateGlass, dt);
    safe(updateWaves, dt);
    safe(updateGuide, dt);
    safe(updateNav, rdt);
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
  // tethers run from Null's mind (her brow) to whatever she holds
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
  Powers.update(G.ultState ? rdt : (dt > 0 ? dt : rdt * 0.2));   // she acts outside frozen time
  updateArcs(rdt);
  updateCamera(rdt);
  FX.numbers.update(rdt, camera);
  level.update(rdt, camState.look);
  if (cyber) safe(() => cyber.update(rdt, camState.look, heroCenter()));
  if (G.digit) safe(() => G.digit.update(rdt, G.props));
  if (G.trails) safe(() => G.trails.update(G.bolts, G.props));
  if (G.tally) safe(() => G.tally.update(rdt));
  updateUI(rdt);
}
const PERF = { js: 0, render: 0, rdt: 0 }; window.__perf = PERF;
boot();
window.__G = G; // debug hook
window.__dbg = {
  snap: () => { camState.init = false; },
  rstats: () => G.rinfo,
  drawProfile: () => new Promise(res => {
    const orig = renderer.renderBufferDirect.bind(renderer), counts = {};
    renderer.renderBufferDirect = (cam, sc, geo, mat, obj, grp) => {
      let top = obj; while (top.parent && top.parent !== scene) top = top.parent;
      const pr = G.props.find(p => p.mesh === top), en = G.enemies.find(e => e.root === top || e.char === top || (e.char && e.char.parent === top));
      let tag = (pr ? 'prop:' + pr.type : en ? 'enemy:' + en.type : top === hero.root ? 'hero' : top.userData.batched ? 'batched' : (top.name || top.type)) + (mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial ? ' [shadow]' : ' ' + mat.type);
      counts[tag] = (counts[tag] || 0) + 1; return orig(cam, sc, geo, mat, obj, grp);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => { renderer.renderBufferDirect = orig; res(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40)); }));
  }),
  camPos: () => [camera.position.x, camera.position.y, camera.position.z, camState.look.x, camState.look.z].map(v => Math.round(v * 10) / 10),
  edits: () => EDITS.map(E => E.kind), ageEdits: (t) => { for (const E of EDITS) E.t += t; }, rewriteWorld: (x, y, z) => { toScreen(new THREE.Vector3(x, y, z), _sp); return rewriteAt(99, _sp.x, _sp.y); }, gates: () => level.gates.map(g => [g.pos.x, g.pos.z, g.open]), heat: () => hero.focus,
  wallNear: () => { const hp = heroCenter(); let best = null, bd = 1e9; for (const b of wallBodies()) { const d = boxDistXZ(b, hp); if (d < bd) { bd = d; best = b; } } return best ? [best.position.x, best.position.z, best.shapes[0].halfExtents.x, best.shapes[0].halfExtents.z, bd] : null; },
  toScreen: (x, y, z) => { const o = {}; toScreen({ x, y, z }, o); return [o.x, o.y]; },
  cam: (...o) => { G.camOverride = o.length ? o : null; },
  freeze: (on) => { for (const e of G.enemies) { e.atkCD = on ? 999 : 1; } G.booth = !!on; },
  dmg: (i, n, dx = 0, dz = -1) => { const e = G.enemies[i < 0 ? G.enemies.length + i : i]; if (e) damageEnemy(e, n, new THREE.Vector3(dx, 0, dz), 6, 'hit'); },
  pose: (i, st) => { const e = G.enemies[i]; if (e) e.boothState = st; },
  spawn: (t, x, z) => { const e = spawnEnemy(t, x, z); attach(e); return G.enemies.length; },
  zone: (i) => { syncUnlocksForCheckpoint(i); for (const e of [...G.enemies]) removeEnemy(e); G.waveQueue = []; G.chase = null; G.mode = 'play'; G.unlocked = i; setGates(i); ensureZoneProps(i); const st = ZONES[i].start; hero.body.position.set(st[0], 0.85, st[1]); camState.init = false; enterZone(i); },
  clearZone: () => { for (const e of [...G.enemies]) removeEnemy(e); G.waveQueue = []; G.chase = null; G.stepI = ZD(G.zone).steps.length - 1; zoneCleared(); },
  step: () => G.mission,
  xp: (n) => gainXP(n),
  skipBreak: () => { if (zoneBreak > 0) zoneBreak = 0.01; spawnTimer = 0; },
  arm: () => openArm(),
  ending: () => startEnding(),
  surge: () => { unlockPower('surge', true); doSurge(); }, ult: () => { unlockPower('root', true); G.ult = 100; startUlt(); },
  unlock: (k) => unlockPower(k),
  grabFlier: (i) => { const f = cyber.fliers[i]; if (!f || !f.on) return null; toScreen(f.o.position, _sp); return api.tryGrab(77, _sp.x, _sp.y); },
  grabProp: (type) => { const hp = hero.body.position; let best = null, bd = 1e9; for (const o of G.props) { if (!o.alive || o.held || (type && o.type !== type)) continue; const d = Math.hypot(o.body.position.x - hp.x, o.body.position.z - hp.z); if (d < bd) { bd = d; best = o; } } if (!best) return null; startHold(77, best, G.W / 2, G.H / 2); return [best.type, Math.round(bd * 10) / 10]; },
  grabEnemy: () => { const e = G.enemies.find(e => !e.dead && e.def.grip && e.state !== 'spawn'); if (!e) return false; startHold(77, e, G.W / 2, G.H / 2); return true; },
  release: (vx, vy) => { const h = G.holds.get(77); if (!h) return false; endHold(h); if (vx) throwObj(h.obj, G.W / 2, G.H / 2, vx, vy, Math.hypot(vx, vy)); else dropObj(h.obj); return true; },
  closeup: (on, dist = 3.2, h = 1.4, yawOff = 0) => { G.closeup = on ? { dist, h, yawOff } : null; },
  dmgHeld: (d) => { for (const h of [...G.holds.values()]) damageProp(h.obj, d, null, 'bolt'); },
  dmgType: (t, d) => { const o = G.props.find(o => o.type === t); if (o) damageProp(o, d, null, 'bolt'); return !!o; },
  hitRelay: (i, d) => { const R = RELAYS[i]; if (R) { R.lastHit = -9; hitRelay(R, d, null); } return RELAYS.map(r => r.alive); },
  holdObj: (pred) => { const o = G.props.find(pred); if (!o) return false; startHold(78, o, G.W / 2, G.H / 2); return true; },
  holdDoor: (i) => { const C = CAGES[i]; if (!C) return false; startHold(78, C.door, G.W / 2, G.H / 2); return true; },
  dropHeld: () => { const h = G.holds.get(78); if (h) { endHold(h); dropObj(h.obj); } },
  moveHeld: (x, z) => { const h = G.holds.get(78); if (h) { h.obj.body.position.x = x; h.obj.body.position.z = z; } },
  setLeft: (t) => { if (G.mission) G.mission.left = t; if (G.chase) G.chase.left = t; },
  hurt: (type, frac) => { const e = G.enemies.find(e => e.type === type && !e.dead); if (e) damageEnemy(e, Math.round(e.maxHp * frac), null, 0, 'hit'); return e ? e.hp : null; },
  killAll: () => { for (const e of [...G.enemies]) if (!e.dead && e.type !== 'auditor' && e.type !== 'lamplighter') damageEnemy(e, 999, null, 0, 'hit'); },
  state: () => ({ zone: G.zone, zs: G.zState, step: G.stepI, kind: G.mission && G.mission.kind, left: G.mission && G.mission.left, ret: G.mission && G.mission.retreated, chase: G.chase && { wi: G.chase.wi, left: G.chase.left }, cages: CAGES.map(c => c.freed), relays: RELAYS.map(r => r.alive), en: G.enemies.filter(e => !e.dead).map(e => e.type + ':' + Math.round(e.hp) + ':' + e.state).join(','), q: G.waveQueue.length, obj: G.objective && G.objective.text, err: G.lastErr || null }),
  grenade: (x, z) => { spawnGrenade(new THREE.Vector3(x, 1.2, z - 6), new THREE.Vector3(x, 0.3, z), 1.0); },
};
