// Prepares the real product photography for the bento tiles: crops each
// shot tight to the product's own silhouette (the source pack shots carry
// a lot of flat margin, which is what made the tiles read as small
// thumbnails floating in a box), then recolors the flat backdrop to the
// exact brand ivory the card sits on, so photo and card panel are one
// continuous surface instead of two mismatched off-whites.
//
// The recolor is a flood fill from the image border (not a global colour
// threshold), so it only touches pixels connected to the outer backdrop —
// a white patch inside the product art (a label's white band, a bottle's
// highlight) is never mistaken for background. The edge blends colour
// toward the target over a short band while alpha stays fully opaque the
// whole time, which is what avoids the "ghosted" translucent-edge look a
// plain alpha cutout gives.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const IVORY = [247, 244, 239]; // --ivory, the tile-photo panel colour

// Some source exports (Quick Stix) carry a canvas much larger than the shot
// itself, padded with real alpha:0 margin rather than flat colour. Crop to
// the opaque bounding box first so the flood-fill below starts from the
// shot's own backdrop, not from transparent pixels.
function alphaCrop(img) {
  const w = img.width, h = img.height;
  const c = createCanvas(w, h);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = createCanvas(cw, ch);
  out.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

function recolorAndCrop(img, { near = 15, outer = 50, pad = 0.035 } = {}) {
  const w = img.width, h = img.height;
  const c = createCanvas(w, h);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, w, h);
  const px = data.data;
  const corner = [px[0], px[1], px[2]];

  const idx = (x, y) => y * w + x;
  const dist = (i) => {
    const dr = px[i] - corner[0], dg = px[i + 1] - corner[1], db = px[i + 2] - corner[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const visited = new Uint8Array(w * h);
  const distMap = new Float32Array(w * h);
  const stack = [];

  function seed(x, y) {
    const p = idx(x, y);
    if (visited[p]) return;
    const dd = dist(p * 4);
    if (dd <= outer) { visited[p] = 1; distMap[p] = dd; stack.push(p); }
  }
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }

  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    const neigh = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = idx(nx, ny);
      if (visited[np]) continue;
      const dd = dist(np * 4);
      if (dd <= outer) { visited[np] = 1; distMap[np] = dd; stack.push(np); }
    }
  }

  // Recolor background pixels toward the target. Alpha is never touched,
  // so there is no transparency anywhere in the output.
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = idx(x, y);
      if (visited[p]) {
        const dd = distMap[p];
        const t = dd <= near ? 1 : Math.max(0, 1 - (dd - near) / (outer - near));
        const i = p * 4;
        px[i]     = px[i]     * (1 - t) + IVORY[0] * t;
        px[i + 1] = px[i + 1] * (1 - t) + IVORY[1] * t;
        px[i + 2] = px[i + 2] * (1 - t) + IVORY[2] * t;
      } else {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  cx.putImageData(data, 0, 0);

  // Tight crop around the product silhouette, plus a small breathing margin.
  const bw = maxX - minX, bh = maxY - minY;
  const padX = bw * pad, padY = bh * pad;
  const cropX = Math.max(0, Math.floor(minX - padX));
  const cropY = Math.max(0, Math.floor(minY - padY));
  const cropW = Math.min(w, Math.ceil(maxX + padX)) - cropX;
  const cropH = Math.min(h, Math.ceil(maxY + padY)) - cropY;

  const out = createCanvas(cropW, cropH);
  out.getContext('2d').drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

const jobs = [
  ['Social gummies 10m.png', 'assets/product-gummies.png'],
  ['Baked krispies.png',     'assets/product-krispies.png'],
  ['Sherpa thc drink.png',   'assets/product-drinks.png'],
  ['Sherpa wellnes.png',     'assets/product-wellness.png', { outer: 60 }], // cooler, grayer backdrop needs a wider net
  ['Sherpa dog treats.png',  'assets/product-pet.png'],
  ['Sherpa qs.png',          'assets/product-stix.png', { alphaMargin: true }],
];

for (const [src, out, opts] of jobs) {
  let img = await loadImage(src);
  if (opts && opts.alphaMargin) img = alphaCrop(img);
  const canvas = recolorAndCrop(img, opts);
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`${src} -> ${out} (${canvas.width}x${canvas.height})`);
}
