// The campaign sea chart: an illustrated parchment map of the Caribbean drawn as inline SVG, with the battles
// as tappable buttons laid over it and a dotted route joining them in campaign order. The map is drawn in a
// 1000 x 700 coordinate space and scaled to cover the screen; whatever doesn't fit pans (drag or scroll).
import { BATTLES, REGIONS } from '../config/battles.js';
import { hatSVG } from '../config/hats.js';
import { ENDLESS_ID, ENDLESS } from '../config/endless.js';
import { save, isUnlocked } from '../save.js';

const W = 1000, H = 700;
const MIN_SCALE = 0.8; // below this the nodes crowd each other, so small screens pan instead

// Where each battle sits on the chart, and the short name written under it. `via` bends the route into that
// battle through extra points, to keep it clear of other battles.
const NODES = {
  tutorial:   { x: 548, y: 352, label: 'Shakedown' },
  tortuga:    { x: 690, y: 214, label: 'Tortuga Narrows' },
  cayman:     { x: 445, y: 300, label: 'Cayman Shoals' },
  rojo:       { x: 378, y: 258, label: 'La Bruja' },
  sanlucas:   { x: 466, y: 608, label: 'San Lucas' },
  silver:     { x: 515, y: 506, label: 'Silver Fleet' },
  comodoro:   { x: 548, y: 618, label: 'San Cristóbal' },
  cartagena:  { x: 610, y: 560, label: 'Cartagena' },
  santamarta: { x: 684, y: 508, label: 'Santa Marta' },
  oro:        { x: 778, y: 458, label: 'Trinidad' },
  cove:       { x: 878, y: 420, label: 'Smugglers’ Cove' },
  wreck:      { x: 918, y: 340, label: 'Treasure Wreck' },
  kate:       { x: 800, y: 374, label: 'Black Wyvern' },
  convoy:     { x: 690, y: 366, label: 'Convoy' },
  siege:      { x: 612, y: 404, label: 'Fort Charles' },
  hierro:     { x: 122, y: 236, label: 'Iron Marquis', via: [[420, 414]] },
  fog:        { x: 440, y: 470, label: 'Mosquito Fog' },
  blockade:   { x: 312, y: 228, label: 'Blockade' },
  armada:     { x: 404, y: 98, label: 'Gran Armada' },
  [ENDLESS_ID]: { x: 922, y: 128, label: 'Endless Skirmish' },
};

// Sea names for each campaign region.
const REGION_LABELS = {
  port: { x: 530, y: 474, r: -4 },
  windward: { x: 572, y: 288, r: 6 },
  main: { x: 452, y: 580, r: -6 },
  golden: { x: 812, y: 540, r: -5 },
  pirate: { x: 884, y: 286, r: 4 },
  campeche: { x: 118, y: 172, r: -3, t: 'Bay of Campeche' },
  armada: { x: 300, y: 184, r: -6 },
};

