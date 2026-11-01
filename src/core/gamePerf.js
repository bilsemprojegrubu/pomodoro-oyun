// Oyun başarısı: günün özetindeki (günlük karşılaşma) skoru etkiler.
// Hiç oyun oynanmadıysa -%15, hepsi başarısız -%20, hepsi başarılı 0 (aradaki başarı yüzdesi doğrusal).
import { CONFIG } from '../config.js';
import { dayKey } from './dates.js';
import { dailyRecord } from './economy.js';

const G = CONFIG.friendly.gameEffect;

/** Bir oyun turunun başarısını kaydeder (rate: 0-1). Güncel etkiyi (yüzde) döndürür. */
export function recordGame(state, rate, now = Date.now()) {
  const rec = dailyRecord(state, dayKey(now));
  rec.games = (rec.games || 0) + 1;
  rec.gameSum = (rec.gameSum || 0) + Math.max(0, Math.min(1, rate));
  return gameEffect(rec);
}

/** Günlük kayıttan oyun etkisi: { pct (yüzde), games, rate (ortalama başarı 0-1 ya da null) }. */
export function gameEffect(rec) {
  const games = (rec && rec.games) || 0;
  if (!games) return { pct: G.none, games: 0, rate: null };
  const rate = rec.gameSum / games;
  return { pct: Math.round(G.worst + (G.best - G.worst) * rate), games, rate };
}
