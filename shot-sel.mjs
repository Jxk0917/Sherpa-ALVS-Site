// Capture one element, by selector, at its own size. The companion to
// shot-slices.mjs (whole page, blind slices) and shot-el.mjs (every .tag in
// turn): this is for iterating on a single band or card without hunting for
// it in a full-page capture.
//
// Usage: node shot-sel.mjs <url> <selector> <out.png> [width] [scale]
//
// Reveals are forced in before measuring -- .reveal elements start at
// opacity:0 with a transform, so an un-forced capture measures the wrong
// box and shoots a blank one. Puppeteer resolves from this script's own
// directory, so this has to live in the repo, not in a scratchpad.
import puppeteer from 'puppeteer';

const url = process.argv[2];
const selector = process.argv[3];
const out = process.argv[4];
const width = parseInt(process.argv[5] || '1440', 10);
const scale = parseFloat(process.argv[6] || '2');

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width, height: 1000, deviceScaleFactor: scale });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  document.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
  document.querySelectorAll('.enter').forEach(e => e.classList.add('in'));
});
await new Promise(r => setTimeout(r, 1400));

const box = await page.evaluate(sel => {
  const el = document.querySelector(sel);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
}, selector);

if (!box) { await browser.close(); throw new Error(`no element matched ${selector}`); }
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: out, clip: box, captureBeyondViewport: true });
await browser.close();
console.log(`${selector} (${Math.round(box.width)}x${Math.round(box.height)}) -> ${out}`);