// ---------- Map art ----------
const LAND = [
  // New Spain, Yucatán and the isthmus down to Darién
  'M0 0 L24 0 C20 60 10 130 14 184 C22 232 38 266 53 287 C68 306 82 326 95 328 C118 332 146 318 163 309 C180 298 190 280 195 263 C200 240 206 222 221 210 C244 200 268 198 289 203 C296 232 294 290 288 330 C280 345 266 350 258 356 C254 374 250 392 254 404 C296 410 344 414 389 442 C393 492 386 548 382 590 C390 618 398 638 410 646 C440 650 468 640 487 646 C508 654 528 668 540 680 L552 700 L474 700 C450 690 402 656 368 645 C340 638 322 626 324 610 C322 592 318 582 316 571 C306 546 296 528 289 516 C250 504 200 490 171 479 C138 460 110 432 79 398 C50 404 26 414 0 420 Z',
  // Tierra Firme
  'M540 700 L540 680 C560 660 576 630 592 612 C606 598 614 590 626 582 C650 570 676 546 697 530 C706 546 712 564 720 576 C726 562 728 550 735 540 C748 554 762 580 792 588 C830 598 870 592 900 596 C940 600 970 598 1000 602 L1000 700 Z',
  // Cuba
  'M342 188 C360 175 385 150 410 144 C440 139 470 150 500 158 C530 167 553 177 576 191 C600 206 620 230 633 250 C615 259 590 263 560 262 C540 258 530 242 515 233 C490 222 466 213 442 206 C422 202 410 208 398 206 C380 202 360 196 342 188 Z',
  // Hispaniola
  'M630 262 C650 252 690 250 720 255 C750 258 770 262 788 276 C792 295 782 312 762 320 C738 324 718 316 698 324 C676 330 650 320 624 310 C640 302 660 300 668 292 C655 285 640 280 630 262 Z',
  // Jamaica
  'M500 322 C506 310 530 306 552 308 C572 309 588 314 592 324 C590 336 574 342 556 342 C534 343 512 338 500 322 Z',
  // Puerto Rico
  'M812 318 C822 312 846 312 860 316 C862 324 852 330 836 330 C822 330 812 326 812 318 Z',
  // Florida
  'M432 0 L500 0 C498 30 490 56 472 72 C462 78 452 62 448 42 C444 24 438 10 432 0 Z',
];
// Small islands: [x, y, rx, ry, rotation]
const ISLES = [
  [404, 222, 14, 8, 0], [668, 244, 12, 4, -4], // Isle of Pines, Tortuga
  [430, 290, 8, 3, -8], [468, 281, 5, 2.5, 0], [478, 279, 4, 2, 0], // Caymans
  [300, 258, 4, 7, 20], [306, 392, 8, 3, -10], // Cozumel, Roatán
  [520, 78, 8, 19, 10], [548, 40, 5, 13, -20], [572, 90, 12, 4, 20], [598, 104, 10, 4, 10], [620, 70, 7, 4, -30],
  [642, 112, 9, 4, 0], [602, 40, 4, 10, 20], [662, 96, 5, 3, 0], // Bahamas
  [458, 84, 4, 2, 20], [446, 88, 4, 2, 10], [436, 90, 3, 2, 0], // Keys
  [882, 318, 4, 2.5, 0], [894, 316, 3, 2, 0], // Virgins
  [940, 360, 5, 7, 0], [948, 388, 4, 6, 0], [956, 416, 5, 7, 10], [962, 446, 4, 6, 0], [958, 478, 5, 7, -10],
  [952, 508, 4, 5, 0], [948, 538, 5, 6, 0], [966, 600, 18, 10, 0], [986, 576, 5, 3, -20], // Lesser Antilles
  [748, 550, 6, 2.5, 0], [764, 548, 5, 2.5, 0], [778, 550, 4, 2, 0], // ABC isles
];
const HILLS = [[80, 350], [130, 425], [60, 240], [200, 445], [250, 470], [110, 300], [40, 330], [330, 470],
  [612, 676], [985, 640], [470, 172], [590, 218], [700, 282], [742, 298], [248, 300]];
const LANDNAMES = [
  ['NUEVA ESPAÑA', 128, 395, -10, 15], ['YUCATÁN', 244, 268, -70, 11], ['CUBA', 486, 186, 14, 14],
  ['HISPANIOLA', 712, 292, 4, 11], ['FLORIDA', 470, 32, 62, 10], ['TIERRA FIRME', 680, 652, -2, 15],
];
const SEANAMES = [['Mar del Sur', 196, 668, -8], ['Mar del Norte', 846, 54, 0]];

const f1 = (n) => Math.round(n * 10) / 10;

function compass(cx, cy, k0 = 1) {
  let s = `<g class="ch-compass" transform="translate(${cx} ${cy}) scale(${k0})">` +
    '<circle r="34" class="ch-ring"/><circle r="27" class="ch-ring thin"/>';
  // Eight points: long ones on the quarters, short ones between, each split light and dark.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, len = k % 2 ? 26 : 48, w = k % 2 ? 6 : 9;
    const tip = [Math.cos(a) * len, Math.sin(a) * len];
    const l = [Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w];
    const r = [Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w];
    s += `<path d="M0 0 L${f1(l[0])} ${f1(l[1])} L${f1(tip[0])} ${f1(tip[1])} Z" class="ch-pt ${k % 2 ? 'b' : 'a'}"/>` +
      `<path d="M0 0 L${f1(r[0])} ${f1(r[1])} L${f1(tip[0])} ${f1(tip[1])} Z" class="ch-pt ${k % 2 ? 'a' : 'c'}"/>`;
  }
  s += '<circle r="5" class="ch-hub"/>' +
    (k0 === 1 ? '<text y="-54" class="ch-n">N</text>' : '') + '</g>';
  return s;
}

