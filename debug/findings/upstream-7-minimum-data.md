# Upstream #7: privacy-minimized academic projections

- Upstream: `wormforce/sustech-cli#7`
- Symptom: focused planning reads can return grades or broader personal fields than the advisor needs.
- Safety impact: unnecessary personal data can reach logs, files, or model context.
- Downstream containment: degree-progress reads omit `--details`; recommendation retains only typed course, meeting, capacity, teaching-team, and evidence fields; errors and diagnostics expose stable codes rather than raw payloads.
- Maintenance rule: do not log raw upstream JSON. When the upstream projection capability exists, prefer it and keep detailed/raw modes opt-in.
