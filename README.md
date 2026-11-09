# Mesai

ARGE Portal çalışma saatlerini hesapla ve haftanı planla. / Calculate work hours and plan your week in ARGE Portal.

**Status:** 3.2.5 · Tarayıcı yer işareti aracı. Önizleme örnek veri kullanır; gerçek portal hesabı gerektirmez.

![Three-step workflow overview](docs/images/workflow.svg)

## Start here

[Kurulum ve örnek önizleme / Setup and sample preview](https://berkant-jotform.github.io/mesai/).

Kurulum sayfasını aç, **Mesai** düğmesini yer işaretleri çubuğuna sürükle. ARGE Portal’da PDKS (personel giriş-çıkış) kartını açıp yer işaretine tıkla. Önce kurulum sayfasındaki örnek önizlemeyi deneyebilirsin.

[Adım adım kullanım / Step-by-step guide](docs/GETTING_STARTED.md).

## What needs configuration

| Item | What to know |
| --- | --- |
| Kurulum / Installation | Use the linked setup page; there is no executable installer. |
| Portal erişimi / Portal access | Needed only for real records, not for the sample preview. |
| Güncelleme / Update | Drag the bookmark again after a new version; old bookmarks do not update themselves. |

## Downloads and help

- [Download and build guide](docs/DOWNLOADS.md) — source files versus packaged apps.
- [Developer reference](docs/REFERENCE.md) — workflow details and relevant limits.
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Usage and licensing](USAGE.md).

### 3.2.5

Şövalye görünümü tek bir resimli çerçeve olarak yeniden kuruldu. Açık ve koyu görünüm aynı yerleşimi kullanır; Sor, ayarlar ve geçmiş çerçevenin içinde açılır. Hesaplama kuralları değişmedi.

### 3.2.1
Şövalye görünümü el yazması düzeniyle yeniden işlendi: çiçekli kenarlar, kale detayı, gömülü Gotik ve kaligrafik yazı tipleri. Göksel saatin iç kadranı ve rakamları yenilendi. Hesap kuralları değişmedi.

3.2.5 fixes artwork and font loading on portals that restrict image/font URLs. Bundled artwork renders to canvas and fonts load from bytes; no host policy changes are required. Restricted-policy browser fixture: `source/mesai/test/csp-preview.html`.

3.2.5 adds a visible theme menu, close controls for open panels, Escape dismissal, consistent Cep/minimize behavior and themed progress marks.

3.2.5 replaces symbolic theme swatches with real light/dark layout previews, adds a ruler-linked drafting cursor effect to the website, and credits Berkant with a Slack feedback invitation.


## 3.3.0 — Saydam

Saydam adds a light glass appearance with Day and Hourglass views. Try it on the install page, then replace your bookmark to update. See [release provenance and build notes](docs/SAYDAM-RELEASE.md) before changing application source.
