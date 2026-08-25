// Clicks through the gummies product page's dose picker and view toggle,
// capturing each state and asserting price/spec/image actually change.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join } from 'path';

const url = process.argv[2] || 'http://localhost:8080/shop/gummies/social-gummies/';
const outDir = process.argv[3] || 'C:/Users/Jack/AppData/Local/Temp/claude/variant-check';
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
await page.goto(url, { waitUntil: 'networkidle0' });

async function state(label) {
  const s = await page.evaluate(() => ({
    price: document.getElementById('pdp-price').textContent,
    img: document.getElementById('pdp-image').src.split('/').pop(),
    dose: document.getElementById('pdp-spec-dose').textContent,
    total: document.getElementById('pdp-spec-total').textContent,
    count: document.getElementById('pdp-spec-count').textContent,
    cal: document.getElementById('pdp-spec-cal').textContent,
  }));
  console.log(label, JSON.stringify(s));
  return s;
}

await state('initial (10mg, front)');
await page.screenshot({ path: join(outDir, '1-initial.png'), clip: { x: 0, y: 480, width: 1440, height: 560 } });

// Click 25mg
await page.click('[data-dose="25"]');
await new Promise(r => setTimeout(r, 150));
await state('after clicking 25mg');
await page.screenshot({ path: join(outDir, '2-25mg.png'), clip: { x: 0, y: 480, width: 1440, height: 560 } });

// Click 100mg
await page.click('[data-dose="100"]');
await new Promise(r => setTimeout(r, 150));
await state('after clicking 100mg');
await page.screenshot({ path: join(outDir, '3-100mg.png'), clip: { x: 0, y: 480, width: 1440, height: 560 } });

// Toggle to back label while on 100mg
await page.click('[data-view="back"]');
await new Promise(r => setTimeout(r, 150));
await state('after clicking back view (still 100mg)');
await page.screenshot({ path: join(outDir, '4-100mg-back.png'), clip: { x: 0, y: 480, width: 1440, height: 560 } });

// Keyboard nav: focus dose group, press Home to jump back to 10mg
await page.focus('[data-dose="100"]');
await page.keyboard.press('Home');
await new Promise(r => setTimeout(r, 150));
await state('after Home key (should be 10mg again, view stays back)');

await browser.close();
