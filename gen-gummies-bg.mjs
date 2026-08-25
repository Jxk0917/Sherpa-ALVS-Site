// Prepares the Social Gummies product page's full-bleed backdrop plate.
// Source is "Strawberrry Field.jpg", 4718x2658 straight off a camera.
//
// This is a ONE-OFF: only social-gummies carries a heroBackground field in
// products.json, and only product.njk's variant branch reads it. No other
// product page gets a photographic backdrop behind its buy panel -- that
// was an explicit instruction, not an oversight to fix later.
//
// THE CROP TAKES THE CENTRE OF THE FRAME, NOT THE FULL WIDTH. The section
// this sits behind is unusually TALL (a sticky product photo beside a
// panel with six spec tiles, notes and an ingredients line can run past
// 1400px), not wide-and-short like the other full-bleed bands in this
// project (spotlight, dose-head). A landscape source cropped to a wide
// banner would force CSS background-size:cover to zoom in hard just to
// cover that height, cropping away almost everything but a vertical
// sliver. Cropping a taller ~0.9:1 slice from the middle here -- where the
// rows converge and the most strawberries hang -- means cover has real
// material to work with at every breakpoint instead of one over-zoomed
// scrap of it.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const SRC = 'Strawberrry Field.jpg';
const OUT = 'src/assets/gummies-field-bg.jpg';

const CROP = { x: 1150, y: 0, w: 2450, h: 2658 };

// 1400x1516 (~0.92:1). Heavily blurred and washed with ivory in the page
// (see .pdp-scene / .pdp::after in pages.css), so nothing finer than the
// blur radius survives -- a plate matched pixel-for-pixel to a 2x desktop
// viewport would be wasted bytes for a texture this quiet.
const W = 900, H = 974;

const img = await loadImage(SRC);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.patternQuality = 'best';
ctx.quality = 'best';
ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, W, H);

const buf = canvas.toBuffer('image/jpeg', { quality: 0.7, progressive: true });
writeFileSync(OUT, buf);
console.log(`${SRC} (${img.width}x${img.height}) -> ${OUT} (${W}x${H}, ${(buf.length / 1024).toFixed(0)} KB)`);