// A sea serpent in the Mar del Sur, and a spouting whale up in the Atlantic.
const SERPENT = '<g class="ch-beast" transform="translate(70 548) scale(0.95)">' +
  '<path d="M-6 52 Q10 46 26 52 T58 52 T90 52 T122 52 T154 52 T186 52 T214 52" class="ch-wave"/>' +
  '<path d="M150 50 C150 30 180 28 182 48 Z" class="ch-scale"/>' +
  '<path d="M184 50 C188 30 210 24 212 36 C208 32 198 34 198 50 Z" class="ch-scale"/>' +
  '<path d="M96 50 C96 18 140 18 140 50 Z" class="ch-scale"/>' +
  '<path d="M106 26 L110 14 L116 23 L122 12 L126 24" class="ch-fin"/>' +
  '<path d="M44 50 C40 30 40 14 24 6 C10 0 -6 8 -4 22 C-2 30 8 32 18 30 C26 30 28 40 26 50 Z" class="ch-scale"/>' +
  '<path d="M-4 22 C4 24 10 22 16 20" class="ch-line"/>' +
  '<path d="M14 6 L16 -6 L24 2 L30 -8 L32 6" class="ch-fin"/>' +
  '<circle cx="18" cy="13" r="5" class="ch-eye"/><circle cx="17" cy="13" r="2.2" class="ch-pupil"/>' +
  '<path d="M-2 22 L2 27 L5 22" class="ch-tooth"/>' +
  '</g>';
const WHALE = '<g class="ch-beast" transform="translate(684 36) scale(0.85)">' +
  '<path d="M-10 54 Q6 48 22 54 T54 54 T86 54 T118 54" class="ch-wave"/>' +
  '<path d="M28 8 Q22 -10 10 -14 M28 8 Q28 -12 30 -20 M28 8 Q36 -8 48 -12" class="ch-spout"/>' +
  '<path d="M0 34 Q2 8 40 8 Q74 8 80 28 Q90 16 100 8 Q102 26 92 32 Q102 38 102 54 Q90 46 80 40 Q70 52 40 52 Q4 52 0 34 Z" class="ch-whale"/>' +
  '<path d="M6 38 Q30 50 56 40" class="ch-line"/>' +
  '<circle cx="20" cy="26" r="3" class="ch-pupil"/>' +
  '</g>';
const GALLEON = '<g class="ch-ship" transform="translate(820 190) scale(0.9)">' +
  '<path d="M4 34 Q22 30 40 34 T76 34" class="ch-wave"/>' +
  '<path d="M22 4 V28 M42 0 V28 M58 8 V28" class="ch-line"/>' +
  '<path d="M14 8 Q22 6 30 8 Q32 16 30 22 Q22 20 14 22 Q12 15 14 8 Z M33 4 Q42 2 51 4 Q53 13 51 22 Q42 20 33 22 Q31 13 33 4 Z M52 12 Q58 10 64 12 Q66 17 64 22 Q58 21 52 22 Q50 17 52 12 Z" class="ch-sail"/>' +
  '<path d="M42 0 L52 3 L42 6 Z" class="ch-flag"/>' +
  '<path d="M4 24 L70 24 L64 34 L12 34 Z" class="ch-hull"/>' +
  '</g>';
const CARTOUCHE = '<g class="ch-cartouche" transform="translate(852 652)">' +
  '<path d="M-104 -24 H104 Q96 0 104 24 H-104 Q-96 0 -104 -24 Z" class="ch-scroll"/>' +
  '<path d="M-104 -24 Q-118 -18 -112 -8 Q-104 -4 -100 -12 M104 24 Q118 18 112 8 Q104 4 100 12" class="ch-line"/>' +
  '<text y="0" class="ch-title">The West Indies</text>' +
  '<text y="16" class="ch-sub">Drawn for the Admiral · 1655</text>' +
  '</g>';

// A smooth curve through the battles in order (Catmull-Rom), one segment per leg so legs can be styled apart.
function legs(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6];
    const c2 = [p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6];
    out.push(`M${p1.x} ${p1.y} C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${p2.x} ${p2.y}`);
  }
  return out;
}

