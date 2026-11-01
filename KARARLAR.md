# KARARLAR

Talimatta net olmayan ya da birden fazla yolu olan yerlerde verilen kararlar. Her satır: **karar** — neden.

## Proje ve yapı
- **Proje `pomodoro-oyun/` klasöründe, depodaki diğer proje (Endemik PWA) olduğu gibi bırakıldı** — aynı depoda başka bir uygulama vardı; talimattaki klasör adı kullanıldı, karışıklık olmasın.
- **Framework yok, saf HTML + CSS + JS (ES modules), Vite sadece derleme ve geliştirme sunucusu için** — lise öğrencileri kodu okuyabilsin. Test için Vitest + jsdom.
- **Tema = JSON + CSS + (paleti JSON'dan okunur)** — yeni tema motora dokunmadan eklenir. Renk paleti JSON'da (aydınlık + karanlık), dekoratif arka plan CSS'te.
- **Tema JSON'ları `tools/temalari-uret.mjs` ile üretilir** — 160+ ürünün tutarlı fiyat/güç/seviye değerleri elle yazılırsa kayar. Üretilen JSON'lar depoda durur, elle de düzenlenebilir.

## Ekonomi ve oyun
- **Para ortak, ürünler ve ilerleme temaya özel** (talimat önerisi) — tema değiştirmek serbest olsun, emek boşa gitmesin.
- **Güç = her kategoride sadece slot sınırı kadar en güçlü ürün** — "sınırlı slot" kuralının sade hali. Oyuncu elle kadro seçmez; en iyiler otomatik girer, fazlası "yedek" olur. Seçim yapma boyutu: slotlar doluyken zayıf ürün almanın faydası yok (mağazada uyarı çıkar).
- **Kademe → seviye kilidi:** Bronz Sv.1, Gümüş Sv.2, Altın Sv.3, Efsane Sv.4 (talimat: "seviye atlayınca yeni ürünler açılır").
- **Seviye eşikleri, temanın azami gücünün oranı** (`config.js` → `levelFractions`) — dört temada da benzer hız.
- **Denge yorumu:** Talimattaki "günde ortalama 4 Pomodoro → haftada ~1 gümüş + birkaç bronz" cümlesi, haftada **5 çalışılan gün** varsayılarak karşılanıyor (≈2.450 para = 1 gümüş + 5 bronz). 7 gün çalışan öğrenci daha fazla kazanır. Bunu `tests/economy.test.js` doğruluyor.
- **Günlük tavan:** Pomodoro'nun *bittiği* günün sayacına yazılır (gece yarısını geçen oturum bitiş gününe sayılır).
- **Set sayacı gün içinde sayılır, gün değişince sıfırlanır; yarım kalan oturum sayacı sıfırlamaz** (ceza yok).
- **Haftalık olay:** Pazar 18:00'den sonra o haftanın olayı çözülür (talimat: "pazar akşamı"); uygulama kapalıysa bir sonraki açılışta gösterilir. Sonuç = (güç + haftalık dakika × 0,1) × (1 ± %10). Rastgelelik **tohumludur** (hafta + tema) — yeniden açarak sonucu değiştirme hilesi yok. Kayıp da para verir (60) ve hiçbir şeyi bozmaz.
- **Olay sadece aktif tema için çözülür**; tema o hafta başlamışsa önceki haftalar sayılmaz.
- **Haftanın başı Pazartesi.**

## Zamanlayıcı ve hile önleme
- **Sayaç `setInterval` ile saymaz;** başlangıç zaman damgasından hesaplanır. `setInterval` yalnızca ekranı yenilemek ve kalp atışı için var.
- **"Kapanıp açılırsa devam etsin" ile "30 sn'den uzun gizli kalırsa geçersiz" kuralı birleştirildi:** son kalp atışından bu yana 30 sn'den az geçtiyse (ör. sayfa yenileme) sayaç devam eder; fazlaysa sayfa "kapalıydı" sayılıp oturum geçersizdir. Mola sayacı için bu kural yok.
- **Saat hilesi denetimi tik-tik:** iki ardışık kontrol arasında duvar saati ile `performance.now()` farkı 3 sn'yi aşarsa geçersiz. Sekme gizliyken karşılaştırma yapılmaz (telefon uykusunda yanlış alarm olmasın); yeniden görünür olunca çapa sıfırlanır. Sayfa yenilemede `performance.now()` sıfırlandığı için sadece "başlangıç geleceğe ait mi" denetlenir.
- **Sekmeler arası tek sayaç:** `localStorage` kilidi + kalp atışı (5 sn bayatlama). `BroadcastChannel` yerine bu seçildi: tarayıcı çökse bile bayat kilit kendiliğinden düşer. Diğer sekmeler `storage` olayıyla durumu yeniden okur.
- **1 dakikadan kısa denemeler kaydedilmez** (yanlışlıkla başlatma araştırma verisini kirletmesin).
- **Duraklatma sadece odak oturumunda**, tek hak, 2 dk.
- **Mola otomatik başlar** (ayarlardan kapatılır) — ritim bozulmasın.
- **Yarım kalan oturum kaydı** (`status: interrupted`, nedeni ile) araştırma için tutulur; kullanıcıya suçlayıcı olmayan metinle gösterilir.

## Psikoloji ve sağlık
- **Rozetler sadece çabaya bağlı:** kazanma/kaybetme sayısına bağlı rozet yok (ilk taslaktaki "3 zafer" rozeti "3 haftalık olaya katıl" yapıldı).
- **Liderlik tablosu, loot box, gerçek para, reklam, "dönmezsen" bildirimi yok.** `tests/i18n.test.js` yasaklı ifadeleri tarar.
- **Hayvan Barınağı'nda hayvanlar "satılmaz/satın alınmaz":** düğme "Barınağa kabul et", fiyat etiketi "bakım masrafı", ayrılan hayvan yok (kayıp korkusu yok).
- **Seri dondurma otomatik uygulanır:** tek gün atlanırsa ve o hafta hak kullanılmadıysa. Kopunca: "Seri sıfırlandı ama sen hâlâ buradasın".
- **Uyku hatırlatması 23:00-05:00 arası**, engellemez, ayarlardan kapanır.
- **Dil:** hiçbir yerde "kızlar/erkekler için" ifadesi yok; test ediliyor.

## Veri ve gizlilik
- **Sunucu yok; her şey `localStorage`'da.** `schemaVersion` + göç zinciri (`MIGRATIONS`). Gelecekteki sürümden gelen kayıt bozulmasın diye reddedilir.
- **`localStorage` yoksa/doluysa bellek içi yedeğe düşülür** ve kullanıcıya uyarı gösterilir.
- **CSV ayracı `;` + UTF-8 BOM** — Türkçe yerel ayarlı Excel'de çift tıkla düzgün açılır. Tek dosyada hem oturumlar hem anketler (`tur` sütunu). Hücreler `= + - @` ile başlıyorsa başa `'` eklenir (formül enjeksiyonuna karşı).
- **CSV'ye görev adının sadece "ders" kısmı** (tireden öncesi) yazılır — görev adına yanlışlıkla kişisel bilgi yazılsa bile dışarı çıkmaz.
- **Katılımcı kodu** sadece harf/rakam/`_`/`-`, en çok 12 karakter.
- **Anket kaldırıldı:** site kâr amacı gütmeyen bir katkı sitesi, kanıt toplamak gerekmiyor. Açılışta ve 14 gün sonra anket sorulmaz. Araştırma modülü kodda duruyor ama kullanıcıya görünmüyor (sürüm numarasına basarak açılan gizli bölüm). Ayarlar ve İstatistik ekranlarındaki Araştırma bağlantıları da kaldırıldı.
- **Kontrol modu gizli:** Ayarlar → Hakkında'da sürüm yazısına 5 kez dokununca "Araştırma raporu" ekranında açılır. İlk 3 gün oyun/tema/mağaza/para kapalıdır, sonra kendiliğinden açılır; veri `mode: control | game` etiketiyle ayrılır.

## Günlük karşılaşma (her temada)
- **Futbol:** hazırlık maçı. İlk 11 (kaleci 1, defans 4, orta saha 3, forvet 3) kurulunca açılır.
- **Kafe:** rakip kafe, "günün özeti" müşteri sayısı. **Moda:** rakip atölye, beğeni. **Barınak:** komşu barınak, ilgi puanı (amaç dostlarımıza yuva bulmak; rakip düşman değil, dost bir komşu).
- **Ödül (hepsinde aynı):** Kazanırsan 10 birim bonus. Rakip öndeyse ya da berabere kalırsan 0 — ne kayıp ne kazanç; rakip de bir şey kazanmaz (`CONFIG.friendly`).
- **Para sömürülmesin diye:** Her karşılaşma için o gün tamamlanmış bir Pomodoro gerekir, günde en fazla 3. Sonuç gün + sıraya bağlıdır; yeniden deneyerek değişmez.
- **Analiz:** Senin gücün ve rakibin gücü, bugünkü odak süresinin etkisi, alanlara göre güç yüzdesi (futbolda mevkiler, diğerlerinde kategoriler), en güçlü/zayıf alan ve öneri. Kayıp "ceza" değil, öğrenme fırsatı olarak anlatılır.
- **Metinler:** `tr.json` → `friendly.theme.<tema>`. Yeni tema eklenirse oraya da eklenmeli (test kontrol eder).

## Görsel ve erişilebilirlik
- **Görseller:** ürünler için "kademe renkli kare + emoji" ya da kod ile çizilen karakter (SVG). Tek yerden: `src/assets/art.js`. Kademe sadece renkle değil, ikon + yazıyla da verilir.
- **Sesler Web Audio ile kodla üretilir** — dosya/telif yok.
- **Karanlık mod:** otomatik (sistem) / aydınlık / karanlık seçilebilir. Tema paletinin her ikisi de WCAG AA için test edilir.
- **Sade mod:** odak sırasında alt menü ve üst şerit solar; mola sırasında menü geri gelir (kazandığın parayı harcayabilmen için).
- **Geniş ekranda alt menü sol şeride dönüşür.**
- **Bildirim izni sadece kullanıcı ayarı açınca istenir.**

## Kaydırarak sekme değiştirme
- Sola kaydır: sonraki sekme, sağa kaydır: önceki sekme (Odak → Dünyam → Mağaza → İstatistik → Ayarlar). Baştan sona dönmez, uçta durur.
- Yanlışlıkla tetiklenmesin diye: en az 70 px, yataya belirgin ağırlıklı, 0,7 sn'den kısa olmalı. Yazı kutusu, kaydırıcı, yatay kayan alanlar ve açık pencere üstünde çalışmaz. Kontrol modunda gizli sekmeler atlanır.

## Test kodu (geçici)
- Ayarlar'da "Test kodu" bölümü: doğru kod girilince 100.000 para ekler, her girişte tekrar verir. Amaç siteyi hızlı denemek (örn. futbolcu almak için dakikalarca beklememek).
- Kod düz yazı olarak değil SHA-256 özeti olarak dosyada durur (`src/core/testcode.js`). Bu kodu gizli tutmaz: kodu bilen herkes kullanabilir, site açık olduğu için isteyen kodu kırabilir. Bu yüzden yalnızca test için; yayına açık kullanımdan önce kaldırılmalı.
- İstatistikteki "toplam kazanılan para"ya eklenmez. Kaldırma: `testcode.js`, settings.js'deki bölüm, tr.json'daki `testCode` bloğu.
- **Otomatik en güçlü kadro (test ayarı):** "Test kodu" bölümündeki anahtar açılınca, seçili temada her mevkiye en güçlü ürünler bedava ve seviye kilidine bakmadan yerleşir. Tema değiştirince yeni temada da yerleşir. Kapatınca verilenler geri alınmaz. Para değişmez. Kaldırma: `testcode.js` içindeki `applyAutoLineup`, settings.js'deki anahtar.
- **Test kodu ve hazırlık maçı:** Kod girilince ayrıca "1000 Pomodoro yapılmış" sayılır (`settings.testBonusPomodoros`). Hazırlık maçında günlük 3 sınırı ve "Pomodoro tamamla" şartı kalkar. Günlük istatistik, seri ve hedef etkilenmez. Kaldırma: `testcode.js`, `friendly.js` içindeki `bonus` satırları.
- **Alan yüzdesi düzeltildi:** Analizde bir alanın yüzdesi artık, oyunda gerçekten bulunan en iyi ürünlerle dolu olsaydı ulaşacağı güce göre hesaplanır (eskiden "her slotta en iyi tek ürün" varsayılıyordu, bu yüzden en iyi kadro bile %54 çıkabiliyordu). En güçlü kadro her alanda %100 verir.
- **Futbolda efsane kadro:** Her mevkide kadroyu dolduracak kadar Efsane oyuncu vardır (Kaleci 1, Defans 4, Orta saha 3, Forvet 3). Hepsini alan takım kusursuzdur (analizde her alan %100). Yeni oyuncular üretici listesinin sonuna eklendi, böylece eski kayıtlardaki oyuncu numaraları ve güçleri değişmedi. Azami güç 745'ten 956'ya çıktığı için futbolun seviye eşikleri ve rakip güçleri yeniden hesaplandı (3. Lig 60→76, 2. Lig 164→210, 1. Lig 313→402, Süper Lig 507→650).

## Kusursuz kadroda analiz
Tüm alanlar %100 iken "en zayıf alan / yatırım yap" önerisi gösterilmez; yerine "Kadron kusursuz" mesajı çıkar (`analyze().perfect`, eşik %99,5).

## Oyun düzeni ve elle kadro
- Futbolda 5 diziliş: 4-3-3 (varsayılan), 4-4-2, 3-5-2, 3-4-3, 5-3-2 (`formations`, `tools/temalari-uret.mjs`). Seçim tema kaydında (`formation`).
- Kadro varsayılan olarak otomatik: her mevkide en güçlüler oynar. Bir oyuncuya dokunup yerine yedek koyunca ya da yedeğe alınca o kategori "elle" olur (`picks[kategori]`); "En güçlüleri otomatik seç" düğmesi geri döndürür.
- Elle kadroda yeni alınan ürün, o mevkide boş yer varsa kadroya girer; yoksa yedekte kalır. Diziliş değişince kotaya sığdırılır, boşlar en güçlülerle dolar.
- Seviye eşikleri 4-3-3'e göre hesaplı; elle kadro gücü düşürebilir (kullanıcı tercihi).
- Test modu "otomatik kur" elle seçimleri siler ve her dizilişe yetecek oyuncuyu verir.

## Sekme geçiş animasyonu
Sekme değişince ekran 0,22 sn sağdan (ileri) ya da soldan (geri) hafifçe kayarak belirir. "Hareketi azalt" açıksa ya da cihaz azaltılmış hareket istiyorsa animasyon kapanır.

## Diğer temaların denetimi
Kafe, moda ve barınak temaları baştan sona gezildi (kadro, mağaza verisi, elle kadro, karşılaşma): hata çıkmadı. Düzeltilenler: sahne altındaki not artık "dokunarak değiştirebilirsin" diyor; kadro pencerelerindeki "oyuncu/oynasın" gibi futbola özel sözler tüm temalara uygun hale getirildi.

## Dünyam sahneleri (dört tema)
- Her temanın Dünyam ekranında çizili bir sahne var: kafe iç mekânı, futbol sahası, moda podyumu, hayvan barınağı (`src/ui/components/scenes.js`).
- Görsellerde emoji ve piksel sanat yok: hepsi özgün, düz renkli vektör (SVG) çizimdir (`src/assets/props.js`). Mağaza/kadro karoları da aynı çizimleri kullanır.
- Arkadaşın sitesinden hiçbir görsel alınmadı.
- Kadro seçimi sahneye yansır (sadece slotlara giren ürünler çizilir). Hareket kapalıyken animasyonlar durur.
- Düzeltme: karakter kıyafet/saç rengi seçiminde negatif indeks hatası giderildi (`>>>`).

## Servis oyunu (dört tema, İyi Pizza Güzel Pizza tarzı)
- Dünyam sahnesinin altındaki "Oyna" düğmesi servis oyununu açar: müşteri gelir, siparişini söyler (sahip olunan eşyalardan), oyuncu tepsiden doğru eşyalara dokunur. Sabır çubuğu dolmadan yetişirse 1-3 yıldız.
- Yanlış eşya sabrı azaltır ve seriyi bozar. Sipariş, oyuncunun sahip olduğu eşyalardan çıkar; eşya aldıkça oyun zenginleşir.
- Oyun puanı SADECE eğlence içindir: Pomodoro parasını ve seviyeyi etkilemez, böylece odaklanma ekonomisi bozulmaz. Araştırma kontrol modunda Dünyam zaten kapalıdır.
- Kod: src/ui/components/serviceGame.js (oyun), scenes.js (stageFor), screens.css (.sg-*). Hareket azaltma ayarına uyar.
- Zorluk seviyeye bağlı: seviye arttıkça sipariş büyür (2 seviyede +1 parça), tepsi 8'den 12 eşyaya çıkar, sabır 24 sn'den 12 sn'ye iner. Ekranda "Zorluk: n" görünür.
- Servis oyunu zorlaştırıldı: sipariş soldan sağa SIRAYLA verilmeli (numaralı), sabır 18 sn'den 8 sn'ye iner, tepsi 16 eşyaya çıkar, yanlış dokunuş sabırdan 4 sn götürür.
- Temaya özel ek oyunlar (src/ui/components/miniGames.js, sadece eğlence, para vermez): kafe pasta kulesi, futbol penaltı, moda kart eşleştirme, barınak hayvanları besle. Hepsi seviyeye göre zorlaşır.
- Oyunlar küçük para verir (src/core/gameCoins.js): servis oyunu müşteri başına 2-4, ek oyunlar tur başına en çok 20. Günlük tavan 100 oyun parası (yaklaşık 1 Pomodoro = 100). Asıl kazanç odaklanmadan gelir; sayılar src/config.js içinde (miniGameMaxCoins, dailyGameCoinCap).

## Oyunların günün özetine etkisi
- Oyun oynamayan gün: skor %15 düşer. Tüm turları kaçırırsan %20 düşer. Hepsini kazanırsan düşüş 0.
- Arası doğrusal: `pct = round(-20 + 20 * ortalamaBaşarı)`. (Başarı %25'in altındaysa hiç oynamamak daha iyi çıkar; kullanıcı böyle istedi.)
- Ayarlar: `CONFIG.friendly.gameEffect = { none: -15, worst: -20, best: 0 }`.
- Oyunların üstünde "günün özetini etkiler" yazısı, oyun sonunda ve maç analizinde sonuç satırı var.
- Futbolda yeni mod: kaleci (penaltı tutma); penaltıda ve kalecilikte 10 şut (tek kaçırma etkisi yarıya iner, gol başı 2 altın), rakibin bakışı ipucu verir ama zorlukla güveni azalır.

## Kurtarma kodu (cihazlar arası devam)
- Kullanıcı adı/şifre yok, sunucu yok. Ayarlar > "Kurtarma kodu al" ile kod alınır, diğer cihazda "Kodla yükle".
- Kod = `PO1.` + gzip + base64url. Kodu bilen herkes kaydı yükleyebilir: gizli tutulmalı.
- Otomatik senkron yok; kod elle taşınır.

## Bulut hesabı (Supabase)
- Giriş: kullanıcı adı + kullanıcının kendi şifresi (en az 8). E-posta istenmiyor; arka planda `kullanıcıadı@kullanici.pomodoro-oyun.app` sahte adresi kullanılır, hiç posta gitmez.
- Supabase'de "Confirm email" KAPALI olmalı. Tablo: `public.saves(user_id, data jsonb, updated_at)`, RLS açık, herkes sadece kendi satırını okur/yazar.
- Kütüphane yok: `src/core/cloud.js` doğrudan REST çağırır. `cloudSync.js`: açılışta uzlaşma, 30 sn'de bir ve sayfa gizlenirken gönderim.
- Çakışma kuralı: başka cihaz daha yeni kayıt yazdıysa o yüklenir; bu cihazda gönderilmemiş değişiklik de varsa kullanıcıya sorulur.
- Şifre sıfırlama YOK (e-posta toplanmıyor). İsteğe bağlı e-posta + otomatik sıfırlama sonraki adım; ayrı kurulum gerektirir.
- Altın/maç hesabı hâlâ telefonda; hile mümkün (sıralama tablosu yapılırsa sunucuya taşınmalı).
- Anahtar `src/config.js` içinde, publishable türü, herkese açık olması güvenli.

## İsteğe bağlı e-posta
- Kayıtta ve Ayarlar > "E-posta ekle / değiştir" ile girilir; `public.contacts` tablosunda saklanır (RLS: herkes yalnız kendininkini görür). Girişte kullanılmaz.
- Şifre sıfırlama ELLE: kullanıcı kayıtlı adresinden proje adresine yazar, sahibi Supabase panelinden (Authentication > Users) şifreyi sıfırlar. Kayıtlı e-postayı panelde Table Editor > contacts'tan doğrula.
- Otomatik sıfırlama için ayrı SMTP servisi gerekir (Supabase'in varsayılan gönderimi sadece ekip üyelerine gider). Sonraki adım.
- `CONFIG.cloud.contactEmail` boş; doldurulursa "Şifremi unuttum" ekranında gösterilir.
