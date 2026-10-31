// Günlük karşılaşma: Dünyam ekranındaki kart ve sonuç penceresi (kısa animasyon + günün özeti + analiz).
// Futbolda hazırlık maçı, kafede rakip kafe, modada rakip atölye, barınakta komşu barınak.
import { h, motionOn } from '../dom.js';
import { t, fmtNumber, fmtMinutes } from '../../i18n/index.js';
import { CONFIG } from '../../config.js';
import { matchStatus, playMatch, supportsFriendly } from '../../core/friendly.js';
import { openModal } from '../components/modal.js';
import { confetti, countUp } from '../components/effects.js';
import { play } from '../sound.js';
import { goalsFor } from './weekly.js';

const key = (theme, k) => `friendly.theme.${theme.id}.${k}`;
const lower = (s) => s.toLocaleLowerCase('tr');
const currencyName = (theme) => lower(theme.currency.name);

function showMatch(ctx, theme, match) {
  const icon = match.result === 'win' ? '🏆' : match.result === 'draw' ? '🤝' : '🌱';
  const a = match.analysis;
  const goals = theme.weeklyEvent.scoreStyle === 'goals';
  const level = theme.levels.find((l) => l.opponentPower === match.opp) || theme.levels[0];
  const rival = goals ? level.opponentName : t(key(theme, 'rival'));
  const stage = h('div', { class: 'stack center weekly-stage' },
    h('p', { class: 'emoji-big spin', 'aria-hidden': 'true' }, theme.icon),
    h('p', null, t(key(theme, 'ready'))));
  const coinEl = h('span', { class: 'count-up big-number' }, '0');
  const board = goals
    ? h('p', { class: 'scoreboard', 'aria-label': t('weekly.scoreAria') }, goalsFor({ themeId: theme.id, week: `f${match.at}`, result: match.result }).join(' – '))
    : h('div', { class: 'stack center' },
        h('p', { class: 'scoreboard', 'aria-label': t('weekly.scoreAria') }, `${fmtNumber(match.score)} – ${fmtNumber(match.opp)}`),
        h('p', { class: 'small muted' }, `${t('weekly.you')} · ${rival} (${t(key(theme, 'unit'))})`));
  const result = h('div', { class: 'stack center' },
    h('p', { class: 'emoji-big pop', 'aria-hidden': 'true' }, icon),
    h('h3', null, t(key(theme, `result.${match.result}`))),
    board,
    goals ? h('p', { class: 'small muted' }, t('friendly.opponent', { name: rival })) : null,
    h('p', null, t(key(theme, `summary.${match.result}`), { mine: fmtNumber(match.score), opp: fmtNumber(match.opp) })),
    match.coins > 0
      ? h('p', { class: 'row', style: { justifyContent: 'center' } }, h('span', { 'aria-hidden': 'true' }, theme.currency.icon), '+', coinEl)
      : h('p', { class: 'small muted' }, t('friendly.noCoins')),
    h('div', { class: 'card stack', style: { textAlign: 'left' } },
      h('h4', null, t('friendly.analysisTitle')),
      h('p', null, t('friendly.power', { team: fmtNumber(match.power), mine: fmtNumber(match.score), opp: fmtNumber(match.opp) })),
      match.minutes > 0 ? h('p', { class: 'small muted' }, t('friendly.effort', { time: fmtMinutes(match.minutes) })) : null,
      h('p', { class: 'small' }, t('friendly.lines')),
      h('ul', { class: 'small' }, a.lines.map((l) => h('li', null, t('friendly.line', { role: l.role, percent: l.percent })))),
      a.perfect
        ? h('p', { class: 'small' }, t('friendly.perfect'))
        : [h('p', { class: 'small' }, t('friendly.strong', { role: a.strongest })),
          h('p', { class: 'small' }, t('friendly.weak', { role: a.weakest }))],
      h('p', null, t(`friendly.tip.${match.result}`))));
  result.hidden = true;
  openModal({ title: t(key(theme, 'title')), body: [stage, result], actions: [{ label: t('friendly.close'), kind: 'primary' }], className: 'celebrate' });
  const reveal = () => {
    stage.hidden = true;
    result.hidden = false;
    play(match.result === 'lose' ? 'warn' : 'levelup');
    if (match.coins > 0) countUp(coinEl, 0, match.coins, 600, fmtNumber);
    if (match.result === 'win') confetti(40);
  };
  if (motionOn()) setTimeout(reveal, 1200);
  else reveal();
}

/** Dünyam için kart. */
export function friendlyCard(ctx, theme) {
  if (!supportsFriendly(theme)) return null;
  const st = matchStatus(ctx.state, theme, Date.now());
  const btn = h('button', {
    type: 'button',
    class: 'btn btn-primary',
    disabled: !st.ok,
    onClick: () => {
      let out = null;
      ctx.store.update((s) => { out = playMatch(s, theme, Date.now()); });
      if (out && out.ok) showMatch(ctx, theme, out.match);
    },
  }, t('friendly.play'));
  return h('div', { class: 'card stack' },
    h('h2', null, `${theme.icon} ${t(key(theme, 'title'))}`),
    h('p', { class: 'small' }, t(key(theme, 'intro'), { n: CONFIG.friendly.winCoins, currency: currencyName(theme) })),
    st.reason === 'needPomodoro' || st.reason === 'dayLimit' || st.ok
      ? h('p', { class: 'small muted' }, (st.unlimited ? t('friendly.leftTest', { done: st.done }) : t('friendly.left', { done: st.done, allowed: st.allowed })))
      : null,
    st.ok ? null : h('p', { class: 'small muted' }, t(`friendly.reason.${st.reason}`, { filled: st.lineup.filled, total: st.lineup.total })),
    btn);
}
