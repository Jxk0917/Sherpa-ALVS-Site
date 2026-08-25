// Prepares the Basecamp Seltzer plinth's background plate from the source
// photograph. The source is a 6936x9248 / 14.5 MB portrait JPEG straight
// off a camera -- roughly sixty times the pixels the card can display and
// far too heavy to put on a landing page, so it is never referenced
// directly; this writes src/assets/plinth-peak.jpg instead.
//
// Crop: the source is 3:4 portrait and the card is landscape at every
// breakpoint (1.09 on mobile through 1.63 on tablet), so most of the frame
// has to go. The window below keeps the summit horizontally centred and
// sits it about a third of the way down: the peak's mass reads as a soft
// light form up the middle, behind the can, with the darker sky falling
// away to either side.
//
// ── THE BLUR IS BAKED IN HERE, NOT APPLIED IN CSS (2026-08-24) ───────
// Jack's ask: the photograph was competing with the can. Three earlier
// attempts at this lived in the stylesheet as a `filter:blur()` on
// .plinth-scene and all three came out; the notes on those are kept in
// styles.css. Doing it at generation time instead fixes the two problems
// that were structural rather than aesthetic:
//   - a CSS blur needs the element to bleed past its frame (inset:-6%)
//     so the filter has real pixels to sample at the edges, which crops
//     the picture for nothing. Baked, the bleed is PAD below and gets
//     thrown away before the file is written.
//   - a large-radius filter on a background-size:cover element is
//     repainted by the compositor on every resize. A JPEG costs nothing.
//
// The ramp is an INVERTED spotlight: heaviest blur in the middle, where
// the can stands, easing to a light blur at the frame's edges. That is
// the opposite of a normal spotlight and it is deliberate -- a sharp
// centre inside a soft surround reads as a photo pasted into the card and
// draws the eye off the product, which is the exact failure Jack is asking
// to fix. A uniform blur solves that too but flattens the peak to mush;
// keeping some structure at the edges lets the mountain still read as a
// mountain in the corners, where nothing overlaps it.
//
// Blur radii are declared in CSS pixels against the card's real rendered
// width and converted to plate pixels below, so re-tuning them does not
// mean re-deriving the scale factor by hand.
//
// Output is 1000x769 (1.3:1, between the card's widest and narrowest
// aspect so `cover` never has to crop hard in either direction) at
// quality .82. This is smaller than the 1240x954 it replaced: the old
// plate was sized to keep the frame's edge detail alive under a
// sharp-edged treatment, and nothing on the plate is sharp any more.
//
// THE PLATE KEEPS ITS OWN COLOUR, and no brand colour is put on it here or
// in the CSS. An earlier version baked a crimson duotone in at this step,
// because the first attempt at tinting the card had laid a crimson scrim
// over the full-colour photo and turned the whole thing mauve -- the
// image's largest area is deep blue sky, and blue under a crimson wash is
// violet. The duotone dodged that by discarding the blue entirely, but it
// made the card read as a red picture rather than as a mountain. A later
// attempt kept the photo and put crimson in a glow around the frame's edge
// instead; that went violet in the corners for exactly the same reason,
// and was dropped too.
// So the only adjustments made here are tonal -- a contrast curve, because
// the source is a flat high-altitude exposure, and a centre weight under
// the can -- both applied identically to all three channels so they shape
// tone without pulling hue anywhere.
import { createCanvas, createImageData, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const SRC = 'Mountain Background.jpg';
const OUT = 'src/assets/plinth-peak.jpg';

// Source-pixel crop window, measured against the summit at (3668, 2601).
const CROP = { x: 938, y: 1257, w: 5460, h: 4200 };
const W = 1000, H = 769;

// The card's rendered width at the desktop breakpoint, measured off the
// live page. Blur radii are authored against this so they mean what they
// say on screen rather than in plate pixels.
const CARD_CSS_W = 560;
const SCALE = W / CARD_CSS_W;

// Inverted spotlight. EDGE is what survives in the corners; CORE is what
// sits behind the can. Both in CSS pixels.
const BLUR_EDGE = 5;
const BLUR_CORE = 17;

// Where the can stands, as a fraction of the plate. Horizontally centred;
// vertically a little below centre, because the can is bottom-aligned in
// the card and its label -- the part that has to stay legible -- sits in
// the lower half.
const CORE = { x: 0.5, y: 0.56, rx: 0.62, ry: 0.7 };

// Tone curve. `CONTRAST` is how far each channel is pushed toward a
// smoothstep S-curve, and `LIFT` darkens the whole plate a little, because
// the can standing in front of this carries an ivory base band and a white
// wordmark and has to stay the brightest thing on the card.
// LIFT is lower than it was before the blur went in: blurring averages the
// picture's darks up into its lights, so the same curve came out brighter
// than it used to and the can's white base band lost separation from the
// snow behind it. Same curve on R, G and B, so tone moves and hue does not.
const CONTRAST = 0.45;
const LIFT = 0.86;

// Saturation, pulled slightly below 1. The plate's largest area is deep
// blue sky and the can in front of it is a saturated forest green; at full
// strength the two read as two foreground colours competing rather than a
// product standing on a ground. This is a SATURATION move, not a hue one --
// the channels are pulled toward their own luma, so nothing rotates around
// the wheel. That distinction matters here: every previous attempt to put
// colour on this plate went violet, because crimson over blue is violet.
const SATURATION = 0.88;

// A second, softer darkening laid only over the core, so the ivory can has
// a deliberately quiet ground to stand against while the corners keep the
// brightness that makes the plate read as daylight. Neutral, not crimson.
const CORE_SHADE = 0.2;

// Bleed. The blur samples past every edge of the finished frame, so the
// crop is drawn oversize and the margin is discarded. Sized off the
// heaviest radius, which is the only one that can reach this far.
const PAD = Math.ceil(BLUR_CORE * SCALE * 2.5);

function buildLut() {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const s = t * t * (3 - 2 * t);
    lut[i] = Math.round(255 * Math.min(1, (t * (1 - CONTRAST) + s * CONTRAST) * LIFT));
  }
  return lut;
}

