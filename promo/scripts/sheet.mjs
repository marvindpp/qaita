// Контактный лист из out/frames → out/sheet.png
import { chromium } from '/tmp/claude-0/-home-user-qaita/61928357-dfcf-5a80-a823-a69da5213ded/scratchpad/node_modules/playwright/index.mjs';
import { readdirSync, writeFileSync } from 'node:fs';
const files = readdirSync('out/frames').filter((f) => f.endsWith('.png')).sort().filter((f) => !process.argv[2] || process.argv[2].split(',').includes(String(Number(f.slice(0,3)))));
const html = '<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(' + Math.min(6, files.length) + ',1fr);gap:6px;padding:6px;font:16px sans-serif;color:#fff">' + files.map((f) => '<div><img src="file://' + process.cwd() + '/out/frames/' + f + '" style="width:100%;outline:1px solid #555"><div>' + f + '</div></div>').join('') + '</body>';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1800, height: 900 } });
writeFileSync('out/sheet.html', html); await p.goto('file://' + process.cwd() + '/out/sheet.html'); await p.waitForTimeout(800);
await p.screenshot({ path: 'out/sheet.png', fullPage: true }); await b.close();
