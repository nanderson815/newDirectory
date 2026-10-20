// Layout checks for the sea chart's geometry (src/ui/chart-map.js), in plain Node: the campaign route must stay
// off land, keep clear of battles it doesn't stop at and of every name on the map, and cross itself as little as
// possible. `node tests/chart-check.mjs` prints each problem and exits non-zero if there are any.
import { NODES, LAND, ISLES, REGION_LABELS, routePoints, curveSegments, nameBox, starBox, nodeRadius } from '../src/ui/chart-map.js';
import { BATTLES, REGIONS } from '../src/config/battles.js';

// This plate is the West Indies' (the Mediterranean's placeholder lives in chart-map-med.js and isn't checked yet).
const ids = BATTLES.filter((b) => b.world === 'caribbean').map((b) => b.id);
const SCALES = [1]; // the chart never draws the map below scale 1 (MIN_SCALE in chart.js); smaller screens pan
const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };

// Coastlines as polygons (sampled cubics), islands as ellipses.
function polygon(d) {
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+/g), poly = [];
  let i = 0, cur = null, cmd = '';
  const num = () => +toks[i++];
  while (i < toks.length) {
    if (/[MLCZ]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'Z') continue;
    if (cmd === 'M' || cmd === 'L') { cur = [num(), num()]; poly.push(cur); }
    else if (cmd === 'C') {
      const c1 = [num(), num()], c2 = [num(), num()], p = [num(), num()];
      for (let k = 1; k <= 12; k++) { const t = k / 12; poly.push([bez(cur[0], c1[0], c2[0], p[0], t), bez(cur[1], c1[1], c2[1], p[1], t)]); }
      cur = p;
    }
  }
  return poly;
}
const lands = LAND.map(polygon);
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const distToPoly = (x, y, poly) => Math.min(...poly.map(([px, py]) => Math.hypot(px - x, py - y)));
function onLand(x, y, margin) {
  for (const p of lands) if (inPoly(x, y, p) || distToPoly(x, y, p) < margin) return true;
  for (const [cx, cy, rx, ry, r] of ISLES) {
    const a = (-r * Math.PI) / 180, dx = x - cx, dy = y - cy;
    const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
    if ((u / (rx + margin)) ** 2 + (v / (ry + margin)) ** 2 < 1) return true;
  }
  return false;
}

// The route, sampled, leg by leg.
const segs = curveSegments(routePoints(ids));
const legs = [];
for (const [a, c1, c2, b] of segs) {
  const L = (legs[b.to] = legs[b.to] || []);
  for (let k = 0; k <= 24; k++) { const t = k / 24; L.push([bez(a.x, c1.x, c2.x, b.x, t), bez(a.y, c1.y, c2.y, b.y, t)]); }
}
const problems = [];
const say = (m) => problems.push(m);

legs.forEach((L, i) => {
  if (!L) return;
  const name = `${ids[i - 1]} -> ${ids[i]}`;
  const wet = L.filter(([x, y]) => onLand(x, y, 3));
  if (wet.length) say(`${name}: ${wet.length} points on or hugging land, e.g. ${wet[0].map(Math.round)}`);
  for (const [id, n] of Object.entries(NODES)) {
    if (id === ids[i] || id === ids[i - 1]) continue;
    const r = NODES[id].boss ? 36 : 30;
    const d = Math.min(...L.map(([x, y]) => Math.hypot(x - n.x, y - n.y)));
    if (d < r) say(`${name}: passes ${d.toFixed(0)} from ${id}`);
  }
  for (const id of Object.keys(NODES)) {
    let hit = null;
    for (const scale of SCALES) for (const won of [false, true]) {
      const b = nameBox(id, won, scale);
      hit = hit || L.find(([x, y]) => x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2);
    }
    if (hit) say(`${name}: crosses the name of ${id} at ${hit.map(Math.round)}`);
  }
  for (const r of REGIONS.filter((x) => x.world === 'caribbean')) {
    const p = REGION_LABELS[r.id];
    if (!p) continue;
    const t = p.t || r.name, w = t.length * 9.2, h = 18;
    const a = (-p.r * Math.PI) / 180;
    const hit = L.find(([x, y]) => {
      const dx = x - p.x, dy = y - (p.y - 6);
      const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
      return Math.abs(u) < w / 2 + 4 && Math.abs(v) < h / 2 + 4;
    });
    if (hit) say(`${name}: crosses the region name "${t}" at ${hit.map(Math.round)}`);
  }
});

// Crossings between legs that don't share a battle.
const segX = (p, q, r, s) => {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (!d) return false;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
};
let crossings = 0;
for (let i = 1; i < legs.length; i++) {
  for (let j = i + 2; j < legs.length; j++) {
    const A = legs[i], B = legs[j];
    let hit = null;
    for (let a = 0; a < A.length - 1 && !hit; a++) for (let b = 0; b < B.length - 1 && !hit; b++) if (segX(A[a], A[a + 1], B[b], B[b + 1])) hit = A[a];
    if (hit) { crossings++; console.log(`  crossing: ${ids[i - 1]}->${ids[i]} x ${ids[j - 1]}->${ids[j]} at ${hit.map(Math.round)}`); }
  }
}
// Names, star rows, nodes and region names overlapping each other, at each map scale.
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function regionBox(id) {
  const p = REGION_LABELS[id], r = REGIONS.find((x) => x.id === id), t = p.t || r.name;
  const w = t.length * 9.2 + Math.abs(p.r) * 3, h = 18 + Math.abs(p.r) * 1.2; // rough, padded for rotation
  return { x: p.x - w / 2, y: p.y - h + 4, w, h };
}
const all = Object.keys(NODES);
const seen = new Set();
const once = (m) => { if (!seen.has(m)) { seen.add(m); say(m); } };
for (const scale of SCALES) {
  for (const a of all) {
    const nb = nameBox(a, true, scale), sb = starBox(a, scale);
    for (const b of all) {
      if (a === b) continue;
      const n = NODES[b], rb = nodeRadius(b, scale);
      const disc = { x: n.x - rb, y: n.y - rb, w: rb * 2, h: rb * 2 };
      if (overlap(nb, disc)) once(`name of ${a} overlaps node ${b} (scale ${scale})`);
      if (overlap(nb, starBox(b, scale))) once(`name of ${a} overlaps the stars of ${b} (scale ${scale})`);
      if (a < b && overlap(nb, nameBox(b, true, scale))) once(`names of ${a} and ${b} overlap (scale ${scale})`);
      if (a < b && overlap(sb, starBox(b, scale))) once(`stars of ${a} and ${b} overlap (scale ${scale})`);
    }
    for (const r of Object.keys(REGION_LABELS)) if (overlap(nb, regionBox(r))) once(`name of ${a} overlaps region name ${r} (scale ${scale})`);
  }
  for (const r of Object.keys(REGION_LABELS)) for (const b of all) {
    const n = NODES[b], rb = nodeRadius(b, scale);
    if (overlap(regionBox(r), { x: n.x - rb, y: n.y - rb, w: rb * 2, h: rb * 2 })) once(`region name ${r} overlaps node ${b} (scale ${scale})`);
  }
}
console.log(problems.map((p) => '  ' + p).join('\n') || '  no layout problems');
console.log(`  ${crossings} crossing(s)`);
process.exit(problems.length ? 1 : 0);
