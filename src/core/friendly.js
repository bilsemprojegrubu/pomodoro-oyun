// Günlük karşılaşma: futbolda hazırlık maçı, kafede rakip kafe, modada rakip atölye, barınakta komşu barınak.
// Para farm'lanamasın diye her maç için o gün tamamlanmış bir Pomodoro gerekir (günde en fazla 3 maç).
import { CONFIG } from '../config.js';
import { dayKey, seededRandom } from './dates.js';
import { equippedIds, levelInfo, themeState, totalPower } from './economy.js';

const F = CONFIG.friendly;
const W = CONFIG.weekly;

/** Mevkili (11'li) oyuncu kategorisi (sadece futbol); diğer temalarda yok. */
export function lineupCategory(theme) {
  return theme.categories.find((c) => c.roleSlots) || null;
}

/** Her temada bir rakiple günlük karşılaşma vardır. */
export const supportsFriendly = (theme) => theme.categories.length > 0;

/** Oyunda gerçekten bulunan en iyi `slots` ürünün güç toplamı: o alanın ulaşabileceği en yüksek güç. */
const bestSum = (theme, pred, slots) => theme.items.filter(pred).map((i) => i.power).sort((a, b) => b - a)
  .slice(0, slots).reduce((a, b) => a + b, 0);

/**
 * Alanlara göre güç: futbolda mevkiler (kaleci, defans...), diğer temalarda kategoriler.
 * strength: o alanın, oyundaki en iyi ürünlerle dolu olsaydı ulaşacağı gücün kaçta kaçı (0-1). En iyi kadroyla 1 olur.
 */
export function lineup(theme, ownedIds) {
  const cat = lineupCategory(theme);
  const eq = equippedIds(theme, ownedIds);
  const byId = new Map(theme.items.map((i) => [i.id, i]));
  const lines = {};
  let filled = 0;
  let total = 0;
  if (cat) {
    for (const [role, slots] of Object.entries(cat.roleSlots)) {
      const mine = eq[cat.id].map((id) => byId.get(id)).filter((i) => i.role === role);
      const best = bestSum(theme, (i) => i.category === cat.id && i.role === role, slots);
      const power = mine.reduce((a, i) => a + i.power, 0);
      lines[role] = { role, count: mine.length, slots, power, strength: power / best };
      filled += mine.length;
      total += slots;
    }
    return { total, filled, needsFull: true, lines };
  }
  for (const c of theme.categories) {
    const mine = eq[c.id].map((id) => byId.get(id));
    const best = bestSum(theme, (i) => i.category === c.id, c.slotLimit);
    const power = mine.reduce((a, i) => a + i.power, 0);
    lines[c.name] = { role: c.name, count: mine.length, slots: c.slotLimit, power, strength: power / best };
    filled += mine.length;
    total += c.slotLimit;
  }
  return { total, filled, needsFull: false, lines };
}

/** Bugünkü karşılaşma durumu: oynanabilir mi, neden olmuyor? */
export function matchStatus(state, theme, now) {
  const ts = themeState(state, theme.id, now);
  const lu = lineup(theme, ts.owned);
  const day = dayKey(now);
  const done = (ts.friendlies || []).filter((m) => m.day === day).length;
  // Test kodu girilmişse sanki o kadar Pomodoro yapılmış gibi sayılır ve günlük sınır uygulanmaz.
  const bonus = (state.settings && state.settings.testBonusPomodoros) || 0;
  const completed = ((state.daily[day] && state.daily[day].completed) || 0) + bonus;
  const allowed = bonus ? completed : Math.min(F.maxPerDay, completed);
  let reason = null;
  if (lu.needsFull && lu.filled < lu.total) reason = 'lineup';
  else if (lu.filled === 0) reason = 'empty';
  else if (!bonus && done >= F.maxPerDay) reason = 'dayLimit';
  else if (done >= allowed) reason = 'needPomodoro';
  return { ok: !reason, reason, done, allowed, completed, unlimited: !!bonus, lineup: lu };
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
  // Hepsi (neredeyse) tam güçteyse "en zayıf alan" diye bir şey yoktur.
  const perfect = sorted[sorted.length - 1].strength >= 0.995;
  return {
    perfect,
    strongest: perfect ? null : sorted[0].role,
    weakest: perfect ? null : sorted[sorted.length - 1].role,
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
