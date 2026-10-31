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

import { THEMES } from '../src/themes/index.js';
import { applyAutoLineup, bestLineupIds } from '../src/core/testcode.js';
import { equippedIds, totalPower } from '../src/core/economy.js';
import { defaultState } from '../src/core/storage.js';

describe('otomatik en güçlü kadro', () => {
  it('her temada kadroyu doldurur ve toplam güç tüm kadrodan büyük olamaz', () => {
    for (const theme of Object.values(THEMES)) {
      const state = defaultState(Date.now());
      applyAutoLineup(state, theme);
      const owned = state.themes[theme.id].owned;
      const eq = equippedIds(theme, owned);
      for (const cat of theme.categories) {
        const groups = cat.roleSlots ? Object.values(cat.roleSlots) : [cat.slotLimit];
        expect(eq[cat.id].length).toBe(groups.reduce((a, b) => a + b, 0));
      }
      expect(owned.length).toBe(bestLineupIds(theme).length);
      expect(totalPower(theme, owned)).toBeGreaterThan(0);
    }
  });
  it('ikinci kez çalışınca yinelenen eklemez, parayı değiştirmez', () => {
    const theme = THEMES.football;
    const state = defaultState(Date.now());
    applyAutoLineup(state, theme);
    expect(applyAutoLineup(state, theme)).toBe(0);
    expect(state.wallet.coins).toBe(0);
  });
});

import { matchStatus, playMatch } from '../src/core/friendly.js';

describe('test kodu ve hazırlık maçı', () => {
  it('kod girilince Pomodoro yapılmamış olsa da günde 3den fazla maç oynanır', async () => {
    const theme = THEMES.football;
    const now = Date.now();
    const state = defaultState(now);
    applyAutoLineup(state, theme, now);
    expect(matchStatus(state, theme, now).reason).toBe('needPomodoro');
    redeemHash(state, await hashText('Oyb160512.'));
    for (let i = 0; i < 6; i++) {
      expect(matchStatus(state, theme, now).ok).toBe(true);
      expect(playMatch(state, theme, now).ok).toBe(true);
    }
    expect(state.daily).toEqual({});
  });
});

import { lineup } from '../src/core/friendly.js';

describe('alan yüzdeleri', () => {
  it('en güçlü kadro her alanda %100 verir', () => {
    for (const theme of Object.values(THEMES)) {
      const state = defaultState(Date.now());
      applyAutoLineup(state, theme);
      const lu = lineup(theme, state.themes[theme.id].owned);
      for (const l of Object.values(lu.lines)) expect(l.strength).toBeCloseTo(1, 5);
    }
  });
});
