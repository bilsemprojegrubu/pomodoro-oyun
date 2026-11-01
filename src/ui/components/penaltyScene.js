// Penaltı sahnesi: stadyum, kale, file, kaleci, şutçu ve top. Şutçu ve kaleci modları bunu kullanır.
// Top uçuşu Web Animations ile yapılır (kavisli yol, dönüş, gölge); hareket kapalıysa anında biter.
import { h, fromHTML, motionOn } from '../dom.js';
import { characterArt } from '../../assets/art.js';

// Kale ağzı (sahnenin yüzdesi): sol 14, sağ 86, üst 20, kale çizgisi 56.
const G = { l: 14, r: 86, t: 20, b: 56 };
export const GOAL = G;
export const zoneX = (z) => G.l + ((G.r - G.l) / 3) * (z + 0.5);
const SPOT = { x: 50, y: 86 };

const BG = `<svg class="pk-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="pkSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2b4f"/><stop offset="1" stop-color="#3a5590"/></linearGradient>
    <linearGradient id="pkGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8f47"/><stop offset="1" stop-color="#3fae58"/></linearGradient>
  </defs>
  <rect width="100" height="30" fill="url(#pkSky)"/>
  <rect y="29" width="100" height="5" fill="#e8eef7"/>
  <rect y="29" width="25" height="5" fill="#e4573d"/><rect x="50" y="29" width="25" height="5" fill="#2f80ed"/>
  <rect y="34" width="100" height="66" fill="url(#pkGrass)"/>
  <path d="M0 44h100M0 58h100M0 74h100M0 92h100" stroke="#fff" stroke-opacity=".07" stroke-width="7"/>
  <path d="M3 ${G.b}h94M8 ${G.b}v14h84v-14M28 ${G.b}v5h44v-5" stroke="#fff" stroke-opacity=".85" stroke-width=".7" fill="none"/>
  <path d="M30 70q20 9 40 0" stroke="#fff" stroke-opacity=".6" stroke-width=".7" fill="none"/>
  <ellipse cx="${SPOT.x}" cy="${SPOT.y + 2}" rx="1.4" ry=".8" fill="#fff"/>
  <!-- file arkası (perspektif) -->
  <path d="M${G.l} ${G.t}L${G.l + 4} ${G.t + 5}V${G.b - 2}L${G.l} ${G.b}M${G.r} ${G.t}L${G.r - 4} ${G.t + 5}V${G.b - 2}L${G.r} ${G.b}M${G.l + 4} ${G.t + 5}H${G.r - 4}M${G.l + 4} ${G.b - 2}H${G.r - 4}" stroke="#fff" stroke-opacity=".55" stroke-width=".5" fill="rgb(255 255 255 / 6%)"/>
</svg>`;

const POSTS = `<svg class="pk-posts" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <path d="M${G.l} ${G.b + 0.6}V${G.t}H${G.r}V${G.b + 0.6}" stroke="#000" stroke-opacity=".25" stroke-width="2.6" fill="none" transform="translate(.6 .6)"/>
  <path d="M${G.l} ${G.b + 0.6}V${G.t}H${G.r}V${G.b + 0.6}" stroke="#fff" stroke-width="2" fill="none"/>
</svg>`;

// Tribün: renkli seyirci noktaları (gol olunca zıplar).
export function crowd() {
  const cols = ['#f2c230', '#e4573d', '#ffffff', '#2f80ed', '#f29ebb', '#7bc47f'];
  let s = '';
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 26; i++) {
      const x = i * 4 + (row % 2 ? 2 : 0) + 1;
      s += `<circle cx="${x}" cy="${6 + row * 6}" r="1.7" fill="${cols[(i * 7 + row * 3) % cols.length]}"/>`;
    }
  }
  return `<svg class="pk-crowd" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`;
}

/**
 * Kaydırma hareketini şuta çevirir (saf hesap, test edilebilir).
 * pts: [{x, y, t}] piksel ve ms; W/H: sahne boyutu.
 * Döner: null (kısa/aşağı kaydırma) ya da { tx, power (0-1), over (çok sert), bend (-1..1) }.
 */
