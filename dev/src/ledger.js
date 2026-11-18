// In-world typography (cyberpunk addendum §5): who wrote a piece of text is told by its typeface.
//  LEDGER   the Census: a 14-segment display face, 8° italic, unlit segments ghosted at 8% (its signature)
//  TALLY    the Census barcode: per digit 4 verticals (long/short = bits) sealed by a 60° slash
//  PIXEL    Null: a 5x7 bitmask face
// All code-drawn onto canvases; no font files.

// 14 segments: a (top), b (top right), c (bottom right), d (bottom), e (bottom left), f (top left),
// g1 (mid left), g2 (mid right), h (diag top-left), i (centre top), j (diag top-right), k (diag bottom-left), l (centre bottom), m (diag bottom-right)
const SEG = {
  A: 'abcefg1g2', B: 'abcdig2l', C: 'adef', D: 'abcdil', E: 'adefg1', F: 'aefg1', G: 'acdefg2', H: 'bcefg1g2', I: 'adil', J: 'bcde', K: 'efg1jm', L: 'def', M: 'bcefhj', N: 'bcefhm',
  O: 'abcdef', P: 'abefg1g2', Q: 'abcdefm', R: 'abefg1g2m', S: 'acdfg1g2', T: 'ail', U: 'bcdef', V: 'efkj', W: 'bcefkm', X: 'hjkm', Y: 'hjl', Z: 'adjk',
  0: 'abcdefjk', 1: 'bcj', 2: 'abdeg1g2', 3: 'abcdg2', 4: 'bcfg1g2', 5: 'adfg1m', 6: 'acdefg1g2', 7: 'abc', 8: 'abcdefg1g2', 9: 'abcdfg1g2',
  '-': 'g1g2', '·': '', '/': 'jk', '×': 'hjkm', '#': 'bcg1g2il', '%': 'cfjkg1g2', '—': 'g1g2', '+': 'g1g2il', ':': '', '.': '', ' ': '',
};
const ALL = ['a', 'b', 'c', 'd', 'e', 'f', 'g1', 'g2', 'h', 'i', 'j', 'k', 'l', 'm'];
function segs(s) { const out = []; for (const k of ['g1', 'g2', 'a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'j', 'k', 'l', 'm']) if (s.includes(k)) { out.push(k); s = s.replace(k, ''); } return out; }
const LINES = (w, h) => {
  const m = h / 2;
  return { a: [0, 0, w, 0], b: [w, 0, w, m], c: [w, m, w, h], d: [0, h, w, h], e: [0, m, 0, h], f: [0, 0, 0, m], g1: [0, m, w / 2, m], g2: [w / 2, m, w, m],
    h: [0, 0, w / 2, m], i: [w / 2, 0, w / 2, m], j: [w, 0, w / 2, m], k: [0, h, w / 2, m], l: [w / 2, m, w / 2, h], m: [w, h, w / 2, m] };
};

// largest cap height (<= hMax) at which text fits in maxW
export const ledgerFit = (text, maxW, hMax) => Math.min(hMax, maxW / Math.max(1, [...text].length * 0.75 - 0.15 + 0.1));

// draw text in LEDGER at (x, y) top-left, cap height h; returns the advance width
export function drawLedger(ctx, text, x, y, h, color = '#ff9a1f', { ghost = 0.08, align = 'left' } = {}) {
  const cw = h * 0.6, track = cw * 0.25, adv = cw + track, total = [...text].length * adv - track;
  let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, h * 0.11); ctx.strokeStyle = color; ctx.fillStyle = color;
  const gap = h * 0.03, L = LINES(cw, h), slant = Math.tan(8 * Math.PI / 180);
  for (const ch of String(text).toUpperCase()) {
    const on = segs(SEG[ch] ?? '');
    ctx.save(); ctx.translate(px, y); ctx.transform(1, 0, -slant, 1, slant * h, 0);
    if (ch === '·' || ch === '.' || ch === ':') {
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cw / 2, ch === ':' ? h * 0.3 : h * 0.5, h * 0.07, 0, 6.3); ctx.fill();
      if (ch === ':') { ctx.beginPath(); ctx.arc(cw / 2, h * 0.75, h * 0.07, 0, 6.3); ctx.fill(); }
    } else for (const k of ALL) {
      const lit = on.includes(k); if (!lit && ghost <= 0) continue;
      ctx.globalAlpha = lit ? 1 : ghost;
      const [x0, y0, x1, y1] = L[k], dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, gx = dx / len * gap, gy = dy / len * gap;
      ctx.beginPath(); ctx.moveTo(x0 + gx, y0 + gy); ctx.lineTo(x1 - gx, y1 - gy); ctx.stroke();
    }
    ctx.restore(); px += adv;
  }
  ctx.restore(); return total;
}

// the Census barcode: each digit = 4 verticals (long = 1 bit, short = 0) sealed by a 60° slash
export function drawTally(ctx, digits, x, y, h, color = '#ff9a1f') {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, h * 0.08); ctx.lineCap = 'butt';
  let px = x; const sp = h * 0.22;
  for (const ch of String(digits)) {
    const d = parseInt(ch, 10); if (isNaN(d)) { px += h * 0.5; continue; }
    for (let b = 0; b < 4; b++) { const long = (d >> (3 - b)) & 1, hh = long ? h : h * 0.6; ctx.beginPath(); ctx.moveTo(px + b * sp, y + h); ctx.lineTo(px + b * sp, y + h - hh); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(px - sp * 0.4, y + h * 0.85); ctx.lineTo(px + 3 * sp + sp * 0.4, y + h * 0.85 - (3.8 * sp) * Math.tan(Math.PI / 3) * 0.35); ctx.stroke();
    px += 3 * sp + h * 0.5;
  }
  ctx.restore(); return px - x;
}

// Null's 5x7 pixel face
const P5 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'], C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'], F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'], H: ['10001', '10001', '11111', '10001', '10001', '10001', '10001'], I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'], K: ['10001', '10010', '11100', '10010', '10001', '10001', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10010', '10001', '10001'],
  S: ['01111', '10000', '01110', '00001', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'], W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'], X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100', '00100', '00100'], Z: ['11111', '00010', '00100', '01000', '10000', '10000', '11111'],
  0: ['01110', '10011', '10101', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], 2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], 4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], 8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'], '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '·': ['00000', '00000', '00000', '00100', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'], ':': ['00000', '00100', '00000', '00000', '00000', '00100', '00000'],
};
export function drawPixel(ctx, text, x, y, px, color = '#b39bff', drop = 0) {
  ctx.save(); ctx.fillStyle = color; let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const g = P5[ch] || P5[' '];
    g.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '1' && (!drop || Math.random() > drop)) ctx.fillRect(cx + rx * px, y + ry * px, px, px); }));
    cx += 6 * px;
  }
  ctx.restore(); return cx - x;
}
