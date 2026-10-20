// Layout checks for the sea charts' geometry (src/ui/chart-map.js, the West Indies; src/ui/chart-map-med.js, the
// Mediterranean), in plain Node: the campaign route must stay on the plate and off land, keep clear of battles it
// doesn't stop at and of every name on the map, and cross itself as little as possible; battle names, star rows,
// region, sea and land names must not overlap each other or a battle, nor sit on the compass rose, the cartouche or
// a vignette or the hills. `node tests/chart-check.mjs` prints each problem and exits non-zero if there are any.
import * as CARIB from '../src/ui/chart-map.js';
import * as MED from '../src/ui/chart-map-med.js';
import { BATTLES, REGIONS } from '../src/config/battles.js';

// Each plate, with the decorations chart.js draws on it (centre and half-size of each, in map units).
const PLATES = {
  caribbean: { map: CARIB, art: [[826, 159, 40, 48], [852, 652, 112, 24], [160, 575, 98, 25], [711, 45, 46, 25]] },
  med: { map: MED, art: [[MED.ROSE[0], MED.ROSE[1] - 7, 40, 48], [...MED.CARTOUCHE, 112, 24], [MED.VIGNETTES.galley[0] + 42, MED.VIGNETTES.galley[1] + 8, 56, 32],
    [MED.VIGNETTES.dolphin[0] + 26, MED.VIGNETTES.dolphin[1] + 14, 36, 24]] },
};
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
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const distToPoly = (x, y, poly) => Math.min(...poly.map(([px, py]) => Math.hypot(px - x, py - y)));
// Boxes are convex polygons (four corners; a roundel eight), so a rotated name is tested as it is printed (separating axes).
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const grow = (P, d) => {
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length;
  return P.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d]; });
};
function overlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], nx = y2 - y1, ny = x1 - x2;
      const pa = A.map(([x, y]) => x * nx + y * ny), pb = B.map(([x, y]) => x * nx + y * ny);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}
