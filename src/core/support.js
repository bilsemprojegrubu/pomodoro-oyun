// Destek kutusu: "Şifremi unuttum" gibi istekler için araya giren denetim katmanı.
// Kişisel e-posta adresi sitede gösterilmez; mesajlar sunucudaki `destek` tablosuna düşer,
// spam burada (istemcide) ve sunucuda (supabase/destek.sql) süzülür.
import { cleanUsername, validEmail } from './cloud.js';

export const SUPPORT = {
  cooldownMs: 10 * 60 * 1000, // aynı cihazdan iki mesaj arası
  minMessage: 10,
  maxMessage: 500,
  key: 'pomodoroOyun.destekSon',
};

/** Basit insan sorusu: "3 + 4 kaç eder?" */
export function makeQuestion(rand = Math.random) {
  const a = 2 + Math.floor(rand() * 8);
  const b = 2 + Math.floor(rand() * 8);
  return { text: `${a} + ${b} kaç eder?`, answer: String(a + b) };
}

const LINK = /(https?:\/\/|www\.|\.(com|net|ru|xyz|top|click)\b)/i;

/** Gönderilecek mesajı denetler. { ok:true, row } ya da { ok:false, reason } döndürür. */
export function checkSupport({ username, email, message, honey, answer, expected, lastAt = 0, now = Date.now() }) {
  if (honey) return { ok: false, reason: 'spam' }; // botlar gizli alanı da doldurur
  if (lastAt && now - lastAt < SUPPORT.cooldownMs) {
    const min = Math.ceil((SUPPORT.cooldownMs - (now - lastAt)) / 60000);
    return { ok: false, reason: `Az önce mesaj gönderdin. ${min} dakika sonra tekrar dene.` };
  }
  const name = cleanUsername(username);
  if (!name) return { ok: false, reason: 'Kullanıcı adı geçersiz.' };
  const mail = String(email || '').trim().toLowerCase();
  if (!mail || !validEmail(mail)) return { ok: false, reason: 'Kayıtta yazdığın e-posta adresini doğru yaz.' };
  const text = String(message || '').trim();
  if (text.length < SUPPORT.minMessage) return { ok: false, reason: `Mesaj en az ${SUPPORT.minMessage} karakter olmalı.` };
  if (text.length > SUPPORT.maxMessage) return { ok: false, reason: `Mesaj en fazla ${SUPPORT.maxMessage} karakter olabilir.` };
  if (LINK.test(text)) return { ok: false, reason: 'Mesajda bağlantı olamaz.' };
  if (String(answer || '').trim() !== String(expected)) return { ok: false, reason: 'Toplama sorusunun cevabı yanlış.' };
  return { ok: true, row: { username: name, email: mail, message: text } };
}
