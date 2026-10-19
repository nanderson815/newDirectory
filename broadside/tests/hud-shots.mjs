// Art-direction screenshots of the battle HUD: mid-battle with real action, at three phone sizes (portrait
// 390x844, small 360x740, landscape 844x390), with the real Google Fonts (tests/fonts.mjs). Not part of `npm test`.
// After `npx vite build --mode single`: `node tests/hud-shots.mjs <outDir> [--offline] [--only=a,b] [--sizes=psl]`.
import path from 'path';
import fs from 'fs';
import { launch, open, save, OUT } from './lib.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || path.join(OUT, 'hud');
const fonts = !args.includes('--offline');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const ALL_SIZES = { p: [390, 844], s: [360, 740], l: [844, 390] };
const sizeArg = (args.find((a) => a.startsWith('--sizes=')) || '').slice(8);
const SIZES = Object.fromEntries(Object.entries(ALL_SIZES).filter(([k]) => !sizeArg || sizeArg.includes(k)));
fs.mkdirSync(dir, { recursive: true });

const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro',
  'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const all = save({ gold: 5120, stars: Object.fromEntries(ids.map((id) => [id, 3])), hats: ['cabin'], best: 12,
  tips: ['fleet', 'ammo', 'mine', 'land', 'board', 'fireship', 'mortar', 'exit', 'chest', 'reach', 'protect', 'hunt', 'fog'] });

// [name, battle, seconds of bot play, options]
const SCENES = [
  ['cayman', 'cayman', 22, {}],
  ['kate', 'kate', 18, { manual: true }],
  ['convoy', 'convoy', 14, {}],
  ['wreck', 'wreck', 16, {}],
  ['siege', 'siege', 40, {}],
  ['fog', 'fog', 16, {}],
  ['tip', 'cayman', 4, { tip: true }],
  ['orders', 'kate', 10, { orders: true }],
];
const want = (name) => !only.length || only.includes(name);

const browser = await launch();
const errors = [];
for (const [sz, [width, height]] of Object.entries(SIZES)) {
  const page = await open(browser, { width, height, save: all, fonts });
  await page.evaluate(() => {
    window.__broadside.lockDpr(1); // the 3D sea at 1x so a loaded machine can keep up; the HUD stays at 2x
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => setTimeout(() => raf(cb), 250);
  });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  for (const [name, id, secs, o] of SCENES) {
    if (!want(name)) continue;
    await page.evaluate(([id, secs, o]) => {
      const b = window.__broadside;
      b.setFire(o.manual ? 'manual' : 'auto');
      if (o.tip) b.save.tips = [];
      b.startBattle(id);
      b.step(1);
      for (let t = 0; t < secs; t++) { window.__bot.tick(); b.sim(60); }
      b.step(1); b.sim(60); // the hull bars' damage ghosts drain away
      // Catch a moment with damage numbers in the air.
      for (let i = 0; i < 30 && !b.S.floaters.some((f) => b.S.clock - f.born < 0.4); i++) b.sim(6);
      if (o.manual) { const s = b.S.selected; if (s) s.reload[0] = 0; }
      if (o.orders) { // the whole fleet chosen, the lead ship anchored, a toast over her
        const s = b.S.selected; b.S.selectAll = true;
        if (s) { s.pivot = s.h + 0.8; s.path = []; b.S.toast = { text: 'Anchored', shipId: s.id, until: b.S.clock + 1.2, secs: 1.2 }; }
        b.sim(20);
      }
      b.settle();
      b.step(1);
    }, [id, secs, o]);
    await page.screenshot({ path: path.join(dir, `${name}-${sz}.png`), timeout: 240000 });
  }
  errors.push(...page.errors);
  await page.context().close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
