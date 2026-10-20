// The campaign sea chart: an illustrated parchment map of the Caribbean drawn as inline SVG, with the battles
// as tappable buttons laid over it and the voyage drawn between them in campaign order: legs already sailed in
// terracotta ink, the leg ahead dotted, the rest of the voyage not yet charted. The map is drawn in a
// 1000 x 700 coordinate space (geometry in chart-map.js) and scaled to cover the screen; whatever doesn't fit
// pans (drag or scroll).
//
// Worlds: the chart shows one world at a time (save.js currentWorld; the West Indies plate from chart-map.js, the
// Mediterranean's placeholder plate from chart-map-med.js), and a link in the chart's nav sails to the other.
import { BATTLES, REGIONS } from '../config/battles.js';
import { worldById } from '../config/worlds.js';
import * as CARIB from './chart-map.js';
import * as MED from './chart-map-med.js';
import { hatSVG } from '../config/hats.js';
import { ENDLESS_ID, ENDLESS } from '../config/endless.js';
import { save, isUnlocked, currentWorld } from '../save.js';
import { mainGoal } from '../sim/goals/index.js';
import { iconSVG } from './icons.js';

// Each world's plate: its geometry module, where the compass rose and the cartouche sit, its two vignettes, and
// what else it carries (Port Royal's flag and the Endless Skirmish are the West Indies').
const PLATES = {
  caribbean: { map: CARIB, rose: [826, 166], cartouche: [852, 652], title: 'The West Indies', sub: 'Drawn for the Admiral, 1655',
    art: () => SERPENT + WHALE, port: true, endless: true },
  med: { map: MED, rose: MED.ROSE, cartouche: MED.CARTOUCHE, title: 'The Middle Sea', sub: 'Printed for the Admiralty, 1666',
    art: () => galley(...MED.VIGNETTES.galley) + dolphin(...MED.VIGNETTES.dolphin), port: false, endless: false },
};
const plateOf = (world) => PLATES[world] || PLATES.caribbean;
let P = PLATES.caribbean;
// The battles on the chart now: this world's, each with its index into BATTLES.
const shown = () => BATTLES.map((b, i) => ({ b, i })).filter(({ b }) => (b.world || 'caribbean') === P.world);

const MIN_SCALE = 1; // below this names and battles crowd each other (tests/chart-check.mjs), so small screens pan instead
const f1 = (n) => Math.round(n * 10) / 10;

function compass(cx, cy) {
  let s = `<g class="ch-compass" transform="translate(${cx} ${cy}) scale(0.82)">` +
    '<circle r="34" class="ch-ring"/><circle r="28" class="ch-ring thin"/><circle r="40" class="ch-ring thin"/>';
  // Eight points: long ones on the quarters, short ones between, each split light and dark.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, len = k % 2 ? 26 : 48, w = k % 2 ? 5 : 8;
    const tip = [Math.cos(a) * len, Math.sin(a) * len];
    const l = [Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w];
    const r = [Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w];
    s += `<path d="M0 0 L${f1(l[0])} ${f1(l[1])} L${f1(tip[0])} ${f1(tip[1])} Z" class="ch-pt ${k % 2 ? 'b' : 'a'}"/>` +
      `<path d="M0 0 L${f1(r[0])} ${f1(r[1])} L${f1(tip[0])} ${f1(tip[1])} Z" class="ch-pt ${k % 2 ? 'a' : 'c'}"/>`;
  }
  return s + '<circle r="4" class="ch-hub"/><text y="-55" class="ch-n">N</text></g>';
}

// A sea serpent in the Mar del Sur, and a spouting whale up in the Atlantic.
const SERPENT = '<g class="ch-beast" transform="translate(64 552) scale(0.9)">' +
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
const WHALE = '<g class="ch-beast" transform="translate(672 30) scale(0.72)">' +
  '<path d="M-10 54 Q6 48 22 54 T54 54 T86 54 T118 54" class="ch-wave"/>' +
  '<path d="M28 8 Q22 -10 10 -14 M28 8 Q28 -12 30 -20 M28 8 Q36 -8 48 -12" class="ch-spout"/>' +
  '<path d="M0 34 Q2 8 40 8 Q74 8 80 28 Q90 16 100 8 Q102 26 92 32 Q102 38 102 54 Q90 46 80 40 Q70 52 40 52 Q4 52 0 34 Z" class="ch-whale"/>' +
  '<path d="M6 38 Q30 50 56 40" class="ch-line"/>' +
  '<circle cx="20" cy="26" r="3" class="ch-pupil"/>' +
  '</g>';
