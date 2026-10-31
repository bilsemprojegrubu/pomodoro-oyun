// Hazırlık maçı (futbol). İlk 11 kurulunca oynanır; kazanınca küçük ödül, kaybedince kayıp yok.
// Para farm'lanamasın diye her maç için o gün tamamlanmış bir Pomodoro gerekir (günde en fazla 3 maç).
import { CONFIG } from '../config.js';
import { dayKey, seededRandom } from './dates.js';
import { equippedIds, levelInfo, themeState, totalPower } from './economy.js';

const F = CONFIG.friendly;
const W = CONFIG.weekly;

/** Mevkili (11'li) oyuncu kategorisi; yoksa bu tema hazırlık maçını desteklemez. */
export function lineupCategory(theme) {
  return theme.categories.find((c) => c.roleSlots) || null;
}

/** Hazırlık maçı bu temada var mı? */
export const supportsFriendly = (theme) => Boolean(lineupCategory(theme));

/** Mevkiye göre sahadaki oyuncular ve güçleri. */
export function lineup(theme, ownedIds) {
  const cat = lineupCategory(theme);
  if (!cat) return null;
  const byId = new Map(theme.items.map((i) => [i.id, i]));
  const ids = equippedIds(theme, ownedIds)[cat.id] || [];
  const lines = {};
  for (const role of Object.keys(cat.roleSlots)) {
    const mine = ids.map((id) => byId.get(id)).filter((i) => i.role === role);
    const best = Math.max(...theme.items.filter((i) => i.category === cat.id && i.role === role).map((i) => i.power));
    const power = mine.reduce((a, i) => a + i.power, 0);
    lines[role] = { role, count: mine.length, slots: cat.roleSlots[role], power, strength: mine.length ? power / (cat.roleSlots[role] * best) : 0 };
  }
  const total = Object.values(cat.roleSlots).reduce((a, b) => a + b, 0);
  return { total, filled: ids.length, lines };
}

/** Bugünkü maç durumu: oynanabilir mi, neden olmuyor? */
export function matchStatus(state, theme, now) {
  const ts = themeState(state, theme.id, now);
  const lu = lineup(theme, ts.owned);
  const day = dayKey(now);
  const done = (ts.friendlies || []).filter((m) => m.day === day).length;
  const completed = (state.daily[day] && state.daily[day].completed) || 0;
  const allowed = Math.min(F.maxPerDay, completed);
  let reason = null;
  if (!lu) reason = 'unsupported';
  else if (lu.filled < lu.total) reason = 'lineup';
  else if (done >= F.maxPerDay) reason = 'dayLimit';
  else if (done >= allowed) reason = 'needPomodoro';
  return { ok: !reason, reason, done, allowed, completed, lineup: lu };
}

/** Saf hesap: aynı gün + aynı maç sırası her zaman aynı sonucu verir. */
export function simulateFriendly({ theme, power, minutes, day, n }) {
  const rng = seededRandom(`f|${theme.id}|${day}|${n}`);
  const opp = levelInfo(theme, power).current.opponentPower;
  const noise = 1 + (rng() * 2 - 1) * F.randomness;
  const score = Math.round((power + minutes * W.minuteBonus) * noise);
  const ratio = opp > 0 ? score / opp : 2;
  let result = 'draw';
  if (ratio > 1 + W.winMargin) result = 'win';
  else if (ratio < 1 - W.winMargin) result = 'lose';
  const coins = result === 'win' ? F.winCoins : result === 'draw' ? F.drawCoins : F.loseCoins;
  return { result, score, opp, coins, power, minutes };
}

/** Analiz: en güçlü ve en zayıf hat, rakibe göre fark. */
export function analyze(lu, sim) {
  const lines = Object.values(lu.lines);
  const sorted = [...lines].sort((a, b) => b.strength - a.strength || a.role.localeCompare(b.role));
  return {
    strongest: sorted[0].role,
    weakest: sorted[sorted.length - 1].role,
    lines: lines.map((l) => ({ role: l.role, percent: Math.round(l.strength * 100) })),
    gap: sim.score - sim.opp,
  };
}

/** Maçı oynar (durumu değiştirir). Oynanamazsa { ok:false, reason } döner. */
export function playMatch(state, theme, now) {
  const st = matchStatus(state, theme, now);
  if (!st.ok) return { ok: false, reason: st.reason };
  const ts = themeState(state, theme.id, now);
  const day = dayKey(now);
  const minutes = (state.daily[day] && state.daily[day].minutes) || 0;
  const power = totalPower(theme, ts.owned);
  const sim = simulateFriendly({ theme, power, minutes, day, n: st.done });
  const match = { themeId: theme.id, day, at: now, ...sim, analysis: analyze(st.lineup, sim) };
  state.wallet.coins += match.coins;
  state.wallet.earnedTotal += match.coins;
  if (!ts.friendlies) ts.friendlies = [];
  ts.friendlies.push({ day, at: now, result: sim.result, coins: sim.coins });
  return { ok: true, match };
}