function mapSVG() {
  // Route points in order; each remembers which battle its leg leads to, so the leg is drawn as sailed once
  // that battle opens.
  const pts = [];
  BATTLES.forEach((b, i) => {
    for (const [x, y] of NODES[b.id].via || []) pts.push({ x, y, to: i });
    pts.push({ x: NODES[b.id].x, y: NODES[b.id].y, to: i });
  });
  let rh = '';
  // Rhumb lines fan out from the compass rose and from a second wind rose out in the Caribbean.
  for (const [cx, cy] of [[196, 104], [730, 440]]) {
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      rh += `M${cx} ${cy} L${f1(cx + Math.cos(a) * 1300)} ${f1(cy + Math.sin(a) * 1300)} `;
    }
  }
  // Legs already sailed are drawn bold in red; the rest of the voyage is a faint dotted line.
  const route = legs(pts).map((d, i) => `<path d="${d}" class="ch-route${isUnlocked(pts[i + 1].to) ? ' done' : ''}"/>`).join('');
  const land = LAND.map((d) => `<path d="${d}"/>`).join('') +
    ISLES.map(([x, y, rx, ry, r]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${r ? ` transform="rotate(${r} ${x} ${y})"` : ''}/>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">` +
    '<defs><radialGradient id="chPaper" cx="50%" cy="48%" r="72%"><stop offset="0" stop-color="#f8ebc8"/><stop offset="0.7" stop-color="#f1dcaa"/><stop offset="1" stop-color="#d9b676"/></radialGradient>' +
    `<g id="chLand">${land}</g></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#chPaper)"/>` +
    `<path d="${rh}" class="ch-rhumb"/>` +
    '<use href="#chLand" class="ch-shore2"/><use href="#chLand" class="ch-shore1"/><use href="#chLand" class="ch-land"/>' +
    `<g class="ch-hills">${HILLS.map(([x, y]) => `<path d="M${x - 9} ${y} Q${x} ${y - 12} ${x + 9} ${y} M${x + 4} ${y - 2} Q${x + 12} ${y - 10} ${x + 20} ${y - 1}"/>`).join('')}</g>` +
    LANDNAMES.map(([t, x, y, r, s]) => `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" class="ch-landname" style="font-size:${s}px">${t}</text>`).join('') +
    SEANAMES.map(([t, x, y, r]) => `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" class="ch-seaname">${t}</text>`).join('') +
    compass(196, 104) + compass(730, 440, 0.4) + SERPENT + WHALE + GALLEON + CARTOUCHE +
    '<g class="ch-port"><path d="M566 342 V328 M566 328 L576 331 L566 334" /></g>' +
    REGIONS.map((r) => { const p = REGION_LABELS[r.id]; return p ? `<text x="${p.x}" y="${p.y}" transform="rotate(${p.r} ${p.x} ${p.y})" class="ch-region">${p.t || r.name}</text>` : ''; }).join('') +
    route +
    `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" class="ch-frame"/><rect x="13" y="13" width="${W - 26}" height="${H - 26}" class="ch-frame thin"/>` +
    '</svg>';
}

// ---------- Battle nodes ----------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LOCK = '<svg viewBox="0 0 20 20" class="cn-lock" aria-hidden="true"><path d="M6 9 V6.5 a4 4 0 0 1 8 0 V9" fill="none" stroke="currentColor" stroke-width="2.6"/><rect x="3.5" y="9" width="13" height="9" rx="2" fill="currentColor"/></svg>';
const SHIP = '<svg viewBox="0 0 40 36" class="cn-you" aria-hidden="true"><path d="M20 2 V24" stroke="#3a2414" stroke-width="2.5"/>' +
  '<path d="M9 6 Q20 3 31 6 Q33 13 31 20 Q20 18 9 20 Q7 13 9 6 Z" fill="#fbf3dc" stroke="#3a2414" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M20 2 L29 0 L20 -2" fill="#c8402f"/><path d="M15 10 H25 M20 7 V17" stroke="#c8402f" stroke-width="2.5"/>' +
  '<path d="M2 23 H38 L32 33 H8 Z" fill="#8b5a2b" stroke="#3a2414" stroke-width="2.5" stroke-linejoin="round"/></svg>';

const stars = (n) => `<span class="cn-stars" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('')}</span>`;

function nodeHTML(b, i, next) {
  const p = NODES[b.id], open = isUnlocked(i), won = save.stars[b.id] || 0, boss = b.goal === 'boss';
  const hat = boss && save.hats.includes(b.hat);
  const cls = ['cnode', boss ? 'boss' : '', open ? 'open' : 'locked', won ? 'won' : '', hat ? 'hat-won' : '', i === next ? 'next' : ''].filter(Boolean).join(' ');
  const disc = boss ? hatSVG(b.hat, !open) + (open ? '' : LOCK) : open ? `<b>${esc(b.roman === '0' ? '★' : b.roman)}</b>` : LOCK;
  const status = !open ? 'locked' : won ? `${won} of 3 stars` : 'not yet won';
  const label = `${b.tutorial ? 'Tutorial' : `Battle ${b.roman}`}: ${b.name}${boss ? ', boss battle' : ''}, ${status}`;
  return `<button type="button" class="${cls}" data-battle="${i}" style="left:${p.x / 10}%;top:${(p.y / 7).toFixed(3)}%"` +
    `${open ? '' : ' disabled'} aria-label="${esc(label)}">` +
    `<span class="cn-disc">${disc}</span>${won ? stars(won) : ''}<span class="cn-name">${esc(p.label)}</span>` +
    `${i === next ? SHIP : ''}</button>`;
}

function endlessHTML() {
  const p = NODES[ENDLESS_ID], open = isUnlocked(2);
  const label = `${ENDLESS.name}: ${open ? (save.best ? `best wave ${save.best}` : 'waves of enemies') : 'win the Tortuga Narrows to open'}`;
  return `<button type="button" class="cnode endless ${open ? 'open' : 'locked'}" data-battle="${ENDLESS_ID}" style="left:${p.x / 10}%;top:${(p.y / 7).toFixed(3)}%"` +
    `${open ? '' : ' disabled'} aria-label="${esc(label)}"><span class="cn-disc">${open ? '<b>∞</b>' : LOCK}</span>` +
    `<span class="cn-name">${esc(p.label)}${open && save.best ? `<small>Best: wave ${save.best}</small>` : ''}</span></button>`;
}

// The battle the campaign is up to: the first one that's open but not won yet.
export const nextBattle = () => BATTLES.findIndex((b, i) => isUnlocked(i) && !save.stars[b.id]);

let mapEl = null, viewEl = null, focus = null;

// Builds the chart inside `el` (the scrolling viewport) and scrolls the next battle into view.
export function renderChart(el) {
  viewEl = el;
  const next = nextBattle();
  el.innerHTML = `<div class="chart-map">${mapSVG()}${BATTLES.map((b, i) => nodeHTML(b, i, next)).join('')}${endlessHTML()}</div>`;
  mapEl = el.firstChild;
  const f = NODES[(BATTLES[next] || BATTLES[BATTLES.length - 1]).id];
  focus = f;
  layoutChart(true);
}

// Scales the map to cover the viewport (never below MIN_SCALE) and, when asked, centres on the next battle.
export function layoutChart(centre) {
  if (!mapEl || !viewEl || !viewEl.clientWidth) return;
  const vw = viewEl.clientWidth, vh = viewEl.clientHeight;
  const s = Math.max(vw / W, vh / H, MIN_SCALE);
  const mw = Math.round(W * s), mh = Math.round(H * s);
  const prev = mapEl.offsetWidth;
  // Keep the same spot in the middle of the view across a resize.
  const cx = prev ? (viewEl.scrollLeft + vw / 2) / prev : 0.5, cy = prev ? (viewEl.scrollTop + vh / 2) / mapEl.offsetHeight : 0.5;
  mapEl.style.width = mw + 'px';
  mapEl.style.height = mh + 'px';
  mapEl.style.setProperty('--s', s.toFixed(3));
  if (centre && focus) {
    viewEl.scrollLeft = focus.x * s - vw / 2;
    viewEl.scrollTop = focus.y * s - vh / 2;
  } else {
    viewEl.scrollLeft = cx * mw - vw / 2;
    viewEl.scrollTop = cy * mh - vh / 2;
  }
}

// Mouse users can drag the chart around like a touch screen; a drag doesn't count as a tap on a battle.
export function enablePan(el) {
  let drag = null, moved = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    moved = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    el.classList.add('panning');
    el.scrollLeft = drag.l - dx;
    el.scrollTop = drag.t - dy;
  });
  window.addEventListener('pointerup', () => { drag = null; el.classList.remove('panning'); });
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  if (window.ResizeObserver) new ResizeObserver(() => layoutChart(false)).observe(el);
}
