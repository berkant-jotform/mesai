# Mesai theme assets

The illustrated manuscript, celestial-clock and Bozkır artwork was generated for this project from the user's approved visual directions. It is interpreted artwork, not a reproduction or certification of a historical object. Mesai is an independent work-hours tool. The app draws its own live labels, time values and controls above the paintings; preview thumbnails use synthetic example data.

## Current delivery

- Original project delivery files are kept under `assets/` as WebP images and WOFF2 fonts. Preferred smaller copies under `assets/web/` are the inputs embedded by `source/mesai/build.js`.
- Large Knight, clock and Bozkır paintings use AVIF where the optimized `.avif` file exists. Other ornaments and thumbnails remain WebP. Do not infer the source type from an internal data-string label: the runtime decodes bundled base64url bytes, detects the AVIF container and supplies the appropriate Blob MIME type to `createImageBitmap`.
- Fonts load through bundled bytes and `FontFace`. Artwork and fonts do not require external requests from the host portal. The optional release-version check is separate from resource loading.
- The full distribution includes the complete picker/art/font set. Single-theme bookmarks embed only that theme's required artwork and fonts, omitting the other themes' pictures and picker thumbnails. Saydam, Çizelge and Sütunlar do not need illustration/font payloads.
- Bozkır · atlı and Bozkır · ayakta are light-only. Each has wide and compact paintings; their mounted/standing figure, wolf, eagle, horses, river and yurts are painted into the composition. Preserve natural image ratios and the clear interface area when placing the controls.

`tools/optimize-assets.py` produces optimized copies, subsets fonts and can resize selected images to the intended delivery dimensions. It needs Pillow with AVIF support, fontTools and Brotli. The encoder versions/options affect its output. A normal release build embeds the checked-in optimized binaries; it does not rerun this image-generation step. Changing them requires a visual comparison at actual tool size, including faces, small ornaments, transparent edges and text-adjacent contrast.

The build checks a **1,500,000-character project safety budget** on the actual encoded bookmark URL. Chromium's cited 2,097,152 cross-process URL serialization bound is not a universal guarantee for bookmark storage, sync or execution in every browser. Browser installation and portal checks remain necessary.

## Fonts and licenses

Preserve the accompanying SIL Open Font License notices when redistributing the fonts or their subsets:

| Bundled family/file | Original family | Included notice |
| --- | --- | --- |
| Mesai Manuscript / `almendra.woff2`; Mesai Calligraphy / `almendra-bold.woff2` | Almendra, Ana Sanfelippo | `Almendra-OFL.txt` |
| Mesai Gothic / `gothic.woff2` | Grenze Gotisch, Renata Polastri / Omnibus-Type | `GrenzeGotisch-OFL.txt` |
| Mesai Blackletter / `blackletter.woff2` | UnifrakturMaguntia, J. Mach Wust / contributors | `UnifrakturMaguntia-OFL.txt` |
| Mesai Steppe / `steppe.woff2` | Kurale | `Kurale-OFL.txt` |
| Mesai Orkhon / `orkhon.woff2` | Noto Sans Old Turkic | `NotoSansOldTurkic-OFL.txt` |

Additional retained font/reference files and their notices may remain for project history. The Old Turkic letter signature is a design/transliteration choice; font glyph support alone does not prove a historically attested spelling or translation.

## Art direction and retained history

Knight uses the approved bareheaded figure, natural gaze, silver relief armor, cape and long sword within an illuminated border. The clock uses the approved astronomical day/night dial and shaped backing. Bozkır combines the approved steppe figures and animals with manuscript motifs, kilim bands and quiet parchment controls. Actual attended time, plans, leave credit and OOO must remain visually distinct and numerically correct.

Historical border references include the [Getty Book of Hours](https://www.getty.edu/art/collection/object/105SWS), [Leeds floral border, 1470–1480](https://digital.library.leeds.ac.uk/10862/) and [Fitzwilliam Book of Hours](https://www.fitzmuseum.cam.ac.uk/illuminated/manuscript/discover/book-of-hours/folio/folio-15r-411). These inform the generated work; they are not bundled source paintings.

Legacy screenshots, preview images and earlier artwork may remain in the public tree for existing links and traceability. Their presence does not mean the current build embeds or presents them as selectable themes. Do not delete unrelated remote assets merely because they are absent from a new release ZIP; check references first.
