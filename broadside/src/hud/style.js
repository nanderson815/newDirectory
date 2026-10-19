// The HUD style kit: canvas drawing functions in the game's visual language, reading the same tokens as the CSS
// menus (src/ui/tokens.js) and the same icons (src/ui/icons.js). Every function takes the 2D context first and
// works in CSS pixels; the caller sets the devicePixelRatio transform as usual (ctx.setTransform(dpr, ...)), and
// the kit scales canvas shadows (which ignore the transform) to match, so blur looks the same at DPR 1, 2 or 3.
// Nothing here keeps game state; animated pieces take a progress value `t` in [0, 1] (see tween()). Font strings,
// text widths and panel gradients are cached, so drawing the HUD every frame allocates next to nothing.
//
// The look: glass (dark teal, hairline edge, soft drop shadow) for controls; gold for the one thing that's ready
// or chosen; text with a soft shadow instead of an outline; thin bars; icons, not words, where an icon is clear.
import { COLOR, PALETTE, FONT, RADIUS, CANVAS_SHADOW, EASE } from '../ui/tokens.js';
import { drawIcon } from '../ui/icons.js';

const P = PALETTE, C = COLOR;

// HUD metrics, in CSS px. Touch targets are at least 44 px.
export const HUD = {
  edge: 12, gap: 8, radius: RADIUS.md,
  button: 44, buttonSm: 36, icon: 20, iconSm: 16,
  bar: 5, barThin: 3,
  label: 13, labelSm: 11, value: 15, title: 26,
};

