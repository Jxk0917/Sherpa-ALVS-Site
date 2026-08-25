// Processes the six real Sleep Gummies pack shots Jack supplied (front and
// back, at each of the three strengths) through the exact same flood-fill
// crop-and-recolor pipeline as gen-gummies-shots.mjs. Kept as its own file
// for the same reason that one is separate from gen-product-shots.mjs: a
// different content shape (per-strength front/back pairs), writing straight
// to src/assets/.
//
// All six source shots share the exact #F3EEE5 backdrop already used across
// the catalog (verified by corner-pixel sample before writing this — same
// value as the Social Gummies shots), so the same FILL thresholds apply
// with no new tuning.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const IVORY = [247, 244, 239]; // --ivory, the panel colour these sit on

function bboxOf(visited, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!visited[y * w + x]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function floodMask(img, { outer }) {
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
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = idx(nx, ny);
      if (visited[np]) continue;
      const dd = dist(np * 4);
      if (dd <= outer) { visited[np] = 1; distMap[np] = dd; stack.push(np); }
    }
  }
  return { w, h, data, px, visited, distMap, bbox: bboxOf(visited, w, h) };
}

function cropBox(bbox, w, h, pad) {
  const bw = bbox.maxX - bbox.minX, bh = bbox.maxY - bbox.minY;
  const padX = bw * pad, padY = bh * pad;
  const cropX = Math.max(0, Math.floor(bbox.minX - padX));
  const cropY = Math.max(0, Math.floor(bbox.minY - padY));
  const cropW = Math.min(w, Math.ceil(bbox.maxX + padX)) - cropX;
  const cropH = Math.min(h, Math.ceil(bbox.maxY + padY)) - cropY;
  return { cropX, cropY, cropW, cropH };
}

