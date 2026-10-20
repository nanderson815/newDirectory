// The HUD style kit: canvas drawing functions in the game's visual language, reading the same tokens as the CSS
// menus (src/ui/tokens.js) and the same icons (src/ui/icons.js). Every function takes the 2D context first and
// works in CSS pixels; the caller sets the devicePixelRatio transform as usual (ctx.setTransform(dpr, ...)), and
// the kit scales canvas shadows (which ignore the transform) to match, so blur looks the same at DPR 1, 2 or 3.
// Nothing here keeps game state; animated pieces take a progress value `t` in [0, 1] (see tween()). Font strings,
// text widths and panel gradients are cached, so drawing the HUD every frame allocates next to nothing.
//
// The look is the menus' printed matter carried onto the sea (docs/DESIGN.md, "Style" and "Battle HUD"):
// - Controls are flat slips of ink with paper-coloured type and a hairline edge (tone 'glass', a historical name).
//   What is ready or toggled on inverts to a paper slip with ink type (tone 'gold', also historical).
// - On the sea, paper draws your lines; pale gilt (as on a book's edges) marks the chosen ship and the rings to
//   sail for (the game's copy calls them gold rings). Red is the enemy, blue a friend.
// - Words are EB Garamond; names and numbers IM Fell English (one weight, never bolded); button labels in IM Fell
//   English SC; small labels on the sea in Garamond's own small capitals. Paper-coloured type on the water carries a soft ink halo for contrast, never an outline.
// - Corners are cut nearly square; bars are flat with square ends; messages are paper slips.
import { COLOR, PALETTE, FONT, RADIUS, CANVAS_SHADOW, EASE } from '../ui/tokens.js';
import { drawIcon } from '../ui/icons.js';

const P = PALETTE, C = COLOR;

// HUD metrics, in CSS px. Touch targets are at least 44 px.
export const HUD = {
  edge: 12, gap: 8, radius: RADIUS.md,
  button: 44, buttonSm: 36, icon: 20, iconSm: 16,
  bar: 5, barThin: 3,
  label: 14, labelSm: 12, value: 16, title: 26,
};

