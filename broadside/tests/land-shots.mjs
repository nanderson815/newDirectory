// Screenshots of the land, zoomed out (the director's framing) and zoomed in on a landmark, portrait and
// landscape. Not part of npm test.
//   npm run build:single && node tests/land-shots.mjs                 # every battle
//   ONLY=tutorial,rojo OUT=/tmp/shots node tests/land-shots.mjs       # some, somewhere else
import fs from 'fs';
import path from 'path';
import { launch, open, save, ROOT } from './lib.mjs';

const OUT = process.env.OUT || path.join(ROOT, 'shots', 'land');
fs.mkdirSync(OUT, { recursive: true });
const ALL = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro', 'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const ids = process.env.ONLY ? process.env.ONLY.split(',') : ALL;
const views = (process.env.VIEWS || 'portrait,landscape').split(',');
const zooms = (process.env.ZOOMS || 'out,mid,in').split(',');

const browser = await launch();
for (const view of views) {
  const [width, height] = view === 'portrait' ? [390, 844] : [844, 390];
  const page = await open(browser, { width, height, save: save() });
  for (const id of ids) {
    for (const zoom of zooms) {
      const info = await page.evaluate(([id, zoom, focus]) => {
        const B = window.__broadside;
        B.startBattle(id);
        B.step(90);
        B.settle();
        const G = B.G, cam = B.cam;
        cam.mode = 'manual'; cam.idle = 0;
        if (zoom === 'out') { cam.tx = G.W / 2; cam.ty = G.H / 2; cam.d = cam.dMax; }
        else {
          // Close in on the landmark named by FOCUS (a kind), else the first town, else the first landmark.
          const L = G.landmarks || [];
          const o = L.find((q) => q.kind === focus) || L.find((q) => q.kind === 'town') || L[0] || G.islands[0];
          cam.tx = o.x; cam.ty = o.y; cam.d = zoom === 'in' ? cam.dMin * 0.85 : cam.dComfort;
        }
        B.step(40);
        return { calls: B.drawCalls, d: Math.round(cam.d), landmarks: (G.landmarks || []).length };
      }, [id, zoom, process.env.FOCUS || '']);
      const file = path.join(OUT, `${id}-${view}-${zoom}.png`);
      await page.screenshot({ path: file, timeout: 240000 });
      console.log(`${file}  calls ${info.calls}  d ${info.d}  landmarks ${info.landmarks}  ${page.errors.length ? page.errors.slice(-2).join(' | ') : ''}`);
    }
  }
  await page.context().close();
}
await browser.close();
