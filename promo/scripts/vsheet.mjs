import { chromium } from '/tmp/claude-0/-home-user-qaita/61928357-dfcf-5a80-a823-a69da5213ded/scratchpad/node_modules/playwright/index.mjs';
import { readdirSync, writeFileSync } from 'node:fs';
const files = readdirSync('out/check').filter((f) => f.endsWith('.png')).sort((a, b) => parseFloat(a.slice(2)) - parseFloat(b.slice(2)));
writeFileSync('out/vsheet.html', '<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;color:#fff;font:15px sans-serif">' + files.map((f) => '<div><img src="check/' + f + '" style="width:100%"><div>' + f + '</div></div>').join('') + '</body>');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await p.goto('file://' + process.cwd() + '/out/vsheet.html'); await p.waitForTimeout(500);
await p.screenshot({ path: 'out/vsheet.png', fullPage: true }); await b.close();
