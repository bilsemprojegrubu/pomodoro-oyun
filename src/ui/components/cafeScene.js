// Kafe sahnesi: sahip olunan ürünler kafenin içinde görünür, müşteriler gelip sipariş verir.
// Yalnızca kafe temasında kullanılır. Yerleşim yüzdeyle verilir (sahne genişliğine göre ölçeklenir).
import { h, fromHTML } from '../dom.js';
import { characterArt } from '../../assets/art.js';
import { equippedIds, levelInfo, totalPower } from '../../core/economy.js';

// Duvara asılanlar / yere konanlar (kafe ürün kimlikleri)
const WALL_IDS = ['m04', 'm05', 'm06', 'm07', 'm13', 'm11', 'm10'];
const WALL_POS = [[38, 24], [50, 17], [62, 24], [74, 17], [86, 24], [31, 17]];
const FLOOR_POS = [[10, 90], [26, 83], [42, 90], [58, 83], [74, 90], [90, 83]];
const EQUIP_POS = [[7, 54], [18, 54], [29, 54], [40, 54]];
const STAFF_X = [50, 63, 76, 89];
const STOPS = [14, 34, 54, 74];

/** Kafe sahnesi (HTML öğesi döner). ts: tema ilerleme kaydı. */
export function cafeScene(theme, ts) {
  const byId = new Map(theme.items.map((i) => [i.id, i]));
  const eq = equippedIds(theme, ts.owned, ts);
  const lvl = levelInfo(theme, totalPower(theme, ts.owned, ts));
  const pick = (cat) => (eq[cat] || []).map((id) => byId.get(id));

  const furniture = pick('furniture');
  let wall = furniture.filter((i) => WALL_IDS.includes(i.id));
  let floor = furniture.filter((i) => !WALL_IDS.includes(i.id));
  // Bir taraf dolarsa fazlalık diğer tarafa geçer.
  while (wall.length > WALL_POS.length) floor.push(wall.pop());
  while (floor.length > FLOOR_POS.length) wall.push(floor.pop());
  wall = wall.slice(0, WALL_POS.length);
  floor = floor.slice(0, FLOOR_POS.length);

  const staff = pick('staff').slice(0, STAFF_X.length);
  const equipment = pick('equipment').slice(0, EQUIP_POS.length);
  const menu = pick('menu');
  const orders = menu.length ? menu.map((i) => i.emoji) : ['☕'];
  const customers = ts.owned.length ? Math.min(4, 2 + lvl.index) : 0;

  const em = (item, [x, y], size, extra = '') =>
    h('span', { class: `cf-em ${extra}`, 'aria-hidden': 'true', style: { left: `${x}%`, top: `${y}%`, '--s': String(size) } }, item.emoji);

  const scene = h('div', { class: 'cafe-scene', role: 'img', 'aria-label': `${theme.name}: ${staff.length} ekip üyesi, ${customers} müşteri` },
    h('div', { class: 'cf-window', 'aria-hidden': 'true' }, h('span', null, '☀️')),
    ...wall.map((it, k) => em(it, WALL_POS[k], 9)),
    ...staff.map((it, k) => {
      const box = h('span', { class: 'cf-staff', 'aria-hidden': 'true', style: { left: `${STAFF_X[k]}%` } });
      box.append(fromHTML(characterArt('cafe', Number(it.art.split('-')[2]) || 0, it.role, it.id, 64)));
      return box;
    }),
    h('div', { class: 'cf-counter', 'aria-hidden': 'true' }),
    ...equipment.map((it, k) => em(it, EQUIP_POS[k], 9)),
    h('div', { class: 'cf-case', 'aria-hidden': 'true' },
      menu.slice(0, 8).map((it) => h('span', null, it.emoji))),
    ...floor.map((it, k) => em(it, FLOOR_POS[k], 12, 'floor')),
    ...Array.from({ length: customers }, (_, k) => {
      const c = h('span', { class: 'cf-cust', 'aria-hidden': 'true', style: { '--stop': `${STOPS[k]}%`, '--delay': `${-k * 4}s` } });
      c.append(fromHTML(characterArt('cafe', k + 1, '', `musteri${k}`, 64)));
      c.append(h('span', { class: 'cf-bubble' }, orders[k % orders.length]));
      return c;
    }));
  return scene;
}
