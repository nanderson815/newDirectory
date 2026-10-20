// Fleet handling: ships give each other room (src/sim/avoid.js) instead of bumping, the whole fleet sails a
// course in line ahead (or abreast) and spreads round a target it engages (src/sim/formation.js, src/hud/orders.js),
// boarding and ramming still work, the course preview stays the real track with other ships about, and the
// player can let go of every ship and look around the sea.
import { launch, open, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser, { save: save({ stars: { tutorial: 3 } }) });
const B = (fn, arg) => page.evaluate(fn, arg);

// A small open-sea battle from the lab. (The live game loop keeps sailing between evaluates, so anything that
// has to be exact is set up and sailed inside one evaluate.)
const play = (def) => B((def) => { const b = window.__broadside; b.playDef(def); b.setFire('manual'); b.step(1); b.settle(); }, def);
// Runs fn(b, arg) inside the page.
const run = (fn, arg) => B(([src, arg]) => (0, eval)(src)(window.__broadside, arg), [fn.toString(), arg]);
const gesture = (strokes) => B((strokes) => {
  const cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
  const ev = (type, id, q) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + q.x, clientY: r.top + q.y }));
  for (const [i, f] of strokes.entries()) { ev('pointerdown', 51 + i, f[0]); for (const q of f.slice(1)) ev('pointermove', 51 + i, q); ev('pointerup', 51 + i, f[f.length - 1]); }
}, strokes);
const tapMap = async (x, y, z = 0) => gesture([[await B(([x, y, z]) => window.__broadside.proj(x, y, z), [x, y, z])]]);
const clickCard = (pick) => B((src) => { const c = window.__broadside.S.hud.cards.find((0, eval)(src)); return c ? { x: c.x + c.w / 2, y: c.y + c.h / 2 } : null; }, pick.toString())
  .then((q) => (q ? gesture([[q]]).then(() => true) : false));
const redraw = () => B(() => window.__broadside.step(1));

const hulk = (x, y, extra = {}) => ({ type: 'brig', name: 'San Nadie', x, y, h: 90, passive: true, hp: 100000, ...extra });

// ---------- Friends crossing ----------
console.log('Friends crossing each other\'s courses');
for (const kind of ['crossing', 'head-on']) {
  await play({ name: 'Crossing', wind: 45, player: [
    { type: 'frigate', name: 'Resolute', x: 0.5, y: 0.8, h: -90 }, { type: 'brig', name: 'Swift', x: 0.5, y: 0.6, h: 0 },
  ], enemy: [hulk(0.95, 0.04)], ai: { dmgMul: 0 } });
  const r = await run((b, kind) => {
    const G = b.G, [a, c] = G.ships.filter((s) => s.team === 'player');
    const mx = G.W / 2, my = G.H * 0.55;
    // Set up so that, sailing straight, they'd meet in the middle at the same moment.
    a.v = a.speed; c.v = c.speed;
    if (kind === 'crossing') {
      a.x = mx - 260; a.y = my; a.h = 0; a.path = [{ x: mx + 300, y: my }];
      c.x = mx; c.y = my + 260 * c.speed / a.speed; c.h = -Math.PI / 2; c.path = [{ x: mx, y: my - 300 }];
    } else {
      a.x = mx - 260; a.y = my; a.h = 0; a.path = [{ x: mx + 300, y: my }];
      c.x = mx + 260 * c.speed / a.speed; c.y = my; c.h = Math.PI; c.path = [{ x: mx - 300, y: my }];
    }
    b.S.bumps = 0;
    let min = Infinity, t = 0;
    for (; t < 60 * 20 && (a.path.length || c.path.length); t++) { b.sim(1); min = Math.min(min, Math.hypot(a.x - c.x, a.y - c.y)); }
    return { min, bumps: b.S.bumps, done: !a.path.length && !c.path.length, secs: t / 60, need: (a.L + c.L) * 0.34, comfy: (a.L + c.L) * 0.42 };
  }, kind);
  check(r.bumps === 0 && r.min > r.comfy, `${kind}: two of your ships ordered across each other's courses pass clear (closest ${Math.round(r.min)} units between centres, hulls touch at ${Math.round(r.need)}; ${r.bumps} ticks touching)`, failures);
  check(r.done, `${kind}: and both finish their courses (${r.secs.toFixed(1)} s)`, failures);
}

