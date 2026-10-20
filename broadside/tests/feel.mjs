// The camera and the controls: the director keeps the selected ship in shot and never leaves the sea;
// pinch and pan take over until a double-tap; drags on open sea plot courses; tapping an enemy engages it;
// Anchor plus a drag turns a ship on the spot; and the course preview matches where the ship really sails.
import { launch, open, shot, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser, { save: save({ stars: { tutorial: 3 } }) });
const B = (fn, arg) => page.evaluate(fn, arg);

// Pointer gestures, each sent as one burst of synthetic events in a single evaluate. `fingers` is a list of
// strokes in screen px; strokes run in parallel, step by step (a pinch is two strokes).
const gesture = (fingers) => B((fingers) => {
  const cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
  const ev = (type, id, q) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', isPrimary: id === 21, clientX: r.left + q.x, clientY: r.top + q.y }));
  fingers.forEach((f, i) => ev('pointerdown', 21 + i, f[0]));
  const n = Math.max(...fingers.map((f) => f.length));
  for (let k = 1; k < n; k++) fingers.forEach((f, i) => { if (k < f.length) ev('pointermove', 21 + i, f[k]); });
  fingers.forEach((f, i) => ev('pointerup', 21 + i, f[f.length - 1]));
}, fingers);
// The same, with the stroke given in map coordinates.
const mapStroke = (pts) => B((pts) => pts.map((p) => window.__broadside.proj(p.x, p.y, p.z || 0)), pts);
const onScreen = (q, m = 0) => B(([q, m]) => q.x >= m && q.y >= m && q.x <= window.__broadside.S.view.cw - m && q.y <= window.__broadside.S.view.ch - m, [q, m]);

// Every enemy but the ones a test uses goes far away and sits still.
const park = () => B(() => { const G = window.__broadside.G; for (const s of G.ships) if (s.team === 'enemy') { s.passive = true; s.v = 0; s.x = G.W - 40; s.y = 40; } });

// The camera's view of the sea: the four screen corners on the water, against the map's edges.
const viewInSea = () => B(() => {
  const b = window.__broadside, { cw, ch } = b.S.view, G = b.G;
  let worst = 0;
  for (const [x, y] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) {
    const w = b.toWorld(x, y);
    if (!w) return 1e9;
    worst = Math.max(worst, -w.x, w.x - G.W, -w.y, w.y - G.H);
  }
  return worst;
});

