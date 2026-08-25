// Composite "bundle" cover: one of each real product line, staged as a
// single professional product shot rather than a loose collage.
//
// The set is a seamless cyclorama -- the sweep of back wall curving into the
// floor that every catalogue product shot is lit on. Light falls from
// above, the side walls shade off toward the edges so the frame reads as
// an enclosure, and the horizon is a soft cove rather than a drawn line.
// Products stand in two tiers, staggered so the front rank sits in the
// gaps of the back rank, close enough to read as one arrangement.
//
// Run gen-product-shots.mjs first; this consumes its assets/cut-*.png
// outputs, which are now true alpha cutouts for all six lines (the old
// build had to fall back to the opaque product-stix.png here, because a
// bug in the source's alpha handling meant Quick Stix never keyed at all).
//
// TWO RULES HOLD THIS COMPOSITION TOGETHER. Both come from the same fact:
// each cutout keeps its own baked-in studio contact shadow, as opaque
// pixels a shade off the backdrop colour, because no colour threshold can
// separate a soft shadow from a white pouch face -- they sit ~2 units
// apart. See gen-product-shots.mjs. So:
//
//   1. THE FLOOR IS EXACTLY THE SOURCE BACKDROP COLOUR, AND PERFECTLY
//      FLAT. Those shadow pixels then land on a ground identical to the
//      one they were shot against and disappear into it. Every gradient
//      in this file lives above the horizon, well clear of where any
//      product's shadow falls. A floor vignette is what put a visible
//      rectangle around each product in the first version of this cover;
//      the cause was never the vignette itself but that it made the
//      ground disagree with the shadow, so do not reintroduce one.
//
//   2. A PRODUCT MAY OVERLAP THE BODY OF SOMETHING BEHIND IT, BUT ITS
//      SHADOW MAY NEVER LAND ON ANOTHER PRODUCT. A front item occluding
//      a back item's midriff is just correct perspective. A front item's
//      shadow crossing a can, though, paints a pale smear across it,
//      because that shadow is opaque near-ivory. Every shadow here sits
//      at the bottom of its own cutout, and the front tier's bases clear
//      the back tier's entirely -- which is what the tier geometry below
//      is actually for.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const S = 'assets/';

// The exact flat backdrop all six product shots were photographed on.
// The floor is this colour and nothing else. See rule 1.
const FLOOR = '#F3EEE5';

// Canvas is wide (2.5:1) to match the bundle tile's real photo box, which
// measures ~642x250 inside its padding on desktop. The old 1280x620 was
// nearly a full stop squarer than the box it had to sit in, so `contain`
// letterboxed it and left dead ivory down both sides -- half the "empty
// space" in this cover was the frame's aspect, not the arrangement's.
const W = 1400, H = 580;

// Where the wall's falloff finishes and the flat floor begins. Every
// product base sits below this, every gradient above it.
const HORIZON = 310;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ── The set ────────────────────────────────────────────────────────
// Floor first, flat, edge to edge. Everything else is painted into a
// separate wall layer over its top half, then faded out along the frame's
// own edges before being composited down (see BLEED below), so the image
// always meets the tile panel at exactly FLOOR on all four sides.
ctx.fillStyle = FLOOR;
ctx.fillRect(0, 0, W, H);

const wallLayer = createCanvas(W, HORIZON);
const wctx = wallLayer.getContext('2d');

// Back wall: a soft top-lit falloff that lands exactly on the floor colour
// at the horizon, so the cove is seamless and there is no line to see.
// The whole ramp is kept within a few units of FLOOR, because the tile
// panel behind this image is painted FLOOR too (--shot-ground) -- a wall
// that started at a bright ivory put a visible step along the image's top
// edge, which is the seam the panel colour exists to avoid.
const wall = wctx.createLinearGradient(0, 0, 0, HORIZON);
wall.addColorStop(0, '#F8F4EC');
wall.addColorStop(0.55, '#F6F1E9');
wall.addColorStop(1, FLOOR);
wctx.fillStyle = wall;
wctx.fillRect(0, 0, W, HORIZON);

