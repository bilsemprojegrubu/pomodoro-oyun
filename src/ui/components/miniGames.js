// Temaya özel ek oyunlar (sadece eğlence; Pomodoro parasını etkilemez).
// cafe: pasta kulesi · football: penaltı · fashion: kombin eşleştirme · shelter: hayvanları besle
import { h, fromHTML, motionOn } from '../dom.js';
import { characterArt } from '../../assets/art.js';
import { propArt } from '../../assets/props.js';
import { CONFIG } from '../../config.js';
import { confetti, flyCoins, floatText, countUp, burst } from './effects.js';
import { penaltyScene } from './penaltyScene.js';

export const MINI = {
  cafe: { title: 'Pasta kulesi', how: 'Hareket eden katmanı doğru anda "Bırak" ile üstüne koy. Taşan kısım kesilir, kule yükseldikçe hızlanır.' },
  football: { title: 'Penaltı atışları', how: '10 şutun var. Kaleci hareket ediyor: o an durmadığı köşeyi seç ve vur! (Kaleci modunda üç ipucu vardır: bakış, koşu yönü, duruş.)' },
  fashion: { title: 'Kombin eşleştirme', how: 'Kartları çevir, aynı olan çiftleri bul. Az hamlede bitir!' },
  shelter: { title: 'Hayvanları besle', how: '30 saniyen var. Yuvalardan çıkan hayvanlara dokunarak onları besle, kaçırma!' },
};

const MAX = CONFIG.economy.miniGameMaxCoins;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const icon = (it) => fromHTML(propArt(it.id) || characterArt('cafe', 0, '', it.id, 64));
const ownedOf = (theme, ts, cats) => theme.items.filter((i) => cats.includes(i.category) && ts.owned.includes(i.id));

/** Oyun sonu kartı: başlık, 0-3 yıldız (sırayla parlar), kazanılan para sayılarak artar. */
function resultCard(area, text, rate, got, cur) {
  const stars = rate >= 0.85 ? 3 : rate >= 0.6 ? 2 : rate >= 0.3 ? 1 : 0;
  const title = ['Tekrar dene!', 'İyi!', 'Çok iyi!', 'Muhteşem!'][stars];
  const coin = h('b', { class: 'mg-res-coin' }, '0');
  const card = h('div', { class: `mg-result s${stars}`, role: 'status' },
    h('div', { class: 'mg-res-card' },
      h('div', { class: 'mg-res-stars' }, ...[0, 1, 2].map((i) => h('span', { class: `mg-res-star${i < stars ? ' on' : ''}`, style: { '--i': i } }, '★'))),
      h('strong', { class: 'mg-res-title' }, title),
      h('p', { class: 'mg-res-text' }, text),
      got > 0 ? h('p', { class: 'mg-res-got' }, '+', coin, ` ${cur.icon}`) : null));
  area.append(card);
  if (got > 0) setTimeout(() => countUp(coin, 0, got, 700), 700);
  return card;
}

let stopFn = null;
const stopAll = () => { if (stopFn) { stopFn(); stopFn = null; } };
/** Zamanlayıcı kur: ekran değişince (eleman DOM'dan çıkınca) kendiliğinden durur. */
function every(root, ms, fn) {
  const id = setInterval(() => { if (!root.isConnected) { stopAll(); return; } fn(); }, ms);
  const prev = stopFn;
  stopFn = () => { clearInterval(id); if (prev) prev(); };
}

