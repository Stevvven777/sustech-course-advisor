# Reusable timetable viewer

This site is a fixed renderer for structured course-plan data. It contains no student snapshot, campus credential, raw TIS payload, NCES personal profile, or Sites project identifier.

Ordinary timetable updates belong in `lib/sample-data.ts` or in a generated module with the same `TimetableData` shape:

1. add or update a course definition;
2. add an exact section with its complete teaching team and meetings;
3. add a plan that references section IDs;
4. run `npm run typecheck` and `npm run build`.

The page shell derives credits, curriculum-confirmed and unresolved subtotals, conflicts, days used, early periods, colors, scorecards, and ranking text from that canonical data. Do not hard-code those values into the React layout.

The grid uses [Hzy0913/Timetable](https://github.com/Hzy0913/Timetable). Course colors are stable by normalized course code and receive deterministic collision separation within the active data set.

The viewer supports at most 16 active course codes so its deterministic palette can guarantee at least 22 degrees of hue separation. Validation rejects empty plan sets, invalid weekday/period coordinates, incomplete teaching teams, and missing references before the React view initializes.

The Cloudflare/Miniflare development lockfile contains optional Sharp/libvips platform binaries. They are not application runtime dependencies and must not appear in `dist`; `npm run license:check` enforces this reviewed boundary. See `THIRD_PARTY_NOTICES.md` before changing or distributing the web toolchain.
