// One clipped capture per .tag, so each band can be judged against its own ground.
import puppeteer from 'puppeteer';
const url = process.argv[2];
const width = parseInt(process.argv[3] || '1440', 10);
const out = 'c:/Program Files/Git/AlvSolutions/temporary screenshots';
const b = await puppeteer.launch({ headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
await new Promise(r => setTimeout(r, 1200));
const boxes = await p.evaluate(() => [...document.querySelectorAll('.tag')].map((t, i) => {
  const r = t.getBoundingClientRect();
  return { i, x: 0, y: r.top + scrollY - 90, w: innerWidth, h: 380, txt: t.innerText.replace(/\s+/g, ' ') };
}));
for (const bx of boxes) {
  await p.screenshot({ path: `${out}/tag-${width}-${bx.i}.png`,
    clip: { x: bx.x, y: Math.max(0, bx.y), width: bx.w, height: bx.h }, captureBeyondViewport: true });
  console.log(bx.i, bx.txt);
}
await b.close();
