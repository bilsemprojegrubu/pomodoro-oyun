import { describe, it, expect } from 'vitest';
import { awardGameCoins } from '../src/core/gameCoins.js';
import { CONFIG } from '../src/config.js';

const mk = () => ({ daily: {}, wallet: { coins: 0, earnedTotal: 0 } });

describe('oyun parası', () => {
  it('para verir ve cüzdana yazar', () => {
    const s = mk();
    expect(awardGameCoins(s, 20, 1000)).toBe(20);
    expect(s.wallet.coins).toBe(20);
  });
  it('günlük tavanı aşmaz', () => {
    const s = mk();
    let total = 0;
    for (let i = 0; i < 20; i++) total += awardGameCoins(s, 20, 1000);
    expect(total).toBe(CONFIG.economy.dailyGameCoinCap);
    expect(awardGameCoins(s, 20, 1000)).toBe(0);
  });
  it('ertesi gün tavan yenilenir', () => {
    const s = mk();
    awardGameCoins(s, 1000, 1000);
    expect(awardGameCoins(s, 20, 1000 + 86400000 * 2)).toBe(20);
  });
});
