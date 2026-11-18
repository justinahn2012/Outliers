// The Warden's riot shield (characters.md Fix 7): a pale curved glass arc you can see the Warden through,
// a cyan top edge (his ring colour), a CENSUS stencil and a faint amber lock-order hex, so from above you can tell
// which way he faces (frontal hits are blocked) and that he's a person with a shield, not a wall.
// Shared by the Warden and the liftable 'riotshield' prop he drops.
import * as THREE from 'three';

const ARC = [0.95, 1.05, -0.45, 0.9];   // radius, height, theta start, theta length
let M = null;
function mats() {
  if (M) return M;
  const sten = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ffb050'; x.font = 'bold 50px "Bebas Neue", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CENSUS', 128, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const hex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#ff9a1f'; x.lineWidth = 2; const r = 12, h = r * Math.sqrt(3);
    for (let row = -1; row < 7; row++) for (let col = -1; col < 6; col++) { const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0), cy = row * h / 2; x.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; x[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); } x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; })();
  M = {
    face: new THREE.MeshStandardMaterial({ color: 0xa9c4d6, transparent: true, opacity: 0.26, roughness: 0.06, metalness: 0, envMapIntensity: 2.0, depthWrite: false, side: THREE.DoubleSide }),
    top: new THREE.MeshStandardMaterial({ color: 0x06181c, emissive: 0x3fd8f0, emissiveIntensity: 1.6, roughness: 0.4 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.5, roughness: 0.4 }),
    sten: new THREE.MeshBasicMaterial({ map: sten, color: new THREE.Color(1.2, 1.2, 1.2), transparent: true, toneMapped: false, depthWrite: false }),
    hex: new THREE.MeshBasicMaterial({ map: hex, color: new THREE.Color(1, 1, 1), transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    grip: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
  };
  return M;
}
export const SHIELD_SIZE = new THREE.Vector3(0.84, 1.07, 0.14);
export function makeShieldVisual() {
  const m = mats(), [R, H, t0, tl] = ARC, g = new THREE.Group();
  const arc = (r, h, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12, 1, true, t0, tl).translate(0, 0, -R), mat);
  const face = arc(R, H, m.face); face.renderOrder = 3; g.add(face);
  const hx = arc(R + 0.006, H * 0.94, m.hex); hx.renderOrder = 4; g.add(hx);
  for (const [y, mat] of [[H / 2, m.top], [-H / 2, m.rim]]) { const e = arc(R + 0.01, 0.035, mat); e.material.side = THREE.DoubleSide; e.position.y = y; e.castShadow = true; g.add(e); }
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, H, 0.03), m.rim); b.position.set(R * Math.sin(s * tl / 2), 0, R * Math.cos(tl / 2) - R); b.castShadow = true; g.add(b); }
  const st = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.115), m.sten); st.position.set(0, 0.3, 0.03); st.renderOrder = 5; g.add(st);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.05), m.grip); grip.position.set(0, 0, -0.08); g.add(grip);
  return g;
}
