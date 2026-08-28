# SUSTech Course Advisor

An unofficial, local-first course-planning companion for SUSTech students. It uses the installed [`sustech`](https://github.com/wormforce/sustech-cli) CLI for campus reads and safe enrollment previews, while keeping curriculum interpretation, preferences, scoring, and timetable exports in a separate project.

The advisor treats the confirmed official cultivation-plan PDF as the curriculum authority and TIS as the source for completed work and current course supply. It produces three explainable plans: high load, high NCES grading evidence, and interest alignment.

## Status

This repository is an early preview. Recommendations are advisory and never authorize enrollment. NCES evidence is community-supplied; ratings for multi-person teaching teams are never attributed to one instructor or teaching assistant.

## Quick start

```bash
npm install
npm run build
node dist/cli.js doctor
# Before personalized TIS reads, verify the selected profile live once:
node dist/cli.js doctor --profile default --live
node dist/cli.js init --path ./student.advisor.json
node dist/cli.js recommend --path ./student.advisor.json --semester 2026-2027-1 --week-one-monday 2026-09-07 --destination ./plan.json
node dist/cli.js export --input ./plan.json --html ./advisor.html --xlsx ./advisor.xlsx --ics-dir ./calendars
```

During development, set `SUSTECH_BIN` to a compiled `sustech` executable when it is not installed on `PATH`.

`doctor` verifies the advisor checkout/build, Node.js version, required `sustech` capabilities and consequence records, credential backend, and profile credential availability. `--live` additionally performs one authenticated TIS check. It reports structured remediation and exits unsuccessfully when personalized planning is not ready.

Before recommendation, populate `curriculum.courses` from the applicable official PDF with a source page and confirm the framework. The bundled Agent Skill guides this workflow.

## Privacy and safety

- Profiles and outputs stay local and are ignored by Git by default.
- Passwords, cookies, tokens, student IDs, and raw TIS responses are not stored.
- The advisor can request exact `sustech tis selection preview` results, but never calls an apply command.
- Official curriculum discrepancies and ambiguous rules remain visible for manual review.

## License

PolyForm Noncommercial License 1.0.0. Commercial use requires separate permission from the licensor.
