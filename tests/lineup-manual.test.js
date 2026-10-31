import { describe, it, expect } from 'vitest';
import { THEMES } from '../src/themes/index.js';
import { defaultState } from '../src/core/storage.js';
import { themeState, equippedIds, totalPower, swapPick, benchPick, resetPicks, setFormation, buyItem } from '../src/core/economy.js';

const theme = THEMES.football;
const cat = theme.categories[0];
const forwards = theme.items.filter((i) => i.category === 'players' && i.role === 'Forvet').sort((a, b) => b.power - a.power);

function stateWith(ids) {
  const st = defaultState(Date.now());
  themeState(st, 'football').owned = ids;
  return st;
}

describe('elle kadro ve diziliş', () => {
  it('diziliş mevki kotalarını değiştirir (4-4-2: 2 forvet, 4 orta saha)', () => {
    const st = stateWith(theme.items.filter((i) => i.category === 'players').map((i) => i.id));
    const ts = themeState(st, 'football');
    expect(setFormation(theme, ts, '4-4-2')).toBe(true);
    const eq = equippedIds(theme, ts.owned, ts).players.map((id) => theme.items.find((i) => i.id === id));
    expect(eq.filter((i) => i.role === 'Forvet')).toHaveLength(2);
    expect(eq.filter((i) => i.role === 'Orta saha')).toHaveLength(4);
    expect(eq).toHaveLength(11);
    expect(setFormation(theme, ts, 'yok')).toBe(false);
  });

  it('en iyi forvet yedeğe alınıp yerine başkası oynatılabilir', () => {
    const st = stateWith(theme.items.filter((i) => i.category === 'players').map((i) => i.id));
    const ts = themeState(st, 'football');
    const auto = totalPower(theme, ts.owned, ts);
    const best = forwards[0];
    const fourth = forwards[3];
    swapPick(theme, ts, 'players', fourth.id, best.id);
    const eq = equippedIds(theme, ts.owned, ts).players;
    expect(eq).not.toContain(best.id);
    expect(eq).toContain(fourth.id);
    expect(eq).toHaveLength(11);
    expect(totalPower(theme, ts.owned, ts)).toBeLessThan(auto);
    resetPicks(ts, 'players');
    expect(totalPower(theme, ts.owned, ts)).toBe(auto);
  });

  it('yedeğe alınca boş yer kalır; yeni alınan oyuncu boş yere otomatik girer', () => {
    const st = stateWith(['p01']);
    const ts = themeState(st, 'football');
    const p = theme.items.find((i) => i.id === 'p01');
    benchPick(theme, ts, 'players', 'p01');
    expect(equippedIds(theme, ts.owned, ts).players).toEqual([]);
    st.wallet.coins = 1e9;
    const other = theme.items.find((i) => i.category === 'players' && i.role === p.role && i.id !== 'p01' && i.minLevel === 1);
    expect(buyItem(st, theme, other.id).ok).toBe(true);
    expect(equippedIds(theme, ts.owned, ts).players).toContain(other.id);
  });

  it('sahip olunmayan ya da yanlış mevkideki seçimler yok sayılır', () => {
    const st = stateWith(['p01']);
    const ts = themeState(st, 'football');
    ts.picks = { players: ['p01', 'p01', 'olmayan'] };
    expect(equippedIds(theme, ts.owned, ts).players).toEqual(['p01']);
  });
});
