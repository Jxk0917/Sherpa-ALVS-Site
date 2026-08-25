// Prepares the "Know your altitude" heading panel's background plate.
// Source is a 5464x8192 / 2.7 MB portrait JPEG straight off a camera, far
// too heavy to put on a landing page, so it is never referenced directly;
// this writes assets/dose-hiker.jpg instead.
//
// Crop: the source is 2:3 portrait and the panel is close to square, so
// the frame has to lose height at both ends. The window below starts above
// the summit and stops around the hiker's waist, which puts the two things
// worth seeing -- the peak he is looking at, and him -- in the top two
// thirds, and leaves his jacket and pack filling the bottom third. That
// bottom third is where the heading sits, and a large soft mid-tone mass
// is the easiest thing in the picture to lay type over.
//
// No tone curve here, unlike gen-plinth-bg.mjs. That plate had to survive
// being the whole visual field of its card; this one sits under a heavy
// scrim and a blur, and every adjustment it needs is easier to make in the
// CSS where it can be seen against the actual type.
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const SRC = 'Sherpa Guy Green BG.jpg';
const OUT = 'assets/dose-hiker.jpg';

// Source-pixel crop window. Full width; vertically from just above the
// peak down to the hiker's waist.
const CROP = { x: 0, y: 1400, w: 5464, h: 6200 };

// 1000x1135 (0.88:1). The panel is ~547x590 CSS on desktop, so ~1094x1180
// device pixels at 2x -- this upscales about 9%, which the 3px blur on the
// layer hides completely. Quality .76 for the same reason: the plate is
// never displayed sharp.
const W = 1000, H = 1135;

const img = await loadImage(SRC);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.patternQuality = 'best';
ctx.quality = 'best';
ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, W, H);

const buf = canvas.toBuffer('image/jpeg', { quality: 0.76, progressive: true });
writeFileSync(OUT, buf);
console.log(`${SRC} (${img.width}x${img.height}) -> ${OUT} (${W}x${H}, ${(buf.length / 1024).toFixed(0)} KB)`);
