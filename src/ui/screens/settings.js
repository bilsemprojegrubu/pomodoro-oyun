// Ayarlar: süreler, ses, görünüm, sağlık, tema, veri dışa/içe aktarma, silme, hakkında.
import { CONFIG } from '../../config.js';
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { THEMES } from '../../themes/index.js';
import { themePicker } from '../components/themePicker.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { ask as askNotify, supported as notifySupported } from '../notify.js';
import { themeState } from '../../core/economy.js';
import { cleanUsername, errorText, validEmail } from '../../core/cloud.js';
import { makeQuestion, checkSupport, SUPPORT } from '../../core/support.js';
import { hasProgress, parseCloud } from '../../core/cloudSync.js';
import { makeCode, readCode } from '../../core/recoveryCode.js';
import { defaultState } from '../../core/storage.js';
import { hashText, redeemHash, applyAutoLineup } from '../../core/testcode.js';

let versionTaps = 0;

function section(title, ...children) {
  return h('section', { class: 'card stack', 'aria-label': title }, h('h2', null, title), ...children);
}

function toggleRow(id, label, desc, checked, onChange) {
  return h('div', { class: 'setting' },
    h('label', { for: id }, h('div', null, label), desc ? h('div', { class: 'desc' }, desc) : null),
    h('input', { type: 'checkbox', class: 'switch', id, role: 'switch', checked, onChange: (e) => onChange(e.target.checked) }));
}

