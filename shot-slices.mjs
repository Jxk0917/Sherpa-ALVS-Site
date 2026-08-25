// Capture a page as a series of viewport-sized slices at 1x, small enough to review
// one at a time. Full-page 2x captures of this site exceed canvas' surface limit,
// which is what crop.mjs chokes on.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join } from 'path';

const url = process.argv[2];
const outDir = process.argv[3];
const width = parseInt(process.argv[4] || '1440', 10);
const sliceH = parseInt(process.argv[5] || '1100', 10);

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width, height: sliceH, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0' });

// Walk the page once so IntersectionObserver reveals fire before any capture.
await page.evaluate(async () => {
  await new Promise(r => {
    let y = 0;
    const step = () => {
      y += window.innerHeight * 0.7;
      window.scrollTo(0, y);
      if (y < document.body.scrollHeight) setTimeout(step, 80);
      else setTimeout(() => { window.scrollTo(0, 0); setTimeout(r, 900); }, 900);
    };
    step();
  });
});

const total = await page.evaluate(() => document.body.scrollHeight);
const count = Math.ceil(total / sliceH);
for (let i = 0; i < count; i++) {
  await page.evaluate(y => window.scrollTo(0, y), i * sliceH);
  await new Promise(r => setTimeout(r, 350));
  await page.screenshot({ path: join(outDir, `slice-${String(i + 1).padStart(2, '0')}.png`) });
}
await browser.close();
console.log(`${count} slices (${width}x${sliceH}) written to ${outDir}`);