// ── Gaussian blur ───────────────────────────────────────────────────
// Hand-rolled, and it has to be. node-canvas 3.2.3 ACCEPTS `ctx.filter =
// 'blur(20px)'` -- it round-trips the string and throws nothing -- but it
// never applies it: draw a black square through it and the edge is still a
// hard 255->0 step with no ramp at all. Verify with a pixel profile, not by
// looking at the output, if this is ever revisited.
//
// Three successive box blurs approximate a Gaussian closely enough that
// nothing survives the JPEG quantiser afterwards, and box blur is O(1) per
// pixel per pass regardless of radius, which matters here because the core
// radius is ~30 plate px. Box sizes come from Kutskir's standard
// derivation for n boxes at a given sigma.
function boxSizes(sigma, n) {
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

// One separable box pass over a single channel offset. Accumulates a
// running sum across the row/column so the cost does not grow with radius;
// edges clamp to the first and last sample.
function boxPass(src, dst, w, h, r, horizontal) {
  const outer = horizontal ? h : w;
  const inner = horizontal ? w : h;
  const step = horizontal ? 4 : w * 4;
  const jump = horizontal ? w * 4 : 4;
  const norm = 1 / (r + r + 1);
  for (let o = 0; o < outer; o++) {
    const base = o * jump;
    for (let ch = 0; ch < 3; ch++) {
      let acc = src[base + ch] * (r + 1);
      for (let i = 0; i < r; i++) acc += src[base + Math.min(i, inner - 1) * step + ch];
      for (let i = 0; i < inner; i++) {
        acc += src[base + Math.min(i + r, inner - 1) * step + ch];
        acc -= src[base + Math.max(i - r - 1, 0) * step + ch];
        dst[base + i * step + ch] = acc * norm;
      }
    }
  }
}

function gaussBlur(px, w, h, sigma) {
  if (sigma <= 0) return px;
  let src = Float32Array.from(px);
  let dst = new Float32Array(px.length);
  for (const size of boxSizes(sigma, 3)) {
    const r = (size - 1) / 2;
    boxPass(src, dst, w, h, r, true);
    boxPass(dst, src, w, h, r, false);
  }
  const out = new Uint8ClampedArray(px.length);
  for (let i = 0; i < px.length; i += 4) {
    out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; out[i + 3] = 255;
  }
  return out;
}

// Blurs the oversized plate by `cssRadius` and returns a W x H canvas with
// the bleed already trimmed off.
function blurred(wideFrame, wideW, wideH, cssRadius) {
  const blurredPx = gaussBlur(wideFrame, wideW, wideH, cssRadius * SCALE);
  const full = createCanvas(wideW, wideH);
  full.getContext('2d').putImageData(
    createImageData(blurredPx, wideW, wideH), 0, 0);

  const c = createCanvas(W, H);
  const cx = c.getContext('2d');
  cx.drawImage(full, -PAD, -PAD);
  return c;
}

// Fills an ellipse-shaped radial ramp on `ctx`, described in plate
// fractions by CORE. Drawn in a unit square and scaled, so the ellipse can
// have different horizontal and vertical radii without distorting the
// falloff curve. `stops` are [offset, color] pairs.
function coreRamp(ctx, stops) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.save();
  ctx.translate(CORE.x * W, CORE.y * H);
  ctx.scale(CORE.rx * W, CORE.ry * H);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

const img = await loadImage(SRC);

// 1. Crop, oversized by PAD on every side so the blurs have real pixels
//    to sample at the frame's edges instead of smearing the border.
const padScale = CROP.w / W; // source px per plate px
const wide = createCanvas(W + PAD * 2, H + PAD * 2);
const wctx = wide.getContext('2d');
wctx.patternQuality = 'best';
wctx.quality = 'best';
wctx.drawImage(
  img,
  CROP.x - PAD * padScale, CROP.y - PAD * padScale,
  CROP.w + PAD * 2 * padScale, CROP.h + PAD * 2 * padScale,
  0, 0, wide.width, wide.height
);

// 2. Tone curve, before the blur: the S-curve is a per-pixel operation, and
//    running it on the sharp plate applies it once rather than separately
//    to each of the two blur levels.
const wideFrame = wctx.getImageData(0, 0, wide.width, wide.height).data;
{
  const lut = buildLut();
  for (let i = 0; i < wideFrame.length; i += 4) {
    const r = lut[wideFrame[i]], g = lut[wideFrame[i + 1]], b = lut[wideFrame[i + 2]];
    // Rec.709 luma, so the pull toward grey tracks perceived brightness
    // and the snow does not darken while the sky lightens.
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    wideFrame[i]     = luma + (r - luma) * SATURATION;
    wideFrame[i + 1] = luma + (g - luma) * SATURATION;
    wideFrame[i + 2] = luma + (b - luma) * SATURATION;
  }
}

// 3. Two blur levels, cross-faded by a radial mask. The heavy copy is
//    masked with destination-in and then drawn over the light one, which
//    gives a continuous ramp with no boundary anywhere in the frame -- the
//    thing that made the first CSS spotlight read as a pasted rectangle.
const out = blurred(wideFrame, wide.width, wide.height, BLUR_EDGE);
const octx = out.getContext('2d');

const core = blurred(wideFrame, wide.width, wide.height, BLUR_CORE);
const cctx = core.getContext('2d');
cctx.globalCompositeOperation = 'destination-in';
coreRamp(cctx, [
  [0.00, 'rgba(0,0,0,1)'],
  [0.55, 'rgba(0,0,0,.92)'],
  [1.00, 'rgba(0,0,0,0)'],
]);
octx.drawImage(core, 0, 0);

// 4. The core shade, on the same ellipse, so the darkening and the blur
//    fall off together rather than describing two different shapes.
coreRamp(octx, [
  [0.00, `rgba(10,13,19,${CORE_SHADE})`],
  [0.62, `rgba(10,13,19,${(CORE_SHADE * 0.55).toFixed(3)})`],
  [1.00, 'rgba(10,13,19,0)'],
]);

const buf = out.toBuffer('image/jpeg', { quality: 0.82, progressive: true });
writeFileSync(OUT, buf);
console.log(`${SRC} (${img.width}x${img.height}) -> ${OUT} (${W}x${H}, ${(buf.length / 1024).toFixed(0)} KB, blur ${BLUR_EDGE}->${BLUR_CORE} css px)`);
