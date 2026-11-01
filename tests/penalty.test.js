import { describe, it, expect } from 'vitest';
import { shotOutcome, PK_GOAL } from '../src/core/penalty.js';
import { readSwipe } from '../src/ui/components/penaltyScene.js';

const W = 300, H = 300;
// Düz yukarı kaydırma: n adım, her adım dt ms.
const line = (x0, y0, x1, y1, steps, dt, bow = 0) => Array.from({ length: steps + 1 }, (_, i) => {
  const k = i / steps;
  return { x: x0 + (x1 - x0) * k + bow * Math.sin(k * Math.PI), y: y0 + (y1 - y0) * k, t: i * dt };
});

describe('kaydırma okuma', () => {
  it('kısa ya da aşağı kaydırma şut sayılmaz', () => {
    expect(readSwipe(line(150, 250, 152, 245, 4, 20), W, H)).toBeNull();
    expect(readSwipe(line(150, 150, 150, 260, 6, 20), W, H)).toBeNull();
  });
  it('düz yukarı = orta, falsosuz', () => {
    const s = readSwipe(line(150, 260, 150, 120, 8, 20), W, H);
    expect(Math.abs(s.tx - 50)).toBeLessThan(1);
    expect(s.bend).toBe(0);
  });
  it('sağa çapraz = sağ taraf', () => {
    expect(readSwipe(line(150, 260, 220, 140, 8, 20), W, H).tx).toBeGreaterThan(65);
    expect(readSwipe(line(150, 260, 80, 140, 8, 20), W, H).tx).toBeLessThan(35);
  });
  it('hızlı kaydırma daha güçlü', () => {
    const slow = readSwipe(line(150, 260, 150, 120, 10, 60), W, H);
    const fast = readSwipe(line(150, 260, 150, 120, 6, 12), W, H);
    expect(fast.power).toBeGreaterThan(slow.power);
  });
  it('çok hızlı kaydırma üstten çıkar', () => {
    expect(readSwipe(line(150, 290, 150, 0, 4, 8), W, H).over).toBe(true);
  });
  it('kavisli kaydırma falso verir (sağa şişen yol +)', () => {
    expect(readSwipe(line(150, 260, 150, 120, 10, 20, 40), W, H).bend).toBeGreaterThan(0);
    expect(readSwipe(line(150, 260, 150, 120, 10, 20, -40), W, H).bend).toBeLessThan(0);
  });
});

describe('şut sonucu', () => {
  const G = PK_GOAL;
  it('kaleci olmayan köşe gol, olduğu köşe kurtarış', () => {
    expect(shotOutcome({ tx: 25, power: 0.5, keeper: 2 }).result).toBe('goal');
    expect(shotOutcome({ tx: 50, power: 0.5, keeper: 1 }).result).toBe('save');
  });
  it('dışarı, direk ve üstten aut', () => {
    expect(shotOutcome({ tx: G.l - 5, power: 0.5, keeper: 1 }).result).toBe('miss');
    expect(shotOutcome({ tx: G.r + 1, power: 0.5, keeper: 1 }).result).toBe('post');
    expect(shotOutcome({ tx: 50, power: 1, over: true, keeper: 0 }).result).toBe('miss');
  });
  it('yavaş şutta kaleci yan köşeye yetişir', () => {
    expect(shotOutcome({ tx: 30, power: 0.1, keeper: 1 }).result).toBe('save');
    expect(shotOutcome({ tx: 30, power: 0.6, keeper: 1 }).result).toBe('goal');
  });
  it('sert köşe şutu kaleci oradayken bile gol', () => {
    expect(shotOutcome({ tx: G.l + 4, power: 0.9, keeper: 0 }).result).toBe('goal');
    expect(shotOutcome({ tx: G.l + 4, power: 0.5, keeper: 0 }).result).toBe('save');
  });
  it('güçlü şut daha yükseğe gider', () => {
    expect(shotOutcome({ tx: 30, power: 1, keeper: 2 }).ty).toBeLessThan(shotOutcome({ tx: 30, power: 0, keeper: 2 }).ty);
  });
});