// ---------- The director ----------
console.log('Director camera');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); });
const size = await B(() => ({ W: window.__broadside.G.W, H: window.__broadside.G.H, ...window.__broadside.S.view }));
check(size.H > size.ch * 1.8 && size.W > size.cw * 1.3, `the sea is bigger than the screen (${size.W} x ${size.H} map units)`, failures);
// The establishing move opens over the enemy and settles on your flagship.
const intro0 = await B(() => { const b = window.__broadside, e = b.G.ships.find((s) => s.team === 'enemy'); return b.proj(e.x, e.y, 0); });
check(await onScreen(intro0), 'the battle opens with the enemy in shot', failures);
await B(() => window.__broadside.step(240));
const settled = await B(() => { const b = window.__broadside, s = b.S.selected; return b.proj(s.x, s.y, 0); });
check(await onScreen(settled, 40), 'the establishing move settles on the selected ship', failures);
await park();
// Sail the flagship the length of the map; the camera follows.
await B(() => {
  const b = window.__broadside, G = b.G, s = b.S.selected;
  s.path = [{ x: G.W * 0.75, y: G.H * 0.55 }, { x: G.W * 0.3, y: G.H * 0.3 }, { x: G.W * 0.5, y: 120 }];
  for (const o of G.ships) if (o.team === 'player' && o !== s) { o.x = 60; o.y = G.H - 60; o.pivot = o.h; }
});
let kept = 0, worstEdge = 0, samples = 0, moved = 0;
const start = await B(() => ({ x: window.__broadside.cam.tx, y: window.__broadside.cam.ty }));
for (let i = 0; i < 30; i++) {
  const st = await B(() => {
    const b = window.__broadside; b.step(60);
    const s = b.S.selected, q = b.proj(s.x, s.y, 0), { cw, ch } = b.S.view;
    return { in: q.x > 20 && q.x < cw - 20 && q.y > 50 && q.y < ch - 70, tx: b.cam.tx, ty: b.cam.ty, path: s.path.length };
  });
  samples++; if (st.in) kept++;
  worstEdge = Math.max(worstEdge, await viewInSea());
  moved = Math.max(moved, Math.hypot(st.tx - start.x, st.ty - start.y));
  if (i % 10 === 5) await shot(page, `c${i}-director`);
}
check(kept === samples, `the selected ship stays on screen while she sails (${kept}/${samples} samples)`, failures);
check(moved > 300, `the camera travels with her (${Math.round(moved)} units)`, failures);
check(worstEdge <= 105, `the view never strays past the edge of the sea (worst ${Math.round(worstEdge)} units over)`, failures);
// The spring is frame-rate independent: thirty 1/60 s frames land where one 1/2 s frame does.
const fr = await B(() => {
  const b = window.__broadside, c = b.cam;
  // From a fresh start where the goal sits clear of the sea's edges: there the clamp that keeps the view on the
  // sea bends the path (rightly), and the small frames and the big one part company.
  b.startBattle('rojo'); b.step(1); b.settle();
  b.camTick(0);
  const s0 = { tx: c.tx + 300, ty: c.ty - 200, d: c.d * 1.4, vx: 0, vy: 0, vd: 0 };
  Object.assign(c, s0); for (let i = 0; i < 30; i++) b.camTick(1 / 60);
  const A = { x: c.tx, y: c.ty, d: c.d };
  Object.assign(c, s0); b.camTick(0.5);
  const Bq = { x: c.tx, y: c.ty, d: c.d };
  return { gap: Math.hypot(A.x - Bq.x, A.y - Bq.y), dd: Math.abs(A.d - Bq.d), moved: Math.hypot(A.x - s0.tx, A.y - s0.ty) };
});
check(fr.moved > 100 && fr.gap < 6 && fr.dd < 6, `the camera spring is frame-rate independent (${fr.gap.toFixed(1)} units apart after 0.5 s, moved ${Math.round(fr.moved)})`, failures);

// ---------- Pinch, pan and double-tap ----------
console.log('Pinch, pan, double-tap');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); window.__broadside.settle(); });
await park();
const before = await B(() => { const b = window.__broadside, { cw, ch } = b.S.view; return { d: b.cam.d, mid: b.toWorld(cw / 2, ch / 2), path: b.S.selected.path.length }; });
const cx = size.cw / 2, cy = size.ch / 2;
// Spread two fingers apart around the middle of the screen: zoom in about that point.
await gesture([[{ x: cx - 40, y: cy }, { x: cx - 55, y: cy }, { x: cx - 70, y: cy }, { x: cx - 90, y: cy }], [{ x: cx + 40, y: cy }, { x: cx + 55, y: cy }, { x: cx + 70, y: cy }, { x: cx + 90, y: cy }]]);
const pinched = await B(() => { const b = window.__broadside, { cw, ch } = b.S.view; b.step(1); return { mode: b.cam.mode, d: b.cam.d, mid: b.toWorld(cw / 2, ch / 2) }; });
check(pinched.mode === 'manual', 'a pinch hands the camera to the player', failures);
check(pinched.d < before.d * 0.7, `spreading two fingers zooms in (${Math.round(before.d)} -> ${Math.round(pinched.d)})`, failures);
check(Math.hypot(pinched.mid.x - before.mid.x, pinched.mid.y - before.mid.y) < 12, 'the sea under the fingers stays under them', failures);
// Two fingers moving together pan the view.
await gesture([[{ x: cx - 40, y: cy }, { x: cx - 10, y: cy + 40 }, { x: cx + 20, y: cy + 80 }], [{ x: cx + 40, y: cy }, { x: cx + 70, y: cy + 40 }, { x: cx + 100, y: cy + 80 }]]);
const panned = await B(() => { const b = window.__broadside, { cw, ch } = b.S.view; b.step(1); return { mode: b.cam.mode, mid: b.toWorld(cw / 2, ch / 2) }; });
check(Math.hypot(panned.mid.x - pinched.mid.x, panned.mid.y - pinched.mid.y) > 40, 'a two-finger drag pans the view', failures);
check(panned.mode === 'manual', 'and the camera stays in the player\'s hands', failures);
// While manual, the director doesn't drag the view back, even as ships sail.
const held = await B(() => { const b = window.__broadside, c = b.cam, x = c.tx, y = c.ty; b.step(180); return Math.hypot(c.tx - x, c.ty - y); });
check(held < 1, `the view holds still while you look around (${held.toFixed(1)} units)`, failures);
await shot(page, 'c-manual');
// The recentre button shows while manual.
check(await B(() => !!window.__broadside.S.hud.recentre), 'a recentre button shows while the camera is yours', failures);
// Double-tap empty sea: back to the director, and the taps don't send the ship anywhere.
const empty = await B(() => { const b = window.__broadside, { cw, ch } = b.S.view; return { x: cw * 0.5, y: ch * 0.4 }; });
await gesture([[empty]]); await gesture([[empty]]);
await page.waitForTimeout(450);
const back = await B(() => { const b = window.__broadside; return { mode: b.cam.mode, path: b.S.selected.path.length }; });
check(back.mode === 'director', 'a double-tap on the sea gives the camera back to the director', failures);
check(back.path === before.path, 'and the double-tap does not order a course', failures);
const ret = await B(() => { const b = window.__broadside; b.step(180); const s = b.S.selected, q = b.proj(s.x, s.y, 0); return { q, d: b.cam.d, gd: b.cam.gd }; });
check(await onScreen(ret.q, 30) && Math.abs(ret.d - ret.gd) / ret.gd < 0.05, 'the director eases back onto the selected ship', failures);
// After a quiet spell the director takes over on its own.
await gesture([[{ x: cx - 40, y: cy }, { x: cx - 60, y: cy }], [{ x: cx + 40, y: cy }, { x: cx + 60, y: cy }]]);
const quiet = await B(() => { const b = window.__broadside; const m0 = b.cam.mode; b.step(60 * 9); return [m0, b.cam.mode]; });
check(quiet[0] === 'manual' && quiet[1] === 'director', `a quiet spell returns the camera to the director (${quiet.join(' -> ')})`, failures);

