// Kaleci modu sahnesi: kalecinin gözünden (kalenin içinden sahaya bakış).
// Karşıda şutçu ve top, ekranın kenarlarında direkler, altta senin eldivenlerin.
// Köşe seçince eldivenler o tarafa uzanır, şutta kamera o yöne "atlar", top sana doğru büyüyerek gelir.
import { h, fromHTML, motionOn } from '../dom.js';
import { characterArt } from '../../assets/art.js';
import { crowd } from './penaltyScene.js';

// Ekranda üç bölgenin ortası (soldan sağa).
const ZX = [18, 50, 82];
const SPOT = { x: 50, y: 55 };

const BG = `<svg class="kv-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="kvSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2b4f"/><stop offset="1" stop-color="#3a5590"/></linearGradient>
    <linearGradient id="kvGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a8442"/><stop offset="1" stop-color="#46b862"/></linearGradient>
  </defs>
  <rect width="100" height="30" fill="url(#kvSky)"/>
  <rect y="26" width="100" height="4" fill="#e8eef7"/><rect x="20" y="26" width="20" height="4" fill="#e4573d"/><rect x="60" y="26" width="20" height="4" fill="#2f80ed"/>
  <rect y="30" width="100" height="70" fill="url(#kvGrass)"/>
  <path d="M0 33h100M0 40h100M0 50h100M0 64h100M0 84h100" stroke="#fff" stroke-opacity=".07" stroke-width="4"/>
  <!-- ceza sahası (perspektif): uzak çizgi, yan çizgiler; kale alanı; yay -->
  <path d="M6 40H94L118 100M6 40L-18 100M27 66H73L80 100M27 66L20 100" stroke="#fff" stroke-opacity=".8" stroke-width=".7" fill="none"/>
  <path d="M38 40q12 -5 24 0" stroke="#fff" stroke-opacity=".7" stroke-width=".6" fill="none"/>
  <ellipse cx="${SPOT.x}" cy="${SPOT.y + 1.2}" rx="1.6" ry=".6" fill="#fff"/>
</svg>`;

// Kalenin içinden görünen çerçeve: üstte üst direk, yanlarda direkler, köşelerde file.
const FRAME = `<svg class="kv-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <pattern id="kvNet" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H3.2M0 0V3.2" stroke="#fff" stroke-opacity=".55" stroke-width=".35"/></pattern>
    <linearGradient id="kvPost" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9dde3"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#c9ced6"/></linearGradient>
    <linearGradient id="kvBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9ced6"/></linearGradient>
    <radialGradient id="kvVig" cx=".5" cy=".55" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#kvVig)"/>
  <path d="M6 7H30L6 30z" fill="url(#kvNet)"/><path d="M94 7H70L94 30z" fill="url(#kvNet)"/>
  <path d="M6 7V100" stroke="#fff" stroke-opacity=".35" stroke-width=".4"/><path d="M94 7V100" stroke="#fff" stroke-opacity=".35" stroke-width=".4"/>
  <rect x="0" y="6.5" width="100" height="1.6" fill="#000" opacity=".25"/>
  <rect x="0" y="0" width="100" height="6.5" fill="url(#kvBar)"/>
  <rect x="6" y="6.5" width="1.4" height="94" fill="#000" opacity=".2"/><rect x="92.6" y="6.5" width="1.4" height="94" fill="#000" opacity=".2"/>
  <rect x="0" y="0" width="6" height="100" fill="url(#kvPost)"/><rect x="94" y="0" width="6" height="100" fill="url(#kvPost)"/>
</svg>`;

// Kaleci eldiveni (avuç içi bize dönük).
const GLOVE = `<svg viewBox="0 0 60 70" aria-hidden="true">
  <g stroke="#2f5410" stroke-width="2.4" fill="#b6f36b" stroke-linejoin="round">
    <rect x="8" y="2" width="10" height="30" rx="5"/><rect x="19" y="0" width="10" height="32" rx="5"/><rect x="30" y="1" width="10" height="31" rx="5"/><rect x="41" y="5" width="9" height="27" rx="4.5"/>
    <path d="M6 24h46v22a16 16 0 0 1-16 16H22A16 16 0 0 1 6 46z"/>
    <rect x="-2" y="30" width="12" height="22" rx="6" transform="rotate(-25 4 41)"/>
    <rect x="12" y="58" width="34" height="11" rx="3" fill="#1f2a44" stroke="#111"/>
  </g>
  <path d="M16 38h28" stroke="#2f5410" stroke-width="2" opacity=".5"/>
</svg>`;

