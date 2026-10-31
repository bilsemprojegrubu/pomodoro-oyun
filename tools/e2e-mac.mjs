// Günlük karşılaşma duman testi: dört temada Dünyam'dan karşılaşma oynar, ekran görüntüsü alır.
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
const THEME_IDS = ['football', 'cafe', 'fashion', 'shelter'];

function seed(id) {
  const th = JSON.parse(readFileSync(new URL(`../src/themes/${id}.json`, import.meta.url), 'utf8'));
  const cat = th.categories.find((c) => c.roleSlots);
  const owned = cat
    ? Object.entries(cat.roleSlots).flatMap(([role, n]) =>
        th.items.filter((i) => i.category === cat.id && i.role === role).sort((a, b) => a.power - b.power).slice(0, n).map((i) => i.id))
    : [...th.items.filter((i) => i.tier === 'bronze').slice(0, 9), ...th.items.filter((i) => i.tier === 'silver').slice(0, 4)].map((i) => i.id);
  const s = defaultState(NOW - 5 * 86400000);
  s.profile = { consentAt: NOW, onboarded: true, theme: id, participantCode: 'K01' };
  const ts = defaultThemeState(NOW - 5 * 86400000);
  ts.owned = owned;
  ts.lastEventWeek = '2024-12-30';
  s.themes[id] = ts;
  s.wallet = { coins: 100, earnedTotal: 100, spentTotal: 0 };
  s.daily[dayKey(NOW)] = { rewarded: 2, completed: 2, minutes: 50 };
  s.research = { ...s.research, surveySnoozedDay: dayKey(NOW) };
  return s;
}

const browser = await chromium.launch();
const errors = [];
for (const id of THEME_IDS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${id}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${id}] ${e.message}`));
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, ['pomodoroOyun.kayit', JSON.stringify(seed(id))]);
  await page.clock.install({ time: NOW });
  await page.goto(BASE + '#/world');
  await page.clock.runFor(1500);
  const btn = page.getByRole('button', { name: 'Karşılaş' });
  await btn.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/karsilasma-${id}-kart.png` });
  await btn.click();
  await page.clock.runFor(2500);
  await page.screenshot({ path: `${OUT}/karsilasma-${id}-sonuc.png` });
  console.log(`[${id}]`, (await page.locator('.modal').innerText()).replace(/\n+/g, ' | ').slice(0, 260));
  await page.getByRole('button', { name: 'Tamam' }).click();
  await page.clock.runFor(500);
  console.log(`[${id}] Para:`, await page.evaluate(() => JSON.parse(localStorage.getItem('pomodoroOyun.kayit')).wallet.coins));
  await ctx.close();
}
await browser.close();
console.log(errors.length ? `HATALAR:\n${errors.join('\n')}` : 'Konsol temiz.');