// The Middle Sea's two: a galley under her lateen with the oars out, and a dolphin leaping.
const galley = (x, y) => `<g class="ch-beast" transform="translate(${x} ${y}) scale(0.8)">` +
  '<path d="M-22 46 Q-6 40 10 46 T42 46 T74 46 T106 46 T138 46" class="ch-wave"/>' +
  [16, 26, 36, 46, 56, 66, 76, 86].map((x) => `<path d="M${x} 33 L${x - 11} 47" class="ch-oar"/>`).join('') +
  '<path d="M-18 27 L6 30 Q60 34 108 29 Q116 27 121 17 Q123 30 117 36 Q90 41 40 40 Q16 39 6 33 Z" class="ch-hull"/>' +
  '<path d="M8 33 Q60 37 112 32" class="ch-line" style="stroke-width:0.9"/>' +
  '<path d="M92 30 Q93 17 104 16 Q114 16 117 27" class="ch-tent"/>' +
  '<path d="M98 29 Q99 20 104 18 M106 17 Q111 20 111 28" class="ch-line" style="stroke-width:0.9"/>' +
  '<path d="M41 31 L36 -12" class="ch-line"/>' +
  '<path d="M9 15 L86 -27 Q79 2 62 24 Q34 22 9 15 Z" class="ch-sail"/>' +
  '<path d="M3 18 L90 -29" class="ch-line"/>' +
  '<path d="M36 -12 Q45 -17 55 -13 Q46 -10 36 -8 Z" class="ch-fin"/>' +
  '<path d="M119 18 L120 9" class="ch-line" style="stroke-width:1"/><circle cx="120" cy="7" r="2.6" class="ch-fin"/>' +
  '</g>';
const dolphin = (x, y) => `<g class="ch-beast" transform="translate(${x} ${y}) scale(0.82)">` +
  '<path d="M-20 42 Q-6 36 8 42 T36 42 T64 42 T92 42" class="ch-wave"/>' +
  '<path d="M-2 30 Q0 22 8 19 Q24 -4 46 4 Q60 10 64 25 L77 16 Q72 26 76 38 L61 31 Q52 14 34 13 Q18 13 12 27 Q8 33 4 34 Q0 33 -2 30 Z" class="ch-dolphin"/>' +
  '<path d="M29 3 Q33 -10 43 -9 Q38 -3 40 5" class="ch-dolphin"/>' +
  '<path d="M22 17 Q19 27 28 30 Q25 23 28 16" class="ch-dolphin"/>' +
  '<path d="M-1 30 Q4 31 9 28 M14 9 Q24 1 36 1" class="ch-line" style="stroke-width:0.9"/>' +
  '<circle cx="10" cy="22" r="2" class="ch-pupil"/>' +
  '<path d="M-6 37 Q-9 31 -14 29 M-3 36 Q-3 31 -6 27 M70 41 Q76 35 82 36" class="ch-spout"/>' +
  '</g>';
const cartouche = ([x, y], title, sub) => `<g class="ch-cartouche" transform="translate(${x} ${y})">` +
  '<path d="M-100 -22 H100 Q93 0 100 22 H-100 Q-93 0 -100 -22 Z" class="ch-scroll"/>' +
  '<path d="M-92 -15 H92 M-92 15 H92" class="ch-line" style="stroke-width:0.6;opacity:0.5"/>' +
  '<path d="M-100 -22 Q-114 -16 -108 -6 Q-100 -2 -96 -10 M100 22 Q114 16 108 6 Q100 2 96 10" class="ch-line"/>' +
  `<text y="2" class="ch-title">${title}</text>` +
  `<text y="14" class="ch-sub">${sub}</text>` +
  '</g>';

