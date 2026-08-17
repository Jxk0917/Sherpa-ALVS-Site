// crop.mjs <src.png> <y0> <y1> <out.png>  — crops a horizontal band at native resolution
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const [src, y0, y1, out] = process.argv.slice(2);
const img = await loadImage(src);
const Y0 = parseInt(y0, 10), H = parseInt(y1, 10) - Y0;
const c = createCanvas(img.width, H);
c.getContext('2d').drawImage(img, 0, -Y0);
writeFileSync(out, c.toBuffer('image/png'));
console.log(`cropped ${img.width}x${H} → ${out}`);
