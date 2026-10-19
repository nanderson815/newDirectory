// Draw calls and vertex counts per battle, portrait and landscape (a measuring tool, not part of npm test).
//   npm run build:single && node tests/land-stats.mjs
import { launch, open, save } from './lib.mjs';

const browser = await launch();
const out = [];
for (const [w, h] of [[390, 844], [844, 390]]) {
  const page = await open(browser, { width: w, height: h, save: save() });
  const res = await page.evaluate(() => {
    const B = window.__broadside, R = window.__broadsideR;
    const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro', 'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
    const rows = [];
    for (const id of ids) {
      B.startBattle(id); B.step(30); B.settle();
      let verts = 0, meshes = 0;
      R.scene.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry.attributes.position) return;
        meshes++;
        verts += o.geometry.attributes.position.count * (o.isInstancedMesh ? o.count : 1);
      });
      B.step(1);
      rows.push([id, 'calls ' + B.drawCalls, 'meshes ' + meshes, 'verts ' + verts, 'tris ' + R.renderer.info.render.triangles]);
    }
    return rows;
  });
  out.push(`${w}x${h}`);
  for (const r of res) out.push(r.join('\t'));
  await page.context().close();
}
console.log(out.join('\n'));
await browser.close();