// ---------- Line ahead ----------
console.log('Whole fleet: line ahead');
const fleet4 = [
  { type: 'frigate', name: 'Resolute', x: 0.5, y: 0.86, h: -90 }, { type: 'brig', name: 'Swift', x: 0.3, y: 0.9, h: -90 },
  { type: 'brig', name: 'Kestrel', x: 0.7, y: 0.9, h: -90 }, { type: 'sloop', name: 'Merlin', x: 0.42, y: 0.95, h: -90 },
];
await play({ name: 'Line', wind: 30, player: fleet4, enemy: [hulk(0.95, 0.04)], ai: { dmgMul: 0 } });
check(await clickCard((c) => c.fleet), '(the Whole fleet row is in the dock)', failures);
// A course up the chart that bends right: drawn with a finger from the flagship.
const course = await B(() => {
  const b = window.__broadside, G = b.G, s = b.G.ships[0], pts = [];
  for (let i = 1; i <= 10; i++) pts.push({ x: s.x, y: s.y - i * 50 });
  for (let i = 1; i <= 8; i++) pts.push({ x: s.x + i * 45 * 0.7, y: s.y - 500 - i * 45 * 0.7 });
  return [{ x: s.x, y: s.y, z: 8 }, ...pts].map((p) => b.proj(p.x, p.y, p.z || 0));
});
await gesture([course]);
const form = await B(() => window.__broadside.G.ships.filter((s) => s.team === 'player').map((s) => ({ name: s.name, order: s.order, path: s.path.length })));
check(form[0].path > 3 && form.slice(1).every((s) => s.order && s.order.kind === 'line'), `a course for the whole fleet: the chosen ship sails it, the rest form a line on her (${form.map((s) => s.order ? s.order.kind : 'course').join(', ')})`, failures);
const line = await run((b) => {
  const G = b.G, ships = G.ships.filter((s) => s.team === 'player'), byId = (id) => G.ships.find((s) => s.id === id);
  b.S.bumps = 0;
  let ok = 0, n = 0, wake = 0, worst = 0, samples = [];
  for (let sec = 0; sec < 40; sec++) {
    b.sim(60);
    if (sec < 16) continue; // time to form up
    for (const s of ships) {
      if (!s.order || s.order.kind !== 'line') continue;
      const p = byId(s.order.leaderId), d = Math.hypot(p.x - s.x, p.y - s.y), k = d / s.order.gap;
      n++; if (k > 0.7 && k < 1.3) ok++;
      worst = Math.max(worst, Math.abs(1 - k));
      // In the wake: close to the track her leader sailed.
      const t = p.trail || [];
      let off = Infinity;
      for (let i = 0; i < t.length; i += 2) off = Math.min(off, Math.hypot(t[i] - s.x, t[i + 1] - s.y));
      if (off < s.L * 0.6) wake++;
      if (sec === 39) samples.push(`${s.name} ${Math.round(d)}/${Math.round(s.order.gap)}`);
    }
  }
  return { ok, n, wake, worst, bumps: b.S.bumps, samples };
});
check(line.n > 50 && line.ok >= line.n * 0.85, `the line keeps its spacing over time (${line.ok}/${line.n} samples within 30% of the gap; at the end ${line.samples.join(', ')})`, failures);
check(line.wake >= line.n * 0.8, `each follower sails in her leader's wake (${line.wake}/${line.n} samples)`, failures);
check(line.bumps === 0, `no one bumps anyone (${line.bumps} ticks touching)`, failures);
// Line abreast: the toggle under Whole fleet, and a straight course.
await play({ name: 'Abreast', wind: 30, player: fleet4, enemy: [hulk(0.95, 0.04)], ai: { dmgMul: 0 } });
await clickCard((c) => c.fleet);
await redraw();
check(await clickCard((c) => c.formation === 'abreast'), 'the fleet row offers line abreast', failures);
check(await B(() => window.__broadside.S.formation === 'abreast'), 'tapping it chooses line abreast', failures);
const lead = await B(() => { const s = window.__broadside.G.ships[0]; return { x: s.x, y: s.y }; });
await tapMap(lead.x + 30, lead.y - 700);
const abreast = await run((b) => {
  const G = b.G, ships = G.ships.filter((s) => s.team === 'player'), lead = ships[0];
  let ok = 0, n = 0;
  for (let sec = 0; sec < 30; sec++) {
    b.sim(60);
    if (sec < 14) continue;
    for (const s of ships) {
      if (!s.order || s.order.kind !== 'abreast') continue;
      const c = Math.cos(lead.h), sn = Math.sin(lead.h), dx = s.x - lead.x, dy = s.y - lead.y;
      const across = -dx * sn + dy * c, along = dx * c + dy * sn;
      n++; if (Math.abs(across - s.order.off) < Math.abs(s.order.off) * 0.35 + 10 && Math.abs(along) < 45) ok++;
    }
  }
  return { ok, n, kinds: ships.map((s) => (s.order ? s.order.kind : 'course')) };
});
check(abreast.n > 30 && abreast.ok >= abreast.n * 0.75, `line abreast keeps station on the head's beams (${abreast.ok}/${abreast.n} samples; ${abreast.kinds.join(', ')})`, failures);
await B(() => { window.__broadside.S.formation = 'line'; });

