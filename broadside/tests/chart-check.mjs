// Layout checks for the sea chart's geometry (src/ui/chart-map.js), in plain Node: the campaign route must stay
// off land, keep clear of battles it doesn't stop at and of every name on the map, and cross itself as little as
// possible. `node tests/chart-check.mjs` prints each problem and exits non-zero if there are any.
import { NODES, LAND, ISLES, REGION_LABELS, routePoints, curveSegments, nameBox } from '../src/ui/chart-map.js';
import { BATTLES, REGIONS } from '../src/config/battles.js';

const ids = BATTLES.map((b) => b.id);
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
    const r = BATTLES.find((b) => b.id === id && b.hat) ? 36 : 30;
    const d = Math.min(...L.map(([x, y]) => Math.hypot(x - n.x, y - n.y)));
    if (d < r) say(`${name}: passes ${d.toFixed(0)} from ${id}`);
  }
  for (const id of Object.keys(NODES)) {
    for (const won of [false, true]) {
      const b = nameBox(id, won, 1);
      const hit = L.find(([x, y]) => x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2);
      if (hit && !(id === ids[i] && false)) { say(`${name}: crosses the name of ${id}${won ? ' (with stars)' : ''} at ${hit.map(Math.round)}`); break; }
    }
  }
  for (const r of REGIONS) {
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
// Labels and nodes overlapping each other.
const all = Object.keys(NODES);
for (let i = 0; i < all.length; i++) {
  for (let j = 0; j < all.length; j++) {
    if (i === j) continue;
    const b = nameBox(all[i], true, 1), n = NODES[all[j]];
    const cx = Math.max(b.x, Math.min(n.x, b.x + b.w)), cy = Math.max(b.y, Math.min(n.y, b.y + b.h));
    if (Math.hypot(cx - n.x, cy - n.y) < 22) say(`name of ${all[i]} overlaps node ${all[j]}`);
    if (j > i) {
      const c = nameBox(all[j], true, 1);
      if (b.x < c.x + c.w && c.x < b.x + b.w && b.y < c.y + c.h && c.y < b.y + b.h) say(`names of ${all[i]} and ${all[j]} overlap`);
    }
  }
}
console.log(problems.map((p) => '  ' + p).join('\n') || '  no layout problems');
console.log(`  ${crossings} crossing(s)`);
process.exit(problems.length ? 1 : 0);
