import { describe, it, expect } from 'vitest';
import { recordGame, gameEffect } from '../src/core/gamePerf.js';
import { dayKey } from '../src/core/dates.js';

const mk = () => ({ daily: {} });

describe('oyun başarısı etkisi', () => {
  it('hiç oyun yoksa -%15', () => {
    expect(gameEffect(undefined).pct).toBe(-15);
  });
  it('hepsi başarısızsa -%20, hepsi başarılıysa 0', () => {
    const a = mk(); recordGame(a, 0, 1000); recordGame(a, 0, 1000);
    expect(gameEffect(a.daily[dayKey(1000)]).pct).toBe(-20);
    const b = mk(); recordGame(b, 1, 1000);
    expect(gameEffect(b.daily[dayKey(1000)]).pct).toBe(0);
  });
  it('yarı yarıya -%10', () => {
    const s = mk(); recordGame(s, 1, 1000); recordGame(s, 0, 1000);
    expect(gameEffect(s.daily[dayKey(1000)]).pct).toBe(-10);
  });
});
