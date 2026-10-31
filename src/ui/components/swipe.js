// Sağa/sola kaydırarak sekme değiştirme. Sola kaydır: sonraki sekme, sağa kaydır: önceki sekme.
import { TABS } from './nav.js';

const MIN_DX = 70;      // en az bu kadar yatay yol (piksel)
const MAX_MS = 700;     // bu süreden uzun sürerse kaydırma sayılmaz
const SKIP = 'input, select, textarea, button[role="slider"], [role="slider"], .no-swipe, .heat-wrap, .modal, #overlay *';

/** Yatay olarak kaydırılabilen bir üst öğe var mı? (tablo, ısı haritası vb. ile çakışmasın) */
function scrollsSideways(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 4) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/**
 * @param {object} o
 * @param {() => string|null} o.current  şu anki sekme kimliği (sekme dışı ekranlarda null)
 * @param {() => boolean} o.control      kontrol modunda oyun sekmeleri gizli
 * @param {(id: string) => void} o.go    sekmeye git
 */
export function enableSwipe({ current, control, go }) {
  let start = null;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest(SKIP) || scrollsSideways(e.target)) { start = null; return; }
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, at: Date.now() };
  }, { passive: true });
  document.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const quick = Date.now() - start.at <= MAX_MS;
    start = null;
    if (!quick || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    const cur = current();
    if (!cur || document.getElementById('overlay').childElementCount) return;
    const tabs = TABS.filter((tab) => !(control() && tab.game));
    const i = tabs.findIndex((tab) => tab.id === cur);
    const j = i + (dx < 0 ? 1 : -1);
    if (i < 0 || j < 0 || j >= tabs.length) return;
    go(tabs[j].id);
  }, { passive: true });
}
