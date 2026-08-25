// Renders every transparent pack cutout onto the crimson field, side by side,
// so a cutout can be judged against the ground it will actually stand on.
//
// This exists because a cutout that looks perfect on an ivory page can be
// visibly broken on crimson and vice versa, and both failures have shipped
// here. On ivory, the pack's contact shadow on the shoot backdrop survives the
// mask as an opaque cream shelf and nobody can see it; on crimson it reads as
// a grey slab pasted under the product. Widening the net to clear that shelf
// then keys the whole pack face transparent on any shot whose pouch outline is
// too thin to stop the flood -- which is a question of the shoot's resolution,
// not of how dark the pack is.
//
// So: after changing any CUT threshold in gen-gummies-shots.mjs or
// gen-sleep-gummies-shots.mjs, run this and look at the sheet. A good cutout
// has no light halo at its foot and no holes punched through the printed
// artwork.
//
// Usage: node proof-cutouts.mjs [out.png]
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const CRIMSON = '#6A1529';
const files = [
  'cut-gummies-10-front.png', 'cut-gummies-25-front.png', 'cut-gummies-100-front.png',
  'cut-sleep-gummies-10-front.png', 'cut-sleep-gummies-25-front.png', 'cut-sleep-gummies-100-front.png',
];

const out = process.argv[2] || '../temporary screenshots/cutout-proof.png';
const imgs = await Promise.all(files.map(f => loadImage('src/assets/' + f)));

const CELL = 560, PAD = 24;
const sheet = createCanvas((CELL + PAD) * files.length + PAD, CELL + 60);
const ctx = sheet.getContext('2d');
ctx.fillStyle = CRIMSON;
ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.imageSmoothingQuality = 'high';

imgs.forEach((img, i) => {
  const scale = CELL / img.height;
  const w = img.width * scale;
  const x = PAD + i * (CELL + PAD);
  ctx.drawImage(img, x + (CELL - w) / 2, 40, w, CELL);
  ctx.fillStyle = '#F7F4EF';
  ctx.font = '20px sans-serif';
  ctx.fillText(files[i].replace('cut-', '').replace('-front.png', ''), x, 28);
  ctx.fillStyle = CRIMSON;
});

writeFileSync(out, sheet.toBuffer('image/png'));
console.log(`${files.length} cutouts on crimson -> ${out}`);
