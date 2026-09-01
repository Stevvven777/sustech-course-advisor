# Reusable timetable data contract

Keep presentation code stable and make ordinary timetable changes through structured data. The renderer may evolve independently, but adding a plan or course must not require regenerating the page shell or visual design.

## Canonical entities

- `courses`: course-level identity and personalized curriculum status. Store normalized `code`, `name`, `credits`, and `curriculum` (`confirmed-required`, `confirmed-choice`, or `unresolved-or-outside`) with source/module details when confirmed.
- `sections`: exact section identity. Store opaque `rwh`/section identifiers, `courseCode`, the complete order-insensitive `teachingTeam`, meetings, capacity state, and exact-team evidence. Do not split team roles unless the source explicitly supplies them.
- `plans`: named strategy records that reference exact sections and carry inclusion basis (`curriculum` or `explicit-user-choice`). Do not duplicate course or team metadata into each rendered cell.
- `meetings`: day, period range, exact week set or parity, room when available, and an optional component label such as lecture or lab. A lecture plus required lab is one course selection with all required components, not independent credit-bearing courses.

Derived values such as total credits, confirmed curriculum credits, unresolved credits, conflicts, weekday footprint, early periods, colors, scorecards, and ranking summaries must be computed from these entities rather than manually copied.

## Supported small updates

Ordinary AI work should be limited to operations such as:

- add, rename, or remove a plan;
- add or remove an exact section from a plan;
- update a section's complete teaching team, meetings, capacity, or evidence;
- change an inclusion basis after an explicit student decision;
- refresh curriculum status from a confirmed official source.

Validate after every update: referenced sections exist, all required components are present, credits are counted once per course, exact weeks do not conflict, course-code colors are stable, and unresolved courses remain visibly separated from confirmed curriculum coverage.

## Rendering contract

Each occupied compact cell renders, in this order:

1. normalized course code;
2. course name;
3. every teaching-team name;
4. parity/component marker when needed.

Key color selection by normalized course code, not section, meeting, plan, or array index. The plan switcher, grid, compact scorecard, and ranking principles read from the same canonical data. If a cell becomes crowded, preserve the information and adapt layout; do not silently shorten the team to one person.

The renderer must accept a valid advisor result without source-code edits. Prefer a small versioned JSON payload or equivalent generated data module. Keep credentials, raw personal payloads, and campus tokens out of timetable data.