export function miniGame(theme, ts, idx, back, pay = () => 0, record = () => null) {
  stopAll();
  const info = MINI[theme.id];
  const root = h('div', { class: 'mg' });
  const msg = h('p', { class: 'small mg-msg', 'aria-live': 'polite' }, info.how);
  const area = h('div', { class: 'mg-area' });
  const startBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Başla');
  const exit = h('button', { class: 'btn btn-outline', type: 'button', onClick: () => { stopAll(); back(); } }, 'Geri dön');
  root.append(h('h3', { class: 'mg-title' }, info.title), h('p', { class: 'small mg-note' }, 'Bu oyun günün özetini etkiler: başarılı olursan skorun düşmez.'), msg, area, h('div', { class: 'mg-btns' }, startBtn, exit));
  const GAMES = { cafe: tower, football: penalty, fashion: memory, shelter: feed };
  const keeperBtn = theme.id === 'football' ? h('button', { class: 'btn btn-primary', type: 'button' }, 'Kaleci olarak başla') : null;
  if (keeperBtn) { startBtn.textContent = 'Şutçu olarak başla'; root.querySelector('.mg-btns').prepend(keeperBtn); }
  const ctx = { theme, ts, idx, root, msg, area, startBtn, mode: 'shoot',
    // done(metin, para, başarı 0-1): para ve günün özeti kaydı
    done: (t, coins = 0, rate = null) => {
      const got = coins > 0 ? pay(Math.min(coins, MAX)) : 0;
      const eff = rate === null ? null : record(rate);
      msg.textContent = [t, coins > 0 ? (got ? `+${got} ${theme.currency.name}` : '(bugünkü oyun parası doldu)') : '',
        eff ? `Başarın %${Math.round(rate * 100)}. Günün özeti skoru şu an %${eff.pct}.` : ''].filter(Boolean).join(' ');
      const card = rate !== null ? resultCard(area, t, rate, got, theme.currency) : null;
      if (got > 0) {
        // Paralar kazanılan sayının yanından üstteki para sayacına uçar.
        setTimeout(() => {
          const to = document.getElementById('coin-value');
          const from = (card && card.querySelector('.mg-res-got')) || area;
          if (to && from.isConnected) flyCoins(from.getBoundingClientRect(), to, theme.currency.icon, Math.min(8, 2 + Math.round(got / 3)));
        }, 1500);
      }
      if (rate !== null && rate >= 0.6) setTimeout(() => confetti(rate >= 0.85 ? 40 : 22), 500);
      startBtn.textContent = keeperBtn ? 'Şutçu olarak tekrar' : 'Tekrar oyna'; startBtn.hidden = false;
      if (keeperBtn) { keeperBtn.textContent = 'Kaleci olarak tekrar'; keeperBtn.hidden = false; }
    } };
  const go = (mode) => { stopAll(); ctx.mode = mode; area.replaceChildren(); startBtn.hidden = true; if (keeperBtn) keeperBtn.hidden = true; GAMES[theme.id](ctx); };
  startBtn.addEventListener('click', () => go('shoot'));
  if (keeperBtn) keeperBtn.addEventListener('click', () => go('keep'));
  return root;
}

