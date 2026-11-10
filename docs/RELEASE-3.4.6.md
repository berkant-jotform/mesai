# Mesai 3.4.6

The focus is Turkish/light Saydam and both Bozkır layouts.

- Validation errors appear inside the panel or editor being used, with visible invalid-field outlines. Correcting a field removes its error state; a shared panel alert stays while another field still refers to it.
- Settings rejects numbers outside its declared bounds instead of displaying a value the calculator silently replaces with a default.
- Bozkır sizes against available height as well as width, preserving its artwork ratio. Short windows use compact mode; narrower compact headers/forms reflow without losing controls.
- Compact Bozkır exposes Settings through the existing Appearance menu. Panel headings stay visible when scrolling.
- Resize keys follow the visible size; full-view controls explain when a larger browser window is needed.
- Short Saydam compact windows use less secondary header space, and long notes cannot push the editing area outside the pane.
- Website fixes: English respects component display rules, the smallest header fits, and active drag-help messages follow language changes.

QA includes native invalid-input/recovery checks, numeric-bound rejection, 450px-high windows, compact/full/pocket transitions, artwork-ratio/header bounds, warnings, and simulated missing selections/duplicate PDKS cards. Fixtures use isolated in-memory storage and are excluded from the public package. Real signed-in ARGE, Safari, and OS notification delivery remain unverified.
