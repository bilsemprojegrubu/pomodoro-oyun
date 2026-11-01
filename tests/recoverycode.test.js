import { describe, it, expect } from 'vitest';
import { makeCode, readCode } from '../src/core/recoveryCode.js';

describe('kurtarma kodu', () => {
  it('gidip gelince aynı metni verir (Türkçe karakterlerle)', async () => {
    const text = JSON.stringify({ ad: 'Çağrı şüğıöİ', n: Array.from({ length: 500 }, (_, i) => i) });
    const code = await makeCode(text);
    expect(code.startsWith('PO1.')).toBe(true);
    expect(await readCode(code)).toBe(text);
  });
  it('boşluk ve satır sonlarını yok sayar', async () => {
    const code = await makeCode('merhaba');
    expect(await readCode(` ${code.slice(0, 10)}\n${code.slice(10)} `)).toBe('merhaba');
  });
  it('bozuk kodda null döner', async () => {
    expect(await readCode('abc')).toBeNull();
    expect(await readCode('PO1.@@@')).toBeNull();
  });
});