const boxPoly = (b) => rect(b.x, b.y, b.w, b.h);
// A label as printed: `em` is one character's advance, `h` the size; the baseline sits at y, centred on x, turned
// by r degrees about that point (SVG's rotate(r x y)).
function textPoly(t, x, y, r, em, h) {
  const w = t.length * em, a = (r * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return rect(x - w / 2, y - h * 0.72, w, h).map(([px, py]) => [x + (px - x) * c - (py - y) * s, y + (px - x) * s + (py - y) * c]);
}

let total = 0;
for (const [world, { map, art }] of Object.entries(PLATES)) {
  const { NODES, LAND, ISLES, HILLS, REGION_LABELS, SEANAMES, LANDNAMES, routePoints, curveSegments, nameBox, starBox, nodeRadius, W, H } = map;
  const ids = BATTLES.filter((b) => b.world === world).map((b) => b.id);
  const lands = LAND.map(polygon);
  const onLand = (x, y, margin) => {
    for (const p of lands) if (inPoly(x, y, p) || distToPoly(x, y, p) < margin) return true;
    for (const [cx, cy, rx, ry, r] of ISLES) {
      const a = (-r * Math.PI) / 180, dx = x - cx, dy = y - cy;
      const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
      if ((u / (rx + margin)) ** 2 + (v / (ry + margin)) ** 2 < 1) return true;
    }
    return false;
  };
  const problems = [];
  const seen = new Set();
  const say = (m) => { if (!seen.has(m)) { seen.add(m); problems.push(m); } };

  // Every battle of the world has a place on its plate, in the sea.
  for (const id of ids) {
    if (!NODES[id]) { say(`${id} has no place on the chart`); continue; }
    if (onLand(NODES[id].x, NODES[id].y, 0)) say(`${id} sits on land`);
  }
  // The route, sampled, leg by leg.
  const segs = curveSegments(routePoints(ids.filter((id) => NODES[id])));
  const legs = [];
  for (const [a, c1, c2, b] of segs) {
    const L = (legs[b.to] = legs[b.to] || []);
    for (let k = 0; k <= 24; k++) { const t = k / 24; L.push([bez(a.x, c1.x, c2.x, b.x, t), bez(a.y, c1.y, c2.y, b.y, t)]); }
  }
  const regionText = (id) => REGION_LABELS[id].t || REGIONS.find((x) => x.id === id).name;
  // Region names (Fell italic 20 px), sea names (Fell italic 18 px, spaced) and land names (spaced capitals).
  const regionBoxes = Object.keys(REGION_LABELS).map((id) => { const p = REGION_LABELS[id]; return { what: `region name ${id}`, P: textPoly(regionText(id), p.x, p.y, p.r, 9.2, 20) }; });
  const seaBoxes = SEANAMES.map(([t, x, y, r]) => ({ what: `sea name "${t}"`, P: textPoly(t, x, y, r, 9.6, 18) }));
  const townBoxes = (map.TOWNS || []).map(([t, x, y, anchor, dx, dy]) => {
    const w = t.length * 5.7, x0 = anchor === 'start' ? x + dx : anchor === 'end' ? x + dx - w : x + dx - w / 2;
    return { what: `town ${t}`, P: rect(x0, y + dy - 10, w, 13) };
  });
  const landBoxes = LANDNAMES.map(([t, x, y, r, sz]) => ({ what: `land name ${t}`, P: textPoly(t, x, y, r, sz * 0.95, sz) }));
  const hillBoxes = HILLS.map(([x, y]) => ({ what: `the hills at ${Math.round(x)},${Math.round(y)}`, P: rect(x - 9, y - 8, 28, 9) }));
  const artBoxes = art.map(([x, y, hw, hh], k) => ({ what: ['the compass rose', 'the cartouche', 'a vignette', 'a vignette'][k], P: rect(x - hw, y - hh, hw * 2, hh * 2) }));

  legs.forEach((L, i) => {
    if (!L) return;
    const name = `${ids[i - 1]} -> ${ids[i]}`;
    const wet = L.filter(([x, y]) => onLand(x, y, 3));
    if (wet.length) say(`${name}: ${wet.length} points on or hugging land, e.g. ${wet[0].map(Math.round)}`);
    const off = L.find(([x, y]) => x < 24 || y < 24 || x > W - 24 || y > H - 24);
    if (off) say(`${name}: runs off the plate at ${off.map(Math.round)}`);
    for (const [id, n] of Object.entries(NODES)) {
      if (id === ids[i] || id === ids[i - 1]) continue;
      const r = n.boss ? 36 : 30;
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
    for (const b of [...regionBoxes, ...seaBoxes, ...artBoxes, ...townBoxes]) {
      const G = grow(b.P, 4);
      const hit = L.find(([x, y]) => inPoly(x, y, G));
      if (hit) say(`${name}: crosses ${b.what} at ${hit.map(Math.round)}`);
    }
  });

  // Rivers stay out of the names that are read (region names, towns, battles' names).
  (map.RIVERS || []).map(polygon).forEach((R, k) => {
    for (const b of [...regionBoxes, ...townBoxes]) if (R.some(([x, y]) => inPoly(x, y, grow(b.P, 2)))) say(`river ${k} crosses ${b.what}`);
    for (const id of Object.keys(NODES)) { const P = grow(boxPoly(nameBox(id, true)), 2); if (R.some(([x, y]) => inPoly(x, y, P))) say(`river ${k} crosses the name of ${id}`); }
  });

  // Crossings between legs that don't share a battle.
  const segX = (p, q, r, s) => {
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (!d) return false;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  let crossings = 0;
  const notes = [];
  for (let i = 1; i < legs.length; i++) {
    for (let j = i + 2; j < legs.length; j++) {
      const A = legs[i], B = legs[j];
      if (!A || !B) continue;
      let hit = null;
      for (let a = 0; a < A.length - 1 && !hit; a++) for (let b = 0; b < B.length - 1 && !hit; b++) if (segX(A[a], A[a + 1], B[b], B[b + 1])) hit = A[a];
      if (hit) { crossings++; notes.push(`  crossing: ${ids[i - 1]}->${ids[i]} x ${ids[j - 1]}->${ids[j]} at ${hit.map(Math.round)}`); }
    }
  }
  // Names, star rows, nodes, region, sea and land names and the decorations overlapping each other.
  const all = Object.keys(NODES);
  // A roundel as an octagon round it.
  const disc = (b, scale) => { const n = NODES[b], rb = nodeRadius(b, scale) / Math.cos(Math.PI / 8); return [...Array(8)].map((_, k) => [n.x + rb * Math.cos(((k + 0.5) * Math.PI) / 4), n.y + rb * Math.sin(((k + 0.5) * Math.PI) / 4)]); };
  for (const scale of SCALES) {
    for (const a of all) {
      const nbx = nameBox(a, true, scale), nb = boxPoly(nbx), sb = boxPoly(starBox(a, scale));
      if (nbx.x < 14 || nbx.x + nbx.w > W - 14 || nbx.y < 14 || nbx.y + nbx.h > H - 14) say(`name of ${a} runs off the plate`);
      for (const b of all) {
        if (a === b) continue;
        if (overlap(nb, disc(b, scale))) say(`name of ${a} overlaps node ${b} (scale ${scale})`);
        if (overlap(nb, boxPoly(starBox(b, scale)))) say(`name of ${a} overlaps the stars of ${b} (scale ${scale})`);
        if (a < b && overlap(nb, boxPoly(nameBox(b, true, scale)))) say(`names of ${a} and ${b} overlap (scale ${scale})`);
        if (a < b && overlap(sb, boxPoly(starBox(b, scale)))) say(`stars of ${a} and ${b} overlap (scale ${scale})`);
        if (a < b && overlap(disc(a, scale), disc(b, scale))) say(`nodes ${a} and ${b} overlap`);
      }
      for (const b of [...regionBoxes, ...seaBoxes, ...landBoxes, ...artBoxes, ...hillBoxes, ...townBoxes]) {
        if (overlap(nb, b.P) || overlap(sb, b.P)) say(`name of ${a} overlaps ${b.what} (scale ${scale})`);
        if (overlap(disc(a, scale), b.P)) say(`node ${a} overlaps ${b.what} (scale ${scale})`);
      }
    }
  }
  const labels = [...regionBoxes, ...seaBoxes, ...landBoxes, ...artBoxes, ...townBoxes];
  labels.forEach((a, i) => labels.slice(i + 1).forEach((b) => { if (overlap(grow(a.P, -2), grow(b.P, -2))) say(`${a.what} overlaps ${b.what}`); }));
  for (const a of labels) for (const b of hillBoxes) if (overlap(grow(a.P, -2), b.P)) say(`${a.what} overlaps ${b.what}`);

  console.log(`${world}:`);
  console.log(problems.map((p) => '  ' + p).join('\n') || '  no layout problems');
  if (notes.length) console.log(notes.join('\n'));
  console.log(`  ${crossings} crossing(s)`);
  total += problems.length;
}
process.exit(total ? 1 : 0);