// Side walls, shading off toward the frame edges and fading to nothing by
// the horizon -- the corners of the sweep turning away from the light.
// Confined above the horizon so the floor stays flat (rule 1).
for (const side of ['left', 'right']) {
  const g = wctx.createLinearGradient(side === 'left' ? 0 : W, 0, side === 'left' ? 260 : W - 260, 0);
  g.addColorStop(0, 'rgba(118,100,78,.24)');
  g.addColorStop(1, 'rgba(120,104,84,0)');
  const fade = wctx.createLinearGradient(0, 0, 0, HORIZON);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  // Paint the horizontal shade through a vertical alpha ramp so it dies
  // out at the cove instead of stopping dead against the floor.
  const layer = createCanvas(W, HORIZON);
  const lx = layer.getContext('2d');
  lx.fillStyle = g; lx.fillRect(0, 0, W, HORIZON);
  lx.globalCompositeOperation = 'destination-in';
  lx.fillStyle = fade; lx.fillRect(0, 0, W, HORIZON);
  wctx.drawImage(layer, 0, 0);
}

// The overhang: the front lip of the case throwing a soft band across the
// top of the sweep. This is what tells you you're looking into a box.
const lip = wctx.createLinearGradient(0, 0, 0, 150);
lip.addColorStop(0, 'rgba(96,82,64,.2)');
lip.addColorStop(1, 'rgba(96,82,64,0)');
wctx.fillStyle = lip;
wctx.fillRect(0, 0, W, 150);

// A wide pool of light on the wall behind the hero, so the centre of the
// arrangement reads as the lit spot rather than the frame being evenly
// bright.
const pool = wctx.createRadialGradient(W * 0.46, 120, 40, W * 0.46, 120, 620);
pool.addColorStop(0, 'rgba(255,253,250,.55)');
pool.addColorStop(1, 'rgba(255,253,250,0)');
wctx.fillStyle = pool;
wctx.fillRect(0, 0, W, HORIZON);

// Fade the whole wall layer out along the top, left and right edges of the
// frame, so the image's border is FLOOR on every side and meets the tile
// panel -- painted the same colour -- without a step. Only the wall needs
// this: the floor below the horizon is already FLOOR out to the edge, and
// so is the wall's own bottom, which is why there is no ramp there.
const BLEED = 34;
wctx.globalCompositeOperation = 'destination-in';
const edges = [
  [0, 0, BLEED, 0],              // left
  [W, 0, W - BLEED, 0],          // right
  [0, 0, 0, BLEED],              // top
];
for (const [x0, y0, x1, y1] of edges) {
  const g = wctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  wctx.fillStyle = g;
  wctx.fillRect(0, 0, W, HORIZON);
}
ctx.drawImage(wallLayer, 0, 0);

// ── The arrangement ────────────────────────────────────────────────
async function place(path, { cx, bottomY, width }) {
  const img = await loadImage(S + path);
  const h = img.height * (width / img.width);
  ctx.drawImage(img, cx - width / 2, bottomY - h, width, h);
}

// Back tier: bases on one line well up the floor, so the whole rank reads
// as standing further into the box. The seltzer lineup is the flagship
// and takes the centre at the largest size. Wellness and Quick Stix are
// pushed out to the frame edges to open two clear gaps beside the cans.
await place('cut-wellness.png', { cx: 132,  bottomY: 392, width: 190 });
await place('cut-drinks.png',   { cx: 620,  bottomY: 392, width: 470 });

// Quick Stix breaks the back tier's base line deliberately, standing a
// step nearer the camera. On the back line its two small pouches left the
// bottom-right corner of the floor empty and read as hovering, with
// nothing in front of them to give their height a reference.
await place('cut-stix.png',     { cx: 1198, bottomY: 502, width: 372 });

// Front tier: larger and lower. Gummies and Dawg Snax take the two gaps
// in the rank behind, so nothing back there is buried -- the roll-on and
// the white Quick Stix pouch both stay legible, which an evenly spaced
// front row destroyed. Only Krispies stands in front of another product,
// and only across the cans' bases, where a pouch occluding a can is
// exactly what the eye expects.
// Bases sit far enough down the floor that no shadow here can reach
// anything in the back tier (rule 2); the bodies overlap freely.
await place('cut-gummies.png',  { cx: 300,  bottomY: 556, width: 232 });
await place('cut-krispies.png', { cx: 660,  bottomY: 556, width: 262 });
await place('cut-pet.png',      { cx: 928,  bottomY: 556, width: 258 });

writeFileSync(S + 'product-bundle.png', canvas.toBuffer('image/png'));
console.log('saved', S + 'product-bundle.png', `${W}x${H}`);
