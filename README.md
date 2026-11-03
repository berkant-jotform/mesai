# Mesai

ARGE Portal için çalışma saati hesabı.

Kurulum ve çalışan örnek: https://berkant-jotform.github.io/mesai/

Sayfadaki **Mesai** düğmesini yer işaretleri çubuğuna sürükle. Portalda PDKS kartını açıp bu yer işaretine tıkla.

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
