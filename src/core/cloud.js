// Bulut hesabı (Supabase): kullanıcı adı + şifre ile giriş, kaydı sunucuda saklama.
// Kütüphane yok: doğrudan Supabase'in REST adresleri çağrılır (site küçük kalsın diye).
// Anahtar "publishable" türünde: herkese açık olması güvenli. Verileri satır güvenliği (RLS) korur,
// her kullanıcı yalnızca kendi satırını okuyup yazabilir.
import { CONFIG } from '../config.js';

const C = CONFIG.cloud;
const KEY = 'pomodoroOyun.bulut';

/** Kullanıcı adı kurallarına uyuyorsa küçük harfli hâlini, uymuyorsa null döndürür. */
export function cleanUsername(raw) {
  const u = String(raw || '').trim().toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null;
}

/** Kullanıcı adından, sunucuya giden sahte e-posta (gerçek e-posta istemiyoruz, hiçbir zaman posta gönderilmez). */
export const fakeEmail = (username) => `${username}@${C.emailDomain}`;

/** Sunucu hatasını Türkçe kısa mesaja çevirir. */
export function errorText(err) {
  if (err && err.offline) return 'İnternet bağlantısı yok. Sonra tekrar dene.';
  const m = String((err && (err.code || err.msg || err.message || err.error_description)) || '').toLowerCase();
  if (m.includes('already') || m.includes('exists')) return 'Bu kullanıcı adı alınmış. Başka bir ad dene.';
  if (m.includes('invalid_credentials') || m.includes('invalid login')) return 'Kullanıcı adı veya şifre yanlış.';
  if (m.includes('weak') || m.includes('password')) return 'Şifre çok zayıf. Daha uzun bir şifre dene.';
  if (m.includes('rate') || m.includes('too many') || m.includes('429')) return 'Çok fazla deneme yapıldı. Biraz bekle.';
  return 'Bir sorun oluştu. Sonra tekrar dene.';
}

/** Basit metin özeti: durumun değişip değişmediğini anlamak için. */
export function hashString(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${h}`;
}

/** Kayıtta karşılaştırılacak metin (dışa aktarma zamanı gibi değişken alanlar olmadan). */
export const stateText = (state) => JSON.stringify(state);

export function createCloud({ fetchFn = (...a) => fetch(...a), backend, now = () => Date.now() } = {}) {
  const load = () => {
    try { return JSON.parse(backend.get(KEY) || 'null'); } catch { return null; }
  };
  const save = (v) => { try { backend.set(KEY, JSON.stringify(v)); } catch { /* sessizce geç */ } };
  let session = load(); // { access, refresh, exp, uid, username, pushed, syncedAt }

  async function call(path, { method = 'GET', body, token, headers = {}, keepalive = false } = {}) {
    let res;
    try {
      res = await fetchFn(`${C.url}${path}`, {
        method,
        keepalive,
        headers: { apikey: C.key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw { offline: true };
    }
    let json = null;
    try { json = await res.json(); } catch { /* boş yanıt */ }
    if (!res.ok) throw json || { msg: `http ${res.status}` };
    return json;
  }

  function adopt(r, username, extra = {}) {
    session = {
      access: r.access_token, refresh: r.refresh_token,
      exp: now() + (Number(r.expires_in) || 3600) * 1000 - 60000,
      uid: r.user && r.user.id, username, pushed: '', syncedAt: 0, ...extra,
    };
    save(session);
  }

  async function token() {
    if (!session) throw { msg: 'not signed in' };
    if (now() < session.exp) return session.access;
    const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh } });
    session = { ...session, access: r.access_token, refresh: r.refresh_token || session.refresh, exp: now() + (Number(r.expires_in) || 3600) * 1000 - 60000 };
    save(session);
    return session.access;
  }

  return {
    get user() { return session ? session.username : null; },
    get signedIn() { return !!session; },
    get syncedAt() { return session ? session.syncedAt : 0; },
    get pushedHash() { return session ? session.pushed : ''; },

    async signUp(username, password) {
      const r = await call('/auth/v1/signup', { method: 'POST', body: { email: fakeEmail(username), password, data: { username } } });
      if (!r || !r.access_token) throw { msg: 'confirm' }; // e-posta onayı açık kalmış
      adopt(r, username);
    },
    async signIn(username, password) {
      const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: fakeEmail(username), password } });
      adopt(r, username);
    },
    signOut() {
      session = null;
      try { backend.set(KEY, 'null'); } catch { /* sessizce geç */ }
    },

    /** Sunucudaki kayıt: { data, updatedAt } ya da yoksa null. */
    async pull() {
      const rows = await call('/rest/v1/saves?select=data,updated_at', { token: await token() });
      return rows && rows[0] ? { data: rows[0].data, updatedAt: Date.parse(rows[0].updated_at) || 0 } : null;
    },
    /** Durumu sunucuya yazar (varsa üzerine). */
    async push(state, { keepalive = false } = {}) {
      const tk = await token();
      const at = now();
      await call('/rest/v1/saves?on_conflict=user_id', {
        method: 'POST', token: tk, keepalive,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { user_id: session.uid, data: state, updated_at: new Date(at).toISOString() },
      });
      session = { ...session, pushed: hashString(stateText(state)), syncedAt: at };
      save(session);
    },
    /** Sunucudaki kaydı, aynı anda yüklediğimizi not et (tekrar göndermeyelim). */
    markSynced(state, at) {
      if (!session) return;
      session = { ...session, pushed: hashString(stateText(state)), syncedAt: at || now() };
      save(session);
    },
  };
}
