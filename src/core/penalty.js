// Penaltı şutunun sonucu (saf hesap). Kale ölçüleri sahne yüzdesidir.
// tx: topun kale çizgisindeki yatay yeri, power: 0-1 şut gücü, over: çok sert (üstten aut),
// keeper: kalecinin o anki bölgesi (0 sol, 1 orta, 2 sağ).
export const PK_GOAL = { l: 14, r: 86, t: 20, b: 56 };

export function shotOutcome({ tx, power, over = false, keeper }, G = PK_GOAL) {
  const third = (G.r - G.l) / 3;
  const ty = G.b - 5 - power * (G.b - G.t - 7); // güçlü şut daha yükseğe gider
  const zone = tx < G.l + third ? 0 : tx > G.r - third ? 2 : 1;
  const base = { ty, zone, dive: keeper };
  if (over) return { ...base, ty: G.t - 6, result: 'miss', text: 'ÜSTTEN AUT!' };
  if (Math.abs(tx - G.l) < 1.8 || Math.abs(tx - G.r) < 1.8) return { ...base, result: 'post', text: 'DİREK!' };
  if (tx < G.l || tx > G.r) return { ...base, result: 'miss', text: 'AUT!' };
  // Yavaş şutta kaleci yan köşeye yetişebilir.
  let dive = keeper;
  if (power < 0.35 && Math.abs(zone - keeper) === 1) dive = zone;
  // Sert ve köşeye yakın şut, kaleci doğru yerde olsa da kurtarılamaz.
  const corner = zone !== 1 && Math.min(Math.abs(tx - G.l), Math.abs(tx - G.r)) < 7;
  if (dive === zone && !(power > 0.8 && corner)) return { ...base, dive, result: 'save', text: 'KURTARDI!' };
  return { ...base, dive, result: 'goal', text: 'GOOOL!' };
}

/** Şut hızı (km/s, gösterim için). */
export const kmh = (power) => Math.round(45 + power * 75);
