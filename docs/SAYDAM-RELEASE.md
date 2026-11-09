# Saydam 3.3.0 release

The Saydam implementation was supplied in Claude's updated self-contained index.html export on 9 November 2026. Its bookmark was decoded from that export; the new-user default and theme order were then changed to put Saydam first. mesai.js and source/mesai/exports/saydam-3.3.0.js are identical copies of that artifact. The build uses this export so rebuilding does not silently replace Saydam with older editable modules.

The existing src modules predate this Saydam export; they are retained for reference, not claimed as its complete editable source. Before editing application behavior or returning to a module build, obtain the matching Saydam source from Claude. The current published app remains reproducible from the checked-in export.

Website theme selection and preview messaging now include Saydam, the install bookmark and preview use the same application bytes, and version.json identifies 3.3.0. Saydam is light-only, with Day and Hourglass views.

Real ARGE portal acceptance remains to be checked by a signed-in user. No Bozkır artwork from the separate design handoff was included in this release.

Saydam is the default for new users and first in the theme picker. Existing saved user themes are retained.
