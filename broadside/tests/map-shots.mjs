// Screenshots of every battle's map, portrait: the whole sea zoomed out (overview) and the director's mid zoom on
// the signature spot, plus a contact sheet of all the overviews side by side. Not part of npm test.
//   npm run build:single && node tests/map-shots.mjs                 # into shots/maps
//   ONLY=tortuga,cove OUT=/tmp/maps node tests/map-shots.mjs
import fs from 'fs';
import path from 'path';
import { launch, open, save, ROOT } from './lib.mjs';

const OUT = process.env.OUT || path.join(ROOT, 'shots', 'maps');
fs.mkdirSync(OUT, { recursive: true });
const ALL = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro', 'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const ids = process.env.ONLY ? process.env.ONLY.split(',') : ALL;
// Where the mid shot looks: the feature that makes the map (portrait fractions).
const FOCUS = {
  tutorial: [0.45, 0.62], tortuga: [0.45, 0.45], cayman: [0.5, 0.5], rojo: [0.55, 0.42], sanlucas: [0.5, 0.32],
  silver: [0.6, 0.45], comodoro: [0.47, 0.4], cartagena: [0.6, 0.3], santamarta: [0.45, 0.42], oro: [0.45, 0.45],
  cove: [0.55, 0.33], wreck: [0.5, 0.4], kate: [0.5, 0.42], convoy: [0.5, 0.45], siege: [0.55, 0.62],
  hierro: [0.5, 0.42], fog: [0.6, 0.66], blockade: [0.5, 0.3], armada: [0.45, 0.25],
};

const browser = await launch();
const page = await open(browser, { width: 390, height: 844, save: save() });
const files = [];
for (const id of ids) {
  for (const zoom of ['overview', 'mid']) {
    const info = await page.evaluate(([id, zoom, f]) => {
      const B = window.__broadside;
      B.S.muted = true;
      B.startBattle(id);
      B.step(60);
      B.settle();
      const G = B.G, cam = B.cam;
      cam.mode = 'manual'; cam.idle = 0;
      if (zoom === 'overview') {
        // Pull back past the game's own limit so the whole sea fits the phone.
        cam.dMax = Math.max(cam.dMax, Math.max(G.W, G.H) * 2.2);
        cam.tx = G.W / 2; cam.ty = G.H / 2; cam.d = cam.dMax;
      } else {
        const [x, y] = G.land ? [(1 - f[1]) * G.W, f[0] * G.H] : [f[0] * G.W, f[1] * G.H];
        cam.tx = x; cam.ty = y; cam.d = cam.dComfort * 1.15;
      }
      B.step(30);
      return { W: G.W, H: G.H, calls: B.drawCalls };
    }, [id, zoom, FOCUS[id] || [0.5, 0.5]]);
    const file = path.join(OUT, `${id}-${zoom}.png`);
    await page.screenshot({ path: file, timeout: 240000 });
    files.push(file);
    console.log(`${file}  ${info.W}x${info.H}  calls ${info.calls}${page.errors.length ? '  ' + page.errors.slice(-1)[0] : ''}`);
  }
}
await page.context().close();

// A contact sheet: every overview side by side (and every mid under it), to see that no two look alike.
if (!process.env.ONLY) {
  const sheet = await browser.newPage({ viewport: { width: 1900, height: 1240 } });
  const tile = (z) => ids.map((id) => `<figure><img src="file://${path.join(OUT, `${id}-${z}.png`)}"><figcaption>${id}</figcaption></figure>`).join('');
  await sheet.setContent(`<style>body{margin:0;background:#1b2529;font:12px sans-serif;color:#efe5cf}div{display:flex;flex-wrap:nowrap}
    figure{margin:2px;width:98px}img{width:98px}figcaption{text-align:center}</style><div>${tile('overview')}</div><div>${tile('mid')}</div>`);
  await sheet.waitForTimeout(500);
  await sheet.screenshot({ path: path.join(OUT, 'contact-sheet.png'), fullPage: true });
  console.log(path.join(OUT, 'contact-sheet.png'));
}
await browser.close();
