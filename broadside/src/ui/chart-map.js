// Geometry of the campaign sea chart, kept free of the DOM so tests/chart-check.mjs can check it in Node:
// where each battle sits, the coastlines, the route between battles, and where every name is written.
// The map is drawn in a 1000 x 700 coordinate space (see chart.js).

export const W = 1000, H = 700;

// Where each battle sits on the chart, and the short name written under it. `via` bends the route into that
// battle through extra points, to keep it off land and clear of other battles; `name` places the label
// ('below' by default, or 'above', 'left', 'right') where the route leaves it room.
export const NODES = {
  tutorial: { x: 552, y: 362, label: 'Shakedown' },
  tortuga:    { x: 610, y: 288, label: 'Tortuga Narrows', via: [[606, 348]], name: 'above' },
  cayman:     { x: 470, y: 312, label: 'Cayman Shoals', via: [[540, 278]] },
  rojo: { x: 428, y: 258, label: 'La Bruja', name: 'right' },
  sanlucas: { x: 470, y: 612, label: 'San Lucas', via: [[404, 318], [440, 420], [480, 530]], name: 'left' },
  silver:     { x: 536, y: 498, label: 'Silver Fleet', name: 'right' },
  comodoro:   { x: 556, y: 616, label: 'San Cristóbal', name: 'right' },
  cartagena:  { x: 630, y: 556, label: 'Cartagena', name: 'right' },
  santamarta: { x: 690, y: 492, label: 'Santa Marta', name: 'right' },
  oro: { x: 782, y: 456, label: 'Trinidad', name: 'above' },
  cove:       { x: 880, y: 430, label: 'Smugglers’ Cove' },
  wreck:      { x: 912, y: 336, label: 'Treasure Wreck', name: 'above' },
  kate:       { x: 798, y: 372, label: 'Black Wyvern', name: 'above' },
  convoy:     { x: 700, y: 386, label: 'Convoy', name: 'above' },
  siege:      { x: 620, y: 418, label: 'Fort Charles' },
  hierro: { x: 128, y: 232, label: 'Iron Marquis', via: [[520, 428], [424, 378], [384, 300], [350, 222], [300, 172], [230, 166]] },
  fog: { x: 372, y: 400, label: 'Mosquito Fog', via: [[236, 192], [304, 210], [312, 300]], name: 'left' },
  blockade:   { x: 452, y: 114, label: 'Blockade', via: [[346, 326], [338, 250], [326, 200], [352, 158], [404, 132]], name: 'right' },
  armada:     { x: 350, y: 104, label: 'Gran Armada', name: 'left' },
  endless:    { x: 918, y: 132, label: 'Endless Skirmish' },
};

// Sea names for each campaign region: centre, rotation, and an optional shorter text.
export const REGION_LABELS = {
  port: { x: 560, y: 470, r: -3 },
  windward: { x: 712, y: 224, r: -3, t: 'Windward Passage' },
  main: { x: 440, y: 664, r: -4, t: 'Spanish Main' },
  golden: { x: 824, y: 528, r: -4, t: 'Golden Isles' },
  pirate: { x: 870, y: 280, r: 3, t: 'Pirate Coast' },
  campeche: { x: 128, y: 156, r: -3, t: 'Bay of Campeche' },
  armada: { x: 196, y: 64, r: -4, t: 'The Last Armada' },
};