function chipRow(label, options, current, onPick, fmt) {
  return h('div', { class: 'field' },
    h('span', { class: 'label', id: `lbl-${label}` }, label),
    h('div', { class: 'chips', role: 'group', 'aria-labelledby': `lbl-${label}` },
      options.map((o) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(o === current), onClick: () => onPick(o) }, fmt(o)))));
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function mount(root, ctx) {
  const { store } = ctx;
  const body = h('div', { class: 'stack' });
  root.append(body);

  const set = (fn) => { store.update((s) => fn(s.settings)); ctx.applySettings(); };

  function changeTheme() {
    const picker = themePicker({ selected: store.get().profile.theme, onPick: () => {} });
    openModal({
      title: t('settings.themeChange'),
      body: [picker.el, h('p', { class: 'small muted' }, t('settings.themeNote'))],
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.apply'), kind: 'primary',
          onClick: () => {
            const id = picker.selected;
            if (!id) return false;
            store.update((s) => { s.profile.theme = id; themeState(s, id, Date.now()); if (s.settings.testAutoLineup) applyAutoLineup(s, THEMES[id]); });
            ctx.applyTheme();
            toast(t('settings.themeChanged', { name: THEMES[id].name }));
          },
        },
      ],
    });
  }

  async function onNotify(on) {
    if (on) {
      const r = await askNotify();
      if (r !== 'granted') {
        toast(t('settings.notifyDenied'));
        store.update((s) => { s.settings.notifications = false; });
        return;
      }
    }
    store.update((s) => { s.settings.notifications = on; });
  }

  async function showCode() {
    const code = await makeCode(store.storage.exportJSON(store.get()));
    const box = h('textarea', { class: 'input', readonly: true, rows: 6, 'aria-label': 'Kurtarma kodu', style: { width: '100%' } });
    box.value = code;
    openModal({
      title: 'Kurtarma kodun',
      body: [h('p', { class: 'small' }, 'Bu kodu kopyala ve diğer cihazda "Kodla yükle" ile yapıştır. Kod senin ilerlemeni taşır. Kimseyle paylaşma.'), box],
      actions: [
        { label: 'Kopyala', kind: 'primary', keepOpen: true, onClick: async () => {
          try { await navigator.clipboard.writeText(code); toast('Kod kopyalandı'); } catch { box.select(); toast('Kodu elle kopyala'); }
          return false;
        } },
        { label: 'Kapat' },
      ],
    });
  }

  function loadCode() {
    const box = h('textarea', { class: 'input', rows: 6, placeholder: 'PO1. ile başlayan kodu buraya yapıştır', 'aria-label': 'Kurtarma kodu', style: { width: '100%' } });
    openModal({
      title: 'Kodla yükle',
      body: [h('p', { class: 'small' }, 'Dikkat: bu cihazdaki ilerleme, koddaki ilerlemeyle değişir.'), box],
      actions: [
        { label: 'Yükle', kind: 'primary', onClick: async () => {
          const text = await readCode(box.value);
          const next = text ? store.storage.parseImport(text) : null;
          if (!next) { toast('Kod geçersiz. Eksiksiz yapıştırdığından emin ol.'); return false; }
          const ok = await confirmDialog({ title: t('settings.importTitle'), text: t('settings.importText'), yes: t('settings.importYes'), no: t('common.cancel'), danger: true });
          if (!ok) return false;
          store.replace(next);
          ctx.applySettings();
          ctx.applyTheme();
          toast(t('settings.importOk'));
        } },
        { label: 'Vazgeç' },
      ],
    });
  }

  function importFile() {
    const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'aria-label': t('settings.import'),
      onChange: async () => {
        const file = input.files[0];
        if (!file) return;
        const next = store.storage.parseImport(await file.text());
        if (!next) { toast(t('settings.importBad')); return; }
        const ok = await confirmDialog({ title: t('settings.importTitle'), text: t('settings.importText'), yes: t('settings.importYes'), no: t('common.cancel'), danger: true });
        if (!ok) return;
        store.replace(next);
        ctx.applySettings();
        ctx.applyTheme();
        toast(t('settings.importOk'));
      } });
    document.body.append(input);
    input.click();
    setTimeout(() => input.remove(), 60000);
  }

  async function wipe() {
    const ok = await confirmDialog({ title: t('settings.wipeTitle'), text: t('settings.wipeText'), yes: t('settings.wipeYes'), no: t('common.cancel'), danger: true });
    if (!ok) return;
    store.storage.wipe();
    store.replace(defaultState(), { save: false });
    ctx.applySettings();
    ctx.go('welcome');
  }

  async function useTestCode() {
    const box = document.getElementById('tcode');
    const text = (box && box.value || '').trim();
    if (!text) return;
    let hash = '';
    try { hash = await hashText(text); } catch { toast(t('testCode.unsupported')); return; }
    let result = { ok: false };
    store.update((x) => { result = redeemHash(x, hash); });
    toast(result.ok ? t('testCode.ok', { n: result.coins }) : t('testCode.bad'));
  }

  // ---- Bulut hesabı ----
  function applyRemote(next, at) {
    store.replace(next);
    ctx.cloud.markSynced(next, at);
    ctx.applySettings();
    ctx.applyTheme();
  }

  async function afterSignIn() {
    const remote = await ctx.cloud.pull();
    if (!remote) { await ctx.cloud.push(store.get()); toast('Giriş yapıldı. İlerlemen hesabına kaydedildi.'); return; }
    const next = parseCloud(store.storage, remote.data);
    if (!next) { await ctx.cloud.push(store.get()); return; }
    if (!hasProgress(store.get())) { applyRemote(next, remote.updatedAt); toast('Giriş yapıldı. Hesabındaki ilerleme yüklendi.'); return; }
    const useRemote = await confirmDialog({
      title: 'Hangi ilerleme kalsın?',
      text: 'Hesabında kayıtlı bir ilerleme var, bu cihazda da ilerleme var. Biri diğerinin yerine geçecek.',
      yes: 'Hesaptakini yükle', no: 'Bu cihazdakini kullan', danger: true,
    });
    if (useRemote) { applyRemote(next, remote.updatedAt); toast('Hesabındaki ilerleme yüklendi.'); } else { await ctx.cloud.push(store.get()); toast('Bu cihazdaki ilerleme hesabına yazıldı.'); }
  }

  function openAuth(signup) {
    const user = h('input', { class: 'input', id: 'au-user', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', maxlength: 20, placeholder: 'kullanıcı adı' });
    const pw = h('input', { class: 'input', id: 'au-pw', type: 'password', autocomplete: signup ? 'new-password' : 'current-password', placeholder: 'şifre' });
    const pw2 = signup ? h('input', { class: 'input', id: 'au-pw2', type: 'password', autocomplete: 'new-password', placeholder: 'şifre (tekrar)' }) : null;
    const mail = signup ? h('input', { class: 'input', id: 'au-mail', type: 'email', autocomplete: 'email', autocapitalize: 'off', placeholder: 'ornek@gmail.com' }) : null;
    const msg = h('p', { class: 'small', role: 'alert' });
    openModal({
      title: signup ? 'Hesap oluştur' : 'Giriş yap',
      body: [
        h('div', { class: 'field' }, h('label', { for: 'au-user' }, 'Kullanıcı adı'), user, h('p', { class: 'small muted' }, '3-20 karakter: harf (a-z, Türkçe harf olmadan), rakam ve alt çizgi.')),
        h('div', { class: 'field' }, h('label', { for: 'au-pw' }, 'Şifre'), pw),
        pw2 ? h('div', { class: 'field' }, h('label', { for: 'au-pw2' }, 'Şifre (tekrar)'), pw2) : null,
        mail ? h('div', { class: 'field' }, h('label', { for: 'au-mail' }, 'E-posta (isteğe bağlı)'), mail, h('p', { class: 'small muted' }, 'Sadece şifreni unutursan seni tanımak için. Boş bırakabilirsin. Reklam ya da başka amaçla kullanılmaz.')) : null,
        signup ? null : h('button', { type: 'button', class: 'btn btn-ghost', onClick: forgot }, 'Şifremi unuttum'),
        signup ? h('p', { class: 'card note small' }, 'Önemli: E-posta yazmazsan ve şifreni unutursan hesabını geri alamayız. Şifreni bir yere not et. Gerçek adını istemiyoruz. Kaydın sadece senin hesabında saklanır.') : null,
        msg,
      ],
      actions: [
        { label: t('common.cancel') },
        { label: signup ? 'Oluştur' : 'Giriş yap', kind: 'primary', onClick: async () => {
          const name = cleanUsername(user.value);
          if (!name) { msg.textContent = 'Kullanıcı adı geçersiz.'; return false; }
          if (pw.value.length < 8) { msg.textContent = 'Şifre en az 8 karakter olmalı.'; return false; }
          if (signup && pw.value !== pw2.value) { msg.textContent = 'İki şifre aynı değil.'; return false; }
          const email = signup ? mail.value.trim().toLowerCase() : '';
          if (!validEmail(email)) { msg.textContent = 'E-posta adresi geçersiz görünüyor.'; return false; }
          msg.textContent = 'Bekle…';
          try {
            if (signup) { await ctx.cloud.signUp(name, pw.value); await ctx.cloud.push(store.get()); if (email) { try { await ctx.cloud.setEmail(email); } catch { toast('Hesap açıldı ama e-posta kaydedilemedi. Ayarlar\'dan tekrar ekleyebilirsin.'); } } toast('Hesabın oluşturuldu. İlerlemen kaydedildi.'); } else { await ctx.cloud.signIn(name, pw.value); await afterSignIn(); }
          } catch (e) { msg.textContent = errorText(e); return false; }
          render();
        } },
      ],
    });
  }

  function forgot() {
    const q = makeQuestion();
    const user = h('input', { class: 'input', id: 'fg-user', autocapitalize: 'off', autocomplete: 'username', maxlength: '20' });
    const mail = h('input', { class: 'input', id: 'fg-mail', type: 'email', autocapitalize: 'off', autocomplete: 'email', placeholder: 'ornek@gmail.com' });
    const text = h('textarea', { class: 'input', id: 'fg-msg', rows: '3', maxlength: String(SUPPORT.maxMessage), placeholder: 'Şifremi unuttum, yeni şifre rica ederim.' });
    const ans = h('input', { class: 'input', id: 'fg-ans', inputmode: 'numeric', autocomplete: 'off' });
    // Gizli tuzak alan: insanlar görmez, botlar doldurur.
    const honey = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', style: 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0' });
    const msg = h('p', { class: 'small', role: 'alert' });
    openModal({
      title: 'Şifremi unuttum',
      body: [
        h('p', { class: 'small' }, 'Hesap açarken e-posta yazdıysan şifreni sıfırlayabiliriz. Mesajın destek kutusuna düşer; kayıttaki e-postayla aynıysa sana yeni bir geçici şifre veririz.'),
        h('div', { class: 'field' }, h('label', { for: 'fg-user' }, 'Kullanıcı adın'), user),
        h('div', { class: 'field' }, h('label', { for: 'fg-mail' }, 'Kayıtta yazdığın e-posta'), mail),
        h('div', { class: 'field' }, h('label', { for: 'fg-msg' }, 'Mesajın'), text),
        h('div', { class: 'field' }, h('label', { for: 'fg-ans' }, q.text), ans),
        honey,
        h('p', { class: 'card note small' }, 'E-posta yazmadıysan hesabı geri getiremeyiz. Bu durumda yeni bir hesap açabilirsin; ilerlemen bu cihazda duruyorsa kaybolmaz.'),
        msg,
      ],
      actions: [
        { label: t('common.cancel') },
        { label: 'Gönder', kind: 'primary', onClick: async () => {
          let lastAt = 0;
          try { lastAt = Number(localStorage.getItem(SUPPORT.key)) || 0; } catch { /* sessizce geç */ }
          const r = checkSupport({ username: user.value, email: mail.value, message: text.value, honey: honey.value, answer: ans.value, expected: q.answer, lastAt });
          if (!r.ok) {
            if (r.reason === 'spam') { toast('Mesajın alındı.'); return; } // bota ipucu verme
            msg.textContent = r.reason; return false;
          }
          msg.textContent = 'Gönderiliyor…';
          try { await ctx.cloud.sendSupport(r.row); } catch (e) { msg.textContent = errorText(e); return false; }
          try { localStorage.setItem(SUPPORT.key, String(Date.now())); } catch { /* sessizce geç */ }
          toast('Mesajın alındı. En kısa sürede dönüş yapılır.');
        } },
      ],
    });
  }

  async function editEmail() {
    let current = '';
    try { current = await ctx.cloud.getEmail(); } catch (e) { toast(errorText(e)); return; }
    const mail = h('input', { class: 'input', id: 'ed-mail', type: 'email', autocomplete: 'email', autocapitalize: 'off', placeholder: 'ornek@gmail.com' });
    mail.value = current;
    const msg = h('p', { class: 'small', role: 'alert' });
    openModal({
      title: 'E-posta (isteğe bağlı)',
      body: [h('p', { class: 'small' }, 'Şifreni unutursan hesabını bu adresle kurtarabiliriz. Boş bırakıp kaydedersen e-postan silinir.'), h('div', { class: 'field' }, h('label', { for: 'ed-mail' }, 'E-posta'), mail), msg],
      actions: [
        { label: t('common.cancel') },
        { label: 'Kaydet', kind: 'primary', onClick: async () => {
          const email = mail.value.trim().toLowerCase();
          if (!validEmail(email)) { msg.textContent = 'E-posta adresi geçersiz görünüyor.'; return false; }
          try { await ctx.cloud.setEmail(email); } catch (e) { msg.textContent = errorText(e); return false; }
          toast(email ? 'E-posta kaydedildi' : 'E-posta silindi');
        } },
      ],
    });
  }

  async function syncNow() {
    try { await ctx.cloud.push(store.get()); toast('Eşitlendi'); } catch (e) { toast(errorText(e)); }
    render();
  }

  async function signOut() {
    const ok = await confirmDialog({ title: 'Çıkış yapılsın mı?', text: 'Bu cihazdaki ilerleme silinmez. Sadece hesap bağlantısı kapanır.', yes: 'Çıkış yap', no: t('common.cancel') });
    if (!ok) return;
    try { if (ctx.pushNow) await ctx.pushNow(); } catch { /* sessizce geç */ }
    ctx.cloud.signOut();
    render();
  }

  function accountSection() {
    const c = ctx.cloud;
    return section('Hesap',
      c.signedIn
        ? [h('p', null, `Giriş yapıldı: ${c.user}`),
          h('p', { class: 'small muted' }, c.syncedAt ? `Son eşitleme: ${new Date(c.syncedAt).toLocaleString('tr-TR')}` : 'Henüz eşitlenmedi.'),
          h('p', { class: 'small muted' }, 'İlerlemen otomatik olarak hesabına kaydedilir. Başka cihazda aynı kullanıcı adı ve şifreyle giriş yap.'),
          h('div', { class: 'row-wrap' },
            h('button', { type: 'button', class: 'btn btn-outline', onClick: syncNow }, 'Şimdi eşitle'),
            h('button', { type: 'button', class: 'btn btn-outline', onClick: editEmail }, 'E-posta ekle / değiştir'),
            h('button', { type: 'button', class: 'btn btn-outline', onClick: signOut }, 'Çıkış yap'))]
        : [h('p', { class: 'small muted' }, 'Hesap açarsan ilerlemen başka cihazlarda da kaldığın yerden devam eder. Hesap açmak zorunlu değil.'),
          h('div', { class: 'row-wrap' },
            h('button', { type: 'button', class: 'btn btn-primary', onClick: () => openAuth(false) }, 'Giriş yap'),
            h('button', { type: 'button', class: 'btn btn-outline', onClick: () => openAuth(true) }, 'Hesap oluştur'))]);
  }

  function render() {
    const s = store.get();
    const st = s.settings;
    const th = ctx.theme;
    body.replaceChildren(
      h('h1', null, t('settings.title')),
      !ctx.isControl() ? section(t('settings.theme'),
        h('p', null, th ? `${th.icon} ${th.name}` : ''),
        h('p', { class: 'small muted' }, t('settings.themeNote')),
        h('button', { type: 'button', class: 'btn btn-outline', onClick: changeTheme }, t('settings.themeChange'))) : null,
      section(t('settings.timer'),
        chipRow(t('settings.focus'), CONFIG.timer.focusOptions, st.focusMin, (v) => set((x) => { x.focusMin = v; }), (v) => t('fmt.min', { n: v })),
        chipRow(t('settings.shortBreak'), CONFIG.timer.shortBreakOptions, st.shortBreakMin, (v) => set((x) => { x.shortBreakMin = v; }), (v) => t('fmt.min', { n: v })),
        chipRow(t('settings.goal'), CONFIG.goals, st.dailyGoal, (v) => set((x) => { x.dailyGoal = v; }), (v) => t('how.s3.option', { n: v })),
        toggleRow('autobreak', t('settings.autoBreak'), t('settings.autoBreakDesc'), st.autoBreak, (v) => set((x) => { x.autoBreak = v; }))),
      section(t('settings.feedback'),
        toggleRow('snd', t('settings.sound'), null, st.sound, (v) => set((x) => { x.sound = v; })),
        toggleRow('vib', t('settings.vibration'), null, st.vibration, (v) => set((x) => { x.vibration = v; })),
        notifySupported() ? toggleRow('ntf', t('settings.notifications'), t('settings.notificationsDesc'), st.notifications, onNotify) : null,
        toggleRow('mot', t('settings.reduceMotion'), t('settings.reduceMotionDesc'), st.reduceMotion, (v) => set((x) => { x.reduceMotion = v; }))),
      section(t('settings.look'),
        h('div', { class: 'field' }, h('span', { class: 'label', id: 'lbl-mode' }, t('settings.colorMode')),
          h('div', { class: 'segmented', role: 'group', 'aria-labelledby': 'lbl-mode' },
            ['auto', 'light', 'dark'].map((m) => h('button', { type: 'button', 'aria-selected': String(st.colorMode === m), onClick: () => set((x) => { x.colorMode = m; }) }, t(`settings.mode.${m}`))))),
        chipRow(t('settings.fontSize'), CONFIG.fontScales, st.fontScale, (v) => set((x) => { x.fontScale = v; }), (v) => t(`settings.font.${String(v).replace('.', '_')}`))),
      section(t('settings.health'),
        toggleRow('slp', t('settings.sleep'), t('settings.sleepDesc'), st.sleepReminder, (v) => set((x) => { x.sleepReminder = v; }))),
      section(t('testCode.title'),
        h('div', { class: 'field' }, h('label', { for: 'tcode' }, t('testCode.label')),
          h('input', { class: 'input', id: 'tcode', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: t('testCode.placeholder') }),
          h('p', { class: 'small muted' }, t('testCode.desc'))),
        h('button', { type: 'button', class: 'btn btn-outline', onClick: useTestCode }, t('testCode.button')),
        toggleRow('tauto', t('testCode.auto'), t('testCode.autoDesc'), !!st.testAutoLineup, (v) => {
          store.update((s) => {
            s.settings.testAutoLineup = v;
            if (v && THEMES[s.profile.theme]) applyAutoLineup(s, THEMES[s.profile.theme]);
          });
          if (v) toast(t('testCode.autoOn'));
        })),
      accountSection(),
      section(t('settings.data'),
        h('p', { class: 'small muted' }, t('settings.dataDesc')),
        h('div', { class: 'row-wrap' },
          h('button', { type: 'button', class: 'btn btn-outline', onClick: () => download(`pomodoro-oyun-yedek-${new Date().toISOString().slice(0, 10)}.json`, store.storage.exportJSON(store.get()), 'application/json') }, t('settings.export')),
          h('button', { type: 'button', class: 'btn btn-outline', onClick: importFile }, t('settings.import')),
          h('button', { type: 'button', class: 'btn btn-outline', onClick: showCode }, 'Kurtarma kodu al'),
          h('button', { type: 'button', class: 'btn btn-outline', onClick: loadCode }, 'Kodla yükle'),
          h('button', { type: 'button', class: 'btn btn-danger', onClick: wipe }, t('settings.wipe'))),
        store.storage.backend.persistent ? null : h('p', { class: 'card note' }, t('settings.noStorage'))),
      section(t('settings.about'),
        h('p', null, t('about.text')),
        h('p', { class: 'small muted' }, t('about.fiction')),
        h('p', { class: 'small muted' }, t('about.noAds')),
        h('button', {
          type: 'button', class: 'btn btn-ghost', id: 'version-btn',
          onClick: () => {
            versionTaps += 1;
            if (versionTaps >= CONFIG.research.unlockTaps && !store.get().research.unlocked) {
              store.update((x) => { x.research.unlocked = true; }, { silent: true });
              toast(t('settings.researchUnlocked'));
            }
          },
        }, t('about.version', { v: CONFIG.appVersion }))),
    );
  }

  render();
  return { update: render };
}