// ---- Kafe: pasta kulesi ----
function tower({ theme, ts, idx, root, msg, area, done }) {
  const colors = ['#F28CB1', '#F6D186', '#8A5A3B', '#F9F4E8', '#E4573D', '#7BC47F'];
  const board = h('div', { class: 'mg-tower' });
  const drop = h('button', { class: 'btn btn-primary mg-drop', type: 'button' }, 'Bırak');
  const fx = h('div', { class: 'mg-fx' });
  area.append(h('div', { class: 'mg-wrap' }, board, fx), drop);
  const bump = (cls) => { board.classList.remove(cls); void board.offsetWidth; board.classList.add(cls); };
  const chop = (from, to, bottom, color, dir) => {
    if (to - from < 0.5) return;
    const c = h('i', { class: 'mg-chop', style: { left: `${from}%`, width: `${to - from}%`, bottom: `${bottom}%`, background: color, '--dx': `${dir * 40}px` } });
    fx.append(c); setTimeout(() => c.remove(), 800);
  };
  const items = ownedOf(theme, ts, ['menu']);
  let layers = [{ x: 25, w: 50 }];
  let w = 50, x = 0, dir = 1, over = false, landAt = 0, perfectAt = 0;
  const speed = () => 1.1 + idx * 0.15 + layers.length * 0.12;
  const draw = () => {
    const rows = layers.slice(-7);
    const base = layers.length - rows.length;
    // Son konan kat kısa bir an ezilip esner (yumuşak iniş).
    const k = (Date.now() - landAt) / 280;
    const sq = k < 1 ? Math.sin(k * Math.PI) : 0;
    board.replaceChildren(...rows.map((l, i) => {
      const top = i === rows.length - 1;
      const style = { left: `${l.x}%`, width: `${l.w}%`, bottom: `${i * 11}%`, background: colors[(base + i) % colors.length] };
      if (top && sq) { style.transform = `scale(${1 + sq * 0.08}, ${1 - sq * 0.3})`; style.transformOrigin = '50% 100%'; }
      return h('i', { class: `mg-layer${top && Date.now() - perfectAt < 600 ? ' perfect' : ''}`, style });
    }));
    if (!over) board.append(h('i', { class: 'mg-layer mg-move', style: { left: `${x}%`, width: `${w}%`, bottom: `${rows.length * 11}%`, background: colors[layers.length % colors.length] } }));
    if (items.length) { const it = items[layers.length % items.length]; const t = h('span', { class: 'mg-topitem', style: { left: `${(over ? layers[layers.length - 1].x + layers[layers.length - 1].w / 2 : x + w / 2)}%`, bottom: `${(rows.length + (over ? 0 : 1)) * 11}%` } }, icon(it)); board.append(t); }
    msg.textContent = `Kat: ${layers.length}`;
  };
  every(root, 30, () => { if (over) return; x += dir * speed() * 0.6; if (x + w >= 100) { x = 100 - w; dir = -1; } if (x <= 0) { x = 0; dir = 1; } draw(); });
  drop.addEventListener('click', () => {
    if (over) return;
    const last = layers[layers.length - 1];
    const l = Math.max(x, last.x), r = Math.min(x + w, last.x + last.w);
    const rows = Math.min(layers.length, 7);
    const color = colors[layers.length % colors.length];
    if (r - l <= 1) { chop(x, x + w, rows * 11, color, x < last.x ? -1 : 1); over = true; draw(); bump('collapse'); stopAll(); drop.hidden = true; done(`Kule yıkıldı! ${layers.length - 1} kat yaptın.`, (layers.length - 1) * 2, Math.min(1, (layers.length - 1) / 10)); return; }
    const perfect = Math.abs(x - last.x) < 1.5 && Math.abs(w - last.w) < 1.5;
    landAt = Date.now();
    if (perfect) { layers.push({ x: last.x, w: last.w }); w = last.w; perfectAt = landAt; floatText(board, 'Mükemmel! ✨', 'good'); burst(drop, '✨', 6); bump('bump'); }
    else {
      chop(x, l, rows * 11, color, -1); chop(r, x + w, rows * 11, color, 1);
      layers.push({ x: l, w: r - l }); w = r - l; bump('bump');
    }
    x = 0; dir = 1;
  });
  draw();
}

// ---- Futbol: penaltı ----
function penalty(c) {
  if (c.mode === 'keep') return penaltyKeeper(c);
  const { idx, root, msg, area, done } = c;
  let keeper = 1, shots = 10, goals = 0, busy = false;
  const sc = penaltyScene({ onZone: (z) => shoot(z) });
  area.append(sc.el);
  const upd = () => { msg.textContent = `Kalan şut: ${shots} · Gol: ${goals} — Kalecinin olmadığı köşeye dokun!`; };
  every(root, Math.max(280, 750 - idx * 55), () => { if (!busy) { keeper = rnd(0, 2); sc.place(keeper); } });
  function shoot(z) {
    if (busy || shots <= 0) return;
    busy = true;
    const n = 10 - shots;
    shots -= 1;
    const g = z !== keeper;
    if (g) goals += 1;
    sc.pick(z);
    msg.textContent = 'Şut!';
    sc.shoot({ target: z, dive: keeper, goal: g, text: g ? 'GOOOL!' : 'KURTARDI!' }, () => {
      if (!root.isConnected) return;
      sc.mark(n, g);
      if (g) confetti(12);
      sc.reset(); busy = false;
      if (shots <= 0) { stopAll(); done(`Maç bitti: ${goals}/10 gol.`, goals * 2, goals / 10); } else upd();
    });
    setTimeout(() => { if (root.isConnected && busy) msg.textContent = g ? 'GOL! Harika vuruş!' : 'Kaleci kurtardı!'; }, motionOn() ? 700 : 0);
  }
  sc.place(keeper); upd();
}