// ---------- Land ----------
export const LAND = [
  // New Spain, Yucatán and the isthmus down to Darién
  'M0 0 L24 0 C20 60 10 130 14 184 C22 232 38 266 53 287 C68 306 82 326 95 328 C118 332 146 318 163 309 C180 298 190 280 195 263 C200 240 206 222 221 210 C244 200 268 198 289 203 C296 232 294 290 288 330 C280 345 266 350 258 356 C254 374 250 392 254 404 C296 410 344 414 389 442 C393 492 386 548 382 590 C390 618 398 638 410 646 C440 650 468 640 487 646 C508 654 528 668 540 680 L552 700 L474 700 C450 690 402 656 368 645 C340 638 322 626 324 610 C322 592 318 582 316 571 C306 546 296 528 289 516 C250 504 200 490 171 479 C138 460 110 432 79 398 C50 404 26 414 0 420 Z',
  // Tierra Firme
  'M540 700 L540 680 C560 660 576 630 592 612 C606 598 614 590 626 582 C650 570 676 546 697 530 C706 546 712 564 720 576 C726 562 728 550 735 540 C748 554 762 580 792 588 C830 598 870 592 900 596 C940 600 970 598 1000 602 L1000 700 Z',
  // Cuba (its ends trimmed back a little to open the Yucatán Channel and the Windward Passage)
  'M362 182 C374 170 391 150 410 144 C440 139 470 150 500 158 C530 167 553 177 576 191 C592 201 604 216 612 232 C598 242 582 249 562 250 C542 249 530 240 515 233 C490 222 466 213 442 206 C422 202 410 208 398 206 C386 202 374 194 362 182 Z',
  // Hispaniola
  'M634 262 C652 252 690 250 720 255 C750 258 770 262 788 276 C792 295 782 312 762 320 C738 324 718 316 698 324 C676 330 650 320 628 312 C642 303 660 300 668 292 C656 285 642 280 634 262 Z',
  // Jamaica
  'M500 322 C506 310 530 306 552 308 C572 309 588 314 592 324 C590 336 574 342 556 342 C534 343 512 338 500 322 Z',
  // Puerto Rico
  'M812 318 C822 312 846 312 860 316 C862 324 852 330 836 330 C822 330 812 326 812 318 Z',
  // Florida
  'M432 0 L500 0 C498 30 490 56 472 72 C462 78 452 62 448 42 C444 24 438 10 432 0 Z',
];
// Small islands: [x, y, rx, ry, rotation]
export const ISLES = [
  [404, 222, 14, 8, 0], [668, 244, 12, 4, -4], // Isle of Pines, Tortuga
  [430, 290, 8, 3, -8], [468, 281, 5, 2.5, 0], [478, 279, 4, 2, 0], // Caymans
  [306, 392, 8, 3, -10], // Roatán
  [520, 78, 8, 19, 10], [548, 40, 5, 13, -20], [572, 90, 12, 4, 20], [598, 104, 10, 4, 10], [620, 70, 7, 4, -30],
  [642, 112, 9, 4, 0], [602, 40, 4, 10, 20], [662, 96, 5, 3, 0], // Bahamas
  [458, 84, 4, 2, 20], [446, 88, 4, 2, 10], [436, 90, 3, 2, 0], // Keys
  [882, 318, 4, 2.5, 0], [894, 316, 3, 2, 0], // Virgins
  [940, 360, 5, 7, 0], [948, 388, 4, 6, 0], [956, 416, 5, 7, 10], [962, 446, 4, 6, 0], [958, 478, 5, 7, -10],
  [952, 508, 4, 5, 0], [948, 538, 5, 6, 0], [966, 600, 18, 10, 0], [986, 576, 5, 3, -20], // Lesser Antilles
  [748, 550, 6, 2.5, 0], [764, 548, 5, 2.5, 0], [778, 550, 4, 2, 0], // ABC isles
];
export const HILLS = [[80, 350], [130, 425], [60, 240], [200, 445], [250, 470], [110, 300], [40, 330], [330, 470],
  [612, 676], [985, 640], [470, 172], [540, 196], [700, 282], [742, 298], [248, 300]];
export const LANDNAMES = [
  ['NUEVA ESPAÑA', 132, 400, -10, 13], ['YUCATÁN', 246, 268, -78, 10], ['CUBA', 482, 182, 12, 12],
  ['HISPANIOLA', 714, 292, 4, 10], ['FLORIDA', 470, 34, 62, 9], ['TIERRA FIRME', 640, 640, -4, 13],
];
export const SEANAMES = [['Mar del Sur', 200, 640, -8], ['Mar del Norte', 846, 64, 0]];

// ---------- The route ----------
const f1 = (n) => Math.round(n * 10) / 10;
// Route points in campaign order; each remembers which battle (index into `ids`) its leg leads to.
export function routePoints(ids) {
  const pts = [];
  ids.forEach((id, i) => {
    for (const [x, y] of NODES[id].via || []) pts.push({ x, y, to: i });
    pts.push({ x: NODES[id].x, y: NODES[id].y, to: i, node: id });
  });
  return pts;
}
// A smooth curve through the points (Catmull-Rom). Returns one cubic per segment: [p1, c1, c2, p2].
export function curveSegments(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    // Tension is lower into and out of a battle, so legs meet a node at a calm angle.
    const t1 = p1.node ? 8 : 6, t2 = p2.node ? 8 : 6;
    out.push([p1, { x: p1.x + (p2.x - p0.x) / t1, y: p1.y + (p2.y - p0.y) / t1 }, { x: p2.x - (p3.x - p1.x) / t2, y: p2.y - (p3.y - p1.y) / t2 }, p2]);
  }
  return out;
}
// SVG path data for each leg (one leg runs from a battle to the next, through its via points).
export function legPaths(ids) {
  const pts = routePoints(ids), segs = curveSegments(pts), legs = [];
  segs.forEach(([a, c1, c2, b]) => {
    const to = b.to;
    if (!legs[to]) legs[to] = `M${a.x} ${a.y}`;
    legs[to] += ` C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${b.x} ${b.y}`;
  });
  return legs; // legs[i] leads into battle i (legs[0] is empty: the campaign starts there)
}

// Box (in map units, unrotated) of a battle's name label, for the layout checks. `won` adds the star row.
export function nameBox(id, won, scale = 1) {
  const n = NODES[id], r = id === 'endless' ? 20 : 20, w = (n.label.length * 6.1 + 6) / scale, h = 15 / scale;
  const gap = (won ? 15 : 5) / scale;
  switch (n.name) {
    case 'above': return { x: n.x - w / 2, y: n.y - r - gap - h - (won ? -8 / scale : 0), w, h };
    case 'left': return { x: n.x - r - 6 / scale - w, y: n.y - h / 2, w, h };
    case 'right': return { x: n.x + r + 6 / scale, y: n.y - h / 2, w, h };
    default: return { x: n.x - w / 2, y: n.y + r + gap, w, h };
  }
}
