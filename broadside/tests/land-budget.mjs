// The land's own draw calls, vertices and triangles per battle (a measuring tool, not part of npm test).
//   npm run build:single && node tests/land-budget.mjs
//   ONLY=tutorial,cove node tests/land-budget.mjs
import { launch, open, save } from './lib.mjs';

const ids = process.env.ONLY ? process.env.ONLY.split(',') : ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro', 'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada', 'tangier', 'gibraltar', 'sale', 'bougie', 'bagnio', 'goletta', 'algiers', 'knights', 'passero', 'tripoli', 'zante', 'navarino', 'candia', 'dia', 'narrows', 'kapudan'];
const browser = await launch();
const page = await open(browser, { save: save() });
page.on('console', (m) => { if (m.type() === 'warning' && /^TIMING/.test(m.text())) console.log(m.text()); });
const rows = await page.evaluate((ids) => {
  const b = window.__broadside, R = window.__broadsideR, out = [];
  let maxV = 0, maxC = 0, sumV = 0, sumT = 0;
  for (const id of ids) {
    const t0 = performance.now();
    b.startBattle(id); b.step(2);
    const ms = Math.round(performance.now() - t0);
    const land = R.scene.children.find((o) => o.userData.land);
    let verts = 0, calls = 0, tris = 0;
    land.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      calls++;
      const g = o.geometry, k = o.isInstancedMesh ? Math.max(1, o.count) : 1;
      verts += g.attributes.position.count * k;
      tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * k;
    });
    maxV = Math.max(maxV, verts); maxC = Math.max(maxC, calls); sumV += verts; sumT += tris;
    const P = R.debug.landLife && R.debug.landLife().plants;
    out.push(`${id.padEnd(11)} calls ${calls}  verts ${verts}  tris ${Math.round(tris)}  build ${ms}ms${P ? '  plants ' + JSON.stringify(P) : ''}`);
  }
  out.push(`max calls ${maxC}  max verts ${maxV}  mean verts ${Math.round(sumV / ids.length)}  mean tris ${Math.round(sumT / ids.length)}`);
  return out;
}, ids);
console.log(rows.join('\n'));
if (page.errors.length) console.log(page.errors.slice(0, 5).join('\n'));
await browser.close();