// ---------- Basics ----------
// 'ui' is EB Garamond; 'display' IM Fell English and 'caps' its small capitals, both one weight (asking for a bold
// Fell would only get a smeared synthetic one, so their weight is always 400).
const FACES = ['ui', 'display', 'caps'];
const fonts = new Map();
export function font(size, weight = 600, face = 'ui', italic = false) {
  const fi = Math.max(0, FACES.indexOf(face));
  if (fi) weight = 400;
  const key = ((Math.round(size * 4) * 1000 + weight) * 3 + fi) * 2 + (italic ? 1 : 0);
  let f = fonts.get(key);
  if (!f) { f = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[FACES[fi]]}`; fonts.set(key, f); }
  return f;
}
const spacings = new Map();
const spacing = (px) => { let s = spacings.get(px); if (!s) { s = `${px}px`; spacings.set(px, s); } return s; };
const dprOf = (ctx) => { const m = ctx.getTransform(); return Math.hypot(m.a, m.b) || 1; };

// A rounded rectangle path (uses the native roundRect where there is one).
export function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Sets a canvas shadow from a token ({ color, blur, y } in CSS px), scaled to the device pixels.
export function shadow(ctx, s) {
  if (!s) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; return; }
  const k = dprOf(ctx);
  ctx.shadowColor = s.color; ctx.shadowBlur = s.blur * k; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = (s.y || 0) * k;
}
const HALO_STRONG = { color: 'rgba(14,11,8,0.85)', blur: 10, y: 1.5 };
const GLOW_GOLD = { color: 'rgba(244,236,216,0.45)', blur: 12, y: 0 }; // the glow of something lit: paper, not gold

// Eased progress of an animation that started at t0 (seconds or ms, as long as `now` and `dur` agree).
export function tween(t0, now, dur, curve = 'out') {
  const k = Math.min(1, Math.max(0, (now - t0) / dur));
  return EASE[curve] ? EASE[curve](k) : k;
}
// Opacity over a life of `dur`: eases in over `inT` and out over the last `outT` (all in the same units).
export function life(age, dur, inT = 0.15 * dur, outT = 0.2 * dur) {
  if (age < 0 || age > dur) return 0;
  if (age < inT) return EASE.out(age / inT);
  if (age > dur - outT) return 1 - EASE.in((age - (dur - outT)) / outT);
  return 1;
}

export const hpColor = (k) => (k > 0.6 ? C.hpHigh : k > 0.3 ? C.hpMid : C.hpLow);

// A token colour (#rrggbb or rgba()) at another opacity, cached, so the HUD never spells out a colour itself.
const tints = new Map();
export function tint(color, a) {
  let m = tints.get(color);
  if (!m) tints.set(color, (m = new Map()));
  const k = Math.round(a * 100);
  let s = m.get(k);
  if (!s) {
    let r, g, b;
    if (color[0] === '#') { const n = parseInt(color.length === 4 ? color.replace(/./g, (c, i) => (i ? c + c : '')) : color.slice(1, 7), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
    else [r, g, b] = color.match(/[\d.]+/g).map(Number);
    s = `rgba(${r},${g},${b},${k / 100})`;
    m.set(k, s);
  }
  return s;
}

// What marks on the sea and over ships mean, by colour. Goals and abilities get these through their draw api.
// On the sea paper draws, gilt chooses, red is the enemy's.
export const MARK = {
  line: P.paper,      // your courses, arcs, dials
  chosen: '#f2d48c',  // pale gilt: the chosen ship, the tutorial buoy, rings to sail for (reach, chests)
  enemy: P.redHi,     // enemy hull bars, engage rings, targets, their shells
  friend: P.blueHi,   // forts and ships in your care, allies, prizes
  exit: P.greenHi,    // the way out, through, repairs
  warn: '#f08a70',    // fireships, losses: a paler red than the enemy's
  hurt: '#f6b5a2',    // rigging cut and other damage words
  track: 'rgba(20,16,12,0.55)', // the empty part of a bar
};

// ---------- Surfaces ----------
// Flat fills (top and bottom differ by a hair, as ink lies on paper), a hairline edge, no highlight.
const TONES = {
  glass: { top: 'rgba(38, 31, 25, 0.9)', bottom: 'rgba(29, 23, 18, 0.9)', line: C.glassLine, hi: null, ink: C.onGlass }, // an ink slip
  solid: { top: '#2a221b', bottom: P.ink, line: C.glassLineStrong, hi: null, ink: C.onGlass },
  paper: { top: '#f2e9d5', bottom: P.paper, line: 'rgba(33,26,20,0.3)', hi: null, ink: P.ink },
  crimson: { top: 'rgba(150, 42, 30, 0.92)', bottom: 'rgba(122, 28, 19, 0.92)', line: 'rgba(239,229,207,0.22)', hi: null, ink: P.paper }, // bosses
  gold: { top: '#f6efdd', bottom: '#ece1c7', line: 'rgba(33,26,20,0.55)', hi: null, ink: P.ink }, // ready / chosen: inverted to paper
  danger: { top: P.red, bottom: P.redDeep, line: P.redDeep, hi: null, ink: P.paper },
};
export const toneInk = (tone) => (TONES[tone] || TONES.glass).ink;

// Panel gradients, cached by tone, top and height (they are in canvas space, so they move with the panel).
const grads = new Map();
function gradient(ctx, tone, T, y, h) {
  let m = grads.get(tone);
  if (!m) grads.set(tone, (m = new Map()));
  const key = Math.round(y * 4) * 8192 + Math.round(h * 4);
  let g = m.get(key);
  if (!g) {
    if (m.size > 160) m.clear();
    g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, T.top); g.addColorStop(1, T.bottom);
    m.set(key, g);
  }
  return g;
}

// A panel: a flat slip with a hairline edge and, on the sea, a small shadow.
export function panel(ctx, x, y, w, h, { tone = 'glass', r = HUD.radius, elevation = 2, alpha = 1 } = {}) {
  const T = TONES[tone] || TONES.glass;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = gradient(ctx, tone, T, y, h);
  if (elevation) { shadow(ctx, CANVAS_SHADOW[elevation]); rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill(); shadow(ctx, null); }
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5); ctx.lineWidth = 1; ctx.strokeStyle = T.line; ctx.stroke();
  if (T.hi) { ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.lineWidth = 1; ctx.strokeStyle = T.hi; ctx.stroke(); }
  ctx.restore();
}

// A gilt hairline round a rect: "this one" (the chosen ship, a toggled control). `glow` adds a soft halo.
export function hairline(ctx, x, y, w, h, r, { color = MARK.chosen, alpha = 0.9, tint = 'rgba(242,212,140,0.07)', glow = false } = {}) {
  ctx.save();
  if (tint) { rrect(ctx, x, y, w, h, r); ctx.fillStyle = tint; ctx.fill(); }
  if (glow) shadow(ctx, GLOW_GOLD);
  ctx.globalAlpha *= alpha;
  rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5); ctx.lineWidth = 1; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

// ---------- Text ----------
const widths = new Map();
// Text width, cached per font (tracking adds letter spacing). Cheap enough to call every frame.
export function measure(ctx, str, size = HUD.label, weight = 600, face = 'ui', tracking = 0) {
  const f = font(size, weight, face);
  let m = widths.get(f);
  if (!m) widths.set(f, (m = new Map()));
  let w = m.get(str);
  if (w === undefined) {
    if (m.size > 400) m.clear();
    ctx.save(); ctx.font = f; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    w = ctx.measureText(str).width; ctx.restore();
    m.set(str, w);
  }
  return w + (tracking ? tracking * size * String(str).length : 0);
}

// Text with a soft shadow (two passes: a wide soft one for separation from the sea, a tight one for edge
// contrast) instead of a heavy outline. halo: 'soft' | 'strong' | 'tight' | 'none'. Returns the drawn width.
export function text(ctx, str, x, y, {
  size = HUD.label, weight = 600, face = 'ui', italic = false, color = C.onGlass, align = 'left', baseline = 'middle',
  halo = 'soft', tracking = 0, maxWidth, alpha = 1, smallCaps = false,
} = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size, weight, face, italic);
  if (smallCaps) ctx.fontVariantCaps = 'all-small-caps';
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = tracking ? spacing(Math.round(tracking * size * 10) / 10) : '0px';
  ctx.fillStyle = color;
  if (halo === 'soft' || halo === 'strong') {
    shadow(ctx, halo === 'strong' ? HALO_STRONG : CANVAS_SHADOW.text);
    ctx.fillText(str, x, y, maxWidth);
    shadow(ctx, CANVAS_SHADOW.textTight);
  } else if (halo === 'tight') shadow(ctx, CANVAS_SHADOW.textTight);
  ctx.fillText(str, x, y, maxWidth);
  ctx.restore();
  const w = measure(ctx, str, size, weight, face, tracking);
  return maxWidth ? Math.min(w, maxWidth) : w;
}
// A small label (ship labels, "Sunk", "Wind", step lines): EB Garamond 600 in its real small capitals, a little
// spaced, with the strong ink halo by default so it holds over bright water. (Fell's small capitals are too fine
// to read at this size on the sea; they stay on buttons.) Where the canvas can't set small caps it uses spaced
// capitals a size smaller. A string passed already in capitals prints in full capitals either way.
const upper = new Map();
const caps = (s) => { let u = upper.get(s); if (u === undefined) { if (upper.size > 300) upper.clear(); u = String(s).toUpperCase(); upper.set(s, u); } return u; };
let canSmallCaps = null;
export const caption = (ctx, str, x, y, o = {}) => {
  if (canSmallCaps === null) canSmallCaps = 'fontVariantCaps' in ctx;
  const size = o.size || HUD.labelSm;
  if (!canSmallCaps) return text(ctx, caps(str), x, y, { halo: 'strong', color: C.onGlass2, ...o, size, weight: 600, tracking: 0.07 });
  return text(ctx, str, x, y, { halo: 'strong', color: C.onGlass2, ...o, size: size + 2.5, weight: 600, tracking: 0.05, smallCaps: true });
};
export function wrapText(ctx, str, maxW, size = HUD.value, weight = 500) {
  const out = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (measure(ctx, t, size, weight) > maxW && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// ---------- Controls ----------
// A button: an ink slip. state: 'normal' | 'pressed' | 'disabled' | 'active' (toggled on). variant 'glass' |
// 'gold' (the main action: a paper slip, one per screen) | 'danger' (red). `progress` (0..1, or [{ k, w }] for a rule split
// into one segment per battery, w guns long, gilt once loaded) is a reload rule
// filling along the bottom edge; `ready` (a loaded gun) and 'active' invert the slip to paper with ink type, so the
// thing you can use now is the brightest thing on the bar. `stack` puts the icon over a small label (the action
// bar's tiles, labels in Fell small capitals); otherwise icon and label sit side by side.
export function button(ctx, x, y, w, h, {
  label = '', icon = null, state = 'normal', variant = 'glass', progress = null, ready = false, sub = null, stack = false,
  r = Math.min(HUD.radius, h / 2),
} = {}) {
  const pressed = state === 'pressed', disabled = state === 'disabled';
  const lit = (ready || state === 'active') && variant === 'glass';
  const tone = lit ? 'gold' : variant;
  const T = TONES[tone] || TONES.glass;
  const onPaper = tone === 'gold' || tone === 'paper';
  ctx.save();
  if (disabled) ctx.globalAlpha *= 0.42;
  const oy = pressed ? 1 : 0;
  if (ready && !pressed && !disabled) { ctx.save(); shadow(ctx, GLOW_GOLD); rrect(ctx, x, y, w, h, r); ctx.fillStyle = T.bottom; ctx.fill(); ctx.restore(); }
  panel(ctx, x, y + oy, w, h, { tone, r, elevation: pressed || disabled ? 1 : 2 });
  if (pressed) { rrect(ctx, x, y + oy, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fill(); }
  if (Array.isArray(progress) && !ready) {
    // A side with several batteries: the reload rule splits into one segment per battery, as long as its guns
    // (w), each filling on its own and lit full once that battery is loaded.
    const segs = progress, gap = 3, inner = w - 12 - gap * (segs.length - 1), sum = segs.reduce((n, g) => n + g.w, 0) || 1;
    ctx.save(); rrect(ctx, x, y + oy, w, h, r); ctx.clip();
    let sx = x + 6;
    for (const g of segs) {
      const sw = inner * g.w / sum, k = Math.min(1, Math.max(0, g.k));
      ctx.fillStyle = 'rgba(239,229,207,0.16)'; ctx.fillRect(sx, y + oy + h - 4, sw, 1.5);
      ctx.fillStyle = k >= 1 ? MARK.chosen : 'rgba(239,229,207,0.85)'; ctx.fillRect(sx, y + oy + h - (k >= 1 ? 4.5 : 4), sw * k, k >= 1 ? 2.5 : 1.5);
      sx += sw + gap;
    }
    ctx.restore();
  } else if (progress != null && !ready) {
    const k = Math.min(1, Math.max(0, progress));
    ctx.save(); rrect(ctx, x, y + oy, w, h, r); ctx.clip();
    ctx.fillStyle = 'rgba(239,229,207,0.06)'; ctx.fillRect(x, y + oy, w * k, h);
    ctx.fillStyle = 'rgba(239,229,207,0.16)'; ctx.fillRect(x + 6, y + oy + h - 4, w - 12, 1.5);
    ctx.fillStyle = 'rgba(239,229,207,0.85)'; ctx.fillRect(x + 6, y + oy + h - 4, (w - 12) * k, 1.5);
    ctx.restore();
  }
  const ink = T.ink;
  if (stack) {
    const cy = y + oy + h / 2;
    if (icon) drawIcon(ctx, icon, x + w / 2, cy - 7.5, HUD.icon, ink);
    if (label) text(ctx, label, x + w / 2, cy + 13, { size: 13, weight: 400, face: 'caps', tracking: 0.02, color: onPaper || tone !== 'glass' ? ink : C.onGlass2, align: 'center', halo: 'none', maxWidth: w - 6 });
  } else {
    const cy = y + oy + h / 2 - (sub ? 6 : 0);
    const size = h >= 44 ? 17 : 15, isz = h >= 44 ? HUD.icon : HUD.iconSm;
    const lw = label ? measure(ctx, label, size, 400, 'caps') : 0, gap = icon && label ? 7 : 0;
    let cx = x + w / 2 - (lw + (icon ? isz : 0) + gap) / 2;
    if (icon) { drawIcon(ctx, icon, cx + isz / 2, cy, isz, ink); cx += isz + gap; }
    if (label) text(ctx, label, cx, cy, { size, weight: 400, face: 'caps', color: ink, halo: 'none', maxWidth: w - 16 });
    if (sub) text(ctx, sub, x + w / 2, cy + 14, { size: 12, weight: 400, italic: true, color: onPaper ? 'rgba(33,26,20,0.68)' : C.onGlass3, align: 'center', halo: 'none' });
  }
  ctx.restore();
}

// A round icon button (pause, fleet, recentre...): an ink disc. `active` adds a paper hairline ring; `badge` a small
// count; `progress` a paper ring filling round the edge; `ready` inverts it to a paper disc with a soft glow.
export function iconButton(ctx, cx, cy, { icon, size = HUD.button, state = 'normal', active = false, badge: b = null, progress = null, ready = false, alpha = 1 } = {}) {
  const r = size / 2, pressed = state === 'pressed', disabled = state === 'disabled';
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (disabled) ctx.globalAlpha *= 0.42;
  const oy = pressed ? 1 : 0;
  if (ready && !pressed && !disabled) { ctx.save(); shadow(ctx, GLOW_GOLD); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = P.paper; ctx.fill(); ctx.restore(); }
  panel(ctx, cx - r, cy - r + oy, size, size, { tone: ready ? 'gold' : 'glass', r, elevation: pressed ? 1 : 2 });
  if (progress != null && !ready) ring(ctx, cx, cy + oy, r - 2.5, progress, { width: 1.5, track: null });
  if (active && !ready) { ctx.beginPath(); ctx.arc(cx, cy + oy, r + 2, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = MARK.chosen; ctx.stroke(); }
  drawIcon(ctx, icon, cx, cy + oy, size * 0.44, ready ? P.ink : C.onGlass);
  if (b != null) badge(ctx, cx + r * 0.72, cy - r * 0.72 + oy, b);
  ctx.restore();
}

// A small badge: a count or a word on a capsule. tone 'gold' (paper) | 'red' | 'glass' (ink) | 'blue'.
export function badge(ctx, cx, cy, str, { tone = 'gold', size = 10.5 } = {}) {
  const s = typeof str === 'string' ? str : String(str), w = Math.max(size * 1.7, measure(ctx, s, size, 700) + size), h = size * 1.7;
  const fill = tone === 'red' ? P.red : tone === 'glass' ? P.ink : tone === 'blue' ? P.blue : P.paper;
  const ink = tone === 'gold' ? P.ink : P.paper;
  ctx.save();
  shadow(ctx, CANVAS_SHADOW[1]);
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  shadow(ctx, null);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,16,12,0.4)'; ctx.stroke();
  text(ctx, s, cx, cy + 0.5, { size, weight: 700, color: ink, align: 'center', halo: 'none' });
  ctx.restore();
}

// ---------- Meters ----------
// A thin flat bar with square-cut ends: hull, reload, capture. `ghost` (0..1) draws the recently lost part in a pale tint, for a damage
// flash that drains away. `segments` adds hairline notches (e.g. one per 25%). `outline` puts a soft-shadowed
// track round it (for bars on the open sea); without it the track is flush (bars inside a panel).
// (`shine` is accepted for compatibility; bars are printed flat.)
export function bar(ctx, x, y, w, h, k, { color = hpColor(k), track = MARK.track, ghost = null, segments = 0, outline = true, shine = true } = {}) {
  k = Math.min(1, Math.max(0, k));
  const r = Math.min(1, h / 2);
  ctx.save();
  if (outline) { shadow(ctx, CANVAS_SHADOW[1]); rrect(ctx, x - 1, y - 1, w + 2, h + 2, r + 1); ctx.fillStyle = track; ctx.fill(); shadow(ctx, null); }
  else { rrect(ctx, x, y, w, h, r); ctx.fillStyle = track; ctx.fill(); }
  if (ghost != null && ghost > k) { rrect(ctx, x, y, w * Math.min(1, ghost), h, r); ctx.fillStyle = 'rgba(239,229,207,0.6)'; ctx.fill(); }
  if (k > 0) { rrect(ctx, x, y, Math.max(h, w * k), h, r); ctx.fillStyle = color; ctx.fill(); }
  if (segments > 1) {
    ctx.fillStyle = 'rgba(20,16,12,0.5)';
    for (let i = 1; i < segments; i++) ctx.fillRect(Math.round(x + (w * i) / segments) - 0.5, y, 1, h);
  }
  ctx.restore();
}

// A circular progress ring, starting at twelve o'clock.
export function ring(ctx, cx, cy, r, k, { width = 3, color = MARK.chosen, track = MARK.track } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  if (track) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = width + 2; ctx.strokeStyle = track; ctx.stroke(); }
  if (k > 0) { ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); }
  ctx.restore();
}

// ---------- Messages ----------
// A centred banner (fort silenced, boss beaten): a Fell title in paper between two fine paper rules (red for bad
// news), an italic line under it, over a soft ink wash that keeps it legible over a busy sea. `t` (0..1) glides it
// in: it rises 10 px and fades up while the rules draw outwards.
let washG = null;
export function banner(ctx, cx, cy, { title, sub = null, t = 1, maxWidth = 340, tone = 'gold' } = {}) {
  const e = EASE.out(Math.min(1, Math.max(0, t)));
  if (e <= 0) return;
  ctx.save();
  ctx.globalAlpha *= e;
  const y = cy + (1 - e) * 10;
  const size = Math.min(28, maxWidth / Math.max(6, title.length * 0.46));
  const tw = Math.min(maxWidth, measure(ctx, title, size, 400, 'display'));
  if (!washG) { washG = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); washG.addColorStop(0, 'rgba(14,11,8,0.6)'); washG.addColorStop(0.6, 'rgba(14,11,8,0.32)'); washG.addColorStop(1, 'rgba(14,11,8,0)'); }
  // The wash is deep enough to hold the title over bright land and busy water, never a box.
  ctx.save(); ctx.translate(cx, y + (sub ? 10 : 0)); ctx.scale(tw / 2 + 100, sub ? 64 : 48);
  ctx.fillStyle = washG; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  text(ctx, title, cx, y, { size, weight: 400, face: 'display', color: tone === 'red' ? '#f6b5a2' : P.paper, align: 'center', halo: 'strong', maxWidth });
  const half = tw / 2 + 12, len = 30 * e;
  ctx.strokeStyle = tone === 'red' ? P.redHi : 'rgba(239,229,207,0.85)'; ctx.lineWidth = 1;
  shadow(ctx, CANVAS_SHADOW.textTight);
  for (let s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.moveTo(cx + s * half, y + 1); ctx.lineTo(cx + s * (half + len), y + 1); ctx.stroke(); }
  shadow(ctx, null);
  if (sub) text(ctx, sub, cx, y + size * 0.8 + 8, { align: 'center', color: C.onGlass, halo: 'strong', size: 15, weight: 400, italic: true, maxWidth });
  ctx.restore();
}

// A toast: a small ink slip with an optional icon and an italic line, for "Course cleared", "Anchored", "Prize taken".
// `t` (0..1) is its life; it eases in over the first 15% and out over the last 20%.
export function toast(ctx, cx, y, str, { icon = null, t = 0.5, tone = 'glass', maxWidth = 300 } = {}) {
  const a = t < 0.15 ? EASE.out(t / 0.15) : t > 0.8 ? 1 - EASE.in((t - 0.8) / 0.2) : 1;
  if (a <= 0) return;
  const size = 15, h = 28, isz = 14, w = Math.min(maxWidth, measure(ctx, str, size, 400) + (icon ? isz + 8 : 0) + 26);
  ctx.save();
  ctx.globalAlpha *= a;
  const yy = y + (1 - a) * 6;
  panel(ctx, cx - w / 2, yy - h / 2, w, h, { tone, r: HUD.radius, elevation: 2 });
  let x = cx - w / 2 + 13;
  if (icon) { drawIcon(ctx, icon, x + isz / 2, yy, isz, toneInk(tone)); x += isz + 8; }
  text(ctx, str, x, yy, { size, weight: 400, italic: true, color: toneInk(tone), halo: 'none', maxWidth: w - (x - (cx - w / 2)) - 13 });
  ctx.restore();
}

// A tip card (first-time hints, the tutorial coach on canvas): a printed paper slip with a hairline inside its
// edge, a small-capital step line and wrapped text, like the DOM coach. Returns its height so callers can stack it.
// Its geometry (wrap at 14, 19.5 px lines) is fixed, because callers lay the card out from it; `lines` may be
// passed pre-wrapped to that measure.
export function tipCard(ctx, x, y, w, str, { step = null, alpha = 1, lines = null } = {}) {
  lines = lines || wrapText(ctx, str, w - 32, 14, 500);
  const lh = 19.5, h = 26 + (step ? 16 : 0) + lines.length * lh;
  ctx.save();
  ctx.globalAlpha *= alpha;
  panel(ctx, x, y, w, h, { tone: 'paper', r: HUD.radius, elevation: 3 });
  ctx.strokeStyle = C.paperLine; ctx.lineWidth = 1; ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  let ty = y + 14;
  if (step) { caption(ctx, step, x + 16, ty + 5, { color: P.ink3, halo: 'none' }); ty += 16; }
  for (let i = 0; i < lines.length; i++) text(ctx, lines[i], x + 16, ty + i * lh + lh / 2 - 1, { size: 15, weight: 400, color: P.ink, halo: 'none', maxWidth: w - 30 });
  ctx.restore();
  return h;
}

// A number (or a word) thrown up off something that was hit: damage, "Raked!", "Mast down!". `age` and `dur` in
// seconds. It pops in on the spring curve, holds, and fades; the caller moves it (rise). Figures are Fell, words
// Fell small capitals, all with the strong ink halo. tone: 'hit' (your shot landing: paper), 'hurt' (you were hit:
// pale red), 'gold' (a crit or reward: gilt), 'heal' (green), 'cold' (blue).
const FLOAT = { hit: P.paper, hurt: '#f6a08a', gold: MARK.chosen, heal: P.greenHi, cold: P.blueHi };
export function floater(ctx, x, y, { value = null, word = null, tone = 'hit', age = 0, dur = 1.1, size = 17 } = {}) {
  const a = life(age, dur, 0.05, dur * 0.4);
  if (a <= 0) return;
  const pop = age < 0.2 ? 0.6 + 0.4 * EASE.spring(age / 0.2) : 1;
  const color = FLOAT[tone] || tone;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.scale(pop, pop);
  if (value != null) {
    text(ctx, value, 0, 0, { size: size + 3, weight: 400, face: 'display', color, align: 'center', halo: 'strong' });
    if (word) caption(ctx, word, 0, -size * 0.78 - 3, { size: 11, color: tone === 'hurt' ? MARK.hurt : MARK.chosen, align: 'center', halo: 'strong' });
  } else if (word) text(ctx, word, 0, 0, { size: 16, weight: 400, face: 'display', italic: true, color, align: 'center', halo: 'strong' });
  ctx.restore();
}

// ---------- Small instruments ----------
// The wind compass: an ink disc with a fine ring of ticks and a slim paper needle, red-tipped, pointing where the
// wind blows to.
// `strength` (0..1) lengthens the tail. `angle` is in screen radians (0 = right).
export function windRose(ctx, cx, cy, r, angle, { strength = 1, label = 'Wind' } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  shadow(ctx, CANVAS_SHADOW[2]); ctx.fillStyle = 'rgba(29,23,18,0.86)'; ctx.fill(); shadow(ctx, null);
  ctx.lineWidth = 1; ctx.strokeStyle = C.glassLineStrong; ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8, long = i % 4 === 0, r0 = r - (long ? 5.5 : 3.5);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (r - 1.5));
    ctx.lineWidth = long ? 1.3 : 0.9; ctx.strokeStyle = long ? C.onGlass2 : C.onGlass3; ctx.stroke();
  }
  ctx.translate(cx, cy); ctx.rotate(angle);
  const tip = r - 6.5, tail = -(r - 8) * (0.55 + 0.45 * strength);
  ctx.beginPath(); ctx.moveTo(tip, 0); ctx.lineTo(tip - 9, -4.5); ctx.lineTo(tip - 7, 0); ctx.lineTo(tip - 9, 4.5); ctx.closePath();
  ctx.fillStyle = P.redHi; ctx.fill();
  ctx.beginPath(); ctx.moveTo(tip - 7, 0); ctx.lineTo(tail, 0); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.strokeStyle = P.paper; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tail, 0); ctx.lineTo(tail - 3.5, -3.5); ctx.moveTo(tail + 3.5, 0); ctx.lineTo(tail, -3.5); ctx.lineWidth = 1.3; ctx.stroke();
  ctx.restore();
  if (label) caption(ctx, label, cx, cy + r + 9, { align: 'center', size: 9, color: C.onGlass2, halo: 'soft' });
}

// A chevron on the screen edge pointing at something off screen (enemy red, or any colour).
export function edgeChevron(ctx, x, y, angle, { color = P.redHi, size = 14, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(angle);
  shadow(ctx, CANVAS_SHADOW.text);
  ctx.beginPath(); ctx.moveTo(size * 0.6, 0); ctx.lineTo(-size * 0.4, -size * 0.55); ctx.lineTo(-size * 0.15, 0); ctx.lineTo(-size * 0.4, size * 0.55); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

const unders = new Map();
const underInk = (a) => { let s = unders.get(a); if (!s) { s = `rgba(20,16,12,${a})`; unders.set(a, s); } return s; };
// Strokes the current path as a line on the sea: a soft dark underlay, then the line, so it reads on any water.
// `dash` e.g. [2, 8] for dotted; `offset` slides the dashes (for marching ants).
export function seaStroke(ctx, { color = 'rgba(239,229,207,0.92)', width = 1.5, dash = null, offset = 0, under = 0.28 } = {}) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = offset; }
  if (under) { ctx.lineWidth = width + 2.5; ctx.strokeStyle = underInk(under); ctx.stroke(); }
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

// A thin course/firing-arc line on the sea through screen points `pts`.
export function seaLine(ctx, pts, { color = 'rgba(239,229,207,0.92)', width = 2, dash = null } = {}) {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  seaStroke(ctx, { color, width, dash });
}
