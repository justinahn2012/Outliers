// Procedural Web Audio: no sample files, everything synthesized.
let ctx = null, master = null, noiseBuf = null;
let humGain = null, humOsc1 = null, humOsc2 = null, humFilter = null;
let lastImpact = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch (e) { ctx = null; return; }
  master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ctx.destination);

  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; d[i] = w * 0.6 + b0 * 2.2; }

  // Rain bed
  const rain = ctx.createBufferSource(); rain.buffer = noiseBuf; rain.loop = true;
  const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 900;
  const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 7000;
  const rg = ctx.createGain(); rg.gain.value = 0.045;
  rain.connect(rhp); rhp.connect(rlp); rlp.connect(rg); rg.connect(master); rain.start();
  // Harbor drone
  for (const f of [49, 49.6, 73.5]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = f > 60 ? 0.012 : 0.03;
    o.connect(g); g.connect(master); o.start();
  }
  // Telekinetic hum (driven while holding)
  humOsc1 = ctx.createOscillator(); humOsc1.type = 'sawtooth'; humOsc1.frequency.value = 82;
  humOsc2 = ctx.createOscillator(); humOsc2.type = 'sine'; humOsc2.frequency.value = 164.8;
  humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 420; humFilter.Q.value = 6;
  humGain = ctx.createGain(); humGain.gain.value = 0;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
  const lfoG = ctx.createGain(); lfoG.gain.value = 120;
  lfo.connect(lfoG); lfoG.connect(humFilter.frequency);
  humOsc1.connect(humFilter); humOsc2.connect(humFilter); humFilter.connect(humGain); humGain.connect(master);
  humOsc1.start(); humOsc2.start(); lfo.start();
}

export function setMasterMuted(m) { if (master) master.gain.value = m ? 0 : 0.85; }

function noise(t0, dur, type, f0, f1, q, peak, attack = 0.005) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
function tone(t0, dur, type, f0, f1, peak, attack = 0.004) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}

