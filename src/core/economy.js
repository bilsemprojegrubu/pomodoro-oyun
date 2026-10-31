// Para kazanma/harcama, güç ve seviye hesapları.
import { CONFIG } from '../config.js';
import { dayKey } from './dates.js';
import { defaultThemeState } from './storage.js';

const E = CONFIG.economy;

/** Odak süresine orantılı temel ödül (25 dk = 100, 45 dk = 180). */
export function baseReward(minutes) {
  return Math.round(minutes * E.coinsPerMinute);
}

/** Bir Pomodoro'nun ödülünü hesaplar (saf fonksiyon). */
export function computeReward({ plannedMin, task, rewardedToday, setCompleted }) {
  if (rewardedToday >= E.dailyRewardedCap) {
    return { capped: true, base: 0, bonuses: [], total: 0 };
  }
  const base = baseReward(plannedMin);
  const bonuses = [];
  if (rewardedToday === 0) bonuses.push({ id: 'first', coins: E.firstOfDayBonus });
  if (setCompleted) bonuses.push({ id: 'set', coins: E.setBonus });
  if (task && task.trim()) bonuses.push({ id: 'task', coins: E.taskBonus });
  const total = base + bonuses.reduce((a, b) => a + b.coins, 0);
  return { capped: false, base, bonuses, total };
}

/** Günlük kaydı (yoksa oluşturur). */
export function dailyRecord(state, day) {
  if (!state.daily[day]) state.daily[day] = { rewarded: 0, completed: 0, minutes: 0 };
  return state.daily[day];
}

/**
 * Tamamlanan odak oturumunu ekonomiye işler: set sayacı, günlük tavan, para.
 * Durumu değiştirir ve { reward, setCompleted, day } döndürür.
 * control = true ise (araştırma kontrol modu) para verilmez.
 */
export function applyCompletion(state, { plannedMin, actualMin, task, now, control = false }) {
  const day = dayKey(now);
  if (state.cycle.day !== day) state.cycle = { count: 0, day, nextBreak: null };
  state.cycle.count += 1;
  const setCompleted = state.cycle.count >= CONFIG.timer.setSize;
  if (setCompleted) state.cycle.count = 0;

  const rec = dailyRecord(state, day);
  let reward = { capped: false, base: 0, bonuses: [], total: 0 };
  if (!control) {
    reward = computeReward({ plannedMin, task, rewardedToday: rec.rewarded, setCompleted });
    if (reward.total > 0) {
      rec.rewarded += 1;
      state.wallet.coins += reward.total;
      state.wallet.earnedTotal += reward.total;
    }
  }
  rec.completed += 1;
  rec.minutes += actualMin;
  return { reward, setCompleted, day };
}

/** Bir ürünün ait olduğu slot grubu: mevkili kategoride rolü, değilse "*". */
export function slotGroup(cat, item) {
  return cat.roleSlots ? item.role : '*';
}

/** Slot grubunun kapasitesi. */
export function slotCapacity(cat, group, setup = null) {
  return cat.roleSlots ? slotsOf(cat, setup)[group] || 0 : cat.slotLimit;
}

/** Mevkili kategoride (futbol) seçili diziliş; yoksa varsayılan mevki kotaları. setup = tema ilerleme kaydı. */
export function slotsOf(cat, setup = null) {
  if (!cat.roleSlots) return null;
  const f = setup && setup.formation;
  return (cat.formations && cat.formations[f]) || cat.roleSlots;
}

/** Temanın her kategorisinde slotlara giren en güçlü ürünler (mevkili kategoride her mevkinin kotası ayrı). */
export function equippedIds(theme, ownedIds, setup = null) {
  const owned = new Set(ownedIds);
  const picks = (setup && setup.picks) || {};
  const out = {};
  for (const cat of theme.categories) {
    const mine = theme.items.filter((i) => i.category === cat.id && owned.has(i.id));
    const groups = cat.roleSlots ? Object.keys(slotsOf(cat, setup)) : ['*'];
    const manual = Array.isArray(picks[cat.id]) ? picks[cat.id] : null;
    out[cat.id] = groups.flatMap((g) => {
      const pool = mine.filter((i) => slotGroup(cat, i) === g);
      const cap = slotCapacity(cat, g, setup);
      if (manual) {
        // Elle seçilmiş kadro: sadece sahip olunan, bu mevkiye ait, kotayı aşmayan seçimler.
        const ok = new Set(pool.map((i) => i.id));
        return [...new Set(manual)].filter((id) => ok.has(id)).slice(0, cap);
      }
      return pool.sort((a, b) => b.power - a.power || a.id.localeCompare(b.id)).slice(0, cap).map((i) => i.id);
    });
  }
  return out;
}

/** Toplam güç: her kategoride sadece slotlara giren ürünler sayılır. */
export function totalPower(theme, ownedIds, setup = null) {
  const eq = equippedIds(theme, ownedIds, setup);
  const byId = new Map(theme.items.map((i) => [i.id, i]));
  let sum = 0;
  for (const ids of Object.values(eq)) for (const id of ids) sum += byId.get(id).power;
  return sum;
}

