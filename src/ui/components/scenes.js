// Dünyam sahneleri: her temada sahip olunan ürünler çizili bir sahnede görünür (emoji yok, hepsi vektör çizim).
// Yerleşim yüzdeyle verilir: [x, y(alt kenar), genişlik]. Sahne 10:8 oranında, genişliğine göre ölçeklenir.
import { h, fromHTML } from '../dom.js';
import { characterArt } from '../../assets/art.js';
import { propArt } from '../../assets/props.js';
import { equippedIds, levelInfo, totalPower } from '../../core/economy.js';

const SVG = (body) => `<svg class="sc-bg" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

/** Sahnede yerleştirilmiş çizim. kind: 'prop' | 'char'. */
function place(svgText, [x, y, w], { top = false, z = 2, extra = '', style = {} } = {}) {
  const box = h('span', { class: `sc-p ${top ? 'top' : ''} ${extra}`, 'aria-hidden': 'true', style: { left: `${x}%`, top: `${y}%`, width: `${w}%`, zIndex: String(z), ...style } });
  box.append(fromHTML(svgText));
  return box;
}
const prop = (id, pos, o) => place(propArt(id) || '<svg viewBox="0 0 1 1"></svg>', pos, o);
const person = (item, pos, o) => place(characterArt(item.art.split('-')[1], Number(item.art.split('-')[2]) || 0, item.role, item.id, 64), pos, o);

function context(theme, ts) {
  const byId = new Map(theme.items.map((i) => [i.id, i]));
  const eq = equippedIds(theme, ts.owned, ts);
  const lvl = levelInfo(theme, totalPower(theme, ts.owned, ts));
  return { eq, lvl, pick: (cat) => (eq[cat] || []).map((id) => byId.get(id)), byId };
}

function frame(theme, kind, bg, children, label) {
  return h('div', { class: `dscene dscene-${kind}`, role: 'img', 'aria-label': label },
    fromHTML(SVG(bg)), ...children);
}

// ============================ KAFE ============================
const CAFE_BG = `
  <defs>
    <linearGradient id="cfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE6FF"/><stop offset="1" stop-color="#EAF7FF"/></linearGradient>
    <pattern id="cfTile" width="12" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" fill="#C99560"/><rect width="6" height="3" fill="#BA8650"/><rect x="6" y="3" width="6" height="3" fill="#BA8650"/></pattern>
    <pattern id="cfWall" width="8" height="10" patternUnits="userSpaceOnUse"><rect width="8" height="10" fill="#F6E8CE"/><rect width="4" height="10" fill="#F0DFC0"/></pattern>
  </defs>
  <rect width="100" height="58" fill="url(#cfWall)"/>
  <rect width="100" height="3" fill="#C98A45"/><rect y="3" width="100" height="1" fill="#A9743C" opacity=".5"/>
  <rect y="40" width="100" height="18" fill="#DDBB8A"/><rect y="40" width="100" height="1.4" fill="#C79A5C"/>
  <rect y="56" width="100" height="24" fill="url(#cfTile)"/>
  <g>
    <rect x="3" y="7" width="19" height="27" rx="1.2" fill="#8A5A2B"/>
    <rect x="4.4" y="8.4" width="16.2" height="24.2" fill="url(#cfSky)"/>
    <circle cx="16" cy="15" r="3.2" fill="#FFE08A"/>
    <path d="M4.4 32.6V25q4-3 7 0t5-1 4 2v6.600z" fill="#8CCB7B"/>
    <path d="M7 14q1.500-2 3-.5 1.200-1.500 3 0 1.500.5.500 1.500H7z" fill="#fff"/>
    <path d="M12.500 8.400v24.200M4.400 20.500h16.200" stroke="#8A5A2B" stroke-width="1"/>
    <path d="M1 6h6l-1 28H1zM24 6h-6l1 28h5z" fill="#E88AA6" opacity=".9"/>
  </g>
  <rect y="56" width="100" height="2.500" fill="#E8B67F"/>
  <rect y="58.500" width="100" height="11" fill="#7A4A22"/>
  <rect y="58.500" width="100" height=".8" fill="#A9743C"/>
  <path d="M10 60.500v7M30 60.500v7M50 60.500v7M70 60.500v7M90 60.500v7" stroke="#6A3F1B" stroke-width=".6"/>
  <rect x="3" y="59.800" width="94" height="8.600" rx="1.500" fill="#FFFFFF" opacity=".28"/>
  <rect x="3" y="59.800" width="94" height="8.600" rx="1.500" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".5"/>
  <rect y="69.500" width="100" height="1.200" fill="#000" opacity=".12"/>`;

const CAFE_WALL = { m04: [38, 30, 8], m05: [50, 25, 8], m06: [64, 33, 11], m07: [80, 32, 10], m10: [92, 33, 9], m11: [28, 37, 9], m13: [66, 20, 8] };
const CAFE_FLOOR = [[9, 92, 15], [25, 86, 14], [41, 93, 15], [57, 86, 14], [73, 93, 15], [90, 86, 14]];
const CAFE_EQUIP = [[8, 58.500, 12], [21, 58.500, 12], [34, 58.500, 12], [46, 58.500, 12]];
const CAFE_STAFF = [[55, 39, 13], [68, 39, 13], [81, 39, 13], [93, 39, 13]];
const CAFE_STOPS = [14, 34, 54, 74];

function cafeScene(theme, ts) {
  const { pick, lvl } = context(theme, ts);
  const furniture = pick('furniture');
  const onWall = furniture.filter((i) => CAFE_WALL[i.id]);
  const onFloor = furniture.filter((i) => !CAFE_WALL[i.id]).slice(0, CAFE_FLOOR.length);
  const staff = pick('staff').slice(0, CAFE_STAFF.length);
  const equipment = pick('equipment').slice(0, CAFE_EQUIP.length);
  const menu = pick('menu');
  const orders = menu.length ? menu.map((i) => i.id) : ['u01'];
  const customers = ts.owned.length ? Math.min(4, 2 + lvl.index) : 0;

  return frame(theme, 'cafe', CAFE_BG, [
    ...onWall.map((it) => prop(it.id, CAFE_WALL[it.id], { z: 1 })),
    ...staff.map((it, k) => person(it, CAFE_STAFF[k], { z: 1 })),
    ...equipment.map((it, k) => prop(it.id, CAFE_EQUIP[k], { z: 3 })),
    ...menu.slice(0, 8).map((it, k) => prop(it.id, [8 + k * 11.5, 67.500, 8.500], { z: 3 })),
    ...onFloor.map((it, k) => prop(it.id, CAFE_FLOOR[k], { z: 2, extra: 'shadowed' })),
    ...Array.from({ length: customers }, (_, k) => {
      const c = h('span', { class: 'sc-cust', 'aria-hidden': 'true', style: { '--stop': `${CAFE_STOPS[k]}%`, '--delay': `${-k * 4}s` } });
      c.append(fromHTML(characterArt('cafe', k + 1, '', `musteri${k}`, 64)));
      const bub = h('span', { class: 'sc-bubble' });
      bub.append(fromHTML(propArt(orders[k % orders.length])));
      c.append(bub);
      return c;
    }),
  ], `${theme.name}: ${staff.length} ekip üyesi, ${customers} müşteri`);
}

// ============================ FUTBOL ============================
function footballBg() {
  let crowd = '';
  const cols = ['#E4573D', '#F2C230', '#4A90D9', '#fff', '#E0457B', '#5FAE5B'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 34; c++) crowd += `<circle cx="${2 + c * 3 + (r % 2) * 1.500}" cy="${9 + r * 3.200}" r="1.100" fill="${cols[(c * 3 + r * 5) % cols.length]}"/>`;
  let stripes = '';
  for (let i = 0; i < 8; i++) stripes += `<rect y="${25 + i * 7}" width="100" height="7" fill="${i % 2 ? '#58B263' : '#4FA85A'}"/>`;
  return `
  <defs><linearGradient id="fbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD0F5"/><stop offset="1" stop-color="#DDF1FF"/></linearGradient></defs>
  <rect width="100" height="26" fill="url(#fbSky)"/>
  <rect y="5" width="100" height="19" fill="#5B6672"/>${crowd}
  <rect y="4" width="100" height="1.600" fill="#3B4252"/>
  <rect y="22" width="100" height="3.400" fill="#E4573D"/><path d="M0 23.700h100" stroke="#fff" stroke-width=".8" stroke-dasharray="5 3"/>
  ${stripes}
  <g fill="none" stroke="#fff" stroke-width=".7" opacity=".9">
    <rect x="3" y="28" width="94" height="49" rx=".5"/>
    <path d="M3 40h94"/><circle cx="50" cy="40" r="8"/>
    <rect x="28" y="63" width="44" height="14"/><rect x="40" y="70" width="20" height="7"/>
    <path d="M38 63a12 8 0 0 0 24 0"/>
  </g>
  <circle cx="50" cy="40" r="1" fill="#fff"/>
  <rect x="42" y="76" width="16" height="3.600" fill="none" stroke="#fff" stroke-width=".8"/>
  <path d="M42 76l1.500 3.600M46 76l.7 3.600M50 76v3.600M54 76l-.7 3.600M58 76l-1.500 3.600" stroke="#fff" stroke-width=".4" opacity=".7"/>`;
}
const FB_FAC = { f05: [50, 33, 30], f04: [9, 36, 13], f02: [27, 35, 12], f03: [73, 35, 12], f06: [91, 38, 9], f01: [86, 99, 10] };
const FB_STAFF = [[5, 62, 9.500], [95, 78, 9.500], [5, 94, 9.500]];
const FB_ROWS = { Kaleci: [96, 11], Defans: [80, 10.500], 'Orta saha': [64, 10], Forvet: [49, 9.500] };

function footballScene(theme, ts) {
  const { pick } = context(theme, ts);
  const players = pick('players');
  const staff = pick('staff').slice(0, FB_STAFF.length);
  const facilities = pick('facilities').filter((f) => FB_FAC[f.id]);
  const nodes = [];
  for (const [role, [y, w]] of Object.entries(FB_ROWS)) {
    const row = players.filter((p) => p.role === role);
    row.forEach((p, k) => {
      const x = row.length === 1 ? 50 : 20 + (60 * k) / (row.length - 1);
      nodes.push(person(p, [x, y, w], { z: Math.round(y), extra: 'bobbing', style: { '--d': `${-(k * 0.37 + y / 50)}s` } }));
    });
  }
  return frame(theme, 'football', footballBg(), [
    ...facilities.map((f) => prop(f.id, FB_FAC[f.id], { z: 1 })),
    ...staff.map((s, k) => person(s, FB_STAFF[k], { z: 60 + k })),
    ...nodes,
  ], `${theme.name}: sahada ${players.length} oyuncu`);
}

// ============================ MODA ============================
function fashionBg() {
  let lights = '';
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    lights += `<circle cx="${36 - t * 24 - 0.8}" cy="${40 + t * 38}" r=".8" fill="#FFE08A"/><circle cx="${64 + t * 24 + 0.8}" cy="${40 + t * 38}" r=".8" fill="#FFE08A"/>`;
  }
  return `
  <defs>
    <linearGradient id="fsWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2D2442"/><stop offset="1" stop-color="#5A3470"/></linearGradient>
    <linearGradient id="fsRun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE3F3"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
  </defs>
  <rect width="100" height="80" fill="url(#fsWall)"/>
  <path d="M0 0h13q-2 20 3 40-6 24-4 40H0z" fill="#B8325F"/><path d="M0 0h13q-2 20 3 40" fill="none" stroke="#8E2548" stroke-width=".8"/>
  <path d="M100 0H87q2 20-3 40 6 24 4 40h12z" fill="#B8325F"/>
  <path d="M5 0q2 40 0 80M9 0q2 40 0 80M95 0q-2 40 0 80M91 0q-2 40 0 80" stroke="#8E2548" stroke-width=".5" fill="none" opacity=".7"/>
  <path d="M30 0L18 38h24zM50 0L40 38h20zM70 0l-12 38h24z" fill="#FFE9A8" opacity=".13"/>
  <rect x="17" y="8.600" width="66" height=".8" rx=".4" fill="#D0D4DA"/>
  <circle cx="17" cy="9" r="1.100" fill="#9AA5B1"/><circle cx="83" cy="9" r="1.100" fill="#9AA5B1"/>
  <rect y="36.800" width="100" height="1.500" fill="#C98A45"/>
  <rect y="38.300" width="100" height="42" fill="#3B2A4A"/>
  <path d="M36 38.300h28L88 80H12z" fill="url(#fsRun)"/>
  <path d="M50 40v40" stroke="#E0457B" stroke-width=".7" stroke-dasharray="3 2.500"/>
  ${lights}`;
}
const FS_STUDIO = [[56, 46, 11], [68, 46, 11], [80, 46, 11], [92, 46, 11]];
const FS_MODELS = [[50, 62, 10.500], [32, 75, 12.500], [68, 75, 12.500], [14, 94, 14], [86, 94, 14]];

function fashionScene(theme, ts) {
  const { pick } = context(theme, ts);
  const fabrics = pick('fabrics').slice(0, 6);
  const models = pick('models').slice(0, FS_MODELS.length);
  const outfits = pick('outfits').slice(0, 8);
  const studio = pick('studio').slice(0, FS_STUDIO.length);
  return frame(theme, 'fashion', fashionBg(), [
    ...outfits.map((o, k) => prop(o.id, [12 + k * (76 / Math.max(7, outfits.length - 1 || 1)), 10, 9], { top: true, z: 1, extra: 'hung', style: { '--d': `${-k * 0.6}s` } })),
    ...fabrics.map((f, k) => prop(f.id, [6 + k * 7.600, 46, 8], { z: 1 })),
    ...studio.map((s, k) => prop(s.id, FS_STUDIO[k], { z: 1 })),
    ...models.map((m, k) => person(m, FS_MODELS[k], { z: Math.round(FS_MODELS[k][1]), extra: 'bobbing', style: { '--d': `${-k * 0.5}s` } })),
  ], `${theme.name}: podyumda ${models.length} model`);
}

// ============================ BARINAK ============================
function shelterBg() {
  let flowers = '';
  const cols = ['#F29EBB', '#fff', '#F2C230', '#E4573D'];
  for (let i = 0; i < 26; i++) flowers += `<circle cx="${(i * 37 + 11) % 97 + 1.500}" cy="${46 + ((i * 53) % 32)}" r=".8" fill="${cols[i % 4]}" opacity=".85"/>`;
  let posts = '';
  for (let x = 2; x < 100; x += 9) posts += `<rect x="${x}" y="27" width="1.600" height="13" rx=".5" fill="#C98A45"/>`;
  return `
  <defs><linearGradient id="shSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE6FF"/><stop offset="1" stop-color="#EAF7FF"/></linearGradient></defs>
  <rect width="100" height="40" fill="url(#shSky)"/>
  <circle cx="86" cy="9" r="5" fill="#FFE08A"/><circle cx="86" cy="9" r="7.500" fill="#FFE08A" opacity=".3"/>
  <path d="M8 12q2-3 5-1.500 2-2.500 5 0 3 0 2 3H8zM46 7q2-3 5-1.500 2-2.500 5 0 3 0 2 3H46z" fill="#fff"/>
  <path d="M0 30q18-10 38-3t38-4 24 5v14H0z" fill="#9AD58A"/>
  <rect y="38" width="100" height="42" fill="#6DB26B"/>
  <path d="M0 38q25-3 50 0t50 0" stroke="#8CCB7B" stroke-width="1.200" fill="none"/>
  <path d="M0 52h100M0 66h100" stroke="#5FA25D" stroke-width="5" opacity=".25"/>
  ${posts}<rect y="30" width="100" height="1.400" fill="#B9803F"/><rect y="35" width="100" height="1.400" fill="#B9803F"/>
  ${flowers}`;
}
const SH_HOMES = [[18, 52, 15], [32, 52, 15], [46, 52, 15], [60, 52, 15], [74, 52, 15], [88, 52, 15]];
const SH_GARDEN = { g04: [6, 54, 14], g03: [95, 54, 12], g06: [47, 77, 18], g05: [88, 68, 11], g02: [18, 66, 12], g01: [70, 63, 10] };
const SH_ANIMALS = [[14, 72, 12], [32, 70, 12], [50, 68, 12], [68, 70, 12], [86, 72, 12], [10, 90, 14], [28, 88, 14], [64, 90, 14], [82, 88, 14], [94, 96, 12]];
const SH_CARE = [[22, 97, 8], [40, 99, 8], [57, 99, 8], [73, 99, 8], [48, 88, 8], [90, 82, 8]];

function shelterScene(theme, ts) {
  const { pick } = context(theme, ts);
  const animals = pick('animals').slice(0, SH_ANIMALS.length);
  const homes = pick('homes').slice(0, SH_HOMES.length);
  const care = pick('care').slice(0, SH_CARE.length);
  const garden = pick('garden').filter((g) => SH_GARDEN[g.id]);
  return frame(theme, 'shelter', shelterBg(), [
    ...homes.map((hm, k) => prop(hm.id, SH_HOMES[k], { z: 1 })),
    ...garden.map((g) => prop(g.id, SH_GARDEN[g.id], { z: g.id === 'g04' || g.id === 'g03' ? 1 : 2 })),
    ...care.map((c, k) => prop(c.id, SH_CARE[k], { z: 40 })),
    ...animals.map((a, k) => prop(a.id, SH_ANIMALS[k], { z: Math.round(SH_ANIMALS[k][1]), extra: 'wander', style: { '--d': `${-k * 1.3}s`, '--t': `${6 + (k % 4)}s` } })),
  ], `${theme.name}: barınakta ${animals.length} hayvan`);
}

const SCENES = { cafe: cafeScene, football: footballScene, fashion: fashionScene, shelter: shelterScene };

/** Temanın sahnesi (HTML öğesi); tanımsız temada null. */
export function sceneFor(theme, ts) {
  const make = SCENES[theme.id];
  return make ? make(theme, ts) : null;
}