// ---------- Whole-fleet engage ----------
console.log('Whole fleet: engage');
await play({ name: 'Spread', wind: 30, player: fleet4, enemy: [hulk(0.5, 0.45)], ai: { dmgMul: 0 } });
await clickCard((c) => c.fleet);
const tgt = await B(() => { const e = window.__broadside.G.ships.find((s) => s.team === 'enemy'); return { x: e.x, y: e.y, id: e.id }; });
await tapMap(tgt.x, tgt.y, 8);
const spread = await run((b, id) => {
  const G = b.G, ships = G.ships.filter((s) => s.team === 'player'), e = G.ships.find((s) => s.id === id);
  b.S.bumps = 0;
  let sep = 0, n = 0, rng = 0;
  const orders = ships.map((s) => s.order && s.order.targetId === id);
  for (let sec = 0; sec < 60; sec++) {
    b.sim(60);
    if (sec < 25) continue;
    const brg = ships.map((s) => Math.atan2(s.y - e.y, s.x - e.x)).sort((a, c) => a - c);
    // The smallest angle between any two ships, seen from the target.
    let m = Infinity;
    for (let i = 0; i < brg.length; i++) { const d = (brg[(i + 1) % brg.length] - brg[i] + Math.PI * 4) % (Math.PI * 2); m = Math.min(m, d); }
    sep += m; n++;
    const ds = ships.map((s) => Math.hypot(s.x - e.x, s.y - e.y)), mean = ds.reduce((a, c) => a + c, 0) / ds.length;
    rng += Math.sqrt(ds.reduce((a, c) => a + (c - mean) ** 2, 0) / ds.length);
  }
  return { sep: sep / n, rng: rng / n, orders, bumps: b.S.bumps };
}, tgt.id);
check(spread.orders.every(Boolean), 'with Whole fleet on, tapping an enemy sends every ship in', failures);
check(spread.sep > 0.45, `they spread round her at different bearings (closest pair ${(spread.sep * 180 / Math.PI).toFixed(0)}° apart on average)`, failures);
check(spread.rng > 15, `and at different ranges (spread of ${Math.round(spread.rng)} units)`, failures);
check(spread.bumps < 120, `hulls rarely touch (${spread.bumps} ticks of 3600 with two hulls touching)`, failures);

