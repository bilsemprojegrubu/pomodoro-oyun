// Kısa (200-600 ms) mikro animasyonlar. Hareket kapalıysa hiçbir şey yapmaz.
import { h, motionOn } from '../dom.js';

const COLORS = ['#f5b700', '#e8590c', '#2f80ed', '#27ae60', '#d6336c', '#9b51e0'];

/** Konfeti yağdırır (seviye atlama, rozet vb.). */
export function confetti(count = 36) {
  if (!motionOn()) return;
  for (let i = 0; i < count; i++) {
    const p = h('span', { class: 'confetti-piece', 'aria-hidden': 'true' });
    p.style.left = `${Math.random() * 100}vw`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty('--rot', `${360 + Math.random() * 540}deg`);
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.append(p);
    setTimeout(() => p.remove(), 2600);
  }
}

/** Bozuk paralar from noktasından to elemanına uçar. */
export function flyCoins(fromRect, toEl, icon, n = 8) {
  if (!motionOn() || !toEl || !fromRect) return;
  const to = toEl.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const c = h('span', { class: 'fly-coin', 'aria-hidden': 'true' }, icon);
    c.style.left = `${fromRect.left + fromRect.width / 2}px`;
    c.style.top = `${fromRect.top + fromRect.height / 2}px`;
    document.body.append(c);
    const dx = to.left + to.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy = to.top + to.height / 2 - (fromRect.top + fromRect.height / 2);
    const anim = c.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5 + (Math.random() - 0.5) * 80}px, ${dy * 0.3 - 40}px) scale(1.2)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.2 },
      ],
      { duration: 600 + Math.random() * 200, delay: i * 50, easing: 'ease-in', fill: 'both' },
    );
    anim.onfinish = () => c.remove();
  }
}

/** Sayıyı from -> to sayar (ör. kazanılan para). */
export function countUp(el, from, to, ms = 600, format = (n) => String(n)) {
  if (!motionOn() || from === to) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  function step(now) {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = format(Math.round(from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** Bir elemanın üstünde kısa süre yükselip silinen yazı (ör. "GOL!", "+1"). */
export function floatText(anchor, text, cls = '') {
  if (!motionOn() || !anchor) return;
  const host = anchor.offsetParent || anchor.parentElement;
  if (!host) return;
  const f = h('span', { class: `fx-float ${cls}`.trim(), 'aria-hidden': 'true' }, text);
  f.style.left = `${anchor.offsetLeft + anchor.offsetWidth / 2}px`;
  f.style.top = `${anchor.offsetTop + anchor.offsetHeight * 0.35}px`;
  host.append(f);
  setTimeout(() => f.remove(), 1000);
}

/** src elemanının kopyası dst elemanına uçar (ör. tepsiden siparişe). */
export function flyClone(src, dst, ms = 380) {
  if (!motionOn() || !src || !dst) return;
  const a = src.getBoundingClientRect();
  const b = dst.getBoundingClientRect();
  const c = src.cloneNode(true);
  c.removeAttribute('id');
  c.disabled = true;
  c.classList.add('fly-clone');
  Object.assign(c.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(c);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const k = Math.max(0.3, Math.min(1, b.width / a.width));
  const anim = c.animate(
    [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(1 + k) / 2 + 0.1})`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.8 }],
    { duration: ms, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'both' },
  );
  anim.onfinish = () => c.remove();
}

/** Küçük patlama: anchor'ın ortasından n parça (emoji) etrafa saçılır. */
export function burst(anchor, emoji = '✨', n = 8) {
  if (!motionOn() || !anchor || !anchor.isConnected) return;
  const r = anchor.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const p = h('span', { class: 'fx-burst', 'aria-hidden': 'true' }, emoji);
    Object.assign(p.style, { left: `${cx}px`, top: `${cy}px` });
    document.body.append(p);
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 36 + Math.random() * 34;
    const a = p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(1.1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist * 1.2}px), calc(-50% + ${Math.sin(ang) * dist * 1.2 + 16}px)) scale(0.6)`, opacity: 0 },
      ],
      { duration: 650 + Math.random() * 150, easing: 'cubic-bezier(.2,.8,.4,1)', fill: 'both' },
    );
    a.onfinish = () => p.remove();
  }
}
