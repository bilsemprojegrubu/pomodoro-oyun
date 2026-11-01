// Bulut eşitleme: açılışta sunucuyla uzlaş, sonra değişiklikleri düzenli gönder.
import { CONFIG } from '../config.js';
import { hashString, stateText } from './cloud.js';

/** Bu durumda anlamlı bir ilerleme var mı? (boş cihaz mı?) */
export const hasProgress = (s) => (s.wallet && s.wallet.earnedTotal > 0) || (s.sessions && s.sessions.length > 0);

/** Sunucudaki veriyi uygulanabilir duruma çevirir; bozuksa null. */
export const parseCloud = (storage, data) => storage.parseImport(JSON.stringify({ app: 'pomodoro-oyun', data }));

/**
 * Açılışta bir kez çalışır. Başka cihaz bizden yeni kayıt gönderdiyse onu yükler.
 * Bu cihazda gönderilmemiş değişiklik de varsa kullanıcıya sorar.
 * Dönüş: 'applied' (bulut yüklendi) | 'pushed' | 'same' | 'offline'
 */
export async function startupSync({ cloud, store, ask }) {
  if (!cloud.signedIn) return 'same';
  try {
    const remote = await cloud.pull();
    const state = store.get();
    if (!remote) { await cloud.push(state); return 'pushed'; }
    const dirty = hashString(stateText(state)) !== cloud.pushedHash;
    if (remote.updatedAt > cloud.syncedAt) {
      const next = parseCloud(store.storage, remote.data);
      if (next && (!dirty || !hasProgress(state) || await ask())) {
        store.replace(next);
        cloud.markSynced(next, remote.updatedAt);
        return 'applied';
      }
    }
    if (dirty) { await cloud.push(store.get()); return 'pushed'; }
    return 'same';
  } catch { return 'offline'; }
}

/** Değişiklik varsa belli aralıkla ve sayfa gizlenirken sunucuya gönderir. */
export function startAutoPush({ cloud, store }) {
  let busy = false;
  async function push(keepalive = false) {
    if (!cloud.signedIn || busy) return;
    const state = store.get();
    if (hashString(stateText(state)) === cloud.pushedHash) return;
    busy = true;
    try { await cloud.push(state, { keepalive }); } catch { /* internet yoksa sonra denenir */ }
    busy = false;
  }
  setInterval(() => push(), CONFIG.cloud.syncEverySec * 1000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) push(true); });
  window.addEventListener('pagehide', () => push(true));
  return push;
}