/** Güce göre seviye bilgisi. */
export function levelInfo(theme, power) {
  const levels = theme.levels;
  let idx = 0;
  for (let i = 0; i < levels.length; i++) if (power >= levels[i].requiredPower) idx = i;
  const current = levels[idx];
  const next = levels[idx + 1] || null;
  const progress = next
    ? (power - current.requiredPower) / (next.requiredPower - current.requiredPower)
    : 1;
  return {
    level: current.id,
    index: idx,
    current,
    next,
    progress: Math.max(0, Math.min(1, progress)),
    toNext: next ? next.requiredPower - power : 0,
  };
}

/** Hedef fiyata ulaşmak için kaç Pomodoro daha gerekli (en az 0). */
export function pomodorosNeeded(price, coins) {
  const perPomodoro = baseReward(E.baseFocusMinutes);
  return Math.max(0, Math.ceil((price - coins) / perPomodoro));
}

/** Tema ilerleme kaydını getirir (yoksa oluşturur). */
export function themeState(state, themeId, now = Date.now()) {
  if (!state.themes[themeId]) state.themes[themeId] = defaultThemeState(now);
  return state.themes[themeId];
}

/** Ürünü satın alır. Durumu değiştirir. { ok, reason, leveledUp, ... } döndürür. */
export function buyItem(state, theme, itemId, now = Date.now()) {
  const item = theme.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'notFound' };
  const ts = themeState(state, theme.id, now);
  if (ts.owned.includes(itemId)) return { ok: false, reason: 'owned' };
  const before = levelInfo(theme, totalPower(theme, ts.owned, ts));
  if (item.minLevel > before.level) return { ok: false, reason: 'locked' };
  if (state.wallet.coins < item.price) return { ok: false, reason: 'coins' };
  state.wallet.coins -= item.price;
  state.wallet.spentTotal += item.price;
  ts.owned.push(itemId);
  addToManualPicks(theme, ts, item);
  if (ts.goalItem === itemId) ts.goalItem = null;
  const power = totalPower(theme, ts.owned, ts);
  const after = levelInfo(theme, power);
  const leveledUp = after.level > ts.levelSeen;
  if (leveledUp) ts.levelSeen = after.level;
  return { ok: true, item, leveledUp, level: after.current, power };
}

/** Elle kurulmuş kadroda yeni alınan ürüne boş yer varsa onu da kadroya ekler (yoksa yedekte kalır). */
function addToManualPicks(theme, ts, item) {
  const manual = ts.picks && ts.picks[item.category];
  if (!Array.isArray(manual)) return;
  const cat = theme.categories.find((c) => c.id === item.category);
  const eq = equippedIds(theme, ts.owned.filter((id) => id !== item.id), ts)[cat.id];
  const group = slotGroup(cat, item);
  const used = eq.filter((id) => slotGroup(cat, theme.items.find((i) => i.id === id)) === group).length;
  if (used < slotCapacity(cat, group, ts)) manual.push(item.id);
}

/** Bir kategoride elle seçim yapılmış mı? */
export const isManual = (ts, catId) => !!(ts.picks && Array.isArray(ts.picks[catId]));

/** Elle kadroya geçer: o anki otomatik kadroyu başlangıç olarak kaydeder. */
function startManual(theme, ts, catId) {
  if (!ts.picks) ts.picks = {};
  if (!Array.isArray(ts.picks[catId])) ts.picks[catId] = [...equippedIds(theme, ts.owned, ts)[catId]];
}

/** Kadrodaki `outId` yerine yedekteki `inId` ürününü koyar (aynı mevki). outId yoksa boş yere ekler. */
export function swapPick(theme, ts, catId, inId, outId = null) {
  startManual(theme, ts, catId);
  const list = ts.picks[catId].filter((id) => id !== outId && id !== inId);
  list.push(inId);
  ts.picks[catId] = list;
}

/** Ürünü kadrodan çıkarıp yedeğe alır. */
export function benchPick(theme, ts, catId, id) {
  startManual(theme, ts, catId);
  ts.picks[catId] = ts.picks[catId].filter((x) => x !== id);
}

/** Otomatik (en güçlü) kadroya geri döner. */
export function resetPicks(ts, catId) {
  if (ts.picks) delete ts.picks[catId];
}

/** Dizilişi değiştirir. Elle kadro varsa yeni kotalara sığdırıp boşları en güçlülerle doldurur. */
export function setFormation(theme, ts, formation) {
  const cat = theme.categories.find((c) => c.roleSlots && c.formations);
  if (!cat || !cat.formations[formation]) return false;
  const manual = isManual(ts, cat.id);
  const before = manual ? equippedIds(theme, ts.owned, ts)[cat.id] : null;
  ts.formation = formation;
  if (manual) {
    const kept = new Set(before);
    const chosen = equippedIds(theme, ts.owned, { ...ts, picks: { [cat.id]: [...kept] } })[cat.id];
    const out = [...chosen];
    for (const [g, cap] of Object.entries(cat.formations[formation])) {
      const have = out.filter((id) => slotGroup(cat, theme.items.find((i) => i.id === id)) === g).length;
      const extra = theme.items
        .filter((i) => i.category === cat.id && slotGroup(cat, i) === g && ts.owned.includes(i.id) && !out.includes(i.id))
        .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id))
        .slice(0, Math.max(0, cap - have));
      out.push(...extra.map((i) => i.id));
    }
    ts.picks[cat.id] = out;
  }
  return true;
}
