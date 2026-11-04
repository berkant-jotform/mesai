# Mesai: developer reference

Start with [Getting started](GETTING_STARTED.md). This page keeps the workflow details separate from the first-run instructions. Dated release documents retain their original scope; they do not prove the current machine or account is configured.

## Checks

```sh
python3 build.py
node --check mesai.js
node --check page.js
node --check preview.js
```

Use the configured project environment for these commands. Any optional live-service check needs its own setup and approval. Do not run paid jobs, send email or publish content as an incidental test.

## 3.1.0

- **Sor senaryo hesaplar:** “her gün 10 saat yapsam cuma 8’de gelsem kaçta çıkarım”, “cuma 14’te çıkmak için her gün kaç saat”, “perşembe 15’te çıkmak için kaçta gelmeliyim”, “bu hafta kaç saat yaptım”, “kaç saat fazlam var”, “bugün 17’de çıksam yeter mi”. Cevabın altında “Anladığım” etiketleri; uygulanmamış cevaplar “Önizleme” olarak işaretlenir.
- **Zorunlu saat dışına taşan planlarda OOO önce sorulur**, kullanıcı onaylamadan eklenmez (onaylanınca hedef artar, örn. 45 → 47 sa).
- **Portal satırı ile giriş-çıkış listesi farklıysa** (örn. portal 08:23–11:56 = 3:33, liste 08:23–17:38 = 9:14) uyarı gösterilir; varsayılan olarak liste sayılır, gün bazında “Portal” seçilebilir.
- Pencere kenar/köşeden boyutlandırılır; daralınca Standart → Kompakt → Cep. Tek tıkla kompakt görünüm (Alt+K, başlığa çift tık).
- Resmi tatiller (Jotform 2026 TR, 2027 resmi takvim; arife tam gün) 9 saat sayılır; ayarlardan kapatılabilir. Google Takvim .ics içe aktarma (yerelde okunur, onayla eklenir).
- **Soru paneli her temada:** başlıktaki “Sor” düğmesi soru kutusunu, cevabı ve örnekleri açıp kapatır. Bu yüzden “Sütunlar + Sor” teması kaldırıldı (Sütunlar + Sor düğmesi aynı şey); bu temayı kullananlar otomatik olarak Sütunlar’a ve açık soru paneline geçer.
- Okunabilirlik: “Hafta biter · 45 sa”, süreler “9:41 sa”, “tahmin”, “{D} sa sayılır”, başlıkta görünür “Sor” düğmesi.

## 3.0.1

- Ana yer işareti kodun tamamını içerir. Portal içinde GitHub’dan betik yüklemesi gerekmez.
- Eski “Mesai yüklenemedi” hatasını alanlar yer işaretini kurulum sayfasından yeniden eklemeli.
- Kurulum sayfasında beş görünüm de çalışır; açık/koyu ve TR/EN seçimleri önizlemeyi de değiştirir.
- Önizleme örnek kayıtlar ve bellekte tutulan ayarlar kullanır. Gerçek portal verileriyle bağlantısı yoktur.



## Güncelleme

1. `mesai.js` ve `version.json` dosyalarını güncelle.
2. `python3 build.py` çalıştır. Böylece `index.html` içindeki yer işareti de yenilenir.
3. Değişen dosyaları `main` dalına gönder. Pages kaynağı `main / root`.

Kullanıcılar yeni sürüm için düğmeyi yeniden sürüklemeli. Önceden kullanılan uzaktan yükleyici bu sürümde ana kurulum yöntemi değildir.



## Dosyalar

- `page.template.html`, `page.css`, `page.js`: kurulum sayfası.
- `preview.html`, `preview.js`: aynı uygulamayla çalışan, örnek verili önizleme.
- `demo.html`: dönem/personel yüklemelerini ve birden fazla kartı taklit eden mevcut test ekranı.
- `.nojekyll`: Pages’in dosyaları doğrudan sunması için.

Mesai portal tablolarını okur; planları ve ayarları portalın tarayıcı deposunda tutar. Hesapların resmi kaynağı ARGE Portal’dır.



## Yerel geliştirme ve kontrol

Python 3 ve JavaScript sözdizimi kontrolü için Node.js gerekir. Ek paket kurulumu gerekmez.

```sh
python3 build.py
node --check mesai.js
node --check page.js
node --check preview.js
python3 -m http.server 8080 --bind 127.0.0.1
```

Kurulum sayfasını `http://127.0.0.1:8080` adresinde aç. `demo.html` ve `preview.html` örnek veriyle arayüz kontrolü içindir; gerçek personel kayıtlarını doğrulamaz. Yer işaretini gerçek portalda kullanırken görünen hesapları portalın resmi kayıtlarıyla karşılaştır.

## 3.2.0

- Six layouts in this order: Timeline, Knight, Columns, Ask-first, Ticket, Celestial clock. Knight and clock each have light/dark artwork and their own composition.
- All layouts use the same calculation, scenario and question engines. Full, compact and pocket modes preserve the active theme; full view contains the day editor, reverse calculator and settings.
- Bottom-right resize grip supports drag, arrow keys (10px), Shift+arrow (50px), and double-click reset.
- The version link opens the install page. A public version.json check, with no credentials or attendance data, runs at most once every six hours; blocked requests fail silently. Updates require replacing the bookmark. No remote JavaScript is executed.
- Fonts and artwork are embedded in the bookmark. The public page uses local fonts. Its ruler/cursor trail honours reduced motion and has an off switch.

### Build

Run `npm ci`, then `npm run build` at the repository root. The build reads modules from `source/mesai/src`, art and fonts from `assets`, and rebuilds `mesai.js` and the install bookmark in `index.html`. `npm test` runs core, scenario and question tests. Keep `version.json`, the VERSION constant in ui.js, and page version labels aligned.
