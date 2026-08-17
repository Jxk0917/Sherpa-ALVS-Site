// Composite "bundle" cover: one of each real product, flat-laid on the
// brand ivory. Run gen-product-shots.mjs first — this script assumes its
// outputs are already cropped tight and recoloured to exact ivory
// (247,244,239), so placement here is a plain, fully-opaque drawImage.
// No cutout/alpha-key step: that was what produced the translucent
// "ghosted" edges in the first pass. Since every source already sits on
// identical, exact-match ivory, direct rectangular placement leaves no
// visible seam on its own.
//
// Three-tier hierarchy, not a grid: two small accessory items behind,
// the seltzer lineup as the hero in the middle (it's the flagship
// product), three pouches fanned across the front, larger and closest
// to the viewer. Six items total, one of every real product line.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const IVORY = '#F7F4EF';
const W = 1000, H = 780;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Flat, exact-match ivory — no vignette. A gradient here would show through
// the gaps between the pasted product rectangles but get blocked exactly at
// each rectangle's edge (since those are opaque and drawn on top), which is
// what was drawing a faint rectangle around every product. Flat avoids it.
ctx.fillStyle = IVORY;
ctx.fillRect(0, 0, W, H);

async function place(path, { cx, bottomY, width, rotateDeg = 0 }) {
  const img = await loadImage(path);
  const h = img.height * (width / img.width);
  ctx.save();
  ctx.translate(cx, bottomY - h / 2);
  ctx.rotate(rotateDeg * Math.PI / 180);
  ctx.drawImage(img, -width / 2, -h / 2, width, h);
  ctx.restore();
}

const S = 'assets/';

// Back tier: the two smaller/accessory formats, set higher and further back.
await place(S+'product-wellness.png', { cx:120, bottomY:395, width:200, rotateDeg:-8 });
await place(S+'product-stix.png',     { cx:895, bottomY:385, width:250, rotateDeg:7  });
// Hero tier: the seltzer lineup, centered and largest.
await place(S+'product-drinks.png',   { cx:500, bottomY:460, width:580, rotateDeg:0  });
// Front tier: three pouches fanned across the bottom, closest and largest.
await place(S+'product-gummies.png',  { cx:250, bottomY:760, width:265, rotateDeg:-8 });
await place(S+'product-pet.png',      { cx:500, bottomY:772, width:265, rotateDeg:0  });
await place(S+'product-krispies.png', { cx:750, bottomY:760, width:265, rotateDeg:8  });

writeFileSync(S+'product-bundle.png', canvas.toBuffer('image/png'));
console.log('saved', S+'product-bundle.png');
