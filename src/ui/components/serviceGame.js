// Etkileşimli servis oyunu (İyi Pizza, Güzel Pizza tarzı): müşteri gelir, siparişini söyler,
// sen elindeki eşyalardan doğru olanları dokunarak verirsin. Sabır süresi dolmadan yetiştir!
// Oyun puanı sadece eğlence içindir: Pomodoro parasını etkilemez (ekonomi odaklanmaya bağlı kalır).
import { h, fromHTML } from '../dom.js';
import { characterArt } from '../../assets/art.js';
import { propArt } from '../../assets/props.js';
import { sceneFor, stageFor } from './scenes.js';
import { levelInfo, totalPower } from '../../core/economy.js';
import { miniGame, MINI } from './miniGames.js';
import { awardGameCoins } from '../../core/gameCoins.js';
import { recordGame } from '../../core/gamePerf.js';
import { fmtNumber } from '../../i18n/index.js';
import { CONFIG } from '../../config.js';
import { confetti, flyCoins, flyClone, floatText } from './effects.js';

const CFG = {
  cafe: { parts: [{ cat: 'menu', n: [1, 3] }], cust: 'cafe', play: 'Siparişleri hazırla', ask: 'Müşteri bunları istiyor:', done: 'Afiyet olsun!' },
  football: { parts: [{ cat: 'players', n: [2, 3] }], cust: 'staff', play: 'Kadroyu çağır', ask: 'Hoca bu oyuncuları sahada istiyor:', done: 'Sahaya çıktılar!' },
  fashion: { parts: [{ cat: 'fabrics', n: [1, 1] }, { cat: 'outfits', n: [1, 1] }], cust: 'model', play: 'Kombin hazırla', ask: 'Müşteri bu kumaş ve kıyafeti istiyor:', done: 'Harika görünüyor!' },
  shelter: { parts: [{ cat: 'animals', n: [1, 1] }, { cat: 'care', n: [1, 2] }], cust: 'cafe', play: 'Sahiplendirme oyunu', ask: 'Ziyaretçi bunları istiyor:', done: 'Yeni yuvasına gitti!' },
};
// Zorluk, temanın seviyesine göre artar: sipariş büyür, tepsi kalabalıklaşır, sabır kısalır.
const diff = (idx) => ({
  patience: Math.max(8, 18 - idx * 1.2),
  extraNeed: Math.ceil(idx / 2) + 1,
  tray: Math.min(16, 8 + idx * 2),
});

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C4 14 2 9.500 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 2.500-2 7-10 14z" fill="#E4373D"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.800 7.400.7-5.600 4.900 1.700 7.300L12 17.800 5.500 21.700l1.700-7.300L1.600 9.500 9 8.800z" fill="#F2C230"/></svg>';

// Oyun durumu modül düzeyinde: ekran yeniden çizilse de puan kaybolmaz.
const G = { playing: false, score: 0, served: 0, missed: 0, streak: 0, best: 0 };
let timer = null;
const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function iconOf(item, size = 64) {
  const art = propArt(item.id);
  if (art) return fromHTML(art);
  return fromHTML(characterArt(item.art.split('-')[1], Number(item.art.split('-')[2]) || 0, item.role, item.id, size));
}

/** Yeni sipariş: her bölümden sahip olunan eşyalar; tepsi = gerekenler + yanıltıcılar. */
function makeOrder(theme, ts, cfg, d) {
  const owned = new Set(ts.owned);
  const need = [];
  const pool = [];
  for (const part of cfg.parts) {
    const mine = theme.items.filter((i) => i.category === part.cat && owned.has(i.id));
    if (!mine.length) continue;
    pool.push(...mine);
    need.push(...shuffle(mine).slice(0, Math.min(mine.length, rnd(part.n[0], part.n[1] + d.extraNeed))));
  }
  if (!need.length) return null;
  const extra = shuffle(pool.filter((i) => !need.includes(i))).slice(0, Math.max(0, Math.min(d.tray, pool.length) - need.length));
  return { need, tray: shuffle([...need, ...extra]) };
}

