# Mesai theme assets

Illustrations were created with the built-in ImageGen tool for this project, following the approved knight/manuscript and celestial clock mockups. The approved bareheaded knight is retained. Production WebP files and embedded WOFF2 fonts are used by the bundle; native generation files are kept outside this public package.

Fonts: Cormorant Garamond (Christian Thalmann) and UnifrakturMaguntia (J. Mach Wust / contributors), distributed under the SIL Open Font License. See the accompanying OFL files.

The clock is inspired by historical astronomical clocks and the supplied game-interface reference. Mesai is an independent work-hours tool.

## Art direction used for production assets

Built-in ImageGen, followed by transparent-padding trimming and WebP delivery compression. No CSS illustration substitutes.

- Knight manuscript: preserve the approved bareheaded knight, natural slightly raised gaze, chainmail at neck, silver relief armour, blue/crimson cape and long sword. Place inside a continuous painted ultramarine Gothic manuscript niche, restrained gold stars/foliage, ivory flowers and grass. Transparent exterior, opaque painted interior; right vines connect to the writing surface.
- Initial: isolated readable illuminated M; royal ultramarine, vermilion, fine gold leaf, white flowers and small green-leaf tendrils. Transparent exterior.
- Clock: KCD-style day/night astronomical dial; gold/ivory/day-blue/night-blue sectors, sun crest and moon face. No baked-in digits or UI text. Shaped concave backing and separate pill rails with painted gold rims and small floral corners, matching navy and ivory versions.
- Other ornament: slender painted flowering vines, small medieval town silhouette and sun/moon toggle, matching the same palette and brush treatment.

The application overlays live digits, labels and controls. The compact layouts use the same production art.

## 3.2.1 manuscript refinement
New ImageGen transparent raster assets: knight-tall.webp (natural figure with taller canopy), manuscript-rule.webp, manuscript-town.webp, fleuron.webp, time-marker.webp and clock-face.webp. Embedded in the bookmark with no art fetches.
Grenze Gotisch (gothic.woff2) by Renata Polastri/Omnibus-Type and Almendra (almendra.woff2) by Ana Sanfelippo, downloaded from the official google/fonts repository, OFL licenses included. Gothic supplies Turkish labels; Almendra supplies calligraphic numerals and supporting copy.


## 3.2.2 illuminated page

The knight composition uses paired dark/light full-page plates with live HTML controls. Historical ornament references: [Getty Book of Hours](https://www.getty.edu/art/collection/object/105SWS), [Leeds floral border, 1470–1480](https://digital.library.leeds.ac.uk/10862/), and [Fitzwilliam Book of Hours](https://www.fitzmuseum.cam.ac.uk/illuminated/manuscript/discover/book-of-hours/folio/folio-15r-411). Generated artwork interprets manuscript borders rather than reproducing a historical object. Almendra Bold is bundled under the existing Almendra SIL Open Font License.

The 3.2.2 finishing assets add a restrained painted-blue progress strip and transparent notched input borders for both palettes. Actual hours remain a continuous first-entry-to-last-exit span; planned hours, leave and OOO retain distinct outlines and hatching.

The 3.2.5 theme chooser uses 12 real Mesai layout captures (six layouts, both palettes), downsampled to bundled WebP thumbnails. These previews contain synthetic example data and no personal portal records.
