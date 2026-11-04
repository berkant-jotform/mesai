# Getting started with Mesai

3.0.1 · Tarayıcı yer işareti aracı. Önizleme örnek veri kullanır; gerçek portal hesabı gerektirmez.

## 1. Get the files

In GitHub, choose **Code → Download ZIP** and extract the archive. Open Terminal in that extracted folder. If you prefer Git:

```sh
git clone https://github.com/berkant-jotform/mesai.git
cd mesai
```

Private repositories require an approved GitHub login. Downloaded archives normally have `-main` at the end of the folder name; use that actual folder name if navigating with `cd`.

## 2. Check the requirements

Kullanım için bir masaüstü tarayıcı ve yer işaretleri çubuğu yeterli. / Use a desktop browser with its bookmarks bar visible.

## 4. Get a first result

Open **https://berkant-jotform.github.io/mesai/**.

Kurulum sayfasını aç, **Mesai** düğmesini yer işaretleri çubuğuna sürükle. ARGE Portal’da PDKS (personel giriş-çıkış) kartını açıp yer işaretine tıkla. Önce kurulum sayfasındaki örnek önizlemeyi deneyebilirsin.

English: On the setup page, drag the Mesai button to the bookmarks bar. Open the personnel entry/exit card in ARGE Portal and click the bookmark. The setup preview uses fictional records, so you can explore it without portal access. PDKS refers to the personnel attendance/entry-exit card.

## If something does not work

| Symptom | Next step |
| --- | --- |
| A command is not found | Install the required runtime, reopen Terminal, then check its version. |
| The page does not open | Read the server output and open the exact local URL above. Keep that window open. |
| The port is already in use | Close the known app using that port, or use its existing window. Do not terminate an unknown process. |
| The bookmark does not open the panel | Confirm that the PDKS card is open in the intended portal tab, then try the bookmark again. |
| A download is missing | Read the download guide. Source archives and prebuilt installers are different. |

Before reporting a problem, record the step, expected result, actual message and OS/runtime versions. Remove credentials and private data from any screenshot or log. Use the repository issue form for non-sensitive bugs.

## Developer checks

See [Developer reference](REFERENCE.md) for the commands relevant to this project. Passing a local check does not prove live-provider, clean-machine installation or deployment acceptance.
