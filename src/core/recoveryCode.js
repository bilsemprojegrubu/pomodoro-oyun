// Kurtarma kodu: tüm ilerlemeyi tek bir metne çevirir (sıkıştırılmış). Başka cihazda yapıştırınca kaldığın yerden devam edersin.
// Sunucu yok: kod yalnızca senin cihazında üretilir; kimseye gönderilmez. Kodu bilen herkes ilerlemeni yükleyebilir, gizli tut.
const PREFIX = 'PO1.';

const toB64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (text) => {
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
async function pipe(bytes, stream) {
  const src = new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
  const out = src.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Metni (JSON) kurtarma koduna çevirir. */
export async function makeCode(text) {
  const zipped = await pipe(new TextEncoder().encode(text), new CompressionStream('gzip'));
  return PREFIX + toB64(zipped);
}

/** Kurtarma kodunu metne geri çevirir; bozuksa null döner. */
export async function readCode(code) {
  try {
    const c = String(code).replace(/\s+/g, '');
    if (!c.startsWith(PREFIX)) return null;
    const bytes = await pipe(fromB64(c.slice(PREFIX.length)), new DecompressionStream('gzip'));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
