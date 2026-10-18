// The HUD style kit: canvas drawing functions in the game's visual language, reading the same tokens as the CSS
// menus (src/ui/tokens.js) and the same icons (src/ui/icons.js). Every function takes the 2D context first and
// works in CSS pixels; the caller sets the devicePixelRatio transform as usual (ctx.setTransform(dpr, ...)), and
// the kit scales canvas shadows (which ignore the transform) to match, so blur looks the same at DPR 1, 2 or 3.
// Nothing here keeps state; animated pieces take a progress value `t` in [0, 1] (see tween()).
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
export const font = (size, weight = 600, face = 'ui', italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[face]}`;
const dprOf = (ctx) => Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;

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
  const k = dprOf(ctx);
  if (!s) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; return; }
  ctx.shadowColor = s.color; ctx.shadowBlur = s.blur * k; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = (s.y || 0) * k;
}

// Eased progress of an animation that started at t0 (seconds or ms, as long as `now` and `dur` agree).
export function tween(t0, now, dur, curve = 'out') {
  const k = Math.min(1, Math.max(0, (now - t0) / dur));
  return EASE[curve] ? EASE[curve](k) : k;
}

export const hpColor = (k) => (k > 0.6 ? C.hpHigh : k > 0.3 ? C.hpMid : C.hpLow);

// ---------- Surfaces ----------
const TONES = {
  glass: { top: 'rgba(23, 67, 77, 0.9)', bottom: 'rgba(8, 29, 35, 0.9)', line: C.glassLine, hi: 'rgba(255,255,255,0.07)', ink: C.onGlass },
  solid: { top: P.teal700, bottom: P.teal900, line: C.glassLineStrong, hi: 'rgba(255,255,255,0.08)', ink: C.onGlass },
  paper: { top: '#fbf3dd', bottom: '#e9d6aa', line: 'rgba(42,29,19,0.22)', hi: 'rgba(255,255,255,0.6)', ink: P.ink },
  crimson: { top: P.crimson2, bottom: P.crimson, line: 'rgba(246,210,122,0.3)', hi: 'rgba(255,220,200,0.08)', ink: '#f7e2c4' },
  gold: { top: '#f3c86a', bottom: '#d89a33', line: P.goldDeep, hi: 'rgba(255,246,214,0.65)', ink: P.ink },
  danger: { top: P.terracottaHi, bottom: P.terracottaDeep, line: P.terracottaDeep, hi: 'rgba(255,220,200,0.4)', ink: P.cream },
};
export const toneInk = (tone) => (TONES[tone] || TONES.glass).ink;

// A panel: drop shadow, vertical gradient fill, hairline edge and a top highlight.
export function panel(ctx, x, y, w, h, { tone = 'glass', r = HUD.radius, elevation = 2, alpha = 1 } = {}) {
  const T = TONES[tone] || TONES.glass;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, T.top); g.addColorStop(1, T.bottom);
  if (elevation) { shadow(ctx, CANVAS_SHADOW[elevation]); rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill(); shadow(ctx, null); }
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5); ctx.lineWidth = 1; ctx.strokeStyle = T.line; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.lineWidth = 1; ctx.strokeStyle = T.hi; ctx.stroke();
  ctx.restore();
}

// ---------- Text ----------
// Text with a soft shadow (two passes: a wide soft one for separation from the sea, a tight one for edge
// contrast) instead of a heavy outline. Returns the drawn width.
export function text(ctx, str, x, y, {
  size = HUD.label, weight = 600, face = 'ui', italic = false, color = C.onGlass, align = 'left', baseline = 'middle',
  halo = 'soft', tracking = 0, maxWidth, alpha = 1,
} = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size, weight, face, italic);
  ctx.textAlign = align; ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = tracking ? `${tracking * size}px` : '0px';
  ctx.fillStyle = color;
  if (halo === 'soft' || halo === 'strong') {
    shadow(ctx, halo === 'strong' ? { ...CANVAS_SHADOW.text, color: 'rgba(4,14,17,0.8)', blur: 10 } : CANVAS_SHADOW.text);
    ctx.fillText(str, x, y, maxWidth);
    shadow(ctx, CANVAS_SHADOW.textTight);
  }
  ctx.fillText(str, x, y, maxWidth);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return maxWidth ? Math.min(w, maxWidth) : w;
}
// Small caps label: uppercase, tracked, bold.
export const caption = (ctx, str, x, y, o = {}) => text(ctx, String(str).toUpperCase(), x, y, { size: HUD.labelSm, weight: 700, tracking: 0.12, color: C.onGlass2, ...o });
export function measure(ctx, str, size = HUD.label, weight = 600, face = 'ui') {
  ctx.save(); ctx.font = font(size, weight, face); const w = ctx.measureText(str).width; ctx.restore(); return w;
}
export function wrapText(ctx, str, maxW, size = HUD.value, weight = 500) {
  ctx.save(); ctx.font = font(size, weight);
  const out = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  ctx.restore();
  return out;
}

// ---------- Controls ----------
// A pill button. state: 'normal' | 'pressed' | 'disabled' | 'active' (chosen: gold). `progress` (0..1) shows a
// reload filling left to right; `ready` turns it gold with a soft glow. `variant` 'glass' | 'gold' | 'danger'.
export function button(ctx, x, y, w, h, {
  label = '', icon = null, state = 'normal', variant = 'glass', progress = null, ready = false, sub = null, r = Math.min(HUD.radius, h / 2),
} = {}) {
  const pressed = state === 'pressed', disabled = state === 'disabled';
  const tone = ready || state === 'active' ? 'gold' : variant;
  const T = TONES[tone];
  ctx.save();
  if (disabled) ctx.globalAlpha *= 0.45;
  const oy = pressed ? 1 : 0;
  if (ready && !pressed && !disabled) { // the glow of a loaded gun
    ctx.save(); shadow(ctx, { color: 'rgba(246,210,122,0.55)', blur: 14, y: 0 }); rrect(ctx, x, y, w, h, r); ctx.fillStyle = T.bottom; ctx.fill(); ctx.restore();
  }
  panel(ctx, x, y + oy, w, h, { tone, r, elevation: pressed || disabled ? 1 : 2 });
  if (pressed) { rrect(ctx, x, y + oy, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fill(); }
  if (progress != null && !ready) {
    const k = Math.min(1, Math.max(0, progress));
    ctx.save(); rrect(ctx, x, y + oy, w, h, r); ctx.clip();
    ctx.fillStyle = 'rgba(188,217,214,0.1)'; ctx.fillRect(x, y + oy, w * k, h);
    ctx.fillStyle = P.gold; ctx.fillRect(x, y + oy + h - 2.5, w * k, 2.5);
    ctx.restore();
  }
  const ink = T.ink, cy = y + oy + h / 2 - (sub ? 6 : 0);
  const size = h >= 44 ? 15 : 13, isz = h >= 44 ? HUD.icon : HUD.iconSm;
  const lw = label ? measure(ctx, label, size, 650) : 0, gap = icon && label ? 7 : 0;
  let cx = x + w / 2 - (lw + (icon ? isz : 0) + gap) / 2;
  if (icon) { drawIcon(ctx, icon, cx + isz / 2, cy, isz, ink); cx += isz + gap; }
  if (label) text(ctx, label, cx, cy + 0.5, { size, weight: 650, color: ink, halo: tone === 'glass' || tone === 'solid' ? 'tight' : 'none', maxWidth: w - 16 });
  if (sub) text(ctx, sub, x + w / 2, cy + 13, { size: 10.5, weight: 600, color: tone === 'gold' ? 'rgba(42,29,19,0.7)' : C.onGlass3, align: 'center', halo: 'none' });
  ctx.restore();
}

// A round icon button (pause, fleet, anchor...). `active` adds a gold ring; `badge` a small count.
export function iconButton(ctx, cx, cy, { icon, size = HUD.button, state = 'normal', active = false, badge: b = null, progress = null, ready = false } = {}) {
  const r = size / 2, pressed = state === 'pressed', disabled = state === 'disabled';
  ctx.save();
  if (disabled) ctx.globalAlpha *= 0.45;
  const oy = pressed ? 1 : 0, tone = ready ? 'gold' : 'glass';
  panel(ctx, cx - r, cy - r + oy, size, size, { tone, r, elevation: pressed ? 1 : 2 });
  if (progress != null && !ready) ring(ctx, cx, cy + oy, r - 2.5, progress, { width: 2.5, track: null });
  if (active) { ctx.beginPath(); ctx.arc(cx, cy + oy, r + 2.5, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = P.goldHi; ctx.stroke(); }
  drawIcon(ctx, icon, cx, cy + oy, size * 0.46, ready ? P.ink : active ? P.goldHi : C.onGlass);
  if (b != null) badge(ctx, cx + r * 0.72, cy - r * 0.72 + oy, b);
  ctx.restore();
}

// A small badge: a count or a word on a capsule. tone 'gold' | 'red' | 'glass' | 'blue'.
export function badge(ctx, cx, cy, str, { tone = 'gold', size = 10.5 } = {}) {
  const s = String(str), w = Math.max(size * 1.7, measure(ctx, s, size, 700) + size), h = size * 1.7;
  const fill = { gold: P.gold, red: P.red, glass: P.teal800, blue: P.blue }[tone] || P.gold;
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
// flash that drains away. `segments` adds hairline notches (e.g. one per 25%).
export function bar(ctx, x, y, w, h, k, { color = hpColor(k), track = 'rgba(4,14,17,0.5)', ghost = null, segments = 0, outline = true } = {}) {
  k = Math.min(1, Math.max(0, k));
  ctx.save();
  if (outline) { shadow(ctx, CANVAS_SHADOW[1]); rrect(ctx, x - 1, y - 1, w + 2, h + 2, (h + 2) / 2); ctx.fillStyle = track; ctx.fill(); shadow(ctx, null); }
  else { rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = track; ctx.fill(); }
  if (ghost != null && ghost > k) { rrect(ctx, x, y, w * Math.min(1, ghost), h, h / 2); ctx.fillStyle = 'rgba(255,240,210,0.55)'; ctx.fill(); }
  if (k > 0) {
    rrect(ctx, x, y, Math.max(h, w * k), h, h / 2); ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha *= 0.35; rrect(ctx, x, y, Math.max(h, w * k), h / 2, h / 4); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha /= 0.35;
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
// small caption under it. `t` (0..1) glides it in: it rises 10 px and fades up while the rules draw outwards.
export function banner(ctx, cx, cy, { title, sub = null, t = 1, maxWidth = 340, tone = 'gold' } = {}) {
  const e = EASE.out(Math.min(1, Math.max(0, t)));
  if (e <= 0) return;
  ctx.save();
  ctx.globalAlpha *= e;
  const y = cy + (1 - e) * 10;
  const size = Math.min(HUD.title + 4, maxWidth / Math.max(6, title.length * 0.52));
  const tw = Math.min(maxWidth, measure(ctx, title, size, 650, 'display'));
  text(ctx, title, cx, y, { size, weight: 650, face: 'display', color: tone === 'red' ? '#ffd2c6' : P.goldHi, align: 'center', halo: 'strong', maxWidth });
  const half = tw / 2 + 14, len = 34 * e;
  ctx.strokeStyle = tone === 'red' ? P.redHi : P.gold; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.25;
  shadow(ctx, CANVAS_SHADOW.textTight);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * half, y); ctx.lineTo(cx + s * (half + len), y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * (half - 5), y); ctx.lineTo(cx + s * (half - 2), y - 3); ctx.lineTo(cx + s * (half + 1), y); ctx.lineTo(cx + s * (half - 2), y + 3); ctx.closePath(); ctx.fill();
  }
  shadow(ctx, null);
  if (sub) caption(ctx, sub, cx, y + size * 0.85 + 4, { align: 'center', color: C.onGlass, halo: 'soft', size: 11.5 });
  ctx.restore();
}

// A toast: a small glass capsule with an optional icon, for "Course cleared", "Anchored", "Prize taken".
// `t` (0..1) is its life; it eases in over the first 15% and out over the last 20%.
export function toast(ctx, cx, y, str, { icon = null, t = 0.5, tone = 'glass' } = {}) {
  const a = t < 0.15 ? EASE.out(t / 0.15) : t > 0.8 ? 1 - EASE.in((t - 0.8) / 0.2) : 1;
  if (a <= 0) return;
  const size = 13, h = 30, isz = 15, w = measure(ctx, str, size, 600) + (icon ? isz + 8 : 0) + 26;
  ctx.save();
  ctx.globalAlpha *= a;
  const yy = y + (1 - a) * 6;
  panel(ctx, cx - w / 2, yy - h / 2, w, h, { tone, r: h / 2, elevation: 2 });
  let x = cx - w / 2 + 13;
  if (icon) { drawIcon(ctx, icon, x + isz / 2, yy, isz, P.goldHi); x += isz + 8; }
  text(ctx, str, x, yy + 0.5, { size, weight: 600, color: toneInk(tone), halo: 'none' });
  ctx.restore();
}

// A tip card (first-time hints, the tutorial coach on canvas): a step caption and wrapped text on glass.
// Returns its height so callers can stack it.
export function tipCard(ctx, x, y, w, str, { step = null, alpha = 1 } = {}) {
  const lines = wrapText(ctx, str, w - 32, 14, 500), lh = 19.5;
  const h = 26 + (step ? 16 : 0) + lines.length * lh;
  ctx.save();
  ctx.globalAlpha *= alpha;
  panel(ctx, x, y, w, h, { tone: 'glass', r: HUD.radius, elevation: 2 });
  let ty = y + 14;
  if (step) { caption(ctx, step, x + 16, ty + 5, { color: P.goldHi, halo: 'none' }); ty += 16; }
  lines.forEach((ln, i) => text(ctx, ln, x + 16, ty + i * lh + lh / 2 - 1, { size: 14, weight: 500, color: C.onGlass, halo: 'none' }));
  ctx.restore();
  return h;
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
    const a = (i * Math.PI) / 8, long = i % 4 === 0, r0 = r - (long ? 6 : 3.5);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (r - 1.5));
    ctx.lineWidth = long ? 1.4 : 1; ctx.strokeStyle = long ? C.onGlass2 : C.onGlass3; ctx.stroke();
  }
  ctx.translate(cx, cy); ctx.rotate(angle);
  const tip = r - 7, tail = -(r - 9) * (0.55 + 0.45 * strength);
  ctx.beginPath(); ctx.moveTo(tip, 0); ctx.lineTo(tip - 10, -5); ctx.lineTo(tip - 8, 0); ctx.lineTo(tip - 10, 5); ctx.closePath();
  ctx.fillStyle = P.goldHi; ctx.fill();
  ctx.beginPath(); ctx.moveTo(tip - 8, 0); ctx.lineTo(tail, 0); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = P.goldHi; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tail, 0); ctx.lineTo(tail - 4, -4); ctx.moveTo(tail + 4, 0); ctx.lineTo(tail, -4); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  if (label) caption(ctx, label, cx, cy + r + 10, { align: 'center', size: 9.5, color: C.onGlass2, halo: 'soft' });
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

// A thin course/firing-arc line on the sea: a soft dark underlay with a light line on top, so it reads on any
// water. `pts` are screen points; `dash` e.g. [2, 8] for dotted.
export function seaLine(ctx, pts, { color = 'rgba(251,244,227,0.9)', width = 2, dash = null } = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineWidth = width + 3; ctx.strokeStyle = 'rgba(4,14,17,0.28)'; ctx.stroke();
  if (dash) ctx.setLineDash(dash);
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}
