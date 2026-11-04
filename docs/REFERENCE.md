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
