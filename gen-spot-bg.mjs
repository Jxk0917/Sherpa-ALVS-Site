// Prepares the Basecamp Seltzer section's full-bleed background plate.
// Source is an 8192x5464 / 2.3 MB JPEG straight off a camera; this writes
// assets/spot-jacket.jpg instead.
//
// THE CROP EXISTS TO REMOVE ANOTHER BRAND'S WORDMARK. The source frames a
// fleece with "Motéa" embroidered across the back in script -- a different
// company, and in almost exactly the same script-logo idiom as Sherpa's
// own mark, so on a Sherpa page it would read either as Sherpa's logo or
// as a competitor's. The window below takes the band ABOVE it (the top
// 2600 source rows; the wordmark's highest ink starts around row 2700),
// which keeps the part actually worth having -- snow lying on deep green
// fleece, a colour that happens to match the seltzer can -- and leaves the
// lettering out of frame entirely. Do not widen this crop downward.
//
// THE PLATE IS FLIPPED HORIZONTALLY, and that is compositional, not
// cosmetic. In the source the left third is bright out-of-focus winter
// backdrop and the right two thirds are dark fleece. The section puts its
// heading and body copy on the LEFT, so unflipped the type would land on
// the brightest part of the picture and need a scrim heavy enough to kill
// the photograph. Flipped, the dark fleece sits under the text and the
// bright area falls on the right, where the plinth card covers most of it.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const SRC = 'Sherpa Jacket Name BG.jpg';
const OUT = 'assets/spot-jacket.jpg';

const CROP = { x: 0, y: 0, w: 8192, h: 2600 };

// 1800x572 (3.15:1) at quality .74. The section is full-bleed, so it has
// to cover very wide viewports -- but it is blurred ~9px in the page, so
// detail finer than that never survives and a plate matched pixel-for-
// pixel to a 2x desktop viewport would be almost entirely wasted bytes.
const W = 1800, H = 572;

const img = await loadImage(SRC);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.patternQuality = 'best';
ctx.quality = 'best';
ctx.translate(W, 0);
ctx.scale(-1, 1);
ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, W, H);

const buf = canvas.toBuffer('image/jpeg', { quality: 0.74, progressive: true });
writeFileSync(OUT, buf);
console.log(`${SRC} (${img.width}x${img.height}) -> ${OUT} (${W}x${H}, ${(buf.length / 1024).toFixed(0)} KB)`);
