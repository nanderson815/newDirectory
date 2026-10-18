// Steering stress test: every player class sails straight at every island from 8 directions, with a single
// waypoint and with a dense drawn line, and must get past within 40 s. Unreachable targets are skipped.
import { launch, open, check } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser);
const res = await page.evaluate(() => {
  const B = window.__broadside;
  const out = { tried: 0, skipped: 0, stuck: [], slowest: 0 };
  const battles = ['tortuga', 'sanlucas', 'santamarta'];
  for (const id of battles) for (const type of ['sloop', 'frigate', 'manowar']) for (const dense of [false, true]) {
    B.startBattle(id);
    const n = B.G.islands.length;
    for (let ii = 0; ii < n; ii++) for (let k = 0; k < 8; k++) {
      B.startBattle(id);
      const G = B.G; G.endAt = 1e9; G.goal = 'none';
      for (const s of G.ships) if (s.team === 'enemy') s.state = 'sunk';
      G.forts.forEach((f) => { f.state = 'silenced'; });
      const s = G.ships[0];
      for (const o of G.ships) if (o !== s && o.team === 'player') o.state = 'sunk';
      // Swap in the class under test.
      const T = { sloop: [60, 22, 62, 1.35], frigate: [84, 30, 50, 0.85], manowar: [104, 38, 43, 0.62] }[type];
      [s.L, s.B, s.speed, s.turn] = T;
      const is = G.islands[ii], a = (k / 8) * Math.PI * 2, R = is.r + 150;
      s.x = Math.min(G.W - 25, Math.max(25, is.x + Math.cos(a) * R)); s.y = Math.min(G.H - 25, Math.max(25, is.y + Math.sin(a) * R));
      s.h = Math.atan2(is.y - s.y, is.x - s.x); s.v = s.speed * 0.6;
      const tx = Math.min(G.W - 35, Math.max(35, is.x - Math.cos(a) * R)), ty = Math.min(G.H - 35, Math.max(35, is.y - Math.sin(a) * R));
      const blocked = (x, y) => G.islands.some((j) => Math.hypot(x - j.x, y - j.y) < j.r * 1.05 + s.L * 0.42 + 4);
      if (blocked(tx, ty) || blocked(s.x, s.y)) { out.skipped++; continue; }
      if (dense) { const m = Math.ceil(Math.hypot(tx - s.x, ty - s.y) / 12); s.path = Array.from({ length: m }, (_, i) => ({ x: s.x + (tx - s.x) * (i + 1) / m, y: s.y + (ty - s.y) * (i + 1) / m })); }
      else s.path = [{ x: tx, y: ty }];
      let t = 0;
      for (; t < 40 && s.path.length; t += 1 / 60) B.sim(1);
      out.tried++;
      if (s.path.length || Math.hypot(s.x - tx, s.y - ty) > 70) out.stuck.push({ id, type, dense, island: ii, dir: k, left: Math.round(Math.hypot(s.x - tx, s.y - ty)) });
      out.slowest = Math.max(out.slowest, t);
    }
  }
  return out;
});
console.log(`tried ${res.tried}, skipped ${res.skipped} unreachable, slowest ${res.slowest.toFixed(1)} s`);
for (const s of res.stuck.slice(0, 10)) console.log('  stuck', JSON.stringify(s));
check(res.stuck.length === 0, `no ship gets stuck on an island (${res.stuck.length} stuck)`, failures);
check(page.errors.length === 0, 'no page errors', failures);
await browser.close();
process.exit(failures.length ? 1 : 0);