// ---------- Drag on open sea ----------
console.log('Courses');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); window.__broadside.settle(); });
await park();
const fleet = await B(() => window.__broadside.G.ships.filter((s) => s.team === 'player').map((s) => ({ id: s.id, x: s.x, y: s.y })));
const flag = fleet[0];
// A stroke on open sea well ahead of the flagship, away from every ship. Ahead and to her left: the Tortuga
// refit put a small island ahead and to her right, and a course's waypoints on land are (rightly) skipped.
const seaStroke = []; for (let i = 0; i <= 8; i++) seaStroke.push({ x: flag.x - 60 - i * 12, y: flag.y - 170 - i * 22 });
await gesture([await mapStroke(seaStroke)]);
const c1 = await B((id) => { const b = window.__broadside, G = b.G; return { sel: b.S.selected.id, path: G.ships.find((s) => s.id === id).path.map((p) => [p.x, p.y]), others: G.ships.filter((s) => s.team === 'player' && s.id !== id).map((s) => s.path.length) }; }, flag.id);
check(c1.sel === flag.id && c1.path.length >= 5, `a drag on open sea plots the selected ship's course (${c1.path.length} points)`, failures);
check(c1.path.length && Math.hypot(c1.path[0][0] - seaStroke[0].x, c1.path[0][1] - seaStroke[0].y) < 14, `the course starts where the finger went down (finger ${Math.round(seaStroke[0].x)},${Math.round(seaStroke[0].y)}; course ${c1.path.slice(0, 2).map((p) => p.map(Math.round).join(',')).join(' / ')}; flagship ${Math.round(flag.x)},${Math.round(flag.y)})`, failures);
check(c1.others.every((n) => n === 0), 'other ships keep their orders', failures);
await B(() => window.__broadside.step(1));
await shot(page, 'c-course-preview');
// A drag that starts on another of your ships (in shot, beside the flagship) selects her first.
const other = await B(() => { const b = window.__broadside, G = b.G, s = G.ships.filter((x) => x.team === 'player'); s[1].x = s[0].x - 140; s[1].y = s[0].y + 20; s[1].path = []; b.step(1); return { id: s[1].id, x: s[1].x, y: s[1].y }; });
check(await onScreen(await B((o) => window.__broadside.proj(o.x, o.y, 8), other)), '(the second ship is in shot)', failures);
const otherStroke = [{ x: other.x, y: other.y, z: 8 }]; for (let i = 1; i <= 6; i++) otherStroke.push({ x: other.x - i * 15, y: other.y - i * 25 });
await gesture([await mapStroke(otherStroke)]);
const c2 = await B((id) => { const b = window.__broadside; return { sel: b.S.selected.id, path: b.G.ships.find((s) => s.id === id).path.length }; }, other.id);
check(c2.sel === other.id && c2.path >= 3, 'a drag that starts on another of your ships selects her and plots her course', failures);
// Tap one of your ships: select her.
await gesture([await mapStroke([{ x: flag.x, y: flag.y, z: 8 }])]);
check(await B(() => window.__broadside.S.selected.id) === flag.id, 'tapping one of your ships selects her', failures);
// Hold a course-drawing finger at the top edge: the view slides up the chart and the course keeps growing.
const edge = await B(() => {
  const b = window.__broadside, { cw, ch } = b.S.view, cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
  const top = b.toWorld(cw / 2, 0);
  const ev = (type, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: r.left + cw * 0.55, clientY: r.top + y }));
  ev('pointerdown', ch * 0.45);
  for (let y = ch * 0.45; y > 8; y -= 40) ev('pointermove', y);
  ev('pointermove', 6);
  return { topY: top.y, cy: b.cam.ty };
});
await page.waitForTimeout(2500); // the live game loop runs meanwhile
const edge2 = await B(() => {
  const b = window.__broadside, cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: r.left + b.S.view.cw * 0.55, clientY: r.top + 6 }));
  const p = b.S.selected.path;
  return { endY: p.length ? p[p.length - 1].y : null, n: p.length };
});
check(edge2.endY != null && edge2.endY < edge.topY - 60, `holding the finger at the screen edge pans the view and extends the course (${Math.round(edge.topY - (edge2.endY || 0))} units past the old edge)`, failures);

