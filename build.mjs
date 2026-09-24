// Converts the canvas design files (*.dc.html) into standalone pages.
// Usage: node build.mjs <folder containing *.dc.html>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (!src) { console.error('usage: node build.mjs <src dir>'); process.exit(1); }

for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.dc.html'))) {
  let html = fs.readFileSync(path.join(src, f), 'utf8');
  html = html.replace('<script src="./support.js"></script>',
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n<script src="dc-shim.js"></script>\n<style>x-dc,helmet,sc-for,sc-if{display:contents}</style>');
  html = html.replace(/href="([A-Za-z0-9_-]+)\.dc\.html/g, 'href="$1.html');
  const name = f.replace('.dc.html', '.html');
  fs.writeFileSync(path.join(out, name), html);
  console.log('built', name);
}