function mapSVG() {
  const { LAND, ISLES, HILLS, LANDNAMES, SEANAMES, REGION_LABELS, legPaths, NODES, W, H, RIVERS = [], TOWNS = [] } = P.map;
  const ROSE = P.rose;
  const list = shown(), ids = list.map(({ b }) => b.id);
  let rh = '';
  // Rhumb lines fan out from the compass rose.
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    rh += `M${ROSE[0]} ${ROSE[1]} L${f1(ROSE[0] + Math.cos(a) * 1700)} ${f1(ROSE[1] + Math.sin(a) * 1700)} `;
  }
  // The voyage so far in terracotta, the leg ahead dotted; the rest is not yet on the chart.
  const route = legPaths(ids, NODES).map((d, k) => {
    if (!d || !isUnlocked(list[k].i)) return '';
    return `<path d="${d}" class="ch-route ${save.stars[ids[k]] ? 'done' : 'ahead'}"/>`;
  }).join('');
  const land = LAND.map((d) => `<path d="${d}"/>`).join('') +
    ISLES.map(([x, y, rx, ry, r]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${r ? ` transform="rotate(${r} ${x} ${y})"` : ''}/>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">` +
    '<defs><radialGradient id="chPaper" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#f0e5c9"/><stop offset="0.7" stop-color="#e8d9b4"/><stop offset="1" stop-color="#d6c094"/></radialGradient>' +
    `<g id="chLand">${land}</g></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#chPaper)"/>` +
    `<path d="${rh}" class="ch-rhumb"/>` +
    '<use href="#chLand" class="ch-shore2"/><use href="#chLand" class="ch-shore1"/><use href="#chLand" class="ch-land"/>' +
    RIVERS.map((d) => `<path d="${d}" class="ch-river"/>`).join('') +
    `<g class="ch-hills">${HILLS.map(([x, y]) => `<path d="M${x - 8} ${y} Q${x} ${y - 10} ${x + 8} ${y} M${x + 4} ${y - 2} Q${x + 11} ${y - 9} ${x + 18} ${y - 1}"/>`).join('')}</g>` +
    LANDNAMES.map(([t, x, y, r, s]) => `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" class="ch-landname" style="font-size:${s}px">${t}</text>`).join('') +
    TOWNS.map(([t, x, y, a, dx, dy]) => `<circle cx="${x}" cy="${y}" r="2.3" class="ch-town"/><text x="${x + dx}" y="${y + dy}" text-anchor="${a}" class="ch-townname">${t}</text>`).join('') +
    SEANAMES.map(([t, x, y, r]) => `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" class="ch-seaname">${t}</text>`).join('') +
    compass(ROSE[0], ROSE[1]) + P.art() + cartouche(P.cartouche, P.title, P.sub) +
    (P.port ? '<g class="ch-port"><path d="M566 342 V330 M566 330 L575 332.5 L566 335" /></g>' : '') +
    REGIONS.filter((r) => r.world === P.world).map((r) => { const p = REGION_LABELS[r.id]; return p ? `<text x="${p.x}" y="${p.y}" transform="rotate(${p.r} ${p.x} ${p.y})" class="ch-region">${p.t || r.name}</text>` : ''; }).join('') +
    route +
    `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" class="ch-frame"/><rect x="11" y="11" width="${W - 22}" height="${H - 22}" class="ch-frame thin"/>` +
    '</svg>';
}

// ---------- Battle nodes ----------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LOCK = iconSVG('lock', { cls: 'cn-lock', stroke: 2.2 });
const SHIP = '<svg viewBox="0 0 40 36" class="cn-you" aria-hidden="true"><path d="M20 2 V24" stroke="#3a2a1b" stroke-width="1.8"/>' +
  '<path d="M9 6 Q20 3 31 6 Q33 13 31 20 Q20 18 9 20 Q7 13 9 6 Z" fill="#f4ecd8" stroke="#3a2a1b" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<path d="M20 2 L29 0 L20 -2" fill="#a3271c"/><path d="M15 10.5 H25 M20 7.5 V16.5" stroke="#a3271c" stroke-width="2"/>' +
  '<path d="M2 23 H38 L32 33 H8 Z" fill="#7b4c2b" stroke="#3a2a1b" stroke-width="1.8" stroke-linejoin="round"/></svg>';

const stars = (n) => `<span class="cn-stars" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('')}</span>`;
const pos = (p) => `left:${(p.x / P.map.W * 100).toFixed(3)}%;top:${(p.y / P.map.H * 100).toFixed(3)}%`;
const nameCls = (p) => (p.name ? ' n-' + p.name : '') + (p.ship ? ' ship-' + p.ship : '');

function nodeHTML(b, i, next) {
  const p = P.map.NODES[b.id];
  if (!p) return ''; // a battle the chart has no place for yet
  const open = isUnlocked(i), won = save.stars[b.id] || 0, boss = mainGoal(b) === 'boss';
  const hat = boss && save.hats.includes(b.hat);
  const cls = ['cnode', boss ? 'boss' : '', open ? 'open' : 'locked', won ? 'won' : '', hat ? 'hat-won' : '', i === next ? 'next' : ''].filter(Boolean).join(' ') + nameCls(p);
  const disc = boss ? hatSVG(b.hat, !open) + (open ? '' : LOCK) : open ? `<b>${esc(b.roman === '0' ? '★' : b.roman)}</b>` : LOCK;
  const status = !open ? 'locked' : won ? `${won} of 3 stars` : 'not yet won';
  const label = `${b.tutorial ? 'Tutorial' : `Battle ${b.roman}`}: ${b.name}${boss ? ', boss battle' : ''}, ${status}`;
  return `<button type="button" class="${cls}" data-battle="${i}" style="${pos(p)}"` +
    `${open ? '' : ' disabled'} aria-label="${esc(label)}">` +
    `<span class="cn-disc">${disc}</span>${won ? stars(won) : ''}<span class="cn-name">${esc(p.label)}</span>` +
    `${i === next ? SHIP : ''}</button>`;
}

function endlessHTML() {
  const p = P.map.NODES[ENDLESS_ID], open = isUnlocked(2);
  if (!P.endless || !p) return '';
  const label = `${ENDLESS.name}: ${open ? (save.best ? `best wave ${save.best}` : 'waves of enemies') : 'win the Tortuga Narrows to open'}`;
  return `<button type="button" class="cnode endless ${open ? 'open' : 'locked'}${nameCls(p)}" data-battle="${ENDLESS_ID}" style="${pos(p)}"` +
    `${open ? '' : ' disabled'} aria-label="${esc(label)}"><span class="cn-disc">${open ? '<b>∞</b>' : LOCK}</span>` +
    `<span class="cn-name">${esc(p.label)}${open && save.best ? `<small>Best: wave ${save.best}</small>` : ''}</span></button>`;
}

// The battle the campaign is up to in a world (the chart's, by default): the first one there that's open but not
// won yet, as an index into BATTLES (-1 when there is none).
export function nextBattle(world = currentWorld()) {
  const x = BATTLES.map((b, i) => ({ b, i })).find(({ b, i }) => (b.world || 'caribbean') === world && isUnlocked(i) && !save.stars[b.id]);
  return x ? x.i : -1;
}

let mapEl = null, viewEl = null, focus = null;

// Builds the chart inside `el` (the scrolling viewport) and scrolls the next battle into view.
export function renderChart(el, world = currentWorld()) {
  viewEl = el;
  P = { ...plateOf(world), world };
  const next = nextBattle(world), list = shown();
  el.innerHTML = `<div class="chart-map">${mapSVG()}${list.map(({ b, i }) => nodeHTML(b, i, next)).join('')}${endlessHTML()}</div>`;
  el.dataset.world = world;
  el.setAttribute('aria-label', `Sea chart of ${worldById(world).name.replace(/^The /, 'the ')}. Each battle is a button; scroll or drag to pan.`);
  mapEl = el.firstChild;
  const f = P.map.NODES[(BATTLES[next] || list[list.length - 1].b).id];
  focus = f;
  layoutChart(true);
}

// Scales the map to cover the viewport (never below MIN_SCALE) and, when asked, centres on the next battle.
export function layoutChart(centre) {
  if (!mapEl || !viewEl || !viewEl.clientWidth) return;
  const vw = viewEl.clientWidth, vh = viewEl.clientHeight, { W, H } = P.map;
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