// ---------- The preview is the real track ----------
console.log('Course preview');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); window.__broadside.settle(); });
await park();
// Two courses: a hard turn (out to the side, then back across the bow, the drawn line would cut the corner)
// and a straight line drawn right through an island (she must bend around it).
// The live game loop keeps sailing between evaluates, so each course is set up with the battle paused and then
// predicted and sailed inside a single evaluate.
for (const kind of ['turn', 'island']) {
  await B((kind) => {
    const b = window.__broadside, G = b.G, s = b.S.selected;
    G.phase = 'paused';
    for (const o of G.ships) if (o.team === 'player' && o !== s) o.state = 'sunk';
    if (kind === 'turn') {
      s.path = [{ x: s.x + 150, y: s.y - 110 }, { x: s.x + 260, y: s.y - 250 }, { x: s.x + 170, y: s.y - 290 }];
    } else {
      const is = G.islands.reduce((a, c) => (Math.hypot(c.x - s.x, c.y - s.y) < Math.hypot(a.x - s.x, a.y - s.y) ? c : a));
      const a = -Math.PI / 2 + 0.5; // run up the chart and a little downwind, straight at the island
      s.x = is.x - Math.cos(a) * 230; s.y = is.y - Math.sin(a) * 230; s.h = a; s.v = s.speed; s.pivot = null; s.order = null;
      s.path = [{ x: is.x + Math.cos(a) * 170, y: is.y + Math.sin(a) * 170 }];
    }
    b.preview(s.id);
  }, kind);
  if (kind === 'island') { await B(() => { window.__broadside.settle(); window.__broadside.G.phase = 'play'; window.__broadside.step(0); window.__broadside.G.phase = 'paused'; }); await shot(page, 'c-preview-island'); }
  const res = await B(() => {
    const b = window.__broadside, s = b.S.selected;
    b.G.phase = 'play';
    const p = b.preview(s.id);
    // How far the predicted track strays from the straight line through the course (it should, for the island).
    const q = s.path[s.path.length - 1], x0 = p.pts[0], y0 = p.pts[1], L = Math.hypot(q.x - x0, q.y - y0);
    let bend = 0;
    for (let i = 0; i < p.n; i++) bend = Math.max(bend, Math.abs((p.pts[i * 2] - x0) * (q.y - y0) - (p.pts[i * 2 + 1] - y0) * (q.x - x0)) / L);
    // Sail it for real, sampling where she is every 0.1 s (the preview's spacing).
    const out = [];
    for (let k = 0; k < Math.round(p.t * 60); k++) { b.sim(1); if (k % 6 === 5) out.push(s.x, s.y); }
    const x = s.x, y = s.y;
    // She should finish the course right about now (allow a few ticks either way).
    let extra = 0;
    while (s.path.length && extra < 15) { b.sim(1); extra++; }
    return { pv: p, bend, out, path: s.path.length, x, y, extra };
  });
  const pv = res.pv;
  check(pv.pts.length > 20 && pv.done, `${kind}: the preview sails the whole course (${(pv.pts.length / 2) | 0} points, ${pv.t.toFixed(1)} s)`, failures);
  if (kind === 'island') check(res.bend > 25, `island: the preview bends around the island (${Math.round(res.bend)} units off the straight line)`, failures);
  let worst = 0;
  for (let i = 0; i < Math.min(res.out.length, pv.pts.length - 2) / 2; i++) {
    worst = Math.max(worst, Math.hypot(res.out[i * 2] - pv.pts[i * 2 + 2], res.out[i * 2 + 1] - pv.pts[i * 2 + 3]));
  }
  const endGap = Math.hypot(res.x - pv.pts[pv.pts.length - 2], res.y - pv.pts[pv.pts.length - 1]);
  check(endGap < 12 && res.path === 0, `${kind}: the preview ends where the ship actually finishes the course (${endGap.toFixed(1)} units off)`, failures);
  check(worst < 12, `${kind}: and follows her real track all the way (worst ${worst.toFixed(1)} units)`, failures);
}

