// Real Google Fonts for screenshot runs. `npm test` blocks fonts.googleapis.com so tests run offline on the
// fallback faces; screenshot scripts that want the real type pass `fonts: true` to open() (lib.mjs), which
// routes the requests here. The CSS and font files are fetched once with curl (it honours the machine's
// proxy) and cached under tests/out/fonts. Any failure just leaves the page on its fallback faces.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'out', 'fonts');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const curl = (url, file) => execFileSync('curl', ['-sS', '-f', '-m', '30', '-A', UA, '-o', file, url]);
const key = (url) => Buffer.from(url).toString('base64url').slice(-60);

// The cached stylesheet for a css2 URL, downloading it and every font file it names on first use.
function cached(url) {
  fs.mkdirSync(DIR, { recursive: true });
  const cssFile = path.join(DIR, key(url) + '.css');
  if (!fs.existsSync(cssFile)) {
    const tmp = cssFile + '.tmp';
    curl(url, tmp);
    for (const m of fs.readFileSync(tmp, 'utf8').matchAll(/url\((https:[^)]+)\)/g)) {
      const f = path.join(DIR, path.basename(m[1]));
      if (!fs.existsSync(f)) curl(m[1], f);
    }
    fs.renameSync(tmp, cssFile);
  }
  return fs.readFileSync(cssFile, 'utf8');
}

export async function routeFonts(target) {
  await target.route('https://fonts.googleapis.com/**', (r) => {
    let body = '';
    try { body = cached(r.request().url()); } catch (e) { /* offline: fallback faces */ }
    r.fulfill({ body, contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await target.route('https://fonts.gstatic.com/**', (r) => {
    const f = path.join(DIR, path.basename(new URL(r.request().url()).pathname));
    if (fs.existsSync(f)) r.fulfill({ path: f, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' } });
    else r.abort();
  });
}
