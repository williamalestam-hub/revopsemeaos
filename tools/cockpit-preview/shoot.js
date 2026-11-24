// Saves contact sheets of the cockpit scene: node tools/cockpit-preview/shoot.js --scene <file.js> --out <dir> [--fx a,b] [--widths 400,888,1280] [--dpr 1] [--times 0,500,1500,3000,6000,12000] [--theme dark] [--reduced]
// One PNG per fixture and width: the frames at the given times (ms into the run), stacked top to bottom.
// It renders tools/cockpit-preview/preview.html, which loads the scene alone with made-up crews; it never opens the dashboard.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
(async () => {
  const scene = path.resolve(arg('scene', path.join(__dirname, '../../dashboard/os-cockpit-scene.js')));
  const out = path.resolve(arg('out', path.join(__dirname, 'out')));
  const fixtures = require('./fixtures.js');
  const fxs = arg('fx', Object.keys(fixtures).join(',')).split(',').filter(Boolean);
  const widths = arg('widths', '400,888,1280').split(',').map(Number);
  const times = arg('times', '0,500,1500,3000,6000,12000').split(',').map(Number);
  const dpr = +arg('dpr', '1'), theme = arg('theme', ''), reduced = flag('reduced');
  if (!fs.existsSync(scene)) { console.error('no scene file at ' + scene); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let bad = 0;
  if (flag('bench')) { // --bench: frame cost only, no pictures
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const [fx, width] of [['morning', 400], ['cleared', 888], ['eight', 1280]]) {
      await page.goto('file://' + path.join(__dirname, 'preview.html') + '?scene=' + encodeURIComponent('file://' + scene));
      await page.waitForFunction('window.__ready === true', null, { timeout: 15000 });
      const r = await page.evaluate((a) => window.__bench(a), { fx, width, frames: 300 });
      console.log(`bench ${fx} @${width} dpr 2: ${r.avg.toFixed(2)} ms a frame on average, worst ${r.worst.toFixed(2)} ms`);
    }
    await browser.close(); return;
  }
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width: width + 40, height: 900 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    for (const fx of fxs) {
      const url = 'file://' + path.join(__dirname, 'preview.html') + '?scene=' + encodeURIComponent('file://' + scene) + (theme ? '&theme=' + theme : '');
      await page.goto(url);
      await page.waitForFunction('window.__ready === true', null, { timeout: 15000 });
      let res;
      try { res = await page.evaluate((a) => window.__run(a), { fx, width, times, reduced }); }
      catch (e) { console.log(`FAIL ${fx} @${width}: ${String(e.message).split('\n')[0]}`); bad++; continue; }
      const file = path.join(out, `${fx}-${width}${theme ? '-' + theme : ''}${reduced ? '-still' : ''}.png`);
      await (await page.$('#sheet')).screenshot({ path: file });
      const missed = res.hits.filter((h) => h.anchor && h.hit !== h.id).map((h) => h.id);
      const all = errs.concat(res.errors || []);
      console.log(`${all.length ? 'ERR ' : 'ok  '}${fx} @${width}: height ${Math.round(res.height)}px, canvas ${res.canvasW}x${res.canvasH}${missed.length ? ', anchor does not hit: ' + missed.join(',') : ''}${all.length ? ' | ' + all.slice(0, 3).join(' | ') : ''} -> ${file}`);
      if (all.length) bad++;
      errs.length = 0;
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