// ---------- Engage ----------
console.log('Engage');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); window.__broadside.settle(); });
await park();
const tgt = await B(() => {
  const b = window.__broadside, G = b.G, s = b.S.selected, e = G.ships.find((x) => x.team === 'enemy');
  for (const o of G.ships) if (o.team === 'player' && o !== s) o.state = 'sunk';
  e.x = s.x + 120; e.y = s.y - 420; e.h = 0; e.passive = true; e.v = 0; e.hp = e.maxHp = 1e6;
  // Clear water for the test: no islands in the way.
  G.islands.length = 0;
  b.step(1);
  return { id: e.id, x: e.x, y: e.y };
});
await B(() => window.__broadside.settle());
await gesture([await mapStroke([{ x: tgt.x, y: tgt.y, z: 8 }])]);
const eo = await B(() => window.__broadside.S.selected.order);
check(eo && eo.kind === 'engage' && eo.targetId === tgt.id, 'tapping an enemy gives the selected ship an engage order', failures);
await B(() => window.__broadside.step(1));
await shot(page, 'c-engage');
let beam = 0, n = 0, inRange = 0;
for (let i = 0; i < 40; i++) {
  const st = await B((id) => {
    const b = window.__broadside, s = b.S.selected, e = b.G.ships.find((x) => x.id === id);
    b.sim(60);
    const brg = Math.atan2(e.y - s.y, e.x - s.x), off = Math.atan2(Math.sin(brg - s.h), Math.cos(brg - s.h));
    return { off: Math.abs(Math.abs(off) - Math.PI / 2), d: Math.hypot(e.x - s.x, e.y - s.y), range: s.range };
  }, tgt.id);
  if (i < 15) continue; // time to close
  n++;
  if (st.off < 0.5) beam++;
  if (st.d < st.range) inRange++;
}
check(beam >= n * 0.7, `she keeps the target on the beam (${beam}/${n} samples)`, failures);
check(inRange >= n * 0.8, `at gun range (${inRange}/${n} samples)`, failures);
await B(() => window.__broadside.step(1));
await shot(page, 'c-engaged');
// A new drawn course cancels the engage order.
const cancel = await B(() => {
  const b = window.__broadside, s = b.S.selected, { cw, ch } = b.S.view;
  const cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
  const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: r.left + x, clientY: r.top + y }));
  ev('pointerdown', cw * 0.2, ch * 0.8); ev('pointermove', cw * 0.25, ch * 0.75); ev('pointermove', cw * 0.3, ch * 0.7); ev('pointermove', cw * 0.35, ch * 0.65); ev('pointerup', cw * 0.35, ch * 0.65);
  return { order: s.order, path: s.path.length };
});
check(!cancel.order && cancel.path > 0, 'a new drawn course cancels the engage order', failures);
// Whole fleet: one tap on an enemy sends every ship in.
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); window.__broadside.settle(); });
await B(() => window.__broadside.step(1));
const fc = await B(() => window.__broadside.S.hud.cards.find((c) => c.fleet));
if (fc) await page.mouse.click(fc.x + fc.w / 2, fc.y + fc.h / 2);
const foe = await B(() => { const b = window.__broadside, e = b.G.ships.find((x) => x.team === 'enemy'); b.settle(); return { x: e.x, y: e.y, z: 8, id: e.id }; });
await gesture([await mapStroke([foe])]);
const all = await B((id) => window.__broadside.G.ships.filter((s) => s.team === 'player').map((s) => s.order && s.order.targetId === id), foe.id);
check(all.length >= 3 && all.every(Boolean), `with Whole fleet on, tapping an enemy sends every ship in (${all.filter(Boolean).length}/${all.length})`, failures);

