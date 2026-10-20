// A schematic contact sheet of battle maps (no WebGL, so it's quick and light): land, shoals (tidal ones dashed),
// reefs, currents, booms, forts, landmarks and every ship's start, each map at its own sea size on a tall phone.
// For checking at a glance that no two maps share a silhouette. Not part of npm test.
//   node tests/map-sheet.mjs                       # every battle -> shots/maps/sheet-<world>.png
//   WORLD=med OUT=/tmp/x node tests/map-sheet.mjs  # one world
//   SIZE=620x830 ONLY=gibraltar node tests/map-sheet.mjs   # another screen (default the tall phone, 520x1390)
import fs from 'fs';
import path from 'path';
import { launch, ROOT } from './lib.mjs';
import { loadContent } from '../scripts/registries.mjs';

const C = await loadContent();
const { createBattle } = await import('../src/sim/battle.js');
const { setLab, LAB_ID } = await import('../src/config/lab.js');
const { S } = await import('../src/state.js');
const T = await import('../src/sim/terrain.js');
const OUT = process.env.OUT || path.join(ROOT, 'shots', 'maps');
fs.mkdirSync(OUT, { recursive: true });
const worlds = process.env.WORLD ? [process.env.WORLD] : [...new Set(C.BATTLES.map((b) => b.world))];
const [SW, SH] = (process.env.SIZE || '520x1390').split('x').map(Number);
const fleet = [0, 1, 2, 3, 4].map((i) => ({ name: `S${i}`, cls: i ? 'frigate' : 'manowar', up: {} }));

function capsulePath(c, k = 1) {
  const pts = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, r = T.capsuleRadius(c, a) * k; pts.push(`${(c.x + Math.cos(a) * r).toFixed(1)},${(c.y + Math.sin(a) * r).toFixed(1)}`); }
  return pts.join(' ');
}
function mapSVG(B) {
  const k = 1.45 * (B.sea || 1), W = Math.round(SW * k), H = Math.round(SH * k);
  setLab({ ...B, land: B.land || (C.LANDS || {})[B.id] || null });
  const rnd = Math.random; let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const G = createBattle(LAB_ID, { W, H, land: false }, fleet);
  Math.random = rnd;
  S.G = G;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="150" height="${Math.round(150 * H / W)}"><rect width="${W}" height="${H}" fill="#3f7fb0"/>`];
  for (const c of G.currents || []) out.push(`<polygon points="${capsulePath(c)}" fill="#7fb8dd" opacity="0.35"/>`);
  for (const c of G.shoals) out.push(`<polygon points="${capsulePath(c)}" fill="#9fe3d6" ${c.tidal ? 'stroke="#fff" stroke-dasharray="14 10" stroke-width="5"' : ''}/>`);
  for (const co of G.coasts) {
    const p = co.pts, ax = co.axis, far = co.low ? 0 : (ax ? W : H);
    const ends = ax ? [[far, p[p.length - 1][1]], [far, p[0][1]]] : [[p[p.length - 1][0], far], [p[0][0], far]];
    out.push(`<polygon points="${[...p, ...ends].map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="#c9b27c"/>`);
  }
  for (const is of G.islands) out.push(`<polygon points="${capsulePath(is)}" fill="#c9b27c"/>`);
  for (const c of G.reefs) out.push(`<polygon points="${capsulePath(c)}" fill="#3a4a52" stroke="#fff" stroke-width="5"/>`);
  for (const b of G.booms || []) { const ux = Math.cos(b.ang) * b.hl, uy = Math.sin(b.ang) * b.hl; out.push(`<line x1="${b.x - ux}" y1="${b.y - uy}" x2="${b.x + ux}" y2="${b.y + uy}" stroke="#6b4a2b" stroke-width="12"/>`); }
  for (const c of G.currents || []) { const L = 60; for (const t of [-1, 0, 1]) { const x = c.x + Math.cos(c.ang) * (c.hl || 0) * t * 0.6, y = c.y + Math.sin(c.ang) * (c.hl || 0) * t * 0.6; out.push(`<line x1="${x}" y1="${y}" x2="${x + c.fx * L}" y2="${y + c.fy * L}" stroke="#fff" stroke-width="7"/><circle cx="${x + c.fx * L}" cy="${y + c.fy * L}" r="9" fill="#fff"/>`); } }
  for (const o of G.landmarks || []) if (o.kind !== 'stacks' && o.kind !== 'mangroves') out.push(`<rect x="${o.x - 9}" y="${o.y - 9}" width="18" height="18" fill="${o.kind === 'town' ? '#7a3b2e' : o.kind === 'lighthouse' ? '#fff' : '#5a5040'}"/>`);
  for (const f of G.forts) out.push(`<rect x="${f.x - 22}" y="${f.y - 22}" width="44" height="44" fill="${f.team === 'player' ? '#2f5d9a' : '#a3271c'}" stroke="#fff" stroke-width="4"/>`);
  for (const ch of G.chests || []) out.push(`<circle cx="${ch.x}" cy="${ch.y}" r="12" fill="#f2c94c"/>`);
  for (const o of G.goals) if (o.px != null && o.pr) out.push(`<circle cx="${o.px}" cy="${o.py}" r="${o.pr}" fill="none" stroke="#f2d48c" stroke-width="6"/>`);
  for (const s of G.ships) {
    const col = s.team === 'player' ? (s.escort || s.ally ? '#8fd18f' : '#1d2f6f') : s.boss ? '#f2c94c' : '#d0402e';
    out.push(`<rect x="${-s.L / 2}" y="${-s.B / 2}" width="${s.L}" height="${s.B}" fill="${col}" transform="translate(${s.x} ${s.y}) rotate(${s.h * 180 / Math.PI})"/>`);
  }
  for (const e of B.events || []) for (const d of e.spawn || []) if (d.x != null) out.push(`<rect x="${d.x * W - 14}" y="${d.y * H - 14}" width="28" height="28" fill="none" stroke="${d.team === 'player' ? '#8fd18f' : '#f08a7a'}" stroke-width="6"/>`);
  const wd = (B.wind * Math.PI) / 180;
  out.push(`<line x1="${W - 90}" y1="90" x2="${W - 90 + Math.cos(wd) * 60}" y2="${90 + Math.sin(wd) * 60}" stroke="#fff" stroke-width="10"/><circle cx="${W - 90}" cy="90" r="12" fill="#fff"/>`);
  out.push('</svg>');
  return { svg: out.join(''), W, H };
}

const browser = await launch();
for (const world of worlds) {
  const list = C.BATTLES.filter((b) => (b.world || 'caribbean') === world && (!process.env.ONLY || process.env.ONLY.split(',').includes(b.id)));
  const tiles = list.map((B) => { const m = mapSVG(B); return `<figure>${m.svg}<figcaption>${B.roman} ${B.id} · sea ${B.sea || 1}</figcaption></figure>`; }).join('');
  const page = await browser.newPage({ viewport: { width: 1640, height: 900 } });
  await page.setContent(`<style>body{margin:8px;background:#1b2529;font:12px sans-serif;color:#efe5cf;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start}figure{margin:0}figcaption{text-align:center}</style>${tiles}`);
  const file = path.join(OUT, `sheet-${world}${process.env.SIZE ? '-' + process.env.SIZE : ''}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  console.log(file);
}
await browser.close();
