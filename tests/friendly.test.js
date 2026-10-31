import { describe, it, expect } from 'vitest';
import { defaultState } from '../src/core/storage.js';
import { matchStatus, playMatch, simulateFriendly, supportsFriendly } from '../src/core/friendly.js';
import { themeState, totalPower } from '../src/core/economy.js';
import { THEMES } from '../src/themes/index.js';
import tr from '../src/i18n/tr.json';

const theme = THEMES.football;
const now = new Date(2025, 0, 8, 12).getTime();

/** Her mevkiye kotası kadar en ucuz oyuncuyu verir (kötü ama tam bir ilk 11). */
function fullLineup() {
  const cat = theme.categories.find((c) => c.roleSlots);
  const ids = [];
  for (const [role, n] of Object.entries(cat.roleSlots)) {
    ids.push(...theme.items.filter((i) => i.category === cat.id && i.role === role).sort((a, b) => a.power - b.power).slice(0, n).map((i) => i.id));
  }
  return ids;
}

function ready(completed = 1) {
  const st = defaultState(now);
  themeState(st, 'football', now).owned = fullLineup();
  const day = '2025-01-08';
  st.daily[day] = { rewarded: completed, completed, minutes: completed * 25 };
  return st;
}

describe('hazırlık maçı', () => {
  it('dört temada da vardır; her temanın kendi metinleri tr.json içinde bulunur', () => {
    for (const id of Object.keys(THEMES)) {
      expect(supportsFriendly(THEMES[id])).toBe(true);
      const tx = tr.friendly.theme[id];
      for (const k of ['title', 'intro', 'ready', 'rival', 'unit']) expect(typeof tx[k]).toBe('string');
      for (const r of ['win', 'draw', 'lose']) {
        expect(tx.result[r].length).toBeGreaterThan(0);
        expect(tx.summary[r].length).toBeGreaterThan(0);
      }
    }
  });

  it('kafe, moda ve barınakta ilk 11 şartı yok; en az bir ürün yeterli, alanlar kategorilerdir', () => {
    for (const id of ['cafe', 'fashion', 'shelter']) {
      const th = THEMES[id];
      const st = defaultState(now);
      st.daily['2025-01-08'] = { rewarded: 1, completed: 1, minutes: 25 };
      expect(matchStatus(st, th, now).reason).toBe('empty');
      themeState(st, id, now).owned = [th.items[0].id];
      const s = matchStatus(st, th, now);
      expect(s.ok).toBe(true);
      expect(Object.keys(s.lineup.lines)).toEqual(th.categories.map((c) => c.name));
      const out = playMatch(st, th, now);
      expect(out.ok).toBe(true);
      expect(out.match.analysis.lines).toHaveLength(th.categories.length);
      expect(st.wallet.coins).toBeGreaterThanOrEqual(0);
    }
  });

  it('ilk 11 eksikse oynanmaz', () => {
    const st = defaultState(now);
    themeState(st, 'football', now).owned = fullLineup().slice(0, 5);
    st.daily['2025-01-08'] = { rewarded: 1, completed: 1, minutes: 25 };
    expect(matchStatus(st, theme, now).reason).toBe('lineup');
    expect(playMatch(st, theme, now).ok).toBe(false);
  });

  it('Pomodoro yapmadan maç hakkı yoktur', () => {
    const st = ready(0);
    expect(matchStatus(st, theme, now).reason).toBe('needPomodoro');
  });

  it('her maç için bir Pomodoro gerekir, günde en fazla 3 maç', () => {
    const st = ready(5);
    for (let i = 0; i < 3; i++) expect(playMatch(st, theme, now).ok).toBe(true);
    expect(matchStatus(st, theme, now).reason).toBe('dayLimit');
    const one = ready(1);
    expect(playMatch(one, theme, now).ok).toBe(true);
    expect(matchStatus(one, theme, now).reason).toBe('needPomodoro');
  });

  it('kazanınca 10 para verir; kaybedince ve berabere kalınca hiçbir şey eklenmez ya da alınmaz', () => {
    const win = simulateFriendly({ theme, power: 9999, minutes: 0, day: '2025-01-08', n: 0 });
    expect(win.result).toBe('win');
    expect(win.coins).toBe(10);
    const lose = simulateFriendly({ theme, power: 1, minutes: 0, day: '2025-01-08', n: 0 });
    expect(lose.result).toBe('lose');
    expect(lose.coins).toBe(0);
    const st = ready(1);
    st.wallet.coins = 50;
    const { match } = playMatch(st, theme, now);
    expect(st.wallet.coins).toBe(50 + match.coins);
    expect(st.wallet.coins).toBeGreaterThanOrEqual(50);
  });

  it('aynı gün ve aynı maç sırası için sonuç sabittir (tekrar deneme hilesi yok)', () => {
    const a = simulateFriendly({ theme, power: 90, minutes: 50, day: '2025-01-08', n: 1 });
    const b = simulateFriendly({ theme, power: 90, minutes: 50, day: '2025-01-08', n: 1 });
    expect(a).toEqual(b);
  });

  it('analiz en zayıf ve en güçlü mevkiyi bulur', () => {
    const st = ready(1);
    const ts = themeState(st, 'football', now);
    const gk = theme.items.filter((i) => i.role === 'Kaleci').sort((a, b) => b.power - a.power)[0];
    ts.owned.push(gk.id);
    const { match } = playMatch(st, theme, now);
    expect(match.analysis.strongest).toBe('Kaleci');
    expect(match.analysis.lines).toHaveLength(4);
    expect(totalPower(theme, ts.owned)).toBeGreaterThan(0);
  });
});
