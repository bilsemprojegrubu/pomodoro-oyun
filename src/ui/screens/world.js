// Dünyam: temanın ana sahnesi. Sahip olunan ürünler sahnede görünür, boş slotlar "+" ile gösterilir.
import { h, fromHTML } from '../dom.js';
import { t, fmtNumber } from '../../i18n/index.js';
import { itemArt, emptySlotArt } from '../../assets/art.js';
import { benchPick, equippedIds, isManual, levelInfo, resetPicks, setFormation, slotGroup, slotsOf, swapPick, themeState, totalPower } from '../../core/economy.js';
import { openModal } from '../components/modal.js';
import { friendlyCard } from './friendly.js';
import { cafeScene } from '../components/cafeScene.js';

// Son satın alınan ürün (sahneye animasyonla gelsin diye)
let justBought = null;
export const markJustBought = (id) => { justBought = id; };

function slotTile(item, theme, extra = {}) {
  const btn = h('button', {
    type: 'button',
    class: `slot ${item.id === justBought ? 'just-bought' : ''}`,
    'aria-label': t('world.itemAria', { name: item.name, power: item.power }),
    onClick: () => (extra.onPick ? extra.onPick(item) : itemDetails(item, theme)),
    style: extra.style,
  });
  btn.append(fromHTML(itemArt(item, 64)));
  btn.append(h('span', { class: 'slot-name' }, item.name));
  return btn;
}

function emptyTile(cat, extra = {}) {
  if (extra.onPick) {
    const b = h('button', { type: 'button', class: 'slot empty', 'aria-label': t('world.emptyPickAria', { cat: cat.singular }), onClick: extra.onPick, style: extra.style });
    b.append(fromHTML(emptySlotArt(64)));
    b.append(h('span', { class: 'slot-name' }, '+'));
    return b;
  }
  const a = h('a', { class: 'slot empty', href: `#/shop?cat=${cat.id}`, 'aria-label': t('world.emptyAria', { cat: cat.singular }), style: extra.style });
  a.append(fromHTML(emptySlotArt(64)));
  a.append(h('span', { class: 'slot-name' }, '+'));
  return a;
}

function itemDetails(item, theme) {
  openModal({
    title: item.name,
    body: [
      h('div', { class: 'row' }, fromHTML(itemArt(item, 96)),
        h('div', { class: 'stack', style: { gap: '0.25rem' } },
          item.role ? h('p', null, item.role) : null,
          h('p', null, h('span', { class: 'tier' }, `${t(`tier.${item.tier}.icon`)} ${t(`tier.${item.tier}.name`)}`)),
          h('p', { class: 'small muted' }, `${theme.texts.powerLabel}: +${item.power}`))),
    ],
    actions: [{ label: t('common.close'), kind: 'primary' }],
  });
}

/** Dizilişe göre sahadaki konumlar (her mevki kendi sırasında, eşit aralıklı). */
function formationPositions(slots) {
  const rows = { Kaleci: 86, Defans: 68, 'Orta saha': 45, Forvet: 17 };
  const out = [];
  for (const [role, n] of Object.entries(slots)) {
    for (let i = 0; i < n; i++) out.push({ role, x: Math.round(((i + 1) * 100) / (n + 1)), y: rows[role] || 50 });
  }
  return out;
}

/** Futbol sahası gibi konumlu sahneler. */
function pitchScene(cat, ids, theme, slots, handlers) {
  const items = ids.map((id) => theme.items.find((i) => i.id === id));
  const used = new Set();
  const placed = formationPositions(slots).map((pos) => {
    const found = items.find((i) => !used.has(i.id) && i.role === pos.role);
    if (found) used.add(found.id);
    return { pos, item: found || null };
  });
  const scene = h('div', { class: 'scene scene-pitch', role: 'group', 'aria-label': cat.name });
  scene.append(h('div', { class: 'pitch-lines', 'aria-hidden': 'true' }));
  for (const { pos, item } of placed) {
    const style = { left: `${pos.x}%`, top: `${pos.y}%` };
    const tile = item ? slotTile(item, theme, { style, onPick: handlers.item }) : emptyTile(cat, { style, onPick: () => handlers.empty(pos.role) });
    tile.classList.add('pos');
    scene.append(tile);
  }
  return scene;
}

