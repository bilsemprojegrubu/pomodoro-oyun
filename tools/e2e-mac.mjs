// Hazırlık maçı duman testi: kadro kurulu kayıtla Dünyam'da maç oynar, ekran görüntüsü alır.
// Kullanım: `node tools/e2e-mac.mjs [çıktı-klasörü]` (önce `npm run build` ve `npx vite preview --port 4173`).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { defaultState, defaultThemeState } from '../src/core/storage.js';
import { dayKey, addDays } from '../src/core/dates.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const OUT = process.argv[2] || '/tmp/shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.URL || 'http://localhost:4173/';
const NOW = new Date(2025, 0, 8, 15, 0, 0).getTime();
const th = JSON.parse(readFileSync(new URL('../src/themes/football.json', import.meta.url), 'utf8'));
const cat = th.categories.find((c) => c.roleSlots);
const owned = Object.entries(cat.roleSlots).flatMap(([role, n]) =>
  th.items.filter((i) => i.category === cat.id && i.role === role).sort((a, b) => a.power - b.power).slice(0, n).map((i) => i.id));

const s = defaultState(NOW - 5 * 86400000);
s.profile = { consentAt: NOW, onboarded: true, theme: 'football', participantCode: 'K01' };
const ts = defaultThemeState(NOW - 5 * 86400000);
ts.owned = owned;
ts.lastEventWeek = '2024-12-30';
s.themes.football = ts;
s.wallet = { coins: 100, earnedTotal: 100, spentTotal: 0 };
s.daily[dayKey(NOW)] = { rewarded: 2, completed: 2, minutes: 50 };
s.research = { ...s.research, surveySnoozedDay: dayKey(NOW) };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, ['pomodoroOyun.kayit', JSON.stringify(s)]);
await page.clock.install({ time: NOW });
await page.goto(BASE + '#/world');
await page.clock.runFor(1500);
const btn = page.getByRole('button', { name: 'Maça çık' });
await btn.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/mac-kart.png` });
await btn.click();
await page.clock.runFor(2500);
await page.screenshot({ path: `${OUT}/mac-sonuc.png` });
const text = await page.locator('.modal').innerText();
console.log(text.replace(/\n+/g, ' | '));
await page.getByRole('button', { name: 'Tamam' }).click();
await page.clock.runFor(500);
console.log('Para:', await page.evaluate(() => JSON.parse(localStorage.getItem('pomodoroOyun.kayit')).wallet.coins));
await browser.close();
console.log(errors.length ? `HATALAR:\n${errors.join('\n')}` : 'Konsol temiz.');