// ---------- Anchor and turn ----------
console.log('Anchor');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(1); window.__broadside.settle(); window.__broadside.step(1); });
await park();
const anc = await B(() => window.__broadside.S.hud.actions.find((a) => a.kind === 'anchor'));
check(!!anc && anc.w >= 44 && anc.h >= 44, 'the action bar shows an Anchor button (44px or more)', failures);
await page.mouse.click(anc.x + anc.w / 2, anc.y + anc.h / 2);
const a0 = await B(() => { const s = window.__broadside.S.selected; window.__broadside.sim(120); return { pivot: s.pivot, v: s.v, x: s.x, y: s.y, h: s.h }; });
check(a0.pivot != null && a0.v < 3, `Anchor stops her (speed ${a0.v.toFixed(1)})`, failures);
const turnPts = []; for (let i = 0; i <= 8; i++) { const a = a0.h + 0.5 + i * 0.2; turnPts.push({ x: a0.x + Math.cos(a) * 120, y: a0.y + Math.sin(a) * 120 }); }
await gesture([await mapStroke(turnPts)]);
const want = Math.atan2(turnPts[8].y - a0.y, turnPts[8].x - a0.x);
const a1 = await B(() => { const s = window.__broadside.S.selected; const p = s.pivot; window.__broadside.sim(240); return { p, h: s.h, x: s.x, y: s.y }; });
const dh = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
check(a1.p != null && dh(a1.p, want) < 0.12, 'a drag turns the anchored ship toward the finger', failures);
check(dh(a1.h, want) < 0.1 && Math.hypot(a1.x - a0.x, a1.y - a0.y) < 12, `and she swings round on the spot (moved ${Math.hypot(a1.x - a0.x, a1.y - a0.y).toFixed(1)} units)`, failures);
await B(() => window.__broadside.step(1));
await shot(page, 'c-anchored');
// Tap Anchor again to weigh it.
await page.mouse.click(anc.x + anc.w / 2, anc.y + anc.h / 2);
check(await B(() => window.__broadside.S.selected.pivot == null), 'tapping it again weighs anchor', failures);

// ---------- The next ship steps up ----------
console.log('Selection');
const sel2 = await B(() => { const b = window.__broadside, s = b.S.selected; s.hp = 0; s.state = 'sunk'; b.step(1); return b.S.selected && b.S.selected.state === 'afloat' && b.S.selected.team === 'player'; });
check(sel2, 'when the selected ship is lost, the next one is selected', failures);

// ---------- Off-screen enemies ----------
console.log('Chevrons');
const chev = await B(() => {
  const b = window.__broadside, G = b.G, s = b.S.selected, e = G.ships.find((x) => x.team === 'enemy' && x.state === 'afloat');
  e.x = s.x; e.y = Math.max(40, s.y - 1100); e.hidden = false;
  b.settle(); b.step(1);
  const q = b.proj(e.x, e.y, 0), { cw, ch } = b.S.view;
  return { off: q.x < 0 || q.y < 0 || q.x > cw || q.y > ch, n: b.S.hud.chevrons };
});
check(chev.off && chev.n >= 1, `an enemy off screen gets an edge chevron (${chev.n})`, failures);
await shot(page, 'c-chevron');

check(page.errors.length === 0, `no page errors (${page.errors.length})`, failures);
if (page.errors.length) console.log(page.errors.slice(0, 5).join('\n'));
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
