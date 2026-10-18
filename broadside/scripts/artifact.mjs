// Turns the single-file build into an artifact page: the host supplies the doctype, <html>, <head>
// and <body> skeleton (with charset and viewport), so those wrappers are stripped and the rest kept.
import fs from 'fs';

const src = fs.readFileSync('dist-single/index.html', 'utf8');
const out = src
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta charset="utf-8">/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();
if (!/^<meta name="theme-color"[^>]*>\s*<title>/.test(out) && !out.slice(0, 600).includes('<title>')) {
  throw new Error('Expected <title> near the top of the artifact page');
}
fs.writeFileSync('dist-single/artifact.html', out + '\n');
console.log(`dist-single/artifact.html: ${(out.length / 1024).toFixed(0)} KB`);
