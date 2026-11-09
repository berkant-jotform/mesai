# Saydam 3.3.1 QA — 9 November 2026

Browser QA used deterministic, isolated portal fixtures. These results do not claim acceptance on a signed-in ARGE account or Safari.

## Repaired and verified

- Short-window clipping: full Saydam now stays within the viewport and scrolls its content. Verified at 1280×720 and 900×600.
- Narrow toolbar overflow: controls wrap into visible rows instead of escaping the frame.
- Hourglass annotation clipping: forecast labels fit inside the window.
- Invalid times: a readable localized error and aria-invalid feedback preserve the existing plan. Correcting the field clears the error.
- Compact OOO confirmation: primary action now has readable blue/white contrast.
- Reverse calculator: each day/time field has an accessible label.
- Midnight forecast: an allocation ending Saturday 04:00 now says Cmt 04:00, rather than Friday.

## Functional checks

1. **Pass — core totals.** Monday 08:05:29–17:46:10 gives 9:41 including lunch gaps. At Tuesday 13:35, the live total is 5:11. Week total 14:52, target 46 hours (45 + 1 OOO), remaining 31:08, nine-hour milestone 17:24, Friday estimate 18:19.
2. **Pass — planning.** Time editing, ±15 entry shifting, OOO +30, day reset and slider arrow-key adjustment update the plan. An attempted 14:00 departure is constrained to 16:00 with a core-hours explanation. Leave contributes nine hours when reached; future leave remains planned.
3. **Pass — questions and reverse calculator.** Asking to leave Friday at 14:00 requests confirmation before adding two OOO hours; the target stays unchanged until accepted. Invalid reverse times show a localized error.
4. **Pass — window controls.** History, Appearance, Settings, Reverse and Sor close through their close controls; Escape dismissal, compact/pocket layouts, restore, TR/EN and the main close control were exercised. Day and Hourglass layouts were reviewed visually.
5. **Pass — portal edge cases.** Ten fixtures cover normal data, blank period/person, ambiguous person, unavailable period, duplicate cards, missing exit, overnight shift, no records and pagination. A sole person/current period can be selected automatically. Ambiguous/unavailable selections request user input. Duplicate cards use the active person. Missing exits are flagged and excluded; cross-day shifts require correction. Pagination warns that the list is incomplete.
6. **Pass with limits — regression.** 28 core + 43 scenario + 21 question tests pass, JavaScript syntax passes, and the install bookmark decodes exactly to the released application. These baseline module tests are supplemented by the browser checks above. Reduced-motion CSS was added but OS preference emulation was not tested.

## Remaining acceptance

- Real signed-in ARGE portal, browser-specific bookmark limits/CSP and Safari.
- Future editable maintenance needs Claude's matching Saydam source; the release currently uses its compiled export.


## Compact follow-up — 3.3.2

Both Gün and Kum saati are available in the middle window size. The previous generic compact summary is bypassed only for Saydam; other themes and the Pocket layout retain their behavior. Both views share full Saydam planning logic. Compact Hourglass omits long SVG callouts and keeps readable summary text beside the glass, while retaining clickable day bands.

Browser checks: 500px compact window, 390×640 viewport and 900×600 viewport; no toolbar horizontal overflow. Day selection, a 17:30 planned exit, OOO +30, week reset, question/answer, reverse calculator, settings/history/theme X and Escape, EN labels, compact/full view persistence, Pocket and restore were exercised. Fixed an extra theme panel and the compact Expand action during these checks. Short content areas scroll; the lower planning controls remain reachable. Popovers use readable stable surfaces and questions stack vertically in compact size.

92 baseline tests and JavaScript syntax pass. Real signed-in portal and Safari acceptance remain pending.
