# Milestone audio (local, opt-in)

Approved by Berkant: draft 2 (Sunrise), 3 (Peach pop), 5 (Homeward).

- `near.mp3`: Sunrise; heads-up, 10 minutes before a daily or weekly goal by default.
- `day.mp3`: Peach pop; daily goal completed.
- `week.mp3`: Homeward; weekly goal completed. Takes priority if both finish together.

Compact mono deployment copies of the approved original, non-piano recordings;
22.05 kHz, 24 kbps MP3. Embedded in every bookmark, with no remote audio request.
Original audition WAVs are preserved in the local QA folder, not required to build.

Settings: sound off by default, volume 35%, heads-up 5/10/15 minutes, three previews.
A trusted click/key interaction enables audio for the current tab. Listen also
works with automatic sounds switched off. No button-click sounds are added.

Alerts use actual current-week progress, configured targets and OOO. Opening,
reopening, changing goals or previewing a plan does not replay past achievements.
Gaps longer than ten minutes rebase instead of replaying old alerts. Daily half-day
credits reduce the actual-work threshold; future leave does not count as earned.

A separate local receipt ledger plus Web Locks prevents duplicate playback in
same-origin tabs. If locks or writable storage are unavailable, automatic audio
fails quietly rather than risking repeat alerts; Listen remains available.
The existing notification bell and its permission are independent.

Animations are still previews only. No gamification was added.