// ---- Moda: kart eşleştirme ----
function memory({ theme, ts, idx, root, msg, area, done }) {
  const pool = ownedOf(theme, ts, ['fabrics', 'outfits', 'studio']);
  if (pool.length < 2) { done('Önce mağazadan en az 2 kumaş veya kıyafet al.'); return; }
  const pairs = shuffle(pool).slice(0, Math.min(8, 3 + Math.floor(idx / 2) + 1, pool.length));
  const cards = shuffle([...pairs, ...pairs].map((it, i) => ({ it, i, open: false, ok: false })));
  const board = h('div', { class: 'mg-cards' });
  area.append(board);
  let first = null, lock = false, moves = 0, found = 0;
  const btns = cards.map((c) => {
    const b = h('button', { class: 'mg-card', type: 'button', 'aria-label': 'Kart', onClick: () => flip(c, b) }, h('span', { class: 'mg-back' }), h('span', { class: 'mg-face' }, icon(c.it)));
    board.append(b); return b;
  });
  const upd = () => { msg.textContent = `Hamle: ${moves} · Bulunan: ${found}/${pairs.length}`; };
  function flip(c, b) {
    if (lock || c.open || c.ok) return;
    c.open = true; b.classList.add('open');
    if (!first) { first = [c, b]; return; }
    moves += 1; lock = true;
    const [c0, b0] = first; first = null;
    if (c0.it === c.it) { c0.ok = c.ok = true; b0.classList.add('matched'); b.classList.add('matched'); setTimeout(() => { floatText(b, '✓', 'good'); burst(b, '✨', 6); }, 300); found += 1; lock = false; upd();
      if (found === pairs.length) {
        lock = true;
        setTimeout(() => btns.forEach((q, i) => { q.style.setProperty('--i', String(i)); q.classList.add('win'); }), 500);
        setTimeout(() => done(`Tebrikler! ${moves} hamlede bitirdin.`, Math.max(8, MAX - Math.max(0, moves - pairs.length) * 2), Math.min(1, pairs.length / moves)), 1500);
      }
      return; }
    setTimeout(() => { b0.classList.add('wrong'); b.classList.add('wrong'); }, 350);
    setTimeout(() => { c0.open = c.open = false; b0.classList.remove('open', 'wrong'); b.classList.remove('open', 'wrong'); lock = false; upd(); }, 800);
  }
  upd();
}

// ---- Barınak: hayvanları besle ----
function feed({ theme, ts, idx, root, msg, area, done }) {
  const pool = ownedOf(theme, ts, ['animals']);
  if (!pool.length) { done('Önce mağazadan bir hayvan sahiplen.'); return; }
  let score = 0, miss = 0, time = 30;
  const holes = Array.from({ length: 9 }, () => h('button', { class: 'mg-hole', type: 'button', 'aria-label': 'Yuva' }));
  const grid = h('div', { class: 'mg-holes' }, ...holes);
  area.append(grid);
  const upd = () => { msg.textContent = `Süre: ${Math.ceil(time)} sn · Beslenen: ${score} · Kaçan: ${miss}`; };
  holes.forEach((b) => b.addEventListener('click', () => { if (b.classList.contains('up')) { b.classList.remove('up', 'fed'); void b.offsetWidth; b.classList.add('fed'); setTimeout(() => b.replaceChildren(), 160); floatText(b, '+1', 'good'); burst(b, '❤️', 5); score += 1; upd(); } }));
  const show = () => {
    const free = holes.filter((b) => !b.classList.contains('up'));
    if (!free.length) return;
    const b = free[rnd(0, free.length - 1)];
    b.replaceChildren(icon(pool[rnd(0, pool.length - 1)])); b.classList.add('up');
    setTimeout(() => { if (b.classList.contains('up')) { b.classList.remove('up'); b.classList.remove('fed'); setTimeout(() => b.replaceChildren(), 160); miss += 1; floatText(b, '💨', 'bad'); } }, Math.max(650, 1400 - idx * 70));
  };
  every(root, Math.max(420, 900 - idx * 50), () => { if (time > 0) show(); });
  every(root, 250, () => { time -= 0.25; upd(); if (time <= 0) { stopAll(); done(`Süre doldu! ${score} hayvanı besledin.`, score * 2, score + miss ? score / (score + miss) : 0); } });
  upd();
}