function recolorAndCrop(mask, { near, outer, pad = 0.035 }) {
  const { w, h, data, px, visited, distMap } = mask;
  const c = createCanvas(w, h);
  for (let p = 0; p < w * h; p++) {
    if (!visited[p]) continue;
    const dd = distMap[p];
    const t = dd <= near ? 1 : Math.max(0, 1 - (dd - near) / (outer - near));
    const i = p * 4;
    px[i]     = px[i]     * (1 - t) + IVORY[0] * t;
    px[i + 1] = px[i + 1] * (1 - t) + IVORY[1] * t;
    px[i + 2] = px[i + 2] * (1 - t) + IVORY[2] * t;
  }
  c.getContext('2d').putImageData(data, 0, 0);
  const { cropX, cropY, cropW, cropH } = cropBox(mask.bbox, w, h, pad);
  const out = createCanvas(cropW, cropH);
  out.getContext('2d').drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

// Removes the pack's contact shadow on the shoot backdrop, which the flood
// mask cannot reach: the shadow is a ramp, so its pale outer half is inside
// any workable net and its dark core is outside every net that does not also
// start eating the printed berries. gen-gummies-shots.mjs carries the full
// reasoning. Shared verbatim with that file -- keep the two the same, the
// Social and Sleep packs stand side by side in the gummies hero.
const PACK_DIST = 200;
const FEATHER = 3;

function trimContactShadow(px, w, h) {
  const corner = [px[0], px[1], px[2]];
  const isPack = (i) => {
    const dr = px[i] - corner[0], dg = px[i + 1] - corner[1], db = px[i + 2] - corner[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) > PACK_DIST;
  };
  for (let x = 0; x < w; x++) {
    let foot = -1;
    for (let y = h - 1; y >= 0; y--) {
      const p = y * w + x;
      if (px[p * 4 + 3] > 8 && isPack(p * 4)) { foot = y; break; }
    }
    for (let y = foot + 1; y < h; y++) {
      const a = y - foot <= FEATHER ? 1 - (y - foot) / (FEATHER + 1) : 0;
      const p4 = (y * w + x) * 4;
      px[p4 + 3] = Math.min(px[p4 + 3], Math.round(255 * a));
    }
  }
}

// The transparent output, same contract as gen-gummies-shots.mjs: a second
// mask, never the FILL one, plus the geometric shadow trim above. The FILL
// net leaks through a pale pack edge, which is invisible when it only
// recolours near-white to ivory and turns the pack face see-through when it
// drives alpha instead.
function cutoutAndCrop(img, mask, { near, outer, pad = 0.02 }) {
  const { w, h, visited, distMap } = mask;
  const c = createCanvas(w, h);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const out1 = cx.getImageData(0, 0, w, h);
  const opx = out1.data;
  for (let p = 0; p < w * h; p++) {
    if (!visited[p]) continue;
    const dd = distMap[p];
    const t = dd <= near ? 0 : Math.min(1, (dd - near) / (outer - near));
    opx[p * 4 + 3] = Math.round(255 * t);
  }
  trimContactShadow(opx, w, h);
  cx.putImageData(out1, 0, 0);
  const { cropX, cropY, cropW, cropH } = cropBox(mask.bbox, w, h, pad);
  const out = createCanvas(cropW, cropH);
  out.getContext('2d').drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

const FILL = { near: 15, outer: 50 };
// Retuned 2026-08-24 alongside gen-gummies-shots.mjs, which carries the full
// reasoning: the old { near: 2, outer: 10 } left the pack's contact shadow on
// the backdrop as an opaque cream shelf, which is invisible on ivory and reads
// as a grey slab once the cutout is stood on the crimson family hero. These
// two files must keep the same numbers -- the Social and Sleep packs stand
// side by side in that hero, and a shadow on one and not the other is worse
// than a shadow on both. That file also explains why the net is per-source:
// the 10 mg shots come from a much smaller shoot whose pouch outline is too
// thin to stop a wide flood, and the wide net keys their whole pack face
// transparent.
const CUT_TIGHT = { near: 2,   outer: 10 };
const CUT_WIDE  = { near: 100, outer: 140 };

// Third entry, where present, is the transparent cutout — fronts only, for
// the gummies hero, which stands the packs on the crimson field. Fourth is
// the net, verified per source against a crimson proof sheet.
const jobs = [
  ['Sleep Gummies/SG 10mg F.png',  'src/assets/product-sleep-gummies-10-front.png',  'src/assets/cut-sleep-gummies-10-front.png',  CUT_TIGHT],
  ['Sleep Gummies/SG 10mg B.png',  'src/assets/product-sleep-gummies-10-back.png'],
  ['Sleep Gummies/Sg 25mg F.png',  'src/assets/product-sleep-gummies-25-front.png',  'src/assets/cut-sleep-gummies-25-front.png',  CUT_WIDE],
  ['Sleep Gummies/SG 25mg B.png',  'src/assets/product-sleep-gummies-25-back.png'],
  ['Sleep Gummies/SG 100mg F.png', 'src/assets/product-sleep-gummies-100-front.png', 'src/assets/cut-sleep-gummies-100-front.png', CUT_WIDE],
  ['Sleep Gummies/SG 100mg B.png', 'src/assets/product-sleep-gummies-100-back.png'],
];

for (const [src, out, cutOut, cut] of jobs) {
  const img = await loadImage(src);
  const mask = floodMask(img, FILL);
  const opaque = recolorAndCrop(mask, FILL);
  writeFileSync(out, opaque.toBuffer('image/png'));
  console.log(`${src} -> ${out} (${opaque.width}x${opaque.height})`);
  if (!cutOut) continue;
  const cutout = cutoutAndCrop(img, floodMask(img, cut), cut);
  writeFileSync(cutOut, cutout.toBuffer('image/png'));
  console.log(`${src} -> ${cutOut} (${cutout.width}x${cutout.height}, near ${cut.near}/outer ${cut.outer})`);
}