// ---------- Basics ----------
const FACES = ['ui', 'display'];
const fonts = new Map();
export function font(size, weight = 600, face = 'ui', italic = false) {
  const key = ((Math.round(size * 4) * 1000 + weight) * 2 + (face === 'display' ? 1 : 0)) * 2 + (italic ? 1 : 0);
  let f = fonts.get(key);
  if (!f) { f = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[FACES.includes(face) ? face : 'ui']}`; fonts.set(key, f); }
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
const HALO_STRONG = { color: 'rgba(4,14,17,0.8)', blur: 10, y: 1.5 };
const GLOW_GOLD = { color: 'rgba(246,210,122,0.5)', blur: 14, y: 0 };

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

// ---------- Surfaces ----------
const TONES = {
  glass: { top: 'rgba(23, 67, 77, 0.88)', bottom: 'rgba(8, 29, 35, 0.9)', line: C.glassLine, hi: 'rgba(255,255,255,0.07)', ink: C.onGlass },
  solid: { top: P.teal700, bottom: P.teal900, line: C.glassLineStrong, hi: 'rgba(255,255,255,0.08)', ink: C.onGlass },
  paper: { top: '#fbf3dd', bottom: '#e9d6aa', line: 'rgba(42,29,19,0.22)', hi: 'rgba(255,255,255,0.6)', ink: P.ink },
  crimson: { top: 'rgba(86, 31, 34, 0.92)', bottom: 'rgba(52, 18, 21, 0.92)', line: 'rgba(246,210,122,0.28)', hi: 'rgba(255,220,200,0.08)', ink: '#f7e2c4' },
  gold: { top: '#f3c86a', bottom: '#d89a33', line: P.goldDeep, hi: 'rgba(255,246,214,0.65)', ink: P.ink },
  danger: { top: P.terracottaHi, bottom: P.terracottaDeep, line: P.terracottaDeep, hi: 'rgba(255,220,200,0.4)', ink: P.cream },
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

// A panel: drop shadow, vertical gradient fill, hairline edge and a top highlight.
export function panel(ctx, x, y, w, h, { tone = 'glass', r = HUD.radius, elevation = 2, alpha = 1 } = {}) {
  const T = TONES[tone] || TONES.glass;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = gradient(ctx, tone, T, y, h);
  if (elevation) { shadow(ctx, CANVAS_SHADOW[elevation]); rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill(); shadow(ctx, null); }
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5); ctx.lineWidth = 1; ctx.strokeStyle = T.line; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.lineWidth = 1; ctx.strokeStyle = T.hi; ctx.stroke();
  ctx.restore();
}

// A gold hairline round a rounded rect: "this one" (the chosen ship, a toggled control). `glow` adds a soft halo.
export function hairline(ctx, x, y, w, h, r, { color = P.goldHi, alpha = 0.9, tint = 'rgba(246,210,122,0.07)', glow = false } = {}) {
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
  halo = 'soft', tracking = 0, maxWidth, alpha = 1,
} = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size, weight, face, italic);
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
// Small caps label: uppercase, tracked, bold. (Pass the string already in capitals to skip the conversion.)
const upper = new Map();
const caps = (s) => { let u = upper.get(s); if (u === undefined) { if (upper.size > 300) upper.clear(); u = String(s).toUpperCase(); upper.set(s, u); } return u; };
export const caption = (ctx, str, x, y, o = {}) => text(ctx, caps(str), x, y, { size: HUD.labelSm, weight: 700, tracking: 0.12, color: C.onGlass2, ...o });
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
// A button. state: 'normal' | 'pressed' | 'disabled' | 'active' (toggled on: a gold hairline and gold ink).
// variant 'glass' | 'gold' (the main action: one per screen) | 'danger'. `progress` (0..1) is a reload line
// filling along the bottom edge; `ready` (a loaded gun) is a gold hairline with a soft glow. `stack` puts the
// icon over a small label (the action bar's tiles); otherwise icon and label sit side by side.
export function button(ctx, x, y, w, h, {
  label = '', icon = null, state = 'normal', variant = 'glass', progress = null, ready = false, sub = null, stack = false,
  r = Math.min(HUD.radius, h / 2),
} = {}) {
  const pressed = state === 'pressed', disabled = state === 'disabled';
  const tone = variant;
  const T = TONES[tone] || TONES.glass;
  const lit = (ready || state === 'active') && tone === 'glass';
  ctx.save();
  if (disabled) ctx.globalAlpha *= 0.42;
  const oy = pressed ? 1 : 0;
  if (ready && !pressed && !disabled) { // the glow of a loaded gun
    ctx.save(); shadow(ctx, GLOW_GOLD); rrect(ctx, x, y, w, h, r); ctx.fillStyle = T.bottom; ctx.fill(); ctx.restore();
  }
  panel(ctx, x, y + oy, w, h, { tone, r, elevation: pressed || disabled ? 1 : 2 });
  if (pressed) { rrect(ctx, x, y + oy, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fill(); }
  if (lit) hairline(ctx, x, y + oy, w, h, r, { alpha: ready ? 0.85 : 0.7 });
  if (progress != null && !ready) {
    const k = Math.min(1, Math.max(0, progress));
    ctx.save(); rrect(ctx, x, y + oy, w, h, r); ctx.clip();
    ctx.fillStyle = 'rgba(188,217,214,0.06)'; ctx.fillRect(x, y + oy, w * k, h);
    ctx.fillStyle = 'rgba(4,14,17,0.45)'; ctx.fillRect(x + r * 0.6, y + oy + h - 4, w - r * 1.2, 2);
    ctx.fillStyle = P.gold; ctx.fillRect(x + r * 0.6, y + oy + h - 4, (w - r * 1.2) * k, 2);
    ctx.restore();
  }
  const ink = lit ? P.goldHi : T.ink;
  const textHalo = tone === 'glass' || tone === 'solid' ? 'tight' : 'none';
  if (stack) {
    const cy = y + oy + h / 2;
    if (icon) drawIcon(ctx, icon, x + w / 2, cy - 7.5, HUD.icon, ink);
    if (label) text(ctx, label, x + w / 2, cy + 13, { size: 10.5, weight: 650, tracking: 0.02, color: lit || tone !== 'glass' ? ink : C.onGlass2, align: 'center', halo: textHalo, maxWidth: w - 6 });
  } else {
    const cy = y + oy + h / 2 - (sub ? 6 : 0);
    const size = h >= 44 ? 15 : 13, isz = h >= 44 ? HUD.icon : HUD.iconSm;
    const lw = label ? measure(ctx, label, size, 650) : 0, gap = icon && label ? 7 : 0;
    let cx = x + w / 2 - (lw + (icon ? isz : 0) + gap) / 2;
    if (icon) { drawIcon(ctx, icon, cx + isz / 2, cy, isz, ink); cx += isz + gap; }
    if (label) text(ctx, label, cx, cy + 0.5, { size, weight: 650, color: ink, halo: textHalo, maxWidth: w - 16 });
    if (sub) text(ctx, sub, x + w / 2, cy + 13, { size: 10.5, weight: 600, color: tone === 'gold' ? 'rgba(42,29,19,0.7)' : C.onGlass3, align: 'center', halo: 'none' });
  }
  ctx.restore();
}

// A round icon button (pause, fleet, recentre...). `active` adds a gold hairline ring; `badge` a small count;
// `progress` a ring filling round the edge; `ready` gold ink with a soft glow.
export function iconButton(ctx, cx, cy, { icon, size = HUD.button, state = 'normal', active = false, badge: b = null, progress = null, ready = false, alpha = 1 } = {}) {
  const r = size / 2, pressed = state === 'pressed', disabled = state === 'disabled';
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (disabled) ctx.globalAlpha *= 0.42;
  const oy = pressed ? 1 : 0;
  if (ready && !pressed && !disabled) { ctx.save(); shadow(ctx, GLOW_GOLD); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = P.teal900; ctx.fill(); ctx.restore(); }
  panel(ctx, cx - r, cy - r + oy, size, size, { tone: 'glass', r, elevation: pressed ? 1 : 2 });
  if (progress != null && !ready) ring(ctx, cx, cy + oy, r - 2.5, progress, { width: 2, track: null });
  if (active || ready) { ctx.beginPath(); ctx.arc(cx, cy + oy, r - 0.5, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = P.goldHi; ctx.stroke(); }
  drawIcon(ctx, icon, cx, cy + oy, size * 0.44, active || ready ? P.goldHi : C.onGlass);
  if (b != null) badge(ctx, cx + r * 0.72, cy - r * 0.72 + oy, b);
  ctx.restore();
}

// A small badge: a count or a word on a capsule. tone 'gold' | 'red' | 'glass' | 'blue'.
export function badge(ctx, cx, cy, str, { tone = 'gold', size = 10.5 } = {}) {
  const s = typeof str === 'string' ? str : String(str), w = Math.max(size * 1.7, measure(ctx, s, size, 700) + size), h = size * 1.7;
  const fill = tone === 'red' ? P.red : tone === 'glass' ? P.teal800 : tone === 'blue' ? P.blue : P.gold;
  const ink = tone === 'gold' ? P.ink : P.cream;
  ctx.save();
  shadow(ctx, CANVAS_SHADOW[1]);
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  shadow(ctx, null);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(4,14,17,0.35)'; ctx.stroke();
  text(ctx, s, cx, cy + 0.5, { size, weight: 700, color: ink, align: 'center', halo: 'none' });
  ctx.restore();
}

// ---------- Meters ----------
// A thin bar: hull, reload, capture. `ghost` (0..1) draws the recently lost part in a pale tint, for a damage
// flash that drains away. `segments` adds hairline notches (e.g. one per 25%). `outline` puts a soft-shadowed
// track round it (for bars on the open sea); without it the track is flush (bars inside a panel).
export function bar(ctx, x, y, w, h, k, { color = hpColor(k), track = 'rgba(4,14,17,0.5)', ghost = null, segments = 0, outline = true, shine = true } = {}) {
  k = Math.min(1, Math.max(0, k));
  ctx.save();
  if (outline) { shadow(ctx, CANVAS_SHADOW[1]); rrect(ctx, x - 1, y - 1, w + 2, h + 2, (h + 2) / 2); ctx.fillStyle = track; ctx.fill(); shadow(ctx, null); }
  else { rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = track; ctx.fill(); }
  if (ghost != null && ghost > k) { rrect(ctx, x, y, w * Math.min(1, ghost), h, h / 2); ctx.fillStyle = 'rgba(255,240,210,0.6)'; ctx.fill(); }
  if (k > 0) {
    rrect(ctx, x, y, Math.max(h, w * k), h, h / 2); ctx.fillStyle = color; ctx.fill();
    if (shine && h >= 4) { ctx.globalAlpha *= 0.3; rrect(ctx, x, y, Math.max(h, w * k), h / 2, h / 4); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha /= 0.3; }
  }
  if (segments > 1) {
    ctx.fillStyle = 'rgba(4,14,17,0.45)';
    for (let i = 1; i < segments; i++) ctx.fillRect(Math.round(x + (w * i) / segments) - 0.5, y, 1, h);
  }
  ctx.restore();
}

// A circular progress ring, starting at twelve o'clock.
export function ring(ctx, cx, cy, r, k, { width = 3, color = P.gold, track = 'rgba(4,14,17,0.45)' } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  if (track) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = width + 2; ctx.strokeStyle = track; ctx.stroke(); }
  if (k > 0) { ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); }
  ctx.restore();
}

// ---------- Messages ----------
// A centred banner (fort silenced, boss beaten): a display-face title between two thin gold rules, with a
// short line under it, over a soft dark wash that keeps it legible over a busy sea. `t` (0..1) glides it in:
// it rises 10 px and fades up while the rules draw outwards.
let washG = null;
export function banner(ctx, cx, cy, { title, sub = null, t = 1, maxWidth = 340, tone = 'gold' } = {}) {
  const e = EASE.out(Math.min(1, Math.max(0, t)));
  if (e <= 0) return;
  ctx.save();
  ctx.globalAlpha *= e;
  const y = cy + (1 - e) * 10;
  const size = Math.min(24, maxWidth / Math.max(6, title.length * 0.5));
  const tw = Math.min(maxWidth, measure(ctx, title, size, 650, 'display'));
  if (!washG) { washG = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); washG.addColorStop(0, 'rgba(4,14,17,0.42)'); washG.addColorStop(0.55, 'rgba(4,14,17,0.22)'); washG.addColorStop(1, 'rgba(4,14,17,0)'); }
  ctx.save(); ctx.translate(cx, y + (sub ? 10 : 0)); ctx.scale(tw / 2 + 90, sub ? 58 : 44);
  ctx.fillStyle = washG; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  text(ctx, title, cx, y, { size, weight: 650, face: 'display', color: tone === 'red' ? '#ffd2c6' : P.goldHi, align: 'center', halo: 'strong', maxWidth });
  const half = tw / 2 + 14, len = 30 * e;
  ctx.strokeStyle = tone === 'red' ? P.redHi : P.gold; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1;
  shadow(ctx, CANVAS_SHADOW.textTight);
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(cx + s * half, y); ctx.lineTo(cx + s * (half + len), y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * (half - 5), y); ctx.lineTo(cx + s * (half - 2), y - 3); ctx.lineTo(cx + s * (half + 1), y); ctx.lineTo(cx + s * (half - 2), y + 3); ctx.closePath(); ctx.fill();
  }
  shadow(ctx, null);
  if (sub) text(ctx, sub, cx, y + size * 0.8 + 8, { align: 'center', color: C.onGlass, halo: 'strong', size: 13, weight: 500, maxWidth });
  ctx.restore();
}

// A toast: a small glass capsule with an optional icon, for "Course cleared", "Anchored", "Prize taken".
// `t` (0..1) is its life; it eases in over the first 15% and out over the last 20%.
export function toast(ctx, cx, y, str, { icon = null, t = 0.5, tone = 'glass', maxWidth = 300 } = {}) {
  const a = t < 0.15 ? EASE.out(t / 0.15) : t > 0.8 ? 1 - EASE.in((t - 0.8) / 0.2) : 1;
  if (a <= 0) return;
  const size = 13, h = 28, isz = 15, w = Math.min(maxWidth, measure(ctx, str, size, 600) + (icon ? isz + 8 : 0) + 26);
  ctx.save();
  ctx.globalAlpha *= a;
  const yy = y + (1 - a) * 6;
  panel(ctx, cx - w / 2, yy - h / 2, w, h, { tone, r: h / 2, elevation: 2 });
  let x = cx - w / 2 + 13;
  if (icon) { drawIcon(ctx, icon, x + isz / 2, yy, isz, P.goldHi); x += isz + 8; }
  text(ctx, str, x, yy + 0.5, { size, weight: 600, color: toneInk(tone), halo: 'none', maxWidth: w - (x - (cx - w / 2)) - 13 });
  ctx.restore();
}

// A tip card (first-time hints, the tutorial coach on canvas): a step caption and wrapped text on glass.
// Returns its height so callers can stack it.
export function tipCard(ctx, x, y, w, str, { step = null, alpha = 1, lines = null } = {}) {
  lines = lines || wrapText(ctx, str, w - 32, 14, 500);
  const lh = 19.5, h = 26 + (step ? 16 : 0) + lines.length * lh;
  ctx.save();
  ctx.globalAlpha *= alpha;
  panel(ctx, x, y, w, h, { tone: 'glass', r: HUD.radius, elevation: 3 });
  let ty = y + 14;
  if (step) { caption(ctx, step, x + 16, ty + 5, { color: P.goldHi, halo: 'none' }); ty += 16; }
  for (let i = 0; i < lines.length; i++) text(ctx, lines[i], x + 16, ty + i * lh + lh / 2 - 1, { size: 14, weight: 500, color: C.onGlass, halo: 'none' });
  ctx.restore();
  return h;
}

// A number (or a word) thrown up off something that was hit: damage, "Raked!", "Mast down!". `age` and `dur` in
// seconds. It pops in on the spring curve, holds, and fades; the caller moves it (rise). tone: 'hit' (your shot
// landing: warm cream), 'hurt' (you were hit: coral), 'gold' (a crit or reward), 'heal' (green), 'cold' (blue).
const FLOAT = { hit: '#fbecc4', hurt: '#ff9a86', gold: P.goldHi, heal: P.greenHi, cold: P.blueHi };
export function floater(ctx, x, y, { value = null, word = null, tone = 'hit', age = 0, dur = 1.1, size = 17 } = {}) {
  const a = life(age, dur, 0.05, dur * 0.4);
  if (a <= 0) return;
  const pop = age < 0.2 ? 0.6 + 0.4 * EASE.spring(age / 0.2) : 1;
  const color = FLOAT[tone] || tone;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.scale(pop, pop);
  if (value != null) {
    text(ctx, value, 0, 0, { size, weight: 700, face: 'display', color, align: 'center', halo: 'strong' });
    if (word) caption(ctx, word, 0, -size * 0.72 - 3, { size: 10, weight: 800, color: tone === 'hurt' ? '#ffc2b4' : P.goldHi, align: 'center', halo: 'strong' });
  } else if (word) text(ctx, word, 0, 0, { size: 13, weight: 700, tracking: 0.02, color: tone === 'hit' ? P.goldHi : color, align: 'center', halo: 'strong' });
  ctx.restore();
}

// ---------- Small instruments ----------
// The wind compass: a fine ring with tick marks and a slim needle pointing where the wind blows to.
// `strength` (0..1) lengthens the tail. `angle` is in screen radians (0 = right).
export function windRose(ctx, cx, cy, r, angle, { strength = 1, label = 'Wind' } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  shadow(ctx, CANVAS_SHADOW[2]); ctx.fillStyle = 'rgba(8,29,35,0.82)'; ctx.fill(); shadow(ctx, null);
  ctx.lineWidth = 1; ctx.strokeStyle = C.glassLineStrong; ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8, long = i % 4 === 0, r0 = r - (long ? 5.5 : 3.5);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (r - 1.5));
    ctx.lineWidth = long ? 1.3 : 0.9; ctx.strokeStyle = long ? C.onGlass2 : C.onGlass3; ctx.stroke();
  }
  ctx.translate(cx, cy); ctx.rotate(angle);
  const tip = r - 6.5, tail = -(r - 8) * (0.55 + 0.45 * strength);
  ctx.beginPath(); ctx.moveTo(tip, 0); ctx.lineTo(tip - 9, -4.5); ctx.lineTo(tip - 7, 0); ctx.lineTo(tip - 9, 4.5); ctx.closePath();
  ctx.fillStyle = P.goldHi; ctx.fill();
  ctx.beginPath(); ctx.moveTo(tip - 7, 0); ctx.lineTo(tail, 0); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.strokeStyle = P.goldHi; ctx.stroke();
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
const underInk = (a) => { let s = unders.get(a); if (!s) { s = `rgba(4,14,17,${a})`; unders.set(a, s); } return s; };
// Strokes the current path as a line on the sea: a soft dark underlay, then the line, so it reads on any water.
// `dash` e.g. [2, 8] for dotted; `offset` slides the dashes (for marching ants).
export function seaStroke(ctx, { color = 'rgba(251,244,227,0.9)', width = 1.5, dash = null, offset = 0, under = 0.28 } = {}) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = offset; }
  if (under) { ctx.lineWidth = width + 2.5; ctx.strokeStyle = underInk(under); ctx.stroke(); }
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

// A thin course/firing-arc line on the sea through screen points `pts`.
export function seaLine(ctx, pts, { color = 'rgba(251,244,227,0.9)', width = 2, dash = null } = {}) {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  seaStroke(ctx, { color, width, dash });
}
