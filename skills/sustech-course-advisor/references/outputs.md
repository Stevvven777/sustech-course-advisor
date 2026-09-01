# Schedule outputs

All formats must come from the same versioned advisor result. Treat the timetable website as a fixed renderer over structured plan data, not as a new bespoke website to regenerate for each student or recommendation turn. Read [timetable-data.md](timetable-data.md) for the reusable data contract and supported update operations.

## Timetable website

Keep the primary view focused on the schedule:

- a compact strategy/plan switcher;
- the weekday-by-period timetable grid;
- a compact scorecard that separates scheduled credits, confirmed curriculum credits, and unresolved/user-chosen credits;
- the ranking principles used for the plans.

Avoid decorative hero sections, duplicated detail sidebars, and explanatory footers unless the student asks for them. Full schedule detail does not require a separate panel: every occupied cell in the compact grid must show the course code, course name, and all names in the teaching team. Show week parity or component labels when needed to interpret the meeting. Increase cell height, wrap text, or adapt type rather than dropping team names.

Use a stable color keyed by normalized course code. The same course must keep the same color across separate meetings, lecture/lab components, week parity, and different strategies. Do not assign colors by render order or section-array position.

Preserve the scorecard and ranking principles as derived views of the same data; do not hard-code their values into the page. A target-credit shortfall is a valid result. Never present unresolved/outside credits as confirmed curriculum coverage.

## Other exports

- XLSX contains a comparison sheet, one timetable sheet per strategy, details, requirement coverage, evidence, and source notes. Its cells use the same code-keyed colors and show the complete teaching team.
- ICS is one calendar per strategy. Require a verified week-one Monday; never invent semester dates.

Use explicit output paths and do not overwrite existing files without approval. Verify that course codes, opaque section identifiers, teaching teams, weeks, periods, rooms, curriculum status, and strategies agree across all formats.
