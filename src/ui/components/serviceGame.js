// Etkileşimli servis oyunu (İyi Pizza, Güzel Pizza tarzı): müşteri gelir, siparişini söyler,
// sen elindeki eşyalardan doğru olanları dokunarak verirsin. Sabır süresi dolmadan yetiştir!
// Oyun puanı sadece eğlence içindir: Pomodoro parasını etkilemez (ekonomi odaklanmaya bağlı kalır).
import { h, fromHTML } from '../dom.js';
import { characterArt } from '../../assets/art.js';
import { propArt } from '../../assets/props.js';
import { sceneFor, stageFor } from './scenes.js';

const CFG = {
  cafe: { parts: [{ cat: 'menu', n: [1, 3] }], cust: 'cafe', play: 'Siparişleri hazırla', ask: 'Müşteri bunları istiyor:', done: 'Afiyet olsun!' },
  football: { parts: [{ cat: 'players', n: [2, 3] }], cust: 'staff', play: 'Kadroyu çağır', ask: 'Hoca bu oyuncuları sahada istiyor:', done: 'Sahaya çıktılar!' },
  fashion: { parts: [{ cat: 'fabrics', n: [1, 1] }, { cat: 'outfits', n: [1, 1] }], cust: 'model', play: 'Kombin hazırla', ask: 'Müşteri bu kumaş ve kıyafeti istiyor:', done: 'Harika görünüyor!' },
  shelter: { parts: [{ cat: 'animals', n: [1, 1] }, { cat: 'care', n: [1, 2] }], cust: 'cafe', play: 'Sahiplendirme oyunu', ask: 'Ziyaretçi bunları istiyor:', done: 'Yeni yuvasına gitti!' },
};
const PATIENCE = 22; // saniye
const TRAY = 8;

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
function makeOrder(theme, ts, cfg) {
  const owned = new Set(ts.owned);
  const need = [];
  const pool = [];
  for (const part of cfg.parts) {
    const mine = theme.items.filter((i) => i.category === part.cat && owned.has(i.id));
    if (!mine.length) continue;
    pool.push(...mine);
    need.push(...shuffle(mine).slice(0, Math.min(mine.length, rnd(part.n[0], part.n[1]))));
  }
  if (!need.length) return null;
  const extra = shuffle(pool.filter((i) => !need.includes(i))).slice(0, Math.max(0, Math.min(TRAY, pool.length) - need.length));
  return { need, tray: shuffle([...need, ...extra]) };
}

/** Dünyam ekranındaki sahne kutusu: normalde canlı sahne + "Oyna" düğmesi; oyun açıkken servis oyunu. */
export function sceneBox(theme, ts) {
  const cfg = CFG[theme.id];
  const live = sceneFor(theme, ts);
  if (!cfg || !live) return live;
  const box = h('div', { class: 'scene-box' });
  stopTimer();

  const showLive = () => {
    stopTimer();
    G.playing = false;
    box.replaceChildren(live,
      h('button', { class: 'btn btn-primary scene-play', type: 'button', onClick: () => { G.playing = true; showGame(); } }, `▶ ${cfg.play}`));
  };

  const showGame = () => {
    stopTimer();
    let order = makeOrder(theme, ts, cfg);
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
    const stage = stageFor(theme, [
      h('div', { class: 'sg-bubble' }, h('p', { class: 'sg-ask small' }, cfg.ask), orderRow),
      custWrap, reaction,
      h('div', { class: 'sg-bar', role: 'progressbar', 'aria-label': 'Müşterinin sabrı' }, bar),
    ], `${theme.name}: servis oyunu`);

    const refreshStats = () => stats.replaceChildren(`Mutlu müşteri: ${G.served} · Seri: ${G.streak} · Puan: ${G.score} · En iyi: ${G.best}`);

    const nextCustomer = () => {
      busy = false;
      reaction.replaceChildren();
      order = makeOrder(theme, ts, cfg);
      got = new Set();
      left = PATIENCE;
      custWrap.replaceChildren(fromHTML(characterArt(cfg.cust, rnd(0, 9), '', `sg${Math.random()}`, 96)));
      custWrap.classList.remove('leave', 'happy');
      orderRow.replaceChildren();
      tray.replaceChildren();
      if (!order) {
        status.textContent = 'Önce mağazadan bu oyun için eşya al.';
        return;
      }
      status.textContent = '';
      for (const it of order.need) orderRow.append(h('span', { class: 'sg-need', dataset: { id: it.id }, title: it.name }, iconOf(it)));
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
        G.score += stars * 10 + Math.min(G.streak, 10);
        G.best = Math.max(G.best, G.score);
        custWrap.classList.add('happy');
        reaction.replaceChildren(...Array.from({ length: stars }, () => fromHTML(STAR)));
        status.textContent = `${cfg.done} ${'★'.repeat(stars)}`;
      } else {
        G.streak = 0;
        G.missed += 1;
        custWrap.classList.add('leave');
        reaction.replaceChildren();
        status.textContent = 'Müşteri sabredemedi ve gitti. Bir sonrakini yetiştir!';
      }
      refreshStats();
      setTimeout(() => { if (box.isConnected && G.playing) nextCustomer(); }, ok ? 1100 : 1400);
    };

    const tap = (it, btn) => {
      if (busy || !order) return;
      if (order.need.includes(it)) {
        if (got.has(it.id)) return;
        got.add(it.id);
        btn.classList.add('ok');
        btn.disabled = true;
        orderRow.querySelector(`[data-id="${it.id}"]`).classList.add('done');
        if (got.size === order.need.length) finish(true);
      } else {
        left = Math.max(0, left - 3);
        G.streak = 0;
        btn.classList.add('bad');
        setTimeout(() => btn.classList.remove('bad'), 400);
        status.textContent = 'Bu değil! Sabır azaldı.';
        refreshStats();
      }
    };

    timer = setInterval(() => {
      if (!box.isConnected) { stopTimer(); return; }
      if (busy || !order) return;
      left -= 0.25;
      bar.style.width = `${Math.max(0, (left / PATIENCE) * 100)}%`;
      bar.classList.toggle('low', left / PATIENCE < 0.3);
      if (left <= 0) finish(false);
    }, 250);

    box.replaceChildren(stage, status, tray, stats,
      h('button', { class: 'btn btn-outline scene-play', type: 'button', onClick: showLive }, 'Oyunu bitir'));
    nextCustomer();
  };

  if (G.playing) showGame(); else showLive();
  return box;
}