export function readSwipe(pts, W, H) {
  if (!pts || pts.length < 2) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const cx = b.x - a.x;
  const cy = b.y - a.y;
  const len = Math.hypot(cx, cy);
  if (len < H * 0.08 || cy > -H * 0.05) return null; // yukarı doğru yeterince kaydırılmadı
  // Hız: son 150 ms'deki hareket (sahne yüksekliği / saniye).
  const tEnd = b.t;
  let k = pts.length - 1;
  while (k > 0 && tEnd - pts[k - 1].t <= 150) k -= 1;
  const s = pts[Math.max(0, k - (k === pts.length - 1 ? 1 : 0))];
  const dt = Math.max(16, tEnd - s.t);
  const v = (Math.hypot(b.x - s.x, b.y - s.y) / H) / (dt / 1000);
  const raw = (v - 1) / 7; // telefonda hızlı fiske ~6-8 sahne yüksekliği/sn
  const power = Math.max(0, Math.min(1, raw));
  // Yön: yataydaki sapma kale genişliğine yansır.
  const tx0 = SPOT.x + (cx / Math.abs(cy)) * 34;
  // Falso: yolun düz çizgiden en çok saptığı nokta (sağa şişerse +).
  let dev = 0;
  for (const q of pts) {
    const d = (cx * (q.y - a.y) - cy * (q.x - a.x)) / len;
    if (Math.abs(d) > Math.abs(dev)) dev = d;
  }
  const bend = Math.max(-1, Math.min(1, (dev / len) / 0.3));
  // Falsolu top hedefe doğru az da olsa ters yöne kıvrılır.
  const tx = tx0 - bend * 4;
  return { tx, power, over: raw > 1.5, bend: Math.abs(bend) < 0.12 ? 0 : bend, speed: v };
}

/**
 * Sahneyi kurar. onZone(z): kale bölgesine dokununca.
 * keeperArt / shooterArt: karakter çizimi.
 */
