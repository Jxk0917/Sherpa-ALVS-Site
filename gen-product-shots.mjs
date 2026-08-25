// Prepares the real product photography for the bento tiles (and for
// compositions like the bundle showcase and the Basecamp Seltzer plinth).
// Each shot is cropped tight to the product's own silhouette (the source
// pack shots carry a lot of flat margin, which is what made the tiles read
// as small thumbnails floating in a box) and written out twice:
//   assets/product-*.png  opaque, backdrop recoloured to the exact brand
//                          ivory the tile panel sits on, so photo and
//                          panel read as one continuous surface.
//   assets/cut-*.png      true alpha cutout, backdrop transparent, for
//                          any composition where the product needs to
//                          overlap something else or sit on a non-ivory
//                          ground (a flat ivory rectangle would show as a
//                          visible box the moment it's placed on crimson
//                          or overlapped with a neighbour).
//
// Both masks are flood fills from the image border (not a global colour
// threshold), so they only touch pixels connected to the outer backdrop.
//
// THE TWO OUTPUTS DELIBERATELY USE DIFFERENT THRESHOLDS, and folding them
// back onto one shared mask is exactly the bug this file was rewritten to
// fix. They want opposite things from an ambiguous pixel:
//   - The opaque output recolours background to ivory. If the flood leaks
//     through a pouch's white edge into its white face, nothing visible
//     happens: near-white becomes ivory. So it can afford a wide net
//     (outer 50/60) that swallows the whole soft contact shadow and leaves
//     no off-ivory halo on the tile panel.
//   - The cutout output turns background into ALPHA. That same leak
//     punches a hole straight through the product: Social Gummies and Dawg
//     Snax went see-through across their entire pouch face, and the seltzer
//     can lost its silver top and white base band, because those sit only
//     ~20-50 away from the backdrop colour, i.e. inside the wide net.
// Every source here is shot on a mathematically flat backdrop (all four
// corners identical, zero variance across the border rows; Wellness is the
// one near-flat exception at +-4), so the cutout can key on a very tight
// threshold instead. At outer 10 the nearest product pixel is still well
// outside the net, which is what makes the cutouts fully opaque.
//
// The price of a tight threshold is that a soft contact shadow no longer
// gets swallowed: it survives as opaque near-backdrop pixels. For six of
// the seven shots that is what we want, because their shadows are slight
// and the bundle showcase floor is painted the source backdrop colour so
// they composite seamlessly. Wellness is the exception -- the one product
// shot on a mid-grey backdrop, with a real cast shadow thrown to its
// lower right that would read as a grey smudge anywhere else -- so it
// opts into the `shadowStrong` pass below.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const IVORY = [247, 244, 239]; // --ivory, the tile-photo panel colour

// Some source exports (Quick Stix) carry a canvas much larger than the shot
// itself, padded with real alpha:0 margin rather than flat colour. Crop to
// the opaque bounding box first so the flood-fill below starts from the
// shot's own backdrop, not from transparent pixels.
//
// The alpha threshold has to be near-opaque, not merely non-zero. The
// boundary between the transparent margin and the shot is antialiased, so
// a low bar like alpha>8 keeps a rim of barely-there pixels whose RGB is
// still the transparent black underneath. floodMask then samples pixel 0,0
// as its backdrop reference, reads that near-black rim instead of the
// shot's ivory, finds nothing else in the image anywhere near black, and
// keys nothing at all -- which is why cut-stix.png used to come out with
// its whole backdrop rectangle intact and had to be worked around in the
// bundle composite rather than fixed.
const ALPHA_SOLID = 200;