/** Dünyam ekranındaki sahne kutusu: normalde canlı sahne + "Oyna" düğmesi; oyun açıkken servis oyunu. */
/** Oyun parası ver (ekranı yeniden çizmeden): cüzdanı kaydet, üstteki para sayacını güncelle. */
function pay(store, amount) {
  if (!store) return 0;
  const give = store.update((st) => awardGameCoins(st, amount), { silent: true });
  const el = document.getElementById('coin-value');
  if (el && give > 0) el.textContent = fmtNumber(store.get().wallet.coins);
  return give;
}

/** Oyun başarısını günün özeti için kaydet (ekranı yenilemeden). */
function rec(store, rate) {
  return store ? store.update((st) => recordGame(st, rate), { silent: true }) : null;
}

export function sceneBox(theme, ts, store) {
  const cfg = CFG[theme.id];
  const live = sceneFor(theme, ts);
  if (!cfg || !live) return live;
  const box = h('div', { class: 'scene-box' });
  stopTimer();
  const lvl = levelInfo(theme, totalPower(theme, ts.owned, ts));
  const d = diff(lvl.index);
  const PATIENCE = d.patience;

  const showLive = () => {
    stopTimer();
    G.playing = false;
    box.replaceChildren(live,
      h('button', { class: 'btn btn-primary scene-play', type: 'button', onClick: () => { G.playing = true; showGame(); } }, `▶ ${cfg.play}`),
      h('button', { class: 'btn btn-outline scene-play', type: 'button', onClick: () => box.replaceChildren(miniGame(theme, ts, lvl.index, showLive, (n) => pay(store, n), (r) => rec(store, r))) }, `★ ${MINI[theme.id].title}`));
  };

  const showGame = () => {
    stopTimer();
    let order = makeOrder(theme, ts, cfg, d);
    let got = new Set();
    let left = PATIENCE;
    let busy = false;
    const status = h('p', { class: 'sg-status small', 'aria-live': 'polite' }, '');
    const bar = h('span', { class: 'sg-bar-fill' });
    const orderRow = h('div', { class: 'sg-order' });
    const tray = h('div', { class: 'sg-tray', role: 'group', 'aria-label': 'Elindeki eşyalar' });
    const stats = h('p', { class: 'sg-stats small' });
    const reaction = h('span', { class: 'sg-react', 'aria-hidden': 'true' });
    const custWrap = h('span', { class: 'sg-cust', 'aria-hidden': 'true' });
    const bubble = h('div', { class: 'sg-bubble' }, h('p', { class: 'sg-ask small' }, cfg.ask), orderRow);
    const stage = stageFor(theme, [
      bubble,
      custWrap, reaction,
      h('div', { class: 'sg-bar', role: 'progressbar', 'aria-label': 'Müşterinin sabrı' }, bar),
    ], `${theme.name}: servis oyunu`);

    const note = h('p', { class: 'small muted sg-note' }, 'Bu oyun günün özetini etkiler: her kaçırdığın müşteri skoru düşürür.');
    const refreshStats = () => stats.replaceChildren(`Zorluk: ${lvl.index + 1} · Mutlu müşteri: ${G.served} · Seri: ${G.streak} · Puan: ${G.score}`);

    const nextCustomer = () => {
      busy = false;
      reaction.replaceChildren();
      order = makeOrder(theme, ts, cfg, d);
      got = new Set();
      left = PATIENCE;
      custWrap.replaceChildren(fromHTML(characterArt(cfg.cust, rnd(0, 9), '', `sg${Math.random()}`, 96)));
      custWrap.classList.remove('leave', 'happy', 'impatient', 'enter'); void custWrap.offsetWidth; custWrap.classList.add('enter');
      bar.style.width = '100%'; bar.style.background = ''; bar.classList.remove('low');
      orderRow.replaceChildren();
      tray.replaceChildren();
      if (!order) {
        status.textContent = 'Önce mağazadan bu oyun için eşya al.';
        return;
      }
      status.textContent = '';
      order.need.forEach((it, i) => orderRow.append(h('span', { class: 'sg-need', dataset: { id: it.id }, title: it.name }, h('b', { class: 'sg-num' }, String(i + 1)), iconOf(it))));
      for (const it of order.tray) {
        const b = h('button', { class: 'sg-tile', type: 'button', 'aria-label': it.name, title: it.name, onClick: () => tap(it, b) }, iconOf(it));
        tray.append(b);
      }
      refreshStats();
    };

    const finish = (ok) => {
      busy = true;
      if (ok) {
        const frac = left / PATIENCE;
        const stars = frac > 0.6 ? 3 : frac > 0.3 ? 2 : 1;
        G.streak += 1;
        G.served += 1;
        rec(store, 1);
        G.score += stars * 10 + Math.min(G.streak, 10);
        G.best = Math.max(G.best, G.score);
        custWrap.classList.add('happy');
        reaction.replaceChildren(...Array.from({ length: stars }, () => fromHTML(STAR)));
        const got = pay(store, stars + 1);
        reaction.style.setProperty('--n', String(stars));
        if (G.streak >= 3) floatText(custWrap, `🔥 ${G.streak} seri!`, 'streak');
        if (stars === 3 || G.streak % 5 === 0) confetti(16);
        const coinEl = document.getElementById('coin-value');
        if (got > 0 && coinEl) flyCoins(custWrap.getBoundingClientRect(), coinEl, theme.currency.icon, Math.min(6, stars + 2));
        status.textContent = `${cfg.done} ${'★'.repeat(stars)}${got ? ` +${got} ${theme.currency.name}` : ' (bugünkü oyun parası doldu)'}`;
      } else {
        G.streak = 0;
        G.missed += 1;
        rec(store, 0);
        custWrap.classList.add('leave');
        reaction.replaceChildren();
        status.textContent = 'Müşteri sabredemedi ve gitti. Bir sonrakini yetiştir!';
      }
      refreshStats();
      setTimeout(() => { if (box.isConnected && G.playing) nextCustomer(); }, ok ? 1100 : 1400);
    };

    const tap = (it, btn) => {
      if (busy || !order) return;
      if (it === order.need[got.size]) {
        got.add(it.id);
        const slot = orderRow.querySelector(`[data-id="${it.id}"]`);
        flyClone(btn, slot);
        btn.classList.add('ok');
        btn.disabled = true;
        slot.classList.add('done');
        if (got.size === order.need.length) finish(true);
      } else {
        left = Math.max(0, left - 4);
        G.streak = 0;
        btn.classList.add('bad');
        bubble.classList.add('wrong');
        setTimeout(() => { btn.classList.remove('bad'); bubble.classList.remove('wrong'); }, 400);
        status.textContent = order.need.includes(it) ? 'Sıra yanlış! Siparişi soldan sağa say.' : 'Bu değil! Sabır azaldı.';
        refreshStats();
      }
    };

    timer = setInterval(() => {
      if (!box.isConnected) { stopTimer(); return; }
      if (busy || !order) return;
      left -= 0.25;
      bar.style.width = `${Math.max(0, (left / PATIENCE) * 100)}%`;
      const frac = Math.max(0, left / PATIENCE);
      bar.style.background = `hsl(${Math.round(frac * 120)} 65% 45%)`;
      bar.classList.toggle('low', frac < 0.3);
      custWrap.classList.toggle('impatient', frac < 0.3 && !custWrap.classList.contains('leave'));
      if (left <= 0) finish(false);
    }, 250);

    box.replaceChildren(note, stage, status, tray, stats,
      h('button', { class: 'btn btn-outline scene-play', type: 'button', onClick: showLive }, 'Oyunu bitir'));
    nextCustomer();
  };

  if (G.playing) showGame(); else showLive();
  return box;
}
