// Servis ve ek oyunlardan kazanılan küçük ödül. Günlük tavan vardır: asıl kazanç odaklanmadan gelir.
import { CONFIG } from '../config.js';
import { dayKey } from './dates.js';
import { dailyRecord } from './economy.js';

const E = CONFIG.economy;

/** Oyun parası verir; günlük tavanı aşmaz. Verilen miktarı döndürür (0 olabilir). */
export function awardGameCoins(state, amount, now = Date.now()) {
  const rec = dailyRecord(state, dayKey(now));
  const used = rec.gameCoins || 0;
  const give = Math.max(0, Math.min(Math.floor(amount), E.dailyGameCoinCap - used));
  if (give > 0) {
    rec.gameCoins = used + give;
    state.wallet.coins += give;
    state.wallet.earnedTotal += give;
  }
  return give;
}