export function penaltyScene({ onZone, onSwipe = null, keeperId = 'kaleci', keeperN = 1, shooter = true, labels = ['Sol köşe', 'Orta', 'Sağ köşe'] }) {
  const root = h('div', { class: 'pk' });
  const stage = h('div', { class: 'pk-stage' });
  const net = h('div', { class: 'pk-net', 'aria-hidden': 'true' });
  const zones = [0, 1, 2].map((z) => h('button', { class: 'pk-zone', type: 'button', 'aria-label': labels[z], onClick: () => onZone(z) }));
  const zoneBox = h('div', { class: 'pk-zones' }, ...zones);
  const keeper = h('span', { class: 'pk-keeper' }, h('span', { class: 'pk-keeper-in' }, fromHTML(characterArt('gk', keeperN, 'Kaleci', keeperId, 80))));
  const shooterEl = shooter ? h('span', { class: 'pk-shooter' }, fromHTML(characterArt('fwd', 3, 'Şutçu', 'sutcu', 60))) : null;
  const shadow = h('span', { class: 'pk-shadow' });
  const ball = h('span', { class: 'pk-ball' });
  const banner = h('div', { class: 'pk-banner', 'aria-hidden': 'true' });
  const flash = h('div', { class: 'pk-flash', 'aria-hidden': 'true' });
  const hint = h('i', { class: 'pk-hint', hidden: true });
  const dots = Array.from({ length: 10 }, () => h('i', { class: 'pk-dot' }));
  const board = h('div', { class: 'pk-board', 'aria-hidden': 'true' }, ...dots);
  stage.append(fromHTML(crowd()), fromHTML(BG), net, fromHTML(POSTS), hint, keeper, zoneBox, ...(shooterEl ? [shooterEl] : []), shadow, ball, flash, banner);
  root.append(stage, board);

  let anims = [];
  const animate = (el, frames, opts) => {
    const a = el.animate(frames, { fill: 'forwards', ...opts, duration: motionOn() ? opts.duration : 1, delay: motionOn() ? (opts.delay || 0) : 0 });
    anims.push(a);
    return a;
  };
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  const api = {
    el: root,
    zones,
    keeper,
    hint,
    /** Kaleciyi bir bölgeye kaydır (0 sol, 1 orta, 2 sağ). */
    place(z) { keeper.style.left = `${zoneX(z)}%`; },
    pick(z) { zones.forEach((q, i) => q.classList.toggle('picked', i === z)); },
    showHint(z) { hint.style.left = `${zoneX(z)}%`; hint.hidden = false; restart(hint, 'on'); },
    hideHint() { hint.hidden = true; },
    /** Tabelaya i. atışın sonucunu yaz. */
    mark(i, good) { const d = dots[i]; if (!d) return; d.className = `pk-dot ${good ? 'good' : 'bad'}`; restart(d, 'pop'); },
    /** Her şeyi şut öncesine al. */
    reset() {
      anims.forEach((a) => a.cancel());
      anims = [];
      keeper.classList.remove('dive-l', 'dive-r', 'dive-c', 'ready');
      stage.classList.remove('shake', 'cheer');
      zones.forEach((q) => q.classList.remove('picked'));
      banner.className = 'pk-banner';
      banner.textContent = '';
      void keeper.offsetWidth;
      keeper.classList.add('ready');
    },
    /**
     * Şut: koşu, vuruş, top uçuşu, kaleci atlayışı, sonuç.
     * target: bölge (tx/ty verilmezse bölge ortasına gider), tx/ty: hedef nokta (sahne yüzdesi),
     * bend: falso (-1..1, topun yoldaki yana kavisi), fly: uçuş süresi (ms),
     * result: 'goal' | 'save' | 'miss' (dışarı/üstten) | 'post' (direk). dive: kalecinin atladığı bölge.
     * Bitince cb() çağrılır.
     */
    shoot({ target = 1, tx, ty, bend = 0, fly = 420, dive, goal, result = goal ? 'goal' : 'save', text, good = result === 'goal' }, cb) {
      const W = stage.clientWidth || 300;
      const H = stage.clientHeight || 300;
      const run = shooterEl ? 260 : 0;
      if (shooterEl) {
        animate(shooterEl, [{ transform: 'translate(0,0)' }, { transform: 'translate(55%, -12%)', offset: 0.75 }, { transform: 'translate(70%, -14%) rotate(-12deg)' }], { duration: run, easing: 'ease-in' });
      }
      if (tx === undefined) tx = zoneX(target) + (target === 1 ? 0 : (Math.random() - 0.5) * 8);
      if (ty === undefined) ty = G.t + 6 + Math.random() * (G.b - G.t - 14);
      const dx = ((tx - SPOT.x) / 100) * W;
      const dy = ((ty - SPOT.y) / 100) * H;
      // Falso: top yolda yana açılıp hedefe geri kıvrılır (bend > 0 sağa).
      const side = bend * W * 0.28;
      const at = (k, sc, rot) => `translate(-50%, -50%) translate(${dx * k + side * Math.sin(k * Math.PI)}px, ${dy * k - H * 0.07 * Math.sin(k * Math.PI)}px) scale(${sc}) rotate(${rot}deg)`;
      const end = at(1, 0.48, 620);
      animate(ball, [0, 0.25, 0.5, 0.75, 1].map((k) => ({ transform: at(k, 1 - k * 0.52, k * 620), offset: k })), { duration: fly, delay: run, easing: 'cubic-bezier(.25,.6,.4,1)' });
      animate(shadow, [
        { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)', opacity: 0.45 },
        { transform: `translate(-50%, -50%) translate(${dx * 0.5 + side}px, ${((G.b - SPOT.y) / 200) * H}px) scale(0.7)`, opacity: 0.3, offset: 0.5 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${((Math.max(ty, G.b) - SPOT.y) / 100) * H}px) scale(0.45)`, opacity: 0.12 },
      ], { duration: fly, delay: run, easing: 'cubic-bezier(.25,.6,.4,1)' });
      // Kaleci şut anında atlar.
      setTimeout(() => {
        if (dive === null || dive === undefined) return;
        keeper.classList.remove('ready');
        keeper.style.left = `${zoneX(dive) + (dive === 0 ? 4 : dive === 2 ? -4 : 0)}%`;
        keeper.classList.add(dive === 0 ? 'dive-l' : dive === 2 ? 'dive-r' : 'dive-c');
      }, motionOn() ? run + 60 : 0);
      // Sonuç: gol ise top fileye gömülüp düşer, kurtarışta sekip dışarı çıkar, autta uzaklaşır.
      setTimeout(() => {
        const away = tx < 50 ? -1 : 1;
        if (result === 'goal') {
          animate(ball, [
            { transform: end },
            { transform: `translate(-50%, -50%) translate(${dx * 1.04}px, ${dy - H * 0.03}px) scale(0.42) rotate(660deg)`, offset: 0.25 },
            { transform: `translate(-50%, -50%) translate(${dx * 1.04}px, ${((G.b - 3 - SPOT.y) / 100) * H}px) scale(0.42) rotate(700deg)` },
          ], { duration: 520, easing: 'ease-in' });
          net.style.setProperty('--hx', `${((tx - G.l) / (G.r - G.l)) * 100}%`);
          net.style.setProperty('--hy', `${((ty - G.t) / (G.b - G.t)) * 100}%`);
          restart(net, 'hit');
          restart(stage, 'shake');
          restart(stage, 'cheer');
        } else if (result === 'miss') {
          // Dışarı ya da üstten: top küçülerek tribüne doğru gider.
          animate(ball, [
            { transform: end, opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${dx + away * W * 0.08}px, ${dy - H * 0.16}px) scale(0.3) rotate(800deg)`, opacity: 0 },
          ], { duration: 500, easing: 'ease-out' });
        } else if (result === 'post') {
          // Direğe çarpar, geri seker.
          restart(stage, 'shake');
          animate(ball, [
            { transform: end },
            { transform: `translate(-50%, -50%) translate(${dx - away * W * 0.12}px, ${dy + H * 0.12}px) scale(0.6) rotate(500deg)`, offset: 0.5 },
            { transform: `translate(-50%, -50%) translate(${dx - away * W * 0.2}px, ${dy + H * 0.34}px) scale(0.78) rotate(400deg)`, opacity: 0 },
          ], { duration: 650, easing: 'ease-out' });
        } else {
          const sd = target === 0 ? -1 : target === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
          animate(ball, [
            { transform: end },
            { transform: `translate(-50%, -50%) translate(${dx + sd * W * 0.22}px, ${dy + H * 0.05}px) scale(0.62) rotate(420deg)`, offset: 0.45 },
            { transform: `translate(-50%, -50%) translate(${dx + sd * W * 0.34}px, ${dy + H * 0.32}px) scale(0.75) rotate(300deg)`, opacity: 0 },
          ], { duration: 620, easing: 'ease-out' });
        }
        restart(flash, good ? 'good' : 'bad');
        banner.textContent = text;
        banner.className = `pk-banner ${good ? 'good' : 'bad'}${text.length > 9 ? ' long' : ''}`;
        restart(banner, 'show');
      }, motionOn() ? run + fly : 0);
      setTimeout(cb, motionOn() ? run + fly + 1100 : 600);
    },
  };

  // ---- Kaydırarak şut (onSwipe verilirse) ----
  if (onSwipe) {
    stage.classList.add('swipe');
    const trail = fromHTML('<svg class="pk-trail" aria-hidden="true"><polyline points="" /></svg>');
    stage.append(trail);
    const line = trail.querySelector('polyline');
    let pts = null;
    const pos = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() }; };
    stage.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      pts = [pos(e)];
      trail.setAttribute('viewBox', `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
      trail.classList.remove('fade');
      line.setAttribute('points', '');
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts) return;
      pts.push(pos(e));
      if (pts.length > 80) pts.splice(1, 1);
      line.setAttribute('points', pts.map((q) => `${q.x},${q.y}`).join(' '));
    });
    const end = (e) => {
      if (!pts) return;
      pts.push(pos(e));
      const info = readSwipe(pts, stage.clientWidth || 300, stage.clientHeight || 300);
      pts = null;
      restart(trail, 'fade');
      if (info) { api.swiped = performance.now(); onSwipe(info); }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', () => { pts = null; restart(trail, 'fade'); });
  }
  api.reset();
  return api;
}
