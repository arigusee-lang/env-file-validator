import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

// Rasterizes public/og-image.svg into a 1200x630 PNG.
// Social platforms (Twitter/X, Facebook, LinkedIn, Slack, Discord) do not
// render SVG link previews, so we ship a PNG as the og:image/twitter:image.
// Re-run with `npm run og-image` after editing the SVG.

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = path.join(rootDir, 'public', 'og-image.svg');
const pngPath = path.join(rootDir, 'public', 'og-image.png');

const svg = await fs.readFile(svgPath, 'utf8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true },
});

const png = resvg.render().asPng();
await fs.writeFile(pngPath, png);

console.log(`Wrote ${path.relative(rootDir, pngPath)} (${png.length} bytes)`);
