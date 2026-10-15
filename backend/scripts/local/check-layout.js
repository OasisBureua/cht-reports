#!/usr/bin/env node
/**
 * Layout check for a rendered 1.3.0+ report: loads the HTML in Chrome and,
 * for every slide, reports how full its body is and whether anything
 * overflows the slide. Exits 1 if any slide overflows.
 *
 *   PUPPETEER_EXECUTABLE_PATH=/path/to/chrome node scripts/local/check-layout.js <report.html>
 */

const { readFileSync } = require('node:fs');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/local/check-layout.js <report.html>');
    process.exit(2);
  }
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setContent(readFileSync(file, 'utf-8'), { waitUntil: 'load' });
    await page.emulateMediaType('print');
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.slide')].map((slide, i) => {
        const body = slide.querySelector('.slide-body');
        const title = slide.querySelector('h1, h2')?.textContent?.trim().slice(0, 60) ?? '';
        const slideBox = slide.getBoundingClientRect();
        // Lowest content edge inside the body, and the body's own box.
        let bottom = 0;
        let right = 0;
        // Text-bearing leaves only: decorative shapes bleed off the slide on purpose.
        for (const el of (body ?? slide).querySelectorAll('*')) {
          if (el.closest('[aria-hidden="true"]')) continue;
          const leaf = el.children.length === 0 || el.tagName.toLowerCase() === 'svg';
          if (!leaf || el.closest('svg') !== null && el.tagName.toLowerCase() !== 'svg') continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          bottom = Math.max(bottom, r.bottom);
          right = Math.max(right, r.right);
        }
        const bodyBox = body?.getBoundingClientRect();
        const fill = bodyBox && bodyBox.height ? (bottom - bodyBox.top) / bodyBox.height : null;
        // Bodies must stay clear of the logo row; the cover (no body) only of the slide edge.
        const overflow = body ? bottom > slideBox.bottom - 60 || right > slideBox.right - 20 : bottom > slideBox.bottom - 4 || right > slideBox.right - 4;
        return { i: i + 1, cls: slide.className.replace('slide ', ''), title, fill, overflow };
      }),
    );
    let bad = 0;
    for (const r of rows) {
      if (r.overflow) bad++;
      const fill = r.fill === null ? '   -' : `${Math.round(r.fill * 100)}%`.padStart(4);
      console.log(`${String(r.i).padStart(3)} ${fill} ${r.overflow ? 'OVERFLOW' : '        '} ${r.cls.padEnd(42)} ${r.title}`);
    }
    console.log(bad ? `${bad} slide(s) overflow` : `${rows.length} slides, none overflow`);
    process.exitCode = bad ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
