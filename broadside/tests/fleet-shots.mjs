// Screenshots of the whole fleet under orders, mid-battle, portrait and landscape: sailing a course together
// and engaging one enemy together. For comparing fleet handling before and after a change.
//   npx vite build --mode single && node tests/fleet-shots.mjs shots/fleet/after
import path from 'path';
import fs from 'fs';
import { launch, open, save, ROOT } from './lib.mjs';

const out = path.resolve(ROOT, process.argv[2] || 'tests/out/fleet');
fs.mkdirSync(out, { recursive: true });
const fleet = [
  { name: 'Resolute', cls: 'frigate', up: {} }, { name: 'Swift', cls: 'brig', up: {} },
  { name: 'Kestrel', cls: 'brig', up: {} }, { name: 'Merlin', cls: 'sloop', up: {} },
];
const browser = await launch();
for (const [label, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
  const page = await open(browser, { width, height, save: save({ stars: { tutorial: 3, tortuga: 3, cayman: 3, rojo: 3, sanlucas: 3 }, hired: 1, fleet }) });
  const B = (fn, arg) => page.evaluate(fn, arg);
  const tap = (q) => B((q) => {
    const cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
    const ev = (type) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + q.x, clientY: r.top + q.y }));
    ev('pointerdown'); ev('pointerup');
  }, q);
  for (const kind of ['course', 'engage']) {
    await B(() => { const b = window.__broadside; b.startBattle('silver'); b.step(1); b.settle(); b.step(1); });
    // Enemies hold still well up the chart so the picture is about the fleet.
    await B(() => { const G = window.__broadside.G; for (const s of G.ships) if (s.team === 'enemy') s.v *= 0.5; });
    const fc = await B(() => window.__broadside.S.hud.cards.find((c) => c.fleet));
    if (fc) await page.mouse.click(fc.x + fc.w / 2, fc.y + fc.h / 2);
    if (kind === 'course') {
      const q = await B(() => { const b = window.__broadside, s = b.S.selected, G = b.G; const up = G.land ? [1, 0] : [0, -1]; return b.proj(s.x + up[0] * 380 + (G.land ? 0 : 120), s.y + up[1] * 380 + (G.land ? -120 : 0), 0); });
      await tap(q);
      await B(() => { const b = window.__broadside; for (let i = 0; i < 9; i++) b.step(60); b.settle(); b.step(1); });
    } else {
      await B(() => { const b = window.__broadside; b.step(240); b.settle(); });
      const q = await B(() => { const b = window.__broadside, s = b.S.selected, e = b.G.ships.filter((x) => x.team === 'enemy' && x.state === 'afloat').sort((a, c) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(c.x - s.x, c.y - s.y))[0]; return b.proj(e.x, e.y, 8); });
      await tap(q);
      await B(() => { const b = window.__broadside; for (let i = 0; i < 16; i++) b.step(60); b.settle(); b.step(1); });
    }
    await page.screenshot({ path: path.join(out, `${label}-${kind}.png`), timeout: 240000 });
    console.log(`  ${label}-${kind}.png`);
  }
  await page.context().close();
}
await browser.close();