export function mount(root, ctx) {
  const state = ctx.state;
  const theme = ctx.theme;
  const ts = themeState(state, theme.id);
  const power = totalPower(theme, ts.owned);
  const lvl = levelInfo(theme, power);
  const eq = equippedIds(theme, ts.owned, ts);

  const update = (fn) => ctx.store.update((st) => fn(themeState(st, theme.id), st));
  const byId = (id) => theme.items.find((i) => i.id === id);
  const sortStrong = (a, b) => b.power - a.power;

  /** Kadrodaki bir ürünü değiştirme / yedeğe alma penceresi. */
  function manageEquipped(cat, item) {
    const group = slotGroup(cat, item);
    const bench = ts.owned.map(byId).filter((i) => i.category === cat.id && slotGroup(cat, i) === group && !eq[cat.id].includes(i.id)).sort(sortStrong);
    const actions = bench.map((c) => ({
      label: t('world.playInstead', { name: c.name, power: c.power }),
      onClick: () => update((x) => swapPick(theme, x, cat.id, c.id, item.id)),
    }));
    actions.push({ label: t('world.toBench'), onClick: () => update((x) => benchPick(theme, x, cat.id, item.id)) });
    actions.push({ label: t('common.close'), kind: 'primary' });
    openModal({
      title: item.name,
      body: [h('p', null, `${item.role ? `${item.role} · ` : ''}${theme.texts.powerLabel}: +${item.power}`),
        h('p', { class: 'small muted' }, bench.length ? t('world.pickReplace') : t('world.noBench'))],
      actions,
    });
  }

  /** Boş yere yedekten oyuncu koyma penceresi (yedek yoksa mağazaya yönlendirir). */
  function fillEmpty(cat, role) {
    const group = role || '*';
    const bench = ts.owned.map(byId).filter((i) => i.category === cat.id && slotGroup(cat, i) === group && !eq[cat.id].includes(i.id)).sort(sortStrong);
    if (!bench.length) { location.hash = `#/shop?cat=${cat.id}`; return; }
    const actions = bench.map((c) => ({ label: t('world.playInstead', { name: c.name, power: c.power }), onClick: () => update((x) => swapPick(theme, x, cat.id, c.id)) }));
    actions.push({ label: t('world.goShop'), onClick: () => { location.hash = `#/shop?cat=${cat.id}`; } });
    actions.push({ label: t('common.close'), kind: 'primary' });
    openModal({ title: t('world.emptyTitle', { cat: cat.singular }), body: [h('p', { class: 'small muted' }, t('world.pickFill'))], actions });
  }

  /** Yedekteki ürünü kadroya alma penceresi. */
  function manageBench(cat, item) {
    const group = slotGroup(cat, item);
    const inLine = eq[cat.id].map(byId).filter((i) => slotGroup(cat, i) === group);
    const cap = cat.roleSlots ? slotsOf(cat, ts)[group] : cat.slotLimit;
    const actions = [];
    if (inLine.length < cap) actions.push({ label: t('world.addToLineup'), onClick: () => update((x) => swapPick(theme, x, cat.id, item.id)) });
    else for (const o of inLine) actions.push({ label: t('world.playOver', { name: o.name, power: o.power }), onClick: () => update((x) => swapPick(theme, x, cat.id, item.id, o.id)) });
    actions.push({ label: t('common.close'), kind: 'primary' });
    openModal({ title: item.name, body: [h('p', null, `${item.role ? `${item.role} · ` : ''}${theme.texts.powerLabel}: +${item.power}`), h('p', { class: 'small muted' }, t('world.pickOver'))], actions });
  }

  const header = h('div', { class: 'card world-head' },
    h('div', { class: 'row spread' },
      h('div', null, h('p', { class: 'small muted' }, t('world.level', { n: lvl.level })), h('h1', null, lvl.current.name)),
      h('div', { class: 'center' }, h('p', { class: 'small muted' }, theme.texts.powerLabel), h('strong', { class: 'big-number' }, fmtNumber(power)))),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': t('world.progressAria'), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(lvl.progress * 100) },
      h('span', { style: { width: `${lvl.progress * 100}%` } })),
    h('p', { class: 'small muted' }, lvl.next ? t('world.toNext', { n: lvl.toNext, name: lvl.next.name }) : t('world.maxLevel')));

  const sections = theme.categories.map((cat) => {
    const ids = eq[cat.id];
    const ownedInCat = ts.owned.filter((id) => theme.items.find((i) => i.id === id && i.category === cat.id));
    const bench = ownedInCat.filter((id) => !ids.includes(id));
    let scene;
    if (cat.layout === 'pitch') {
      scene = pitchScene(cat, ids, theme, slotsOf(cat, ts), { item: (it) => manageEquipped(cat, it), empty: (role) => fillEmpty(cat, role) });
    } else {
      scene = h('div', { class: `scene scene-${cat.layout}`, role: 'group', 'aria-label': cat.name });
      for (const id of ids) scene.append(slotTile(byId(id), theme, { onPick: (it) => manageEquipped(cat, it) }));
      for (let i = ids.length; i < cat.slotLimit; i++) scene.append(emptyTile(cat, { onPick: () => fillEmpty(cat, null) }));
    }
    const formationRow = cat.formations
      ? h('div', { class: 'field' }, h('span', { class: 'label', id: 'lbl-formation' }, t('world.formation')),
          h('div', { class: 'chips wrap', role: 'group', 'aria-labelledby': 'lbl-formation' },
            Object.keys(cat.formations).map((f) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String((ts.formation || '4-3-3') === f), onClick: () => update((x) => setFormation(theme, x, f)) }, f))))
      : null;
    const manualRow = isManual(ts, cat.id)
      ? h('div', { class: 'row spread' }, h('span', { class: 'small muted' }, t('world.manualOn')),
          h('button', { type: 'button', class: 'btn btn-small btn-outline', onClick: () => update((x) => resetPicks(x, cat.id)) }, t('world.autoBest')))
      : h('p', { class: 'small muted' }, t('world.tapHint'));
    return h('section', { class: 'stack world-section', 'aria-labelledby': `cat-${cat.id}` },
      h('div', { class: 'row spread' }, h('h2', { id: `cat-${cat.id}` }, `${cat.icon} ${cat.name}`), h('span', { class: 'pill' }, `${ids.length}/${cat.slotLimit}`)),
      formationRow,
      scene,
      manualRow,
      bench.length
        ? h('details', { class: 'bench' },
            h('summary', null, t('world.bench', { n: bench.length })),
            h('div', { class: 'row-wrap' }, bench.map((id) => slotTile(byId(id), theme, { onPick: (it) => manageBench(cat, it) }))))
        : null);
  });

  root.append(h('div', { class: 'stack' },
    header,
    theme.id === 'cafe' ? cafeScene(theme, ts) : null,
    ts.owned.length === 0
      ? h('div', { class: 'card empty-state' },
          h('p', { class: 'emoji-big', 'aria-hidden': 'true' }, theme.icon),
          h('p', null, theme.texts.emptyWorld),
          h('div', { class: 'row', style: { justifyContent: 'center', flexWrap: 'wrap' } },
            h('a', { class: 'btn btn-primary', href: '#/focus' }, t('world.startPomodoro')),
            h('a', { class: 'btn btn-outline', href: '#/shop' }, t('world.goShop'))))
      : null,
    sections,
    ts.owned.length ? friendlyCard(ctx, theme) : null,
    h('p', { class: 'small muted center' }, theme.texts.sceneNote)));
  justBought = null;
  return {};
}
