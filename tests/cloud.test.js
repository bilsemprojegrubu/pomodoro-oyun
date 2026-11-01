import { describe, it, expect } from 'vitest';
import { createCloud, cleanUsername, fakeEmail, errorText } from '../src/core/cloud.js';
import { startupSync } from '../src/core/cloudSync.js';
import { createStore } from '../src/core/store.js';
import { createStorage, defaultState } from '../src/core/storage.js';

// Sahte Supabase: kullanıcılar ve saves tablosu bellekte.
function fakeServer() {
  const users = new Map();
  const saves = new Map();
  let calls = 0;
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetchFn = async (url, opt) => {
    calls++;
    const u = new URL(url);
    const body = opt.body ? JSON.parse(opt.body) : null;
    if (u.pathname === '/auth/v1/signup') {
      if (users.has(body.email)) return reply(422, { code: 'user_already_exists', msg: 'User already registered' });
      const id = `id-${users.size + 1}`;
      users.set(body.email, { id, password: body.password });
      return reply(200, { access_token: `a-${id}`, refresh_token: `r-${id}`, expires_in: 3600, user: { id } });
    }
    if (u.pathname === '/auth/v1/token') {
      const us = users.get(body.email);
      if (!us || us.password !== body.password) return reply(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return reply(200, { access_token: `a-${us.id}`, refresh_token: `r-${us.id}`, expires_in: 3600, user: { id: us.id } });
    }
    if (u.pathname === '/rest/v1/saves') {
      const id = String(opt.headers.Authorization || '').replace('Bearer a-', '');
      if (!id) return reply(401, { msg: 'no' });
      if (opt.method === 'POST') { saves.set(id, { data: body.data, updated_at: body.updated_at }); return reply(201, null); }
      return reply(200, saves.has(id) ? [saves.get(id)] : []);
    }
    return reply(404, {});
  };
  return { fetchFn, saves, users, calls: () => calls };
}
const mkBackend = () => { const m = new Map(); return { persistent: true, get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); return true; } }; };
const mkStore = () => createStore(createStorage(mkBackend()));

describe('kullanıcı adı', () => {
  it('kuralları denetler', () => {
    expect(cleanUsername(' Ali_12 ')).toBe('ali_12');
    expect(cleanUsername('ab')).toBeNull();
    expect(cleanUsername('çağrı')).toBeNull();
    expect(cleanUsername('a b c')).toBeNull();
    expect(fakeEmail('ali')).toContain('ali@');
  });
  it('hata metinleri Türkçe', () => {
    expect(errorText({ code: 'user_already_exists' })).toMatch(/alınmış/);
    expect(errorText({ code: 'invalid_credentials' })).toMatch(/yanlış/);
    expect(errorText({ offline: true })).toMatch(/İnternet/);
  });
});

describe('bulut hesabı', () => {
  it('kayıt, çıkış, giriş ve kayıt taşıma', async () => {
    const srv = fakeServer();
    const a = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    await a.signUp('ali', 'sifre1234');
    expect(a.user).toBe('ali');
    const st = defaultState(); st.wallet.coins = 77;
    await a.push(st);
    // başka cihaz
    const b = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    await expect(b.signIn('ali', 'yanlis')).rejects.toBeTruthy();
    await b.signIn('ali', 'sifre1234');
    const remote = await b.pull();
    expect(remote.data.wallet.coins).toBe(77);
  });
  it('aynı kullanıcı adı ikinci kez alınamaz', async () => {
    const srv = fakeServer();
    const a = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    await a.signUp('ali', 'sifre1234');
    await expect(createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() }).signUp('ali', 'baska1234')).rejects.toBeTruthy();
  });
  it('kullanıcılar birbirinin kaydını görmez', async () => {
    const srv = fakeServer();
    const a = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    const b = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    await a.signUp('ali', 'sifre1234'); await b.signUp('veli', 'sifre1234');
    await a.push(defaultState());
    expect(await b.pull()).toBeNull();
  });
  it('internet yoksa offline hatası verir', async () => {
    const c = createCloud({ fetchFn: async () => { throw new Error('x'); }, backend: mkBackend() });
    await expect(c.signIn('ali', 'sifre1234')).rejects.toMatchObject({ offline: true });
  });
  it('oturum yenilenir ve kalıcıdır', async () => {
    const srv = fakeServer(); const be = mkBackend(); let t = 1000;
    const a = createCloud({ fetchFn: srv.fetchFn, backend: be, now: () => t });
    await a.signUp('ali', 'sifre1234');
    expect(createCloud({ fetchFn: srv.fetchFn, backend: be }).user).toBe('ali');
  });
});

describe('açılış eşitlemesi', () => {
  it('bulutta kayıt yoksa gönderir', async () => {
    const srv = fakeServer();
    const c = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    await c.signUp('ali', 'sifre1234');
    const store = mkStore();
    expect(await startupSync({ cloud: c, store, ask: async () => true })).toBe('pushed');
    expect(srv.saves.size).toBe(1);
  });
  it('başka cihazın yeni kaydını yükler', async () => {
    const srv = fakeServer();
    const t = { v: 1000 };
    const c1 = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend(), now: () => t.v });
    await c1.signUp('ali', 'sifre1234');
    const s1 = mkStore(); await startupSync({ cloud: c1, store: s1, ask: async () => true });
    const c2 = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend(), now: () => t.v });
    await c2.signIn('ali', 'sifre1234');
    const s2 = mkStore();
    t.v = 5000;
    s2.update((x) => { x.wallet.coins = 500; x.wallet.earnedTotal = 500; });
    await c2.push(s2.get());
    t.v = 9000;
    expect(await startupSync({ cloud: c1, store: s1, ask: async () => true })).toBe('applied');
    expect(s1.get().wallet.coins).toBe(500);
  });
  it('internet yoksa sessizce çevrimdışı döner', async () => {
    const srv = fakeServer();
    const c = createCloud({ fetchFn: srv.fetchFn, backend: mkBackend() });
    await c.signUp('ali', 'sifre1234');
    const off = createCloud({ fetchFn: async () => { throw new Error('x'); }, backend: (() => { const b = mkBackend(); b.set('pomodoroOyun.bulut', JSON.stringify({ access: 'a-id-1', refresh: 'r', exp: 9e15, uid: 'id-1', username: 'ali', pushed: '', syncedAt: 0 })); return b; })() });
    expect(await startupSync({ cloud: off, store: mkStore(), ask: async () => true })).toBe('offline');
  });
});

import { validEmail } from '../src/core/cloud.js';
describe('e-posta', () => {
  it('boş geçerli, bozuk geçersiz', () => {
    expect(validEmail('')).toBe(true);
    expect(validEmail('ali@gmail.com')).toBe(true);
    expect(validEmail('ali@gmail')).toBe(false);
    expect(validEmail('ali gmail.com')).toBe(false);
  });
});