export function keeperScene({ onZone, labels = ['Sol köşe', 'Orta', 'Sağ köşe'] }) {
  const root = h('div', { class: 'pk kv' });
  const stage = h('div', { class: 'pk-stage kv-stage' });
  const world = h('div', { class: 'kv-world' });
  const shooter = h('span', { class: 'kv-shooter' }, fromHTML(characterArt('fwd', 4, 'Rakip', 'rakip', 70)));
  const shadow = h('span', { class: 'kv-shadow' });
  const ball = h('span', { class: 'pk-ball kv-ball' });
  world.append(fromHTML(crowd()), fromHTML(BG), shooter, shadow, ball);
  const gl = h('span', { class: 'kv-glove l' }, fromHTML(GLOVE));
  const gr = h('span', { class: 'kv-glove r' }, fromHTML(GLOVE));
  const hands = h('div', { class: 'kv-hands', 'aria-hidden': 'true' }, gl, gr);
  const zones = [0, 1, 2].map((z) => h('button', { class: 'pk-zone kv-zone', type: 'button', 'aria-label': labels[z], onClick: () => onZone(z) }));
  const zoneBox = h('div', { class: 'kv-zones' }, ...zones);
  const hint = h('i', { class: 'pk-hint kv-hint', hidden: true });
  const flash = h('div', { class: 'pk-flash', 'aria-hidden': 'true' });
  const banner = h('div', { class: 'pk-banner kv-banner', 'aria-hidden': 'true' });
  const dots = Array.from({ length: 10 }, () => h('i', { class: 'pk-dot' }));
  stage.append(world, fromHTML(FRAME), hint, hands, flash, banner, zoneBox);
  root.append(stage, h('div', { class: 'pk-board', 'aria-hidden': 'true' }, ...dots));

  let anims = [];
  const on = () => motionOn();
  const animate = (el, frames, opts) => {
    const a = el.animate(frames, { fill: 'forwards', ...opts, duration: on() ? opts.duration : 1, delay: on() ? (opts.delay || 0) : 0 });
    anims.push(a);
    return a;
  };
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const DIVES = ['dive-l', 'dive-c', 'dive-r'];

  const api = {
    el: root,
    zones,
    /** Eldivenleri seçilen tarafa kaydır (henüz atlamadan). */
    place(z) { hands.dataset.lean = String(z); world.dataset.lean = String(z); },
    pick(z) { zones.forEach((q, i) => q.classList.toggle('picked', i === z)); },
    showHint(z) { hint.style.left = `${ZX[z]}%`; hint.hidden = false; restart(hint, 'on'); },
    hideHint() { hint.hidden = true; },
    mark(i, good) { const d = dots[i]; if (!d) return; d.className = `pk-dot ${good ? 'good' : 'bad'}`; restart(d, 'pop'); },
    reset() {
      anims.forEach((a) => a.cancel());
      anims = [];
      stage.classList.remove('shake', 'cheer');
      world.classList.remove(...DIVES);
      hands.classList.remove(...DIVES, 'punch');
      zones.forEach((q) => q.classList.remove('picked'));
      banner.className = 'pk-banner kv-banner';
      banner.textContent = '';
      api.place(1);
    },
    /** Şut: rakip koşar ve vurur, top sana doğru büyüyerek gelir; dive = senin seçtiğin köşe (null: yerinde). */
    shoot({ target, dive, goal, good = !goal, text, bend = 0, fly = 460 }, cb) {
      const W = stage.clientWidth || 300;
      const H = stage.clientHeight || 300;
      const run = 340;
      animate(shooter, [
        { transform: 'translate(-50%, -100%) scale(1)' },
        { transform: 'translate(-30%, -96%) scale(1.18)', offset: 0.7 },
        { transform: 'translate(-22%, -94%) scale(1.25) rotate(8deg)' },
      ], { duration: run, easing: 'ease-in' });
      // Kurtarışta top eldivenlere gelir; golde başka köşeden geçer.
      const tx = ZX[target] + (target === 1 ? 0 : (Math.random() - 0.5) * 6);
      const ty = goal ? 26 + Math.random() * 26 : 38;
      const dx = ((tx - SPOT.x) / 100) * W;
      const dy = ((ty - SPOT.y) / 100) * H;
      const side0 = bend * W * 0.18;
      animate(ball, [
        { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1) rotate(0deg)' },
        { transform: `translate(-50%, -50%) translate(${dx * 0.4 + side0}px, ${dy * 0.5 - H * 0.04}px) scale(1.8) rotate(240deg)`, offset: 0.5 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(4.2) rotate(520deg)` },
      ], { duration: fly, delay: run, easing: 'cubic-bezier(.5,0,.9,.6)' });
      animate(shadow, [
        { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)', opacity: 0.4 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${H * 0.4}px) scale(5)`, opacity: 0.15 },
      ], { duration: fly, delay: run, easing: 'cubic-bezier(.5,0,.9,.6)' });
      // Atlayış: kamera seçilen köşeye savrulur, eldivenler uzanır.
      setTimeout(() => {
        if (dive === null || dive === undefined) return;
        world.classList.add(DIVES[dive]);
        hands.classList.add(DIVES[dive]);
      }, on() ? run + 40 : 0);
      setTimeout(() => {
        if (goal) {
          // Top yanından geçip arkadaki fileye gider: büyüyüp ekrandan çıkar.
          const out = target === 0 ? -0.6 : target === 2 ? 0.6 : 0;
          animate(ball, [
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(4.2) rotate(520deg)`, opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${dx + out * W}px, ${dy - H * 0.25}px) scale(8) rotate(640deg)`, opacity: 0 },
          ], { duration: 260, easing: 'ease-in' });
          restart(stage, 'shake');
          restart(stage, 'cheer');
        } else {
          // Eldivenlere çarpıp sahaya geri seker.
          const side = target === 0 ? -1 : target === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
          animate(ball, [
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(4.2) rotate(520deg)` },
            { transform: `translate(-50%, -50%) translate(${dx + side * W * 0.15}px, ${dy - H * 0.12}px) scale(2.4) rotate(380deg)`, offset: 0.45 },
            { transform: `translate(-50%, -50%) translate(${dx + side * W * 0.3}px, ${dy + H * 0.02}px) scale(1.4) rotate(260deg)`, opacity: 0 },
          ], { duration: 700, easing: 'ease-out' });
          restart(hands, 'punch');
        }
        restart(flash, good ? 'good' : 'bad');
        banner.textContent = text;
        banner.className = `pk-banner kv-banner ${good ? 'good' : 'bad'}`;
        restart(banner, 'show');
      }, on() ? run + fly : 0);
      setTimeout(cb, on() ? run + fly + 1150 : 600);
    },
  };
  api.reset();
  return api;
}
