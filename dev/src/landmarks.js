// One landmark per zone, readable from the gameplay camera (environment artist, Fix 9).
// A player should be able to say where they are from a single frame without reading the HUD.
import * as THREE from 'three';
import { G, rand } from './state.js';

const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
const font = (px) => `${px}px "Bebas Neue", Impact, sans-serif`;

// a 7-segment digit, drawn as rounded bars (the Census ledger look)
function seg7(x, ch, cx, cy, w, h, t) {
  const S = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }[ch] || '';
  const bar = (x0, y0, x1, y1) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  x.lineWidth = t; x.lineCap = 'round';
  const L = cx, R = cx + w, T = cy, M = cy + h / 2, B = cy + h, p = t * 0.7;
  if (S.includes('a')) bar(L + p, T, R - p, T); if (S.includes('b')) bar(R, T + p, R, M - p); if (S.includes('c')) bar(R, M + p, R, B - p);
  if (S.includes('d')) bar(L + p, B, R - p, B); if (S.includes('e')) bar(L, M + p, L, B - p); if (S.includes('f')) bar(L, T + p, L, M - p); if (S.includes('g')) bar(L + p, M, R - p, M);
}

export function buildLandmarks(C, H) {
  const { scene, sign, addSpot, L } = C;
  const { metal, stat, statCyl, mesh, glowMat } = H;
  const ticks = [];

  // ---------------- Zone 0, Harrow Street: twin steam stacks (orange-and-white, rust, soot), steam rolling off them
  {
    const tex = canvasTex(64, 256, (x, w, h) => {
      for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#9e3b2a' : '#c9c3b5'; x.fillRect(0, k * h / 8, w, h / 8 + 1); }
      const g = x.createLinearGradient(0, 0, 0, 22); g.addColorStop(0, 'rgba(10,9,8,0.95)'); g.addColorStop(1, 'rgba(10,9,8,0)'); x.fillStyle = g; x.fillRect(0, 0, w, 22);
      x.fillStyle = 'rgba(90,40,20,0.45)'; for (let k = 0; k < 14; k++) { const px = Math.random() * w; x.fillRect(px, Math.random() * h * 0.6, 1.5, 10 + Math.random() * 40); }
    });
    const stackMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5, metalness: 0.4 });
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x9e3b2a, roughness: 0.6 });
    const hole = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.4, metalness: 0.8 });
    L.stacks = [];
    for (const [x, z] of [[-2.6, -8.2], [3.1, 8.8]]) {
      mesh(new THREE.CylinderGeometry(0.33, 0.36, 2.4, 14), stackMat, x, 1.2, z, 0); statCyl(x, 1.2, z, 0.38, 2.4);
      for (const [px, pz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), postMat, x + px, 0.45, z + pz, 0);
      for (const [cx, cz, ry] of [[0, -0.8, 0], [0.8, 0, Math.PI / 2], [0, 0.8, 0], [-0.8, 0, Math.PI / 2]]) mesh(new THREE.BoxGeometry(1.6, 0.05, 0.02), chainMat, x + cx, 0.74, z + cz, ry, false);
      const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20), hole); mh.position.set(x + 1.4, 0.012, z + 0.6); mh.receiveShadow = true; scene.add(mh);
      L.stacks.push([x, z]);
    }
    ticks.push((dt, center) => {
      if (!G.fx) return;
      for (const [x, z] of L.stacks) if (Math.abs(z - center.z) < 24) for (let k = 0; k < 2; k++)
        G.fx.smoke.emit(x + rand(-0.15, 0.15), 2.45, z + rand(-0.15, 0.15), rand(-0.25, 0.25), rand(1.2, 2.0), rand(-0.25, 0.25), 0.85, 0.86, 0.9, rand(1.6, 2.8), 0.5, 1.1, -0.1, 0.6, 0.7);
    });
  }

  // ---------------- Zone 1, Checkpoint Plaza: the floor counts the city
  {
    let shown = -1;
    const c = document.createElement('canvas'); c.width = 512; c.height = 640; const tex = new THREE.CanvasTexture(c);
    const paint = (n) => {
      const x = c.getContext('2d'); x.clearRect(0, 0, 512, 640);
      x.strokeStyle = 'rgba(255,138,30,0.18)'; x.lineWidth = 2; for (let k = 0; k <= 512; k += 49) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 640); x.stroke(); } for (let k = 0; k <= 640; k += 49) { x.beginPath(); x.moveTo(0, k); x.lineTo(512, k); x.stroke(); }
      x.strokeStyle = '#ff8a1e'; x.fillStyle = '#ff8a1e';
      // tally-mark border
      x.lineWidth = 4; for (let k = 0; k < 40; k++) { const px = 14 + k * 12.3; x.beginPath(); x.moveTo(px, 10); x.lineTo(px, 34); x.stroke(); x.beginPath(); x.moveTo(px, 606); x.lineTo(px, 630); x.stroke(); }
      for (let k = 0; k < 40; k += 5) { x.beginPath(); x.moveTo(14 + k * 12.3 - 4, 30); x.lineTo(14 + (k + 4) * 12.3 + 4, 14); x.stroke(); x.beginPath(); x.moveTo(14 + k * 12.3 - 4, 626); x.lineTo(14 + (k + 4) * 12.3 + 4, 610); x.stroke(); }
      // the count, in 7-segment
      const s = String(n).padStart(7, ' '), dw = 46, gap = 14, total = 7 * dw + 6 * gap + 30;
      let px = (512 - total) / 2;
      [...s].forEach((ch, i) => { if (ch !== ' ') seg7(x, ch, px, 210, dw, 110, 11); px += dw + gap + (i === 0 || i === 3 ? 15 : 0); });
      x.font = font(64); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EVERYONE COUNTS', 256, 410);
      x.font = font(28); x.globalAlpha = 0.7; x.fillText('CENSUS OF THE CITY OF CANTOR SOUND', 256, 462); x.globalAlpha = 1;
      tex.needsUpdate = true; shown = n;
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 10.4), new THREE.ShaderMaterial({ uniforms: { tMap: { value: tex }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tMap; uniform float uTime; varying vec2 vU; float hs(float n){ return fract(sin(n) * 43758.5453); } void main(){ float row = floor(vU.y * 80.0); float gl = step(0.985, hs(row + floor(uTime * 9.0))) * 0.02; vec4 t = texture2D(tMap, vec2(vU.x + gl, vU.y)); float scan = 0.8 + 0.2 * step(0.5, fract(gl_FragCoord.y / 3.0)); float sweep = smoothstep(0.03, 0.0, abs(fract(uTime * 0.25) - vU.y)) * 0.6; gl_FragColor = vec4(vec3(1.0, 0.54, 0.12) * (t.a * 0.75 * scan + sweep * t.a), 1.0); }' }));
    m.rotation.x = -Math.PI / 2; m.position.set(46, 0.013, -13); m.renderOrder = 2; scene.add(m); C.wet.hide.push(m);
    let base = 4118227;
    ticks.push((dt, center, t) => { m.material.uniforms.uTime.value = t; const n = base - (G.stats ? G.stats.kills : 0); if (n !== shown && Math.abs(center.x - 46) < 40) paint(n); });
    paint(base);
  }

  // ---------------- Zone 4, Cold Storage: frozen catch on hooks, shrink-wrapped pallets, low mist
  {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5d6166, roughness: 0.4, metalness: 0.8 });
    mesh(new THREE.BoxGeometry(18, 0.12, 0.1), railMat, -19, 3.4, -47.2, 0, false);
    const fish = new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.35, metalness: 0.2 }), frost = new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.6 });
    for (let k = 0; k < 10; k++) {
      const x = -27.1 + k * 1.8;
      mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 10, Math.PI * 1.4), railMat, x, 3.24, -47.2, 0, false);
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.9, 4, 8), fish); f.position.set(x, 2.6, -47.2); f.rotation.z = rand(-0.12, 0.12); f.castShadow = true; scene.add(f);
      mesh(new THREE.ConeGeometry(0.16, 0.22, 8), frost, x, 2.0, -47.2, 0, false);
    }
    const pal = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 }), wrap = new THREE.MeshStandardMaterial({ color: 0xb8c4cc, roughness: 0.25, metalness: 0.05 });
    for (const [x, z] of [[-28.4, -58.5], [-28.4, -52.6], [-21.5, -48.3], [-17.5, -48.3]]) {   // clear of the racks, cages and the door path
      mesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), pal, x, 0.07, z, 0); mesh(new THREE.BoxGeometry(1.1, 1.2, 0.95), wrap, x, 0.74, z, 0);
      stat(x, 0.67, z, 0.6, 0.67, 0.5);
    }
    const mist = [[-28.8, -50], [-28.8, -56], [-28.8, -61], [-22, -47.2], [-14, -47.2], [-20, -63.4], [-12, -63.4], [-8.6, -50]];
    ticks.push((dt, center) => {
      if (!G.fx || Math.abs(center.z + 55) > 26 || Math.abs(center.x + 18) > 26) return;
      for (const [x, z] of mist) if (Math.random() < 0.35) G.fx.smoke.emit(x + rand(-0.5, 0.5), 0.1, z + rand(-0.5, 0.5), rand(-0.3, 0.3), rand(0.02, 0.08), rand(-0.3, 0.3), 0.78, 0.86, 0.94, rand(1.5, 2.5), 0.12, 1.4, -0.05, 0.4, 0.5);
    });
  }

  // ---------------- Zone 5, Gut Lane: a wet V-gutter down the middle and its drains
  {
    const gut = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.12, metalness: 0.4, envMapIntensity: 1.6 });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 28), gut); g.rotation.x = -Math.PI / 2; g.position.set(0, 0.009, -78); g.receiveShadow = true; scene.add(g);
    const grate = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.5, metalness: 0.85 });
    for (const z of [-68, -75, -83, -90]) {
      mesh(new THREE.BoxGeometry(0.62, 0.02, 0.42), grate, 0, 0.012, z, 0, false);
      for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.5, 0.025, 0.03), new THREE.MeshBasicMaterial({ color: 0x020203 }), 0, 0.014, z - 0.16 + k * 0.08, 0, false);
    }
  }

  // ---------------- Zone 6, Rail Yard: a proper signal box, and buffer stops at the dead ends
  {
    const brick = new THREE.MeshStandardMaterial({ color: 0x5a3a2e, roughness: 0.85 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.5 });
    mesh(new THREE.BoxGeometry(3.0, 3.4, 3.2), brick, 74.5, 1.7, -68.5, 0); stat(74.5, 1.7, -68.5, 1.5, 1.7, 1.6);
    mesh(new THREE.BoxGeometry(3.4, 2.4, 3.6), frame, 74.5, 4.6, -68.5, 0);
    const warm = glowMat(2.1, 1.6, 0.9);
    for (const [w, d, x, z, ry] of [[3.0, 0.02, 74.5, -66.68, 0], [3.0, 0.02, 74.5, -70.32, 0], [3.2, 0.02, 72.78, -68.5, Math.PI / 2], [3.2, 0.02, 76.22, -68.5, Math.PI / 2]]) mesh(new THREE.BoxGeometry(w, 1.4, d), warm, x, 4.7, z, ry, false);
    for (let k = -1; k <= 1; k++) { mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), frame, 74.5 + k * 1.0, 4.7, -66.66, 0, false); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7, metalness: 0.3 })); roof.position.set(74.5, 6.4, -68.5); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    sign('YARD 4 SIGNAL BOX', '#e8f0ff', false, 74.5, 3.15, -66.62, 0, 2.6, 0.45);
    addSpot(74.5, 4.5, -66, 0xffc890, 10, 8, 1.6);
    const red = new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: 0.5, metalness: 0.3 });
    for (const z of [-86.5, -79, -71.5]) {
      mesh(new THREE.BoxGeometry(0.3, 1.2, 2.6), frame, 30.6, 0.6, z, 0); stat(30.6, 0.6, z, 0.15, 0.6, 1.3);
      mesh(new THREE.BoxGeometry(0.9, 0.12, 0.16), frame, 30.95, 0.25, z - 1.2, 0, false); mesh(new THREE.BoxGeometry(0.9, 0.12, 0.16), frame, 30.95, 0.25, z + 1.2, 0, false);
      for (const dz of [-0.75, 0.75]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.4, 12), red); b.rotation.z = Math.PI / 2; b.position.set(31.0, 0.8, z + dz); b.castShadow = true; scene.add(b); }
    }
  }

  // ---------------- Zone 7, Container Yard: the straddle carrier dressed, and painted yard markings
  {
    const haz = canvasTex(64, 64, (x) => { x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d8a520'; for (let k = -64; k < 128; k += 32) { x.beginPath(); x.moveTo(k, 64); x.lineTo(k + 16, 64); x.lineTo(k + 80, 0); x.lineTo(k + 64, 0); x.fill(); } });
    haz.wrapS = haz.wrapT = THREE.RepeatWrapping; haz.repeat.set(1, 3);
    const hazMat = new THREE.MeshStandardMaterial({ map: haz, roughness: 0.6 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.9 });
    for (const [lx, lz] of [[66.2, -122.2], [66.2, -128.8], [72.8, -122.2], [72.8, -128.8]]) {
      mesh(new THREE.BoxGeometry(0.54, 2.0, 0.54), hazMat, lx, 1.0, lz, 0);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 16), tyre); t.rotation.z = Math.PI / 2; t.position.set(lx, 0.55, lz + (lz > -125 ? 0.6 : -0.6)); t.castShadow = true; scene.add(t);
    }
    const tf = (z) => sign('TALLYFREIGHT', '#ffb060', false, 69.5, 8, z, 0, 5.2, 0.6);
    tf(-121.88); tf(-129.12);
    const bcn = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.3), toneMapped: false })); bcn.position.set(69.5, 10.05, -125.5); scene.add(bcn);
    ticks.push((dt, center, t) => { bcn.visible = (t % 1.2) < 0.6; });
    // painted markings: bay outlines around the stacks, bay codes, dashed straddle lanes
    const X0 = 40, Z0 = -136, W = 40, D = 44, PX = 1024 / W;
    const marks = canvasTex(1024, 1126, (x) => {
      x.clearRect(0, 0, 1024, 1126);
      const bay = (cx, cz, ry, code) => {
        x.save(); x.translate((cx - X0) * PX, (cz - Z0) * PX); x.rotate(-ry);
        x.strokeStyle = 'rgba(200,162,50,0.75)'; x.lineWidth = 0.12 * PX; x.strokeRect(-3.3 * PX, -1.5 * PX, 6.6 * PX, 3.0 * PX);
        x.fillStyle = 'rgba(235,235,230,0.8)'; x.font = font(0.6 * PX * 1.3); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(code, 3.9 * PX, 0);
        x.restore();
      };
      const st = [[46, -100, 0], [46, -110, 0], [53, -98.5, Math.PI / 2], [61, -105, 0], [70, -100, Math.PI / 2], [75, -110, Math.PI / 2], [53, -117, 0], [64, -116, Math.PI / 2], [44, -126, 0], [56, -129, 0], [70, -126, Math.PI / 2], [76, -131, 0], [46, -118, 0], [66, -98, 0], [56, -104, Math.PI / 2]];
      st.forEach(([cx, cz, ry], i) => bay(cx, cz, ry, `C${String(i + 1).padStart(2, '0')}`));
      x.strokeStyle = 'rgba(230,230,225,0.7)'; x.lineWidth = 0.15 * PX; x.setLineDash([1.2 * PX, 1.0 * PX]);
      for (const z of [-104, -122]) { x.beginPath(); x.moveTo(0, (z - Z0) * PX); x.lineTo(1024, (z - Z0) * PX); x.stroke(); }
    });
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: marks, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mm.rotation.x = -Math.PI / 2; mm.position.set(X0 + W / 2, 0.006, Z0 + D / 2); mm.receiveShadow = true; mm.renderOrder = 1; scene.add(mm); C.wet.hide.push(mm);
  }

  // ---------------- Zone 8, Pier 9 Docks: a tug moored on the north water, fenders on the quay
  {
    const g = new THREE.Group();
    const hullM = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5, metalness: 0.4 }), boot = new THREE.MeshStandardMaterial({ color: 0x6a1a14, roughness: 0.6 });
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(11, 2.2, 5), hullM, -1.5, 0, 0);
    const bow = new THREE.CylinderGeometry(2.5, 2.5, 2.2, 3, 1, false, 0, Math.PI); bow.rotateY(-Math.PI / 2); bow.scale(1.2, 1, 1); add(bow, hullM, 4, 0, 0);
    add(new THREE.BoxGeometry(11.1, 0.3, 5.1), boot, -1.5, -0.95, 0);
    add(new THREE.BoxGeometry(3.2, 2.4, 3.0), new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.5 }), -0.5, 2.3, 0);
    add(new THREE.BoxGeometry(3.25, 0.4, 3.05), glowMat(0.95, 0.85, 0.65), -0.5, 2.8, 0);
    // the deck is what the camera sees: a lighter boat-shaped plate with a white rail line round it
    const deckM = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.8 });
    add(new THREE.BoxGeometry(11, 0.08, 4.7), deckM, -1.5, 1.12, 0);
    { const bd = new THREE.CylinderGeometry(2.35, 2.35, 0.08, 3, 1, false, 0, Math.PI); bd.rotateY(-Math.PI / 2); bd.scale(1.2, 1, 1); add(bd, deckM, 4, 1.12, 0); }
    for (const z of [-2.45, 2.45]) add(new THREE.BoxGeometry(11, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xd8dce0 }), -1.5, 1.4, z);
    add(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 14), new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 }), -2.8, 2.6, 0);
    add(new THREE.CylinderGeometry(0.46, 0.46, 0.35, 14), boot, -2.8, 3.1, 0);
    add(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c30 }), 0.6, 5.5, 0);
    for (const [c, x, z] of [[[3, 3, 3.2], 0.6, 0], [[3, 0.2, 0.2], 0.2, -1.55], [[0.2, 3, 0.4], 0.2, 1.55]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), toneMapped: false })); l.position.set(x, c[0] === 3 && c[1] === 3 ? 7.5 : 3.7, z); g.add(l); }
    for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 14), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 })); t.position.set(-6 + k * 1.4, 0.2, 2.6); g.add(t); }
    g.position.set(-1, -0.2, -135.5); g.userData.static = true; scene.add(g);
    addSpot(-1, 4, -133, 0xfff0d0, 6, 9, 1.6);
    const rope = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 });
    for (const [bx, sx] of [[-8, -5.5], [4, 2.5]]) { const len = Math.hypot(bx - sx, 3.0); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), rope); r.position.set((bx + sx) / 2, 0.6, -131.8); r.rotation.z = Math.PI / 2; r.rotation.y = Math.atan2(-3, bx - sx); scene.add(r); }
    const fender = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
    for (let x = -18; x <= 12; x += 4) mesh(new THREE.BoxGeometry(1.4, 1.0, 0.35), fender, x, -0.6, -130.5, 0, false);
    for (let z = -128; z >= -96; z -= 4) mesh(new THREE.BoxGeometry(0.35, 1.0, 1.4), fender, -20.5, -0.6, z, 0, false);
  }

  // ---------------- Zone 9, Ferry Pier: the ferry dressed, railings, a queue, and the timetable that says it's over
  {
    const blue = new THREE.MeshStandardMaterial({ color: 0x1d3550, roughness: 0.5, metalness: 0.3 }), white = new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.4 });
    mesh(new THREE.CylinderGeometry(0.9, 1.0, 2.4, 18), blue, -36, 7.7, -126.5, 0); mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.5, 18), white, -36, 8.2, -126.5, 0, false);
    for (const z of [-123.4, -129.6]) { const lb = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 3.0, 4, 10), white); lb.rotation.z = Math.PI / 2; lb.position.set(-54, 4.4, z); lb.castShadow = true; scene.add(lb); mesh(new THREE.BoxGeometry(3.4, 0.25, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.6 }), -54, 5.05, z, 0, false); }
    const gw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 2.6), new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.5, metalness: 0.7 })); gw.position.set(-42, 0.7, -121.4); gw.rotation.x = 0.6; gw.castShadow = true; scene.add(gw);
    const rail = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
    for (const z of [-119.9, -104.1]) {
      for (let x = -60; x <= -22; x += 2) { if (z < -110 && x > -44 && x < -40) continue; mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), rail, x, 0.55, z, 0, false); }
      for (const [x0, x1] of z < -110 ? [[-60, -44], [-40, -22]] : [[-60, -22]]) for (const y of [1.1, 0.55]) mesh(new THREE.BoxGeometry(x1 - x0, 0.04, 0.04), rail, (x0 + x1) / 2, y, z, 0, false);
    }
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.2, metalness: 1.0 }), belt = new THREE.MeshStandardMaterial({ color: 0x1d3550, roughness: 0.6 });
    for (const z of [-110, -114]) {
      for (let x = -50; x <= -46; x += 2) { mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), chrome, x, 0.5, z, 0); mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), chrome, x, 0.02, z, 0, false); }
      mesh(new THREE.BoxGeometry(4, 0.05, 0.01), belt, -48, 0.92, z, 0, false);
    }
    const tt = canvasTex(512, 240, (x) => {
      x.fillStyle = '#05070a'; x.fillRect(0, 0, 512, 240); x.strokeStyle = '#2a3a4a'; x.lineWidth = 6; x.strokeRect(3, 3, 506, 234);
      x.fillStyle = '#e8f0ff'; x.font = font(40); x.fillText('DEPARTURES', 24, 52);
      x.font = font(46); x.fillStyle = '#e8f0ff'; x.fillText('HALDEN ISLAND', 24, 120); x.fillText('23:40', 360, 120);
      x.fillStyle = '#ff5a3a'; x.font = font(52); x.fillText('CANCELLED', 24, 196);
      x.fillStyle = 'rgba(232,240,255,0.5)'; x.font = font(22); x.fillText('NO FURTHER SAILINGS', 300, 196);
    });
    const tb = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), new THREE.MeshBasicMaterial({ map: tt, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false }));
    tb.position.set(-57, 2.0, -105.92); scene.add(tb);
  }

  L.landmarkTick = (dt, center) => { const t = G.rt || 0; for (const f of ticks) f(dt, center, t); };
}
