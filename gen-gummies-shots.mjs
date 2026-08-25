// Processes the six real Social Gummies pack shots Jack supplied (front and
// back, at each of the three strengths) through the same flood-fill crop and
// recolor pipeline gen-product-shots.mjs already established. Kept as its
// own file rather than folded into that one: these are a different content
// shape (per-strength front/back pairs, not one shot per family) and this
// script writes straight to src/assets/, which is the fix the TRAP note in
// memory calls for — gen-product-shots.mjs and friends still target the old
// pre-Eleventy assets/ path and should get the same fix before they are next
// run, but that is out of scope here.
//
// Same two-mask reasoning as gen-product-shots.mjs: recolorAndCrop uses a
// wide net (near/outer) because leaking into a near-white pouch face just
// recolors near-white to ivory, which is invisible. All six shots here sit
// on the exact same flat #F3EEE5 backdrop already used across the catalog
// (verified by corner-pixel sample before writing this), so the defaults
// that already work for the rest of the product photography apply as-is.
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
// mask cannot reach. The flood works on colour distance from the backdrop and
// stops once it hits something too different; the shadow is a RAMP, so its
// pale outer half is inside any workable net and its dark core -- the part
// hugging the pouch -- is outside every net that does not also start eating
// the printed strawberries. Widening past { near: 130, outer: 175 } trades one
// artefact for a worse one.
//
// So the core is removed geometrically instead of by colour. The whole of it
// lies BELOW the pouch, and the pouch's own bottom is a deep crimson or deep
// navy band on every pack in this family -- far past PACK_DIST, which nothing
// in the shadow reaches. Walking each column from the bottom to the first
// genuinely pack-coloured pixel therefore finds the pouch's real foot, and
// everything under it is shadow. Columns with no pack pixel at all (out
// beyond the pouch's widest point) clear completely, which is what takes off
// the wedge that spread to the right.
//
// FEATHER keeps a couple of rows of the pouch's own antialiased edge, so the
// foot does not end in a cut line. The page draws its own contact shadow with
// a CSS drop-shadow and .pack-floor, so nothing of value is lost here.
//
// This is shared verbatim with gen-sleep-gummies-shots.mjs -- keep them the
// same, the two packs stand side by side in the gummies hero.
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

// The transparent output. Same reasoning as gen-product-shots.mjs: the two
// masks must never be merged. A leak through a pale pack edge is invisible in
// the opaque output (near-white recoloured to ivory) and catastrophic in the
// cutout (the pack face goes see-through), so the cutout gets its own net
// against the same mathematically flat backdrop, plus the geometric shadow
// trim above, which colour alone cannot do.
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
// CUT was { near: 2, outer: 10 } until 2026-08-24. That was tuned against an
// IVORY destination, where the only thing the mask had to get right was the
// pouch's own edge -- and it did. What it left behind is the pack's contact
// shadow on the shoot backdrop: a soft cream-grey shelf spreading down and to
// the right of the pouch, fully opaque, invisible on an ivory panel and
// unmissable the moment the same file is stood on the crimson family hero,
// where it reads as a grey slab pasted under the product.
//
// The shelf's colour distance from the backdrop runs to about 116, so a net
// with outer:10 never even reached it. These are the widest thresholds that
// still clear it: measured against every front shot on a crimson proof sheet,
// { near: 130, outer: 175 } starts keying holes out of the pale flesh of the
// printed strawberries, which are near-white and reachable from the border
// through the pouch's own light rim.
//
// THIS IS STILL NOT THE SAME NET AS FILL and the two must not be merged --
// that rule has not changed and this is not it. FILL's job is to recolour
// near-white to ivory, where a leak is invisible; CUT's job is to decide what
// is see-through, where a leak is catastrophic. What changed is only that
// CUT's destination is now dark, so it has to remove the shadow that FILL was
// always simply allowed to swallow.
//
// WHICH SHOTS CAN TAKE THE WIDE NET IS A QUESTION ABOUT RESOLUTION, NOT
// ABOUT HOW DARK THE PACK IS. Every one of these packs has interior pixels
// sitting 2-5 units from the backdrop -- the white pack lettering and the
// white flavour label -- and the only thing keeping the flood out of them is
// the pouch's own dark outline. On the 25 and 100 mg shots (~360x520) that
// outline is several pixels of genuinely dark colour and the wide net stops
// dead at it. On the 10 mg shots (~246x299, a different and much smaller
// shoot) the same outline is one or two antialiased pixels, every one of them
// inside a 140-wide net, so the flood walks straight through the edge and
// keys out the whole pack face. That is the "translucent product" failure in
// the project's notes, reproduced exactly.
//
// So the net is per-source, tight by default and widened only where a crimson
// proof sheet has been rendered and checked. Do not widen a new source without
// rendering that sheet -- and note that Quick Stix's white pouch on a cream
// backdrop is the documented case where even the tight net cannot tell pack
// from ground at all.
const CUT_TIGHT = { near: 2,   outer: 10 };
const CUT_WIDE  = { near: 100, outer: 140 };

// Third entry, where present, is the transparent cutout, and the fourth is
// the net it is cut with. Only the fronts get a cutout: the cutouts exist for
// the gummies hero, which stands the packs on the crimson field, and a hero
// never shows a back label.
// The 25 mg pair is what the hero actually renders. The 100 mg cutouts are
// clean at the wide net and kept for it; the 10 mg shots are the low-res
// shoot described above, so they stay on the tight net and still carry their
// backdrop shadow -- fine where they are (nothing renders them on a dark
// ground), and the reason to check before putting one in a hero.
const jobs = [
  ['Social gummies 10m.png',      'src/assets/product-gummies-10-front.png',  'src/assets/cut-gummies-10-front.png',  CUT_TIGHT],
  ['Social gummies 10m Back.png', 'src/assets/product-gummies-10-back.png'],
  ['SG 25mg Ft.png',              'src/assets/product-gummies-25-front.png',  'src/assets/cut-gummies-25-front.png',  CUT_WIDE],
  ['SG 25mg Bk.png',              'src/assets/product-gummies-25-back.png'],
  ['SG 100mg Ft.png',             'src/assets/product-gummies-100-front.png', 'src/assets/cut-gummies-100-front.png', CUT_WIDE],
  ['Sg 100mg Bk.png',             'src/assets/product-gummies-100-back.png'],
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