export const sfx = {
  lift(mass) {
    if (!ctx) return; const t = ctx.currentTime;
    const heavy = Math.min(1, mass / 300);
    tone(t, 0.45 + heavy * 0.4, 'sine', 140 - heavy * 70, 420 - heavy * 220, 0.22, 0.02);
    noise(t, 0.5 + heavy * 0.5, 'bandpass', 300, 1400 - heavy * 900, 3, 0.25, 0.05);
  },
  throw(power) {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.32, 'bandpass', 2200, 380, 1.4, 0.35 + power * 0.25, 0.01);
    tone(t, 0.25, 'triangle', 520, 140, 0.12);
  },
  impact(intensity, metal) {
    if (!ctx) return; const t = ctx.currentTime;
    if (t - lastImpact < 0.035) return; lastImpact = t;
    const k = Math.min(1, intensity);
    noise(t, 0.12 + k * 0.25, 'lowpass', 2600 * (0.5 + k), 200, 0.7, 0.25 + k * 0.6, 0.002);
    tone(t, 0.18 + k * 0.2, 'sine', 120 + Math.random() * 30, 42, 0.3 + k * 0.5, 0.002);
    if (metal) {
      for (const f of [612, 917, 1483]) tone(t, 0.25 + k * 0.4, 'triangle', f * (0.9 + Math.random() * 0.2), f * 0.97, 0.045 + k * 0.05, 0.002);
    }
  },
  explosion() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 1.6, 'lowpass', 5000, 90, 0.5, 1.0, 0.003);
    tone(t, 0.9, 'sine', 90, 28, 1.0, 0.003);
    noise(t + 0.05, 0.9, 'bandpass', 900, 160, 1.2, 0.35, 0.02);
  },
  bolt() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.16, 'sawtooth', 1600, 300, 0.09);
    noise(t, 0.08, 'highpass', 3000, 2000, 0.7, 0.1);
  },
  block() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.2, 'square', 880, 1320, 0.06); noise(t, 0.12, 'highpass', 4000, 1500, 0.8, 0.18);
  },
  hurt() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.3, 'sine', 160, 50, 0.6); noise(t, 0.22, 'lowpass', 1200, 200, 1, 0.4);
  },
  crunch() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.14, 'lowpass', 2400, 200, 0.8, 0.28, 0.002);
    tone(t, 0.12, 'triangle', 300 + Math.random() * 200, 90, 0.12, 0.002);
  },
  shatter() {
    if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) tone(t + i * 0.018, 0.25, 'triangle', 2400 + Math.random() * 2600, 1800, 0.035, 0.002);
    noise(t, 0.2, 'highpass', 6000, 3000, 0.8, 0.12, 0.002);
  },
  surgeCharge() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.16, 'bandpass', 300, 2600, 5, 0.5, 0.12);
    tone(t, 0.16, 'sine', 90, 260, 0.35, 0.1);
  },
  surge() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 1.1, 'sine', 160, 26, 1.0, 0.003);              // sub drop
    noise(t, 0.9, 'lowpass', 5200, 90, 0.9, 1.0, 0.002);     // blast
    noise(t + 0.02, 0.5, 'bandpass', 1800, 400, 2.5, 0.45, 0.004);
    tone(t, 0.5, 'sawtooth', 880, 110, 0.12, 0.002);         // electric tear
    for (let i = 0; i < 9; i++) noise(t + 0.03 + i * 0.035 + Math.random() * 0.02, 0.05, 'highpass', 5000, 3000, 0.7, 0.18 * (1 - i / 10), 0.001); // crackle
  },
  inhale() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 1.2, 'bandpass', 200, 2400, 4, 0.5, 0.9);
    tone(t, 1.3, 'sine', 60, 240, 0.35, 1.0);
  },
  vortex() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 2.1, 'bandpass', 400, 1800, 6, 0.4, 0.3);
    tone(t, 2.1, 'sawtooth', 55, 110, 0.12, 0.4);
  },
  release() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 2.0, 'lowpass', 6000, 70, 0.6, 1.0, 0.003);
    tone(t, 1.4, 'sine', 140, 24, 1.0, 0.003);
    tone(t, 0.6, 'triangle', 880, 110, 0.2, 0.003);
  },
  beep(hi) {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.07, 'square', hi ? 1760 : 1320, hi ? 1760 : 1320, 0.035, 0.002);
  },
  toss() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.2, 'bandpass', 900, 500, 2, 0.15);
  },
  spawn() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.5, 'sine', 1200, 300, 0.08, 0.01); noise(t, 0.5, 'highpass', 5000, 1200, 0.6, 0.12, 0.02);
  },
  down() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.5, 'triangle', 300, 70, 0.15); noise(t, 0.4, 'lowpass', 800, 150, 1, 0.3);
  },
  slam() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.8, 'sine', 70, 25, 1.0, 0.003); noise(t, 0.7, 'lowpass', 1800, 80, 0.8, 0.9, 0.003);
  },
  windup() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.5, 'sawtooth', 70, 160, 0.08, 0.05);
  },
  splash() {
    if (!ctx) return; const t = ctx.currentTime;
    noise(t, 0.8, 'lowpass', 4000, 300, 0.8, 0.5, 0.01);
  },
  ui() {
    if (!ctx) return; const t = ctx.currentTime;
    tone(t, 0.12, 'sine', 660, 990, 0.1);
  },
  win() {
    if (!ctx) return; const t = ctx.currentTime;
    [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.12, 0.9, 'triangle', f, f, 0.12, 0.01));
  },
};

export function setHum(level, heavy) {
  if (!ctx || !humGain) return;
  const t = ctx.currentTime;
  humGain.gain.setTargetAtTime(Math.min(0.09, level * 0.07), t, 0.08);
  humOsc1.frequency.setTargetAtTime(82 - heavy * 30, t, 0.2);
}
