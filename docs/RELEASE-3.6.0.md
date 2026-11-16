# Mesai 3.6.0

Release candidate prepared 16 November 2026. Publication is a separate step.

## What changes

- Saved settings and plans merge safely across stale tabs. Single-theme bookmarks remember their own appearance while sharing hours and plans.
- Turkish Ask handles spaced times and durations, asks about ambiguous inputs and keeps hypothetical exits exact. Core-hours guidance is informational; OOO is never silently added.
- Optional warm milestone sounds, with volume and heads-up settings. Duplicate tabs coordinate one earned alert; sounds start off.
- Theme-matched opening and earned-goal effects for every theme, including both Saydam views. No confetti. The opening keeps actual hours in place. Reopening does not replay an already-earned celebration.
- Effects cancel during interaction, scroll or resize, respect reduced motion, and do not label a different selected day as today’s achievement.
- Invalid backup and storage recovery, unfinished input across tabs, same-version build replacement and failed month-load recovery are hardened.

## Updating

Replace the existing bookmark from the install page after publication. Saved plans and settings stay in the same browser and portal origin. Back up important plans in Settings first. The full bookmark includes all themes; a single-theme bookmark is smaller. A bookmark does not update itself.

## Source and delivery

All changes are in modular source; generated files are rebuilt from it. Motion styles are part of the normal minimized style bundle, and effect art is loaded only for the active theme without reducing image or font quality. See QA-3.6.0.md for exact artifact hashes, tested environments and acceptance limits.

### Update continuity

The version link opens Update mode with the installed package and appearance.
Previewing another theme does not silently replace the update with that package.
Keeping settings is automatic in the same browser and portal origin; no reset
switch is needed. Fourteen real 3.5.0-to-3.6.0 code-replacement scenarios and twenty
installer checks verify this route on a synthetic portal.

### Final panel alignment

Compact Settings stays inside the theme frame and scrolls to the new sound and
effects options. Compact Saydam questions scroll inside their glass panel.
Knight's longer English leave-day note no longer covers the day-type controls.
