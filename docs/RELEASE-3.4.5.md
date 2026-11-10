# Mesai 3.4.5

- Bozkır: a bounded parchment workspace protects the scenery and keeps all controls within the frame. Summary moves above the timeline. The timeline uses the full available width. Header groups reflow and keep Close reachable. The editor/footer follow the week in the same scrolling area.
- Atlı/Ayakta remains a small icon switch; artwork no longer intersects its header. Plans survive switching.
- Saydam: toolbar, scrolling content and editor are separate regions. The editor cannot cover the slider.
- Ask, Reverse, Appearance, History and Settings use the visible pane for positioning; the outer glass window no longer scrolls when inputs receive focus. Settings has a full-width title/close row.
- Hourglass uses native 12px day labels; compact uses its existing day navigation instead of adding duplicate detail.

Validation: 157 source tests and 228 distribution checks. Browser checks at desktop, 1000×650, 820×600 and compact included header/panel bounds, content/editor separation, both Bozkır views, preserved exit edits, menus, Escape and focus recovery. Signed-in ARGE, Safari and operating-system notification delivery remain outside this verification.
