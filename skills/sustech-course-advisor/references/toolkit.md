# Reusable planning toolkit

Use the smallest command that answers the current decision. Keep upstream payloads out of chat and persisted artifacts; retain only the whitelisted fields needed by the next stage.

## Readiness and authoritative inputs

- `sustech-advisor doctor --profile NAME --live`: checks the local advisor, campus CLI capabilities, credential backend, and a live read-only TIS request. A partial report is not readiness.
- `sustech-advisor diagnose --profile NAME [--live] [--support-bundle FILE]`: writes a rotating local projected diagnostic and optionally a sanitized local bundle. It never uploads the bundle; external submission requires a separate exact approval.
- `sustech tis degree progress --json` and `sustech tis degree missing --json`: personalize remaining requirements. On timeout, stop retrying after the bounded fallback in `environment.md`; use the confirmed official PDF and visibly mark personalization gaps.
- `sustech tis courses search CODE --semester TERM --json`: exact current offering lookup. Query by normalized course code rather than requesting the full catalog when the upstream full-catalog path is unreliable.
- `sustech nces search CODE --json`: find grading evidence, followed by the exact evidence page. Only a complete teaching-team match enters the main score.

## Planning and validation

- `sustech-advisor recommend --path PROFILE.json --semester TERM --destination PLAN.json`: builds only from verified curriculum rules plus explicit user choices. Credit targets are soft.
- `sustech-advisor audit --input PLAN.json`: deterministic pre-export check. It recomputes unique-course credits and reports conflicts, duplicate course rows, missing teams or meetings, early periods, weekday footprint, and Friday footprint. A non-zero exit means the plan must not be presented as valid.
- For lecture/lab courses, normalize all required components into one `CourseSection` only when upstream explicitly identifies the bundle and component roles. Credits appear once; meetings and the complete teaching team include every required component. If the contract is missing or ambiguous, exclude the entity and stop before preview rather than guessing from identifiers or names.

## Presentation and safe action boundary

- `sustech-advisor export --input PLAN.json ...`: feeds the fixed data-driven timetable renderer. Ordinary updates change result data, not page layout code.
- `sustech-advisor preview --input PLAN.json --strategy ... --operation cart|enroll`: creates an exact no-write preview only. It does not authorize or apply enrollment.
- Campus writes remain a separate workflow with exact target confirmation and post-write reconciliation. Simulation, recommendation, export, and preview never imply write permission.
- Never retry an enrollment mutation whose submission outcome is uncertain. The advisor is preview-only; reconciliation and any eventual apply remain an upstream workflow.

## Compact AI workflow

1. Read the profile and confirmed curriculum cache.
2. Query only required and viable candidate course codes; project each response to code, name, exact section/`rwh`, credits, full team, meetings, capacity, and source timestamp.
3. Normalize component bundles, then recommend.
4. Run `audit`; fix all structural errors.
5. Update the small timetable data payload and render with the stable site shell.

This sequence minimizes repeated catalog downloads, duplicated website generation, and large raw payloads in model context.
