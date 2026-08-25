// Opens the compliance dialog and captures it, so the restored
// component can be reviewed without clicking through by hand.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join } from 'path';

const url = process.argv[2];
const outDir = process.argv[3];
const width = parseInt(process.argv[4] || '1440', 10);
const height = parseInt(process.argv[5] || '1000', 10);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.click('[data-compliance-open]');
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: join(outDir, `modal-${width}.png`) });

// Prove the dialog actually took focus and can be escaped.
const focused = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
await page.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 700));
const closed = await page.evaluate(() => document.getElementById('compliance-modal').hidden);
const returned = await page.evaluate(() => document.activeElement.className);

await browser.close();
console.log(`focus on open: ${focused}\nhidden after Escape: ${closed}\nfocus returned to: ${returned}`);
