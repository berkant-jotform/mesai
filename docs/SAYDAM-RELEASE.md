# Saydam release provenance

Claude supplied Saydam in a self-contained index.html export on 9 November 2026. Its decoded application is retained in source/mesai/exports/saydam-3.3.0.js. Saydam was made the new-user default and first theme; existing saved selections remain unchanged.

Version 3.3.1 applies targeted QA repairs to that compiled artifact. The current mesai.js and source/mesai/exports/saydam-3.3.2.js are identical. Version 3.3.2 adds native compact Day and Hourglass layouts using the same renderer and controls as the full Saydam window. The build copies this export and regenerates the install bookmark, ensuring installation and preview run the same bytes. Saydam is light-only and includes Day and Hourglass views.

The older src modules do not contain the complete Saydam implementation. Their tests check baseline calculator and question logic; they do not substitute for browser testing of the exported UI. Obtain matching editable source from Claude before resuming a modular source build. The published artifact remains reproducible.

No Bozkır artwork was included. Signed-in ARGE acceptance and Safari remain unverified.
