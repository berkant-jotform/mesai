# Mesai 3.6.0 — release QA

Prepared locally on 16 November 2026. Nothing in this preparation publishes to GitHub.

## Release gates

This report accompanies a frozen release package. The package manifest identifies every file and the exact bookmark hashes. The full bookmark and all seven theme variants are rebuilt from modular source, including `motion.js` and `motion.css`.

| Area | Coverage |
| --- | --- |
| Calculations and recovery | 1,010 module/matrix cases: week calculations, Turkish parsing, persistence, undo, milestone logic and malformed-data recovery. |
| Browser workflows | Full 61-scenario Chrome suite; Firefox and WebKit critical-flow checks. |
| Motion | 29 scenarios per engine: all themes, earned day/week, actual hours unchanged, default and disabled motion, scroll/input cancellation, smaller layouts and reduced motion. |
| Layout | 131 theme/size/appearance/panel combinations; follow-up settings audit after control-size fixes. |
| Distribution | 268 assertions on all delivered bookmarks, assets, versions and exact source-to-output agreement. |
| Installation | Main bookmark, every single-theme package, selection races and recoverable download errors. |
| Restrictive portal policy | Knight, Bozkır and Clock render artwork/fonts with remote image/font loading restricted and eval disallowed. |
| Website | Release identity, visible install guidance, effect/sound help, narrow layout and language controls. |
| Rebuild | Ten generated outputs compared byte-for-byte after a second build. |

## Findings fixed during preparation

- Pocket-mode earned messages overflowed vertically in Bozkır and Clock. The completed amount and status retain their readable size; only the secondary timestamp is omitted in pocket mode. Full and compact layouts keep it.
- Effect/sound checkboxes and the volume slider had small native hit areas. Their settings-row targets are enlarged; the settings audit is repeated afterward.
- A delayed first save could restore new notification defaults after another tab changed effects or sounds. A regression check reproduces the failure and now passes. Enabling by default uses an absent preference instead of writing a conflicting default value.
- Filled light sweeps could inherit the icon stroke colour, producing unwanted straight outlines. Filled decorative geometry now explicitly has no outline; the motion checks verify that behavior.
- Effects cancel on content scroll. Earned effects do not label another selected day as today's achievement. Opening waits briefly for fonts, with a bounded delay.

## Optimization boundaries

- Motion styles are minimized with the regular style bundle instead of injecting a second stylesheet.
- Arrow/sword artwork is requested only when the active theme needs it and reuses the existing image cache.
- Milestone edit signatures inspect the current week rather than serializing the full archive every second.
- No artwork/font quality reduction, remote loader, compressed/eval bootstrap or change to calculation rules was introduced.
- The full encoded bookmark remains about 1.54 million characters; the local project guard is 1.55 million. That is a project budget, **not** a guarantee about every browser's bookmark manager or sync service. Single-theme bookmarks are smaller.

## Reproducing checks

```sh
npm ci
npx playwright install chromium firefox webkit
npm run qa
MESAI_ENGINE=firefox npm run test:motion
MESAI_ENGINE=webkit npm run test:motion
```

`MESAI_CHROME` can select a Chrome executable, and `MESAI_PLAYWRIGHT` can select an existing Playwright package. Browser profiles in these checks are disposable and synthetic. No personal browser was controlled.

WebKit's general workflow harness uses keyboard activation for buttons and focus for inputs because its locator pointer driver on this Mac has a known coordinate problem. SVG bands are checked with direct coordinates. This does not establish branded Safari pointer compatibility.

## Acceptance still requiring the user's environment

- The real signed-in ARGE Portal, particularly the colleague who reported same-day resets.
- Manually saving/reopening the new bookmark through Chrome, Firefox and Safari bookmark managers and any company-managed sync policy.
- Branded Safari on the actual supported Mac.

Before broad rollout, test the candidate on real records: compare today/week with the portal, change a plan and theme, reopen in two tabs and after a browser restart, open both Saydam views and Bozkır variants, and check menu dismissal and undo. Refresh old portal tabs when updating: code from the old public bookmark can still perform old whole-state saves.

The automated gates establish a local release candidate. They do not claim live-portal acceptance or a successful public deployment.

## Update-continuity addendum

The update route was refined after the base release checks. On a synthetic portal,
14 browser scenarios execute the actual public 3.5.0 bookmark followed by 3.6.0:
all seven appearances in the full package and all seven single-theme packages.
Each retains theme, language, appearance, window/view preferences, custom daily and
weekly targets, team hours, plans, OOO and leave entries, then verifies reopening.
The version link carries only presentation context, never the person's ID, hours
or plans. The shared storage key remains `mesai.v3`.

The expanded installer suite has 20 passing checks. Update mode chooses the same
package and appearance context; trying a different preview does not change the
update download. A failed package download disables that update until Retry
succeeds; an older cached install page cannot offer a primary-button downgrade.
The normal first-install button remains the full package. No reset toggle or
portal-to-website transfer of settings was added.

Run `npm run test:upgrade` from a Git checkout containing commit `4604597`, or
provide `MESAI_PREVIOUS_ROOT` pointing to an unpacked 3.5.0 release. The original
broad QA reports retain their earlier artifact hashes. Upgrade, installer and
source/distribution checks identify the new update-flow candidate separately.

## Final theme alignment pass (16 November)

Fresh screenshots cover Turkish and English across all seven theme variants,
full/compact/pocket sizes, supported colour modes and open panels. This pass
found and corrected three layout issues: non-glass compact Settings was appended
below the summary instead of opening inside the frame; compact Saydam Ask could
spill suggestions behind the dock; the English Knight leave-day note covered a
day-type control. Compact Settings now uses the existing Appearance-panel inset,
two-column fields and scrolling, with each theme's own colours and fonts.
The full-mode layout is unchanged except that the Knight note gets its own line.

A maintained `npm run test:panels` check scrolls to all five new effects/sound
controls, checks their actual click targets and closes Settings in every theme,
both languages and full/compact sizes (168 assertions). The audit's settings
selector now targets the visible Saydam toolbar rather than its hidden compact
sidebar; scroll-border measurement was also corrected. Clock's partially visible
question was reachable by scrolling and did not require an application change.

Fresh screenshots and matrix results are in the workspace QA report at
`qa-reports/2026-11-16/alignment-final/`. These checks use isolated Chrome and a
simulated portal. They do not establish real signed-in ARGE or branded Safari
acceptance, and this remains a local candidate without publication.

Final alignment candidate runtime SHA-256:
`a4738030db835f3904fa41b1950245ff89c7d01d0acda8c209bda72e54726409`.
272 screenshot states, 168 Settings reachability assertions, 48 website contexts,
61 Chrome workflows, 29 motion checks, 1,010 module/matrix cases, 268 distribution
assertions and 20 installer cases passed or were cleared by the documented
Clock scroll-border recheck. Ten generated outputs rebuilt byte for byte.
Earlier cross-engine evidence above retains its earlier artifact hash.
