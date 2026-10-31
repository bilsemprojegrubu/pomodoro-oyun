// Test kodu: siteyi hızlı denemek için. Doğru kod girilince cüzdana para ekler.
// Kodun kendisi dosyada durmaz, sadece özeti (SHA-256) durur. Bu, kodu gizli tutmaz ama düz yazı olarak okunmasını engeller.
// Kaldırmak için: bu dosyayı, settings.js'deki "Test kodu" bölümünü ve tr.json'daki "testCode" bloğunu sil.
import { themeState, slotGroup, slotCapacity } from './economy.js';

export const TEST_CODE_HASH = '13ddb23353f2f8f9da5c2c8e6b4a3b699ac90f044c1f2481e9b37a0a2fc6c8f7';
export const TEST_CODE_COINS = 100000;

/** Metnin SHA-256 özetini (küçük harf onaltılık) verir. Güvenli bağlantı gerekir (https ya da localhost). */
export async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Özet doğruysa cüzdana ekler. Her girişte tekrar verir (test içindir). İstatistikteki "toplam kazanılan"a eklenmez. */
export function redeemHash(state, hash) {
  if (hash !== TEST_CODE_HASH) return { ok: false };
  state.wallet.coins += TEST_CODE_COINS;
  return { ok: true, coins: TEST_CODE_COINS };
}

/** Temanın her kategorisinde, slot kotası kadar en güçlü ürünlerin kimlikleri (mevkili kategoride her mevkinin kotası ayrı). */
export function bestLineupIds(theme) {
  const ids = [];
  for (const cat of theme.categories) {
    const groups = cat.roleSlots ? Object.keys(cat.roleSlots) : ['*'];
    for (const g of groups) {
      theme.items
        .filter((i) => i.category === cat.id && slotGroup(cat, i) === g)
        .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id))
        .slice(0, slotCapacity(cat, g))
        .forEach((i) => ids.push(i.id));
    }
  }
  return ids;
}

/** Test ayarı: en güçlü kadroyu bedava ve seviye kilidine bakmadan sahiplenir. Zaten sahip olunanlara dokunmaz. */
export function applyAutoLineup(state, theme, now = Date.now()) {
  const ts = themeState(state, theme.id, now);
  let added = 0;
  for (const id of bestLineupIds(theme)) {
    if (!ts.owned.includes(id)) { ts.owned.push(id); added += 1; }
  }
  return added;
}