// ---------- Boarding and ramming still work ----------
console.log('Boarding and ramming');
await play({ name: 'Board', wind: 0, player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.8, h: -90, up: { marines: 2 } }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.5, h: 0 }], ai: { dmgMul: 0 } });
const board = await run((b) => {
  const G = b.G, s = G.ships[0], e = G.ships[1];
  e.hp = e.maxHp * 0.3; e.pivot = e.h; e.v = 0; // lying at anchor
  s.path = [{ x: e.x, y: e.y }];
  let can = false;
  for (let t = 0; t < 60 * 15 && !can; t++) { b.sim(1); can = Math.hypot(s.x - e.x, s.y - e.y) < (s.L + e.L) * 0.42; }
  b.step(1);
  return { can, d: Math.hypot(s.x - e.x, s.y - e.y) };
});
await redraw();
const boardBtn = await B(() => window.__broadside.S.hud.actions.find((a) => a.kind === 'board'));
check(board.can && !!boardBtn, `a ship of yours sailed at a crippled enemy comes alongside, in boarding reach (${Math.round(board.d)} units)`, failures);
if (boardBtn) await gesture([[{ x: boardBtn.x + boardBtn.w / 2, y: boardBtn.y + boardBtn.h / 2 }]]);
const boarded = await run((b) => { const s = b.G.ships[0], e = b.G.ships[1], on = !!s.boarding; b.sim(60 * 6); return { on, prize: e.team === 'player' }; });
check(boarded.on && boarded.prize, `and Board takes her (${boarded.prize ? 'a prize' : boarded.on ? 'boarded but repelled' : 'no boarding'})`, failures);
// A Spanish boarder lays alongside a crippled English ship.
await play({ name: 'Boarded', wind: 0, player: [{ type: 'sloop', name: 'Swift', x: 0.5, y: 0.7, h: 0 }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.45, h: 0 }], ai: { dmgMul: 0 } });
const taken = await run((b) => {
  const G = b.G, s = G.ships[0];
  s.hp = s.maxHp * 0.3; s.marines = 2; s.pivot = s.h; s.v = 0;
  let on = false;
  for (let t = 0; t < 60 * 30 && !on; t++) { b.sim(1); on = !!s.boarding || s.team !== 'player'; }
  return on;
});
check(taken, 'an enemy captain still lays alongside a crippled ship of yours and boards her', failures);
// A rammer drives her bow into a ship of yours.
await play({ name: 'Ram', wind: 0, player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.7, h: -90, hp: 5000 }],
  enemy: [{ type: 'xebec', name: 'La Lanza', x: 0.5, y: 0.45, h: 90, abilities: { ram: true } }], ai: { dmgMul: 1 } });
const ram = await run((b) => {
  const G = b.G, s = G.ships[0];
  s.pivot = s.h; s.v = 0;
  const hp0 = s.hp;
  let rammed = false;
  for (let t = 0; t < 60 * 20 && !rammed; t++) { b.sim(1); rammed = s.hp < hp0 - 5 && s.slowT > 0; }
  return rammed;
});
check(ram, 'a rammer still rams a ship of yours', failures);

// ---------- The course preview with other ships about ----------
console.log('Course preview');
await play({ name: 'Preview', wind: 30, player: [
  { type: 'frigate', name: 'Resolute', x: 0.5, y: 0.73, h: -90 }, { type: 'brig', name: 'Swift', x: 0.5, y: 0.6, h: 0 },
], enemy: [hulk(0.95, 0.04)], ai: { dmgMul: 0 } });
const pv = await run((b) => {
  const G = b.G, [s, o] = G.ships.filter((q) => q.team === 'player');
  o.pivot = o.h; o.v = 0; // Swift lies at anchor right on the course
  s.v = s.speed;
  s.path = [{ x: s.x, y: o.y - 150 }];
  const p = b.preview(s.id);
  const x0 = p.pts[0];
  let bend = 0;
  for (let i = 0; i < p.n; i++) bend = Math.max(bend, Math.abs(p.pts[i * 2] - x0));
  const out = [];
  for (let k = 0; k < Math.round(p.t * 60); k++) { b.sim(1); if (k % 6 === 5) out.push(s.x, s.y); }
  let worst = 0;
  for (let i = 0; i < Math.min(out.length, p.pts.length - 2) / 2; i++) worst = Math.max(worst, Math.hypot(out[i * 2] - p.pts[i * 2 + 2], out[i * 2 + 1] - p.pts[i * 2 + 3]));
  return { bend, worst, done: p.done, min: Math.hypot(s.x - o.x, s.y - o.y) };
});
check(pv.done && pv.bend > 25, `the preview bends round a ship lying on the course (${Math.round(pv.bend)} units off the line${pv.done ? '' : ', but runs past its horizon'})`, failures);
check(pv.worst < 12, `and she sails the track it drew (worst ${pv.worst.toFixed(1)} units off)`, failures);

