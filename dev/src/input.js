import { G, TUNE } from './state.js';

// Touch-first input.
//  - A touch that lands on (or near) something liftable seizes it.
//  - Any other touch becomes a floating movement stick.
//  - Release with speed = flick throw.  Multi-touch: move with one thumb, throw with the other.
//  - Rewrite: press and hold still on a wall or the street (outside the thumb zone) to edit it.
export const input = {
  joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0, active: false },
  keys: {},
  pointers: new Map(),
};

export function initInput(canvas, api) {
  const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const R = 62;
  const EDIT_HOLD = 420, EDIT_SLOP = 12;
  const ring = document.createElement('div'); ring.id = 'editring'; document.body.appendChild(ring);
  const ringOff = () => { ring.classList.remove('on'); };
  const armEdit = (p, id, x, y, cx, cy) => {
    if (!api.canRewrite || !api.canRewrite()) return;
    p.edit = { x, y, t: setTimeout(() => fireEdit(id), EDIT_HOLD), r: setTimeout(() => { ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on'); }, 130) };
  };
  const cancelEdit = (p) => { if (!p || !p.edit) return; clearTimeout(p.edit.t); clearTimeout(p.edit.r); p.edit = null; ringOff(); };
  const fireEdit = (id) => {
    const p = input.pointers.get(id); if (!p || !p.edit) return;
    const { x, y } = p.edit; p.edit = null; ringOff();
    const res = api.rewrite(id, x, y);
    if (!res) return;
    if (p.role === 'joy') { const j = input.joy; j.id = null; j.active = false; j.vx = j.vy = 0; joyEl.style.display = 'none'; }
    if (res === 'grab') { p.role = 'grab'; p.samples = [[x, y, performance.now()]]; } else p.role = 'spent';
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (G.mode !== 'play' && G.mode !== 'break') return;
    api.audio();
    const [x, y] = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
    const ok = api.tryGrab(e.pointerId, x, y);
    if (ok) { input.pointers.set(e.pointerId, { role: 'grab', samples: [[x, y, performance.now()]] }); return; }
    const thumb = x < G.W * 0.42 && y > G.H * 0.62;
    if (input.joy.id === null) {
      const j = input.joy; j.id = e.pointerId; j.ox = x; j.oy = y; j.x = x; j.y = y; j.vx = j.vy = 0; j.active = true;
      const p = { role: 'joy' }; input.pointers.set(e.pointerId, p);
      joyEl.style.display = 'block'; joyEl.style.transform = `translate(${x}px,${y}px)`; knob.style.transform = 'translate(0px,0px)';
      if (!thumb) armEdit(p, e.pointerId, x, y, e.clientX, e.clientY);
    } else {
      const p = { role: 'idle' }; input.pointers.set(e.pointerId, p);
      armEdit(p, e.pointerId, x, y, e.clientX, e.clientY);
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    const p = input.pointers.get(e.pointerId); if (!p) return;
    e.preventDefault();
    const [x, y] = pos(e);
    if (p.edit && Math.hypot(x - p.edit.x, y - p.edit.y) > EDIT_SLOP) cancelEdit(p);
    if (p.role === 'joy') {
      const j = input.joy; let dx = x - j.ox, dy = y - j.oy; const d = Math.hypot(dx, dy);
      if (d > R) { // drag the origin along so direction changes stay responsive
        const k = (d - R) / d; j.ox += dx * k; j.oy += dy * k; dx = x - j.ox; dy = y - j.oy;
        joyEl.style.transform = `translate(${j.ox}px,${j.oy}px)`;
      }
      j.vx = dx / R; j.vy = dy / R;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      if (Math.hypot(j.vx, j.vy) > 0.3) G.tutorial.moved = true;
    } else if (p.role === 'grab') {
      const now = performance.now();
      p.samples.push([x, y, now]);
      while (p.samples.length > 2 && now - p.samples[0][2] > 110) p.samples.shift();
      api.moveGrab(e.pointerId, x, y);
    }
  }, { passive: false });

  const end = (e) => {
    const p = input.pointers.get(e.pointerId); if (!p) return;
    input.pointers.delete(e.pointerId);
    cancelEdit(p);
    if (p.role === 'joy') {
      const j = input.joy; j.id = null; j.active = false; j.vx = j.vy = 0; joyEl.style.display = 'none';
    } else if (p.role === 'grab') {
      const [x, y] = pos(e); const now = performance.now();
      p.samples.push([x, y, now]);
      // velocity over the last ~90ms
      let i0 = 0; for (let i = p.samples.length - 1; i >= 0; i--) { if (now - p.samples[i][2] <= 95) i0 = i; else break; }
      const a = p.samples[i0], b = p.samples[p.samples.length - 1];
      const dtm = Math.max(16, b[2] - a[2]) / 1000;
      let vx = (b[0] - a[0]) / dtm, vy = (b[1] - a[1]) / dtm;
      if (e.type === 'pointercancel') vx = vy = 0;
      api.releaseGrab(e.pointerId, x, y, vx, vy);
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => { input.keys[e.code] = true; if (e.code === 'Space') api.surge(); if (e.code === 'KeyE' || e.code === 'KeyQ') api.ult(); if (e.code === 'Escape') api.pause(); });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
}

export function moveVector() {
  let x = input.joy.vx, y = input.joy.vy;
  const k = input.keys;
  if (k.KeyW || k.ArrowUp) y -= 1; if (k.KeyS || k.ArrowDown) y += 1;
  if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  // small deadzone with rescale
  const mm = Math.hypot(x, y);
  if (mm < 0.12) return [0, 0];
  const s = (mm - 0.12) / 0.88 / mm;
  return [x * s, y * s];
}