// ---- Futbol: kaleci modu (rakip şut çeker, sen köşeyi seçip kurtarırsın) ----
function penaltyKeeper({ idx, root, msg, area, done }) {
  const AIM = Math.max(1000, 2200 - idx * 130); // şuttan önce karar verme süresi
  // Üç ipucu var, her birinin doğru olma ihtimali ayrı: bakış (sarı çember), koşu yönü, duruş.
  const P = { gaze: Math.max(0.35, 1 - idx * 0.08), run: Math.max(0.5, 0.9 - idx * 0.05), stance: Math.max(0.45, 0.8 - idx * 0.04) };
  const cueOf = (p, target) => (Math.random() < p ? target : (target + rnd(1, 2)) % 3);
  let cue = { gaze: 0, run: 0, stance: 0 };
  let round = 0, saves = 0, t = 0, target = 0, dive = null, phase = 'wait';
  const sc = penaltyScene({ keeperId: 'ben', keeperN: 2, onZone: (z) => { if (phase === 'aim') { dive = z; sc.place(z); sc.pick(z); } } });
  const track = (label) => { const dots = [0, 1, 2].map(() => h('i', { class: 'mg-dot' })); return { dots, el: h('div', { class: 'mg-cue' }, h('span', null, label), h('div', { class: 'mg-track' }, ...dots)) }; };
  const runCue = track('🏃 Koşu yönü');
  const stanceCue = track('🦶 Duruş');
  const light = (c, z) => c.dots.forEach((d, i) => d.classList.toggle('on', z === i));
  area.append(sc.el, h('div', { class: 'mg-cues' }, runCue.el, stanceCue.el));
  const upd = (txt) => { msg.textContent = `${txt} · Kalan şut: ${10 - round} · Kurtarış: ${saves}`; };
  const start = () => {
    if (!root.isConnected) return;
    round += 1; t = 0; dive = null; target = rnd(0, 2); phase = 'aim';
    sc.reset(); sc.place(1);
    cue = { gaze: cueOf(P.gaze, target), run: cueOf(P.run, target), stance: cueOf(P.stance, target) };
    sc.showHint(cue.gaze);
    setTimeout(() => sc.hideHint(), 700);
    light(runCue, null); light(stanceCue, null);
    upd('İpuçlarını izle: bakış, koşu, duruş. Köşeyi seç!');
  };
  every(root, 100, () => {
    if (phase !== 'aim') return;
    t += 100;
    if (t === 200) light(runCue, cue.run);
    if (t === 200 + 900) light(runCue, null);
    if (t === Math.round(AIM * 0.4 / 100) * 100) light(stanceCue, cue.stance);
    if (t === Math.round(AIM * 0.4 / 100) * 100 + 800) light(stanceCue, null);
    if (t < AIM) return;
    phase = 'shot';
    const saved = dive === target;
    if (saved) saves += 1;
    const n = round - 1;
    const mk = (z) => (z === target ? '✓' : '✗');
    sc.shoot({ target, dive, goal: !saved, good: saved, text: saved ? 'KURTARDIN!' : 'GOL OLDU' }, () => {
      if (!root.isConnected) return;
      sc.mark(n, saved);
      if (round >= 10) { stopAll(); done(`Maç bitti: ${saves}/10 kurtarış.`, saves * 2, saves / 10); } else start();
    });
    setTimeout(() => { if (root.isConnected && phase === 'shot') { if (saved) confetti(12); msg.textContent = `${saved ? 'KURTARDIN!' : 'Gol oldu!'} Bakış ${mk(cue.gaze)} · Koşu ${mk(cue.run)} · Duruş ${mk(cue.stance)}`; } }, motionOn() ? 700 : 0);
  });
  start();
}