// ---------- Letting go: nothing selected ----------
console.log('Nothing selected');
await play({ name: 'Look', wind: 30, player: fleet4, enemy: [hulk(0.5, 0.3)], ai: { dmgMul: 0 } });
await B(() => { const b = window.__broadside; b.settle(); b.step(1); });
const flag = await B(() => { const s = window.__broadside.S.selected; return { x: s.x, y: s.y, id: s.id }; });
await tapMap(flag.x, flag.y, 8);
check(await B(() => window.__broadside.S.selected === null), 'tapping the selected ship lets go of her: nothing is selected', failures);
await redraw();
check(await B(() => window.__broadside.S.hud.actions.length === 0), 'and the action bar goes', failures);
const orders = () => B(() => JSON.stringify(window.__broadside.G.ships.map((s) => [s.path.length, s.order && s.order.kind])));
const o0 = await orders();
const cam0 = await B(() => ({ x: window.__broadside.cam.tx, y: window.__broadside.cam.ty }));
const { cw, ch } = await B(() => window.__broadside.S.view);
await gesture([[{ x: cw * 0.5, y: ch * 0.4 }, { x: cw * 0.5, y: ch * 0.45 }, { x: cw * 0.5, y: ch * 0.55 }, { x: cw * 0.5, y: ch * 0.65 }]]);
const cam1 = await B(() => ({ x: window.__broadside.cam.tx, y: window.__broadside.cam.ty, mode: window.__broadside.cam.mode }));
check(Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y) > 40 && cam1.mode === 'manual', `with nothing selected a one-finger drag pans the view (${Math.round(Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y))} units)`, failures);
check(await orders() === o0, 'and plots no course', failures);
const held = await run((b) => { const c = b.cam, x = c.tx, y = c.ty; b.step(60 * 12); return { moved: Math.hypot(c.tx - x, c.ty - y), mode: c.mode }; });
check(held.mode === 'manual', `the view holds where you left it (still yours after 12 s; drifted ${Math.round(held.moved)} units as the pan coasted out)`, failures);
await gesture([[{ x: cw * 0.3, y: ch * 0.5 }]]);
await page.waitForTimeout(450);
check(await orders() === o0, 'a tap on the sea with nothing selected orders nothing', failures);
const enemy = await B(() => { const e = window.__broadside.G.ships.find((s) => s.team === 'enemy'); return { x: e.x, y: e.y }; });
const named = await B(([x, y]) => { const b = window.__broadside; b.settle(); return b.proj(x, y, 8); }, [enemy.x, enemy.y]);
await gesture([[named]]);
const toast = await B(() => window.__broadside.S.toast && window.__broadside.S.toast.text);
check(/San Nadie/.test(toast || '') && await orders() === o0, `a tap on an enemy names her (“${toast}”) and orders nothing`, failures);
const own = await B(() => { const b = window.__broadside, s = b.G.ships[1]; return { id: s.id, q: b.proj(s.x, s.y, 8), x: s.x, y: s.y }; });
await gesture([[own.q]]);
check(await B((id) => window.__broadside.S.selected && window.__broadside.S.selected.id === id, own.id), 'tapping one of your ships takes command of her again', failures);
const stroke = await B((o) => { const b = window.__broadside, pts = []; for (let i = 0; i <= 6; i++) pts.push(b.proj(o.x - 80 - i * 14, o.y - 120 - i * 24, 0)); return pts; }, own);
await gesture([stroke]);
check(await B((id) => window.__broadside.G.ships.find((s) => s.id === id).path.length >= 3, own.id), 'and a drag plots her course again', failures);

check(page.errors.length === 0, `no page errors (${page.errors.length})`, failures);
if (page.errors.length) console.log(page.errors.slice(0, 5).join('\n'));
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
