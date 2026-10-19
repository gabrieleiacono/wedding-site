// Screenshot helper: node tools/shot.mjs [query] [out.png] [waitMs]
import { chromium } from 'playwright';
const [q = '', out = 'shot.png', wait = '2500', w = '1280', h = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8123/index.html?shot=1' + (q ? '&' + q : ''));
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
