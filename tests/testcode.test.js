import { describe, it, expect } from 'vitest';
import { hashText, redeemHash, TEST_CODE_COINS } from '../src/core/testcode.js';

describe('test kodu', () => {
  it('doğru kod 100000 para ekler, yanlış kod eklemez', async () => {
    const state = { wallet: { coins: 5, earnedTotal: 5 } };
    expect(redeemHash(state, await hashText('yanlis'))).toEqual({ ok: false });
    expect(state.wallet.coins).toBe(5);
    const r = redeemHash(state, await hashText('Oyb160512.'));
    expect(r.ok).toBe(true);
    expect(state.wallet.coins).toBe(5 + TEST_CODE_COINS);
    expect(state.wallet.earnedTotal).toBe(5);
  });
  it('büyük/küçük harf önemlidir', async () => {
    const state = { wallet: { coins: 0, earnedTotal: 0 } };
    expect(redeemHash(state, await hashText('oyb160512.')).ok).toBe(false);
  });
});
