// Draws every element of the HUD style kit (src/hud/style.js) and the icon set (src/ui/icons.js) onto one
// canvas, over a stand-in sea, so the kit can be eyeballed and screenshotted (tests/kit-shot.mjs). Test-only.
import * as K from '../../src/hud/style.js';
import { ICON_NAMES, drawIcon } from '../../src/ui/icons.js';
import { PALETTE as P, COLOR as C } from '../../src/ui/tokens.js';

// A busy stand-in sea: deep teal with lighter swells, foam flecks and a sunny island, to test legibility.
function sea(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1d5f6b'); g.addColorStop(0.5, '#2a7f8a'); g.addColorStop(1, '#17505c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(140,210,210,${0.08 + rnd() * 0.1})`); rg.addColorStop(1, 'rgba(140,210,210,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 3, x + 8, y); ctx.stroke(); }
  ctx.fillStyle = '#e9d9a0'; ctx.beginPath(); ctx.ellipse(w - 70, 420, 70, 46, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7cbf62'; ctx.beginPath(); ctx.ellipse(w - 70, 414, 50, 30, -0.3, 0, Math.PI * 2); ctx.fill();
}

export function drawKitDemo(ctx, w, h, now = 0) {
  sea(ctx, w, h);
  const L = 16;
  let y = 16;
  const head = (t) => { K.caption(ctx, t, L, y + 6, { color: P.cream, halo: 'strong' }); y += 18; };

  head('Panels · glass, solid, paper, crimson');
  const pw = (w - L * 2 - 24) / 4;
  ['glass', 'solid', 'paper', 'crimson'].forEach((tone, i) => {
    const x = L + i * (pw + 8);
    K.panel(ctx, x, y, pw, 52, { tone });
    K.text(ctx, tone, x + pw / 2, y + 26, { align: 'center', color: K.toneInk(tone), halo: 'none', size: 13 });
  });
  y += 68;

  head('Buttons · normal, pressed, disabled, active');
  const bw = (w - L * 2 - 24) / 4;
  ['normal', 'pressed', 'disabled', 'active'].forEach((state, i) => K.button(ctx, L + i * (bw + 8), y, bw, 40, { label: 'Board', icon: 'board', state }));
  y += 52;
  K.button(ctx, L, y, (w - L * 2 - 10) / 2, 48, { label: 'Port', icon: 'firePort', progress: 0.42, sub: 'Reloading' });
  K.button(ctx, L + (w - L * 2 + 10) / 2, y, (w - L * 2 - 10) / 2, 48, { label: 'Starboard', icon: 'fireStarboard', ready: true, sub: 'Ready' });
  y += 58;
  K.button(ctx, L, y, 120, 40, { label: 'Land troops', icon: 'land', variant: 'gold' });
  K.button(ctx, L + 128, y, 110, 40, { label: 'Retreat', variant: 'danger' });
  K.button(ctx, L + 246, y, w - L * 2 - 246, 40, { label: 'Drop mine', icon: 'mine', sub: '×2 left' });
  y += 54;

  head('Icon buttons · progress, active, badge, ready');
  const ib = [
    { icon: 'pause' }, { icon: 'fleet', active: true }, { icon: 'anchor', badge: 'On' }, { icon: 'mine', badge: 2 },
    { icon: 'round', progress: 0.65 }, { icon: 'chain', ready: true }, { icon: 'grape', state: 'disabled' }, { icon: 'helm', state: 'pressed' },
  ];
  const step = (w - L * 2 - 44) / (ib.length - 1);
  ib.forEach((o, i) => K.iconButton(ctx, L + 22 + i * step, y + 24, o));
  y += 62;

  head('Labels · soft shadow, no outline');
  K.text(ctx, 'Resolute', L, y + 10, { size: 15, weight: 700 });
  K.text(ctx, 'Frigate', L + 80, y + 10, { size: 12, color: C.onGlass2 });
  K.text(ctx, '★ Flagship', L + 140, y + 10, { size: 12, weight: 700, color: P.goldHi });
  K.text(ctx, 'Rigging cut', L + 220, y + 10, { size: 12, weight: 600, color: '#ffd2c6' });
  K.text(ctx, '−24', w - 40, y + 10, { size: 20, weight: 650, face: 'display', color: '#fff1c4', align: 'center', halo: 'strong' });
  y += 24;
  K.text(ctx, 'Sink the boss · Enemy ships 3', L, y + 10, { size: 13, weight: 600, color: C.onGlass });
  K.caption(ctx, 'Wind · fresh breeze', w - L, y + 10, { align: 'right' });
  y += 30;

  head('Bars · hull, ghost damage, segments, rings, badges');
  const barW = (w - L * 2 - 16) / 3;
  [[0.86], [0.48], [0.18, 0.4]].forEach(([k, ghost], i) => K.bar(ctx, L + i * (barW + 8), y + 2, barW, K.HUD.bar, k, { ghost }));
  y += 14;
  K.bar(ctx, L, y + 2, barW * 2 + 8, 7, 0.62, { color: P.red, segments: 4 });
  K.bar(ctx, L + barW * 2 + 16, y + 2, barW, K.HUD.barThin, 0.7, { color: P.gold, outline: false });
  y += 20;
  K.ring(ctx, L + 14, y + 14, 11, 0.7);
  K.ring(ctx, L + 46, y + 14, 11, 0.3, { color: P.blueHi });
  K.badge(ctx, L + 86, y + 14, 3);
  K.badge(ctx, L + 116, y + 14, 'Prize', { tone: 'blue' });
  K.badge(ctx, L + 160, y + 14, 'Boss', { tone: 'red' });
  K.badge(ctx, L + 200, y + 14, 'x2', { tone: 'glass' });
  K.windRose(ctx, w - L - 30, y + 10, 26, -0.6, { strength: 0.8 });
  K.edgeChevron(ctx, w - L - 80, y + 14, 0);
  K.edgeChevron(ctx, w - L - 100, y + 14, Math.PI / 2, { color: P.goldHi });
  y += 52;

  head('Messages · banner, toast, tip');
  K.banner(ctx, w / 2, y + 22, { title: 'Fort silenced', sub: 'Land troops to take it' });
  y += 62;
  K.toast(ctx, w / 2 - 80, y + 14, 'Anchored', { icon: 'anchor' });
  K.toast(ctx, w / 2 + 70, y + 14, 'Prize taken · +40', { icon: 'gold' });
  y += 36;
  y += K.tipCard(ctx, L, y, w - L * 2, 'This ship carries special shot. Chain cuts rigging; Grape thins the crew before you board.', { step: 'Tip' }) + 10;
  K.seaLine(ctx, [{ x: L + 10, y: y + 30 }, { x: L + 80, y: y + 6 }, { x: L + 170, y: y + 26 }, { x: L + 240, y: y + 10 }], { dash: [1, 7], width: 2.5 });
  K.seaLine(ctx, [{ x: L + 260, y: y + 28 }, { x: w - L - 10, y: y + 6 }], { color: 'rgba(246,210,122,0.9)', width: 1.5 });
  y += 44;

  head('Icons · canvas, from the same paths as the DOM');
  const cols = 6, cell = (w - L * 2) / cols;
  ICON_NAMES.forEach((name, i) => {
    const cx = L + cell * (i % cols) + cell / 2, cy = y + 22 + Math.floor(i / cols) * 62;
    K.panel(ctx, cx - 22, cy - 22, 44, 44, { tone: 'glass', r: 12, elevation: 1 });
    drawIcon(ctx, name, cx, cy, 24, P.cream);
    K.text(ctx, name, cx, cy + 32, { size: 9.5, weight: 600, color: C.onGlass2, align: 'center', halo: 'soft' });
  });
  return y;
}

// Boot: size the canvas for the device pixel ratio, wait for the fonts, draw.
const cv = document.getElementById('kit');
const dpr = window.devicePixelRatio || 1;
const w = cv.clientWidth, h = cv.clientHeight;
cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
const ctx = cv.getContext('2d');
const draw = () => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawKitDemo(ctx, w, h); document.body.dataset.ready = '1'; };
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => Promise.all([
  document.fonts.load('650 16px Fraunces'), document.fonts.load('600 13px "Source Sans 3"'), document.fonts.load('700 13px "Source Sans 3"'),
]).catch(() => {})).then(draw, draw);