function alphaCrop(img) {
  const w = img.width, h = img.height;
  const c = createCanvas(w, h);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] >= ALPHA_SOLID) {
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

// Cuts a rectangle out of the source before any keying happens, for the
// one shot whose backdrop carries a feature no colour threshold can
// separate. Wellness is lit from the left onto a mid-grey sweep, throwing
// a hard cast shadow into the empty right-hand third of the frame. Scanned
// column by column, the product occupies x 43-251 and nothing but that
// shadow lives beyond x 252 -- but the shadow's core reaches 91 away from
// the backdrop colour while the carton's own cream face is only 93 away,
// so a threshold that dissolves the shadow eats the product two units
// later. Two units is not a margin. Cropping the empty band off first
// removes the shadow geometrically instead, and costs nothing, because
// there is no product in it to lose.
function preCropRect(img, [x0, y0, x1, y1]) {
  const cw = x1 - x0, ch = y1 - y0;
  const out = createCanvas(cw, ch);
  out.getContext('2d').drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}

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

// Flood-fills the backdrop inward from the border and returns which pixels
// it reached, how far each one sits from the reference backdrop colour, and
// the tight bounding box of everything it did not reach. Called twice per
// product with different thresholds -- see the header for why.
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
    const neigh = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = idx(nx, ny);
      if (visited[np]) continue;
      const dd = dist(np * 4);
      if (dd <= outer) { visited[np] = 1; distMap[np] = dd; stack.push(np); }
    }
  }
  return { w, h, data, px, corner, visited, distMap, bbox: bboxOf(visited, w, h) };
}

// Second pass for the one shot with a real cast shadow on a mid-grey
// backdrop (Wellness). Continues the flood inward from where the tight
// threshold stopped, now admitting anything within `shadowStrong` of the
// backdrop colour and blocked by anything beyond it. A cast shadow is just
// the backdrop darkened, so it stays inside that net the whole way; the
// product does not -- its cream carton sits ~83 out and its black bottle
// ~300 -- so the flood dissolves the shadow and stops dead at the product
// edge. This only holds where every product colour clears `shadowStrong`
// by a margin, which is why it is opt-in per job rather than the default:
// on the ivory-backdrop shots a white pouch face is only ~22 out, and the
// same pass would eat straight through it.
function dissolveShadow(mask, shadowStrong) {
  const { w, h, px, corner, visited, distMap } = mask;
  const dist = (i) => {
    const dr = px[i] - corner[0], dg = px[i + 1] - corner[1], db = px[i + 2] - corner[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const stack = [];
  for (let p = 0; p < w * h; p++) if (visited[p]) stack.push(p);
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (visited[np]) continue;
      const dd = dist(np * 4);
      if (dd <= shadowStrong) { visited[np] = 1; distMap[np] = dd; stack.push(np); }
    }
  }
  mask.bbox = bboxOf(visited, w, h);
}

// Clears the cutout below a can's base, for a product that has to stand on
// a colour other than the one it was shot on.
//
// The seltzer's contact shadow cannot be keyed by colour from either
// direction. Its outer reaches sit ~60 from the backdrop while the can's
// own silver base band sits ~50, so a flood wide enough to swallow the
// shadow first eats an eight-pixel rim off the whole can; and the shadow's
// pale inner area sits ~22, inside the tight net, yet survives because the
// darker ring around it walls the flood out. It reads as nothing at all on
// the ivory it was shot against, and as a white halo the moment the can is
// put on crimson.
//
// The can's real silhouette is a cylinder closed by its dark base rim, so
// the boundary is geometry rather than colour: straight sides at
// cx +- halfW, and a bottom edge that sags to yMax at the centre and lifts
// by `drop` toward each side. `power` shapes that arc -- 4 tracks the
// measured rim closely, where a plain ellipse fitted the middle and left
// shadow behind at the corners. Coordinates are the source image's, since
// that is where the rim was measured, and the crop happens after.
function trimBase(mask, { cx, halfW, yMax, drop, power }) {
  const { w, h, visited, distMap } = mask;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, Math.abs(x - cx) / halfW);
      const edge = yMax - drop * Math.pow(t, power);
      if (Math.abs(x - cx) > halfW || y > edge) {
        const p = y * w + x;
        visited[p] = 1;
        distMap[p] = 0; // fully transparent, not a ramped edge pixel
      }
    }
  }
  mask.bbox = bboxOf(visited, w, h);
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

