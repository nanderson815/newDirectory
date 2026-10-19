// Screenshots of the HUD style kit demo (tests/kit/), served by a Vite dev server, at DPR 2 and 3, with the
// real fonts (and once offline, on the fallback faces). Not part of `npm test`.
// `node tests/kit-shot.mjs [outDir]` (default tests/out/kit).
import path from 'path';
import fs from 'fs';
import { createServer } from 'vite';
import { launch, ROOT, OUT } from './lib.mjs';
import { routeFonts } from './fonts.mjs';

const dir = process.argv[2] || path.join(OUT, 'kit');
fs.mkdirSync(dir, { recursive: true });
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/tests/kit/index.html`;
const browser = await launch();
const errors = [];
for (const [name, dpr, fonts] of [['kit-dpr2', 2, true], ['kit-dpr3', 3, true], ['kit-offline', 2, false]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1180 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  if (fonts) await routeFonts(page);
  else await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(url);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 });
  await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 240000 });
  await ctx.close();
}
await browser.close();
await server.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
