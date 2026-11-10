# Mesai 3.4.1 verification

Built from the modular source in this repository, starting with Claude's revised 3.4.0 package. The retired compiled Saydam export is not used.

## Passed on 10 November 2026

- 157 source tests: 38 core, 67 scenarios, 29 Ask, 23 independent regressions.
- 224 distribution assertions: versions, exact encoded bookmark size, syntax, selected assets/fonts, self-contained delivery and published/full-build parity for all eight bundles.
- Browser checks in Chromium using synthetic portal records: all eight bookmarks launch; changing the bundle at the same version leaves one window; the full bundle retains the theme picker.
- Saydam compact Day and Hourglass, Sor daily versus weekly answer, invalid time feedback, Claude's daily-duration answer, appearance menu and close controls.
- Mounted/standing Bozkır, Knight and Clock artwork rendered from embedded assets; checked Clock light/dark and Knight dark. Bozkır settings/close controls work. Artwork was preserved rather than redrawn.
- Restrictive image/font-policy fixture: Bozkır artwork plus six embedded fonts passed with zero image/font policy violations.
- Installer: selected bundle and URL size match; preview does not change installation selection; update link retains the variant; Turkish/English labels and expandable explanations work.
- Controlled installer checks cover delayed responses, failed fetch/retry, invalid version and stale-link removal.

The browser inspection included an unrelated MutationObserver warning also reproduced on a script-free page with an empty iframe. It was not reproduced on the standalone Mesai test page.

## Not established by these checks

Signed-in ARGE, Safari, native bookmark saving/sync limits, and real-world startup timing have not been verified for this release. The 1.5-million-character build budget is a project safety threshold, not a universal browser limit. The smaller bundles reduce encoded payload; no timing benchmark is claimed.

The supplied 32-case browser suite and automatic layout-audit scripts are included for reproducibility but were not rerun as those suites in this QA pass. Browser checks above were performed directly on the rebuilt application.

## Reproduce

```sh
npm ci
npm run build
npm test
npm run test:distribution
```

The authoritative version is `version.json`. `bookmarks/manifest.json` records each output's size, assets and fonts. Installer code is generated from the same outputs, with Saydam as default. The full bundle is `mesai.js`.