// Opaque output: background recoloured to the exact ivory the tile panel
// sits on, alpha untouched throughout. This is what avoids the "ghosted"
// translucent edge a plain alpha cutout gives, and it's what the bento
// tiles use -- the photo and the panel read as one continuous surface.
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

// True alpha cutout, built on the tight mask. Pixels the flood reached go
// transparent, ramped across the near->outer band so the edge keeps the
// source's own antialiasing instead of stair-stepping; everything else
// stays fully opaque and travels with the product.
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
  cx.putImageData(out1, 0, 0);
  const { cropX, cropY, cropW, cropH } = cropBox(mask.bbox, w, h, pad);
  const out = createCanvas(cropW, cropH);
  out.getContext('2d').drawImage(c, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

// fill = wide net, feeds the opaque bento-tile output.
// cut  = tight net, feeds the transparent output. See the header.
const FILL = { near: 15, outer: 50 };
const CUT  = { near: 2,  outer: 10 };

const jobs = [
  ['Social gummies 10m.png', 'assets/product-gummies.png',  'assets/cut-gummies.png'],
  ['Baked krispies.png',     'assets/product-krispies.png', 'assets/cut-krispies.png'],
  ['Sherpa thc drink.png',   'assets/product-drinks.png',   'assets/cut-drinks.png'],
  // Cooler, slightly graded grey backdrop rather than the flat ivory the
  // rest share: the wide net needs to reach further, the tight net needs a
  // little headroom over the backdrop's own +-4 drift, and this is the one
  // shot whose cast shadow has to be dissolved rather than kept.
  ['Sherpa wellnes.png',     'assets/product-wellness.png', 'assets/cut-wellness.png',
    { fill: { near: 18, outer: 60 }, cut: { near: 6, outer: 20 },
      shadowStrong: 76, preCrop: [8, 4, 253, 356] }],
  ['Sherpa dog treats.png',  'assets/product-pet.png',      'assets/cut-pet.png'],
  ['Sherpa qs.png',          'assets/product-stix.png',     'assets/cut-stix.png', { alphaMargin: true }],
  // The plinth stands this can on flat crimson, so unlike the six that go
  // into the ivory-floored showcase it cannot keep its baked contact
  // shadow -- near-ivory pixels read as a pale smudge on that ground. Its
  // shadow is faint enough to dissolve on the ivory backdrop shots' one
  // safe margin: the can's own white base band sits ~34 out, so 24 clears
  // the shadow without biting into the can. (Verified by sweep: at 34 the
  // base band starts eroding.) CSS then casts a fresh drop-shadow that
  // actually matches the card's lighting.
  ['Seltzer WM.png',         'assets/product-seltzer-wm.png', 'assets/cut-seltzer-wm.png',
    { shadowStrong: 24, baseTrim: { cx: 150, halfW: 85, yMax: 474, drop: 44, power: 5.4 } }],
];

for (const [src, out, cutOut, opts = {}] of jobs) {
  let img = await loadImage(src);
  if (opts.alphaMargin) img = alphaCrop(img);
  if (opts.preCrop) img = preCropRect(img, opts.preCrop);

  const fill = { ...FILL, ...(opts.fill || {}) };
  const cut  = { ...CUT,  ...(opts.cut  || {}) };

  const fillMask = floodMask(img, fill);
  const opaque = recolorAndCrop(fillMask, fill);
  writeFileSync(out, opaque.toBuffer('image/png'));
  console.log(`${src} -> ${out} (${opaque.width}x${opaque.height})`);

  const cutMask = floodMask(img, cut);
  if (opts.shadowStrong) dissolveShadow(cutMask, opts.shadowStrong);
  if (opts.baseTrim) trimBase(cutMask, opts.baseTrim);
  const cutout = cutoutAndCrop(img, cutMask, cut);
  writeFileSync(cutOut, cutout.toBuffer('image/png'));
  console.log(`${src} -> ${cutOut} (${cutout.width}x${cutout.height})`);
}
