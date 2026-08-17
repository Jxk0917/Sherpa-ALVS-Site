// Scroll-through capture: triggers IntersectionObserver reveals before full-page shot.
// Saves into the project's ./temporary screenshots with the same naming scheme.
import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = 'c:/Program Files/Git/AlvSolutions';
const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';
const width = parseInt(process.argv[4] || '1440', 10);

const outDir = join(ROOT, 'temporary screenshots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const existing = readdirSync(outDir).filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
const nums = existing.map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] || '0'));
const next = (nums.length ? Math.max(...nums) : 0) + 1;
const outPath = join(outDir, `screenshot-${next}${label}.png`);

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.evaluate(async () => {
  await new Promise(r => {
    let y = 0;
    const step = () => {
      y += window.innerHeight * 0.7;
      window.scrollTo(0, y);
      if (y < document.body.scrollHeight) setTimeout(step, 90);
      else setTimeout(() => { window.scrollTo(0, 0); setTimeout(r, 1800); }, 1600);
    };
    step();
  });
});
await new Promise(r => setTimeout(r, 900));
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(`Screenshot saved: ${outPath}`);
