// The game's icon set: one source of path data for the DOM (inline SVG strings) and the canvas HUD (Path2D).
// Rules: a 24 x 24 grid with about 2 units of clear space, 2-unit round-capped strokes, solid fills only for
// small masses (shot, hulls, flags), one colour (currentColor in the DOM, any fill on canvas), no text inside.
// Each icon is a list of parts: { d, f } where f is 'stroke' (default), 'fill', or 'both'; `w` overrides the
// stroke width for that part.

const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const f2 = (n) => Math.round(n * 100) / 100;
function starPath(cx, cy, ro, ri, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${f2(cx + Math.cos(a) * r)} ${f2(cy + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}
// Mirrors path data left to right across the 24-unit grid (absolute M, L, H, V, C, A; relative a; Z).
function mirror(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  let out = '', cmd = '', k = 0;
  for (const t of toks) {
    if (/[a-zA-Z]/.test(t)) { cmd = t; k = 0; out += t; continue; }
    let v = +t;
    if (cmd === 'H' || ((cmd === 'M' || cmd === 'L' || cmd === 'C') && k % 2 === 0)) v = 24 - v;
    else if (cmd === 'A' && k % 7 === 5) v = 24 - v;
    else if (cmd === 'A' && k % 7 === 4) v = 1 - v; // the sweep flag flips
    else if (cmd === 'a' && k % 7 === 5) v = -v;
    else if (cmd === 'a' && k % 7 === 4) v = 1 - v;
    out += (out.endsWith(cmd) ? '' : ' ') + f2(v);
    k++;
  }
  return out;
}

// A small ship (sail, mast, hull) centred on (x, y) at scale k, for the fleet icon.
function miniShip(x, y, k) {
  const p = (dx, dy) => `${f2(x + dx * k)} ${f2(y + dy * k)}`;
  return [
    { d: `M${p(0, -7.4)}V${p(0, 0).split(' ')[1]}`, w: 1.3 },
    { d: `M${p(-3.2, -6)}Q${p(0, -6.8)} ${p(3.2, -6)}Q${p(3.6, -3.5)} ${p(3.2, -1.2)}Q${p(0, -1.8)} ${p(-3.2, -1.2)}Q${p(-3.6, -3.5)} ${p(-3.2, -6)}Z`, f: 'fill' },
    { d: `M${p(-5.2, 0)}H${f2(x + 5.2 * k)}L${p(3.7, 2.4)}H${f2(x - 3.7 * k)}Z`, f: 'fill' },
  ];
}

// A small cannon on its carriage, muzzle to the right, with a muzzle flash.
const CANNON = [
  { d: 'M3.5 9.6L16 8.2V14L3.5 12.6Z', f: 'both', w: 1.5 },
  { d: 'M16 7.2V15', w: 2.2 },
  { d: circle(7.5, 16.5, 2.6) },
  { d: 'M3 19.5H13' },
  { d: 'M19.5 8.6L21.5 7.2M20 11.1H22.5M19.5 13.6L21.5 15', w: 1.8 },
];

export const ICONS = {
  anchor: [
    { d: circle(12, 4.8, 2) },
    { d: 'M12 6.8V20.5M8 10H16' },
    { d: 'M4.8 13.2A7.2 7.2 0 0 0 19.2 13.2' },
    { d: 'M3.2 15L4.8 12.8L6.6 14.6M20.8 15L19.2 12.8L17.4 14.6' },
  ],
  mine: [
    { d: circle(12, 12.6, 6), f: 'fill' },
    { d: 'M12 4.2V6M5.4 6.4L6.7 7.7M18.6 6.4L17.3 7.7M3.6 12.6H5.2M18.8 12.6H20.4', w: 2.6 },
    { d: 'M12 18.6V21.6', w: 1.6 },
  ],
  // Crossed cutlasses: send the boarders across.
  board: [
    { d: 'M3.6 3.6L15.1 13.3L13.3 15.1Z', f: 'both', w: 1.2 },
    { d: 'M20.4 3.6L8.9 13.3L10.7 15.1Z', f: 'both', w: 1.2 },
    { d: 'M12.7 17L17 12.7M11.3 17L7 12.7', w: 2.2 },
    { d: 'M16.4 16.4L19.2 19.2M7.6 16.4L4.8 19.2', w: 2.6 },
    { d: circle(20.1, 20.1, 1.3) + circle(3.9, 20.1, 1.3), f: 'fill' },
  ],
  // A ship's boat with a flag: land the marines.
  land: [
    { d: 'M3 14.5H21L18.6 19.2H5.4Z', f: 'both', w: 1.5 },
    { d: 'M11.5 14.5V3.8' },
    { d: 'M11.5 4.2H18.5L16.6 6.7L18.5 9.2H11.5Z', f: 'both', w: 1.4 },
    { d: 'M2 21.4C4 20.6 5.5 20.6 7.5 21.4S11 22.2 13 21.4S16.5 20.6 18.5 21.4S21 21.8 22 21.4', w: 1.5 },
  ],
  fireStarboard: CANNON,
  firePort: CANNON.map((p) => ({ ...p, d: mirror(p.d) })),
  // Shot types.
  round: [{ d: circle(12, 12, 6.2), f: 'fill' }, { d: circle(12, 12, 9), w: 1.4 }],
  chain: [
    { d: circle(5.6, 12, 3.4), f: 'fill' }, { d: circle(18.4, 12, 3.4), f: 'fill' },
    { d: 'M9 12L10.2 10.6L11.4 12L12.6 10.6L13.8 12L15 10.6', w: 1.7 },
  ],
  grape: [
    [8.6, 7.6], [15.4, 7.6], [5.6, 13], [12, 12.2], [18.4, 13], [8.8, 18.2], [15.2, 18.2],
  ].map(([x, y]) => ({ d: circle(x, y, 2.55), f: 'fill' })),
  // Three ships in company: the whole fleet.
  fleet: [[6.5, 9.6], [17.5, 9.6], [12, 19.6]].map(([x, y]) => miniShip(x, y, 0.85)).flat(),
  pause: [{ d: 'M8.5 5.5V18.5M15.5 5.5V18.5', w: 3.2 }],
  play: [{ d: 'M8 5.2L19 12L8 18.8Z', f: 'both' }],
  wind: [
    { d: 'M3 8.5H13.5A2.8 2.8 0 1 0 10.7 5.7' },
    { d: 'M3 12.5H18A3 3 0 1 1 15 15.5' },
    { d: 'M3 16.5H9.5' },
  ],
  gold: [{ d: circle(12, 12, 8.6) }, { d: circle(12, 12, 4.8), w: 1.5 }, { d: 'M12 9.6V14.4', w: 1.6 }],
  star: [{ d: starPath(12, 12.6, 9.6, 4.3), f: 'both', w: 1.4 }],
  lock: [
    { d: 'M8 11V8.2A4 4 0 0 1 16 8.2V11' },
    { d: 'M5.5 11H18.5V20.5H5.5Z', f: 'both', w: 1.5 },
  ],
  // A tricorne: a solid crown over an outlined, upswept brim.
  hat: [
    { d: 'M7.4 12.4C7.4 8 9.6 5.4 12 5.4S16.6 8 16.6 12.4Z', f: 'fill' },
    { d: 'M2.4 12.2C5.4 9.6 8.6 10.6 12 12.6C15.4 10.6 18.6 9.6 21.6 12.2C19.2 16.4 15.2 17.6 12 16.2C8.8 17.6 4.8 16.4 2.4 12.2Z', w: 1.8 },
  ],
  // Navigation and settings.
  back: [{ d: 'M14.5 5L7.5 12L14.5 19', w: 2.4 }],
  next: [{ d: 'M9.5 5L16.5 12L9.5 19', w: 2.4 }],
  close: [{ d: 'M6 6L18 18M18 6L6 18', w: 2.2 }],
  check: [{ d: 'M4.5 12.5L9.5 17.5L19.5 6.5', w: 2.4 }],
  restart: [{ d: 'M5.2 9.5A7.5 7.5 0 1 1 4.6 14' }, { d: 'M4.4 4.6V9.8H9.6' }],
  // A ship's wheel: settings.
  helm: [
    { d: circle(12, 12, 5.6) }, { d: circle(12, 12, 1.6), f: 'fill' },
    { d: 'M12 2.2V21.8M2.2 12H21.8M5.1 5.1L18.9 18.9M18.9 5.1L5.1 18.9', w: 1.7 },
  ],
  // A sight: hand the camera back to the director.
  recentre: [{ d: circle(12, 12, 6.2) }, { d: circle(12, 12, 1.7), f: 'fill' }, { d: 'M12 2.6V5.4M12 18.6V21.4M2.6 12H5.4M18.6 12H21.4' }],
  map: [{ d: 'M3 6.2L8.6 4L15.4 6.4L21 4.2V17.8L15.4 20L8.6 17.6L3 19.8Z' }, { d: 'M8.6 4V17.6M15.4 6.4V20', w: 1.5 }],
  ship: [
    { d: 'M12 2.8V15' },
    { d: 'M6.2 5.2C9.8 4.4 14.2 4.4 17.8 5.2C18.4 8 18.4 10.6 17.8 13C14.2 12.4 9.8 12.4 6.2 13C5.6 10.6 5.6 8 6.2 5.2Z', f: 'both', w: 1.4 },
    { d: 'M2.6 15.4H21.4L18.6 20.4H5.4Z', f: 'both', w: 1.4 },
  ],
  music: [{ d: 'M9 18V5.8L19 3.8V16' }, { d: circle(6.6, 18, 2.6), f: 'fill' }, { d: circle(16.6, 16, 2.6), f: 'fill' }],
  sound: [{ d: 'M4 9.2H7.6L12.4 5V19L7.6 14.8H4Z', f: 'both', w: 1.5 }, { d: 'M15.6 9A4.2 4.2 0 0 1 15.6 15M18.2 6.4A8 8 0 0 1 18.2 17.6' }],
  mute: [{ d: 'M4 9.2H7.6L12.4 5V19L7.6 14.8H4Z', f: 'both', w: 1.5 }, { d: 'M16 9.5L21 14.5M21 9.5L16 14.5' }],
  skull: [
    { d: 'M5.6 11.4C5.6 6.8 8.4 4 12 4S18.4 6.8 18.4 11.4C18.4 13.8 17.2 15.2 16 15.8V18.6H8V15.8C6.8 15.2 5.6 13.8 5.6 11.4Z' },
    { d: circle(9.4, 11.4, 1.7) + circle(14.6, 11.4, 1.7), f: 'fill' },
    { d: 'M10.6 18.6V16.6M13.4 18.6V16.6', w: 1.4 },
  ],
};
export const ICON_NAMES = Object.keys(ICONS);

// ---------- DOM ----------
// An inline SVG string. `title` makes it an image with that accessible name; otherwise it is decorative.
export function iconSVG(name, { size = 24, cls = '', title = '', stroke = 2 } = {}) {
  const parts = ICONS[name];
  if (!parts) throw new Error('No icon ' + name);
  const body = parts.map((p) => {
    const f = p.f || 'stroke', w = p.w || stroke;
    return `<path d="${p.d}" fill="${f === 'stroke' ? 'none' : 'currentColor'}"` +
      (f === 'fill' ? '' : ` stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`) + '/>';
  }).join('');
  const a11y = title ? ` role="img" aria-label="${title.replace(/"/g, '&quot;')}"` : ' aria-hidden="true" focusable="false"';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="${size}" height="${size}"${a11y}>${body}</svg>`;
}

// ---------- Canvas ----------
const cache = new Map();
// Path2D objects for an icon, built once.
export function iconPaths(name) {
  let p = cache.get(name);
  if (!p) {
    p = ICONS[name].map((part) => ({ path: new Path2D(part.d), f: part.f || 'stroke', w: part.w }));
    cache.set(name, p);
  }
  return p;
}
// Draws an icon centred on (x, y), `size` CSS px across, in one colour. Strokes scale with the icon, so a
// 20px icon has the same weight relative to its size as the 24px master.
export function drawIcon(ctx, name, x, y, size = 24, color = '#fff', { stroke = 2, shadow = null } = {}) {
  const k = size / 24, dpr = ctx.getTransform().a || 1; // canvas shadows ignore the transform
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (shadow) { ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur * dpr; ctx.shadowOffsetY = shadow.y * dpr; }
  for (const part of iconPaths(name)) {
    if (part.f !== 'stroke') ctx.fill(part.path);
    if (part.f !== 'fill') { ctx.lineWidth = part.w || stroke; ctx.stroke(part.path); }
  }
  ctx.restore();
}

// Pre-renders an icon to an offscreen canvas at a device pixel ratio, for HUDs that blit images each frame.
export function iconImage(name, size, color, dpr = 2) {
  const key = `${name}|${size}|${color}|${dpr}`;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    drawIcon(g, name, size / 2, size / 2, size, color);
    cache.set(key, c);
  }
  return c;
}
