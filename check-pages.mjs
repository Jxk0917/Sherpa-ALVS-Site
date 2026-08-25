// Walks every built page, reports console errors, failed requests, links
// that 404, and any horizontal overflow at three viewports.
import puppeteer from 'puppeteer';
import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = process.argv[2] || 'c:/Program Files/Git/AlvSolutions/Sherpa Site/_site';
const BASE = process.argv[3] || 'http://localhost:8080';

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk(ROOT).map(p =>
  '/' + relative(ROOT, p).split(sep).join('/').replace(/index\.html$/, '')
);

const browser = await puppeteer.launch({ headless: 'new' });
let problems = 0;

for (const path of pages.sort()) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('js: ' + e.message));
  page.on('requestfailed', r => errors.push('req: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });

  // Horizontal overflow at each breakpoint.
  const overflow = [];
  for (const w of [390, 768, 1440]) {
    await page.setViewport({ width: w, height: 900 });
    await new Promise(r => setTimeout(r, 200));
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) overflow.push(`${w}px overflows by ${over}px`);
  }

  // Internal links that go nowhere.
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
  const dead = hrefs.filter(h => h === '#' || h === '');

  const all = [...errors, ...overflow, ...(dead.length ? [`${dead.length} link(s) href="#"`] : [])];
  if (all.length) {
    problems++;
    console.log(`\n✗ ${path}`);
    [...new Set(all)].forEach(e => console.log('    ' + e));
  } else {
    console.log(`✓ ${path}`);
  }
  await page.close();
}

await browser.close();
console.log(`\n${pages.length} pages checked, ${problems} with problems.`);
