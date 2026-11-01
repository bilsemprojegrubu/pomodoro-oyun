import { describe, it, expect } from 'vitest';
import { checkSupport, makeQuestion, SUPPORT } from '../src/core/support.js';

const ok = { username: 'Ali_12', email: 'Ali@Gmail.com', message: 'Şifremi unuttum, yardım eder misiniz?', honey: '', answer: '7', expected: '7' };

describe('destek kutusu', () => {
  it('geçerli mesajı temizleyip kabul eder', () => {
    const r = checkSupport(ok);
    expect(r.ok).toBe(true);
    expect(r.row).toEqual({ username: 'ali_12', email: 'ali@gmail.com', message: 'Şifremi unuttum, yardım eder misiniz?' });
  });
  it('tuzak alan doluysa spam sayar', () => { expect(checkSupport({ ...ok, honey: 'x' })).toEqual({ ok: false, reason: 'spam' }); });
  it('yanlış cevap, bağlantı, kısa/uzun mesaj ve kötü e-posta reddedilir', () => {
    expect(checkSupport({ ...ok, answer: '8' }).ok).toBe(false);
    expect(checkSupport({ ...ok, message: 'bak https://kotu.site ziyaret et' }).ok).toBe(false);
    expect(checkSupport({ ...ok, message: 'kısa' }).ok).toBe(false);
    expect(checkSupport({ ...ok, message: 'a'.repeat(SUPPORT.maxMessage + 1) }).ok).toBe(false);
    expect(checkSupport({ ...ok, email: 'yok' }).ok).toBe(false);
    expect(checkSupport({ ...ok, email: '' }).ok).toBe(false);
    expect(checkSupport({ ...ok, username: 'a' }).ok).toBe(false);
  });
  it('bekleme süresi dolmadan ikinci mesajı reddeder', () => {
    const now = 1_000_000;
    expect(checkSupport({ ...ok, lastAt: now - 60_000, now }).ok).toBe(false);
    expect(checkSupport({ ...ok, lastAt: now - SUPPORT.cooldownMs - 1, now }).ok).toBe(true);
  });
  it('soru ve cevap tutarlı', () => {
    const q = makeQuestion(() => 0.5);
    const [a, , b] = q.text.split(' ');
    expect(q.answer).toBe(String(Number(a) + Number(b)));
  });
});
