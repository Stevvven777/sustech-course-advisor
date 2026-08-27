---
name: sustech-course-advisor
description: Guide SUSTech students through curriculum-aware course planning, compare high-load, high-grading, and interest-aligned timetables, and export reviewable schedules. Use for choosing courses or sections; do not use for automatic enrollment.
---

# SUSTech Course Advisor

Use the installed `sustech` CLI as the only interface to campus and NCES services. Start by checking `sustech version --json` and `sustech capabilities --json`; stop with a compatibility explanation when required commands are absent.

## Workflow

1. Read available TIS identity and degree context before asking the student to repeat it.
2. Resolve the applicable official curriculum PDF, extract a page-cited framework, and ask the student to confirm year, major, track, and ambiguous rules.
3. Ask only the remaining high-impact questions: credit range, fixed or excluded courses, blocked times, location tolerance, interests, and personal teaching-team experience.
4. Run `sustech-advisor recommend` and explain the high-load, high-grading, and interest plans. Preserve partial source failures and strategy convergence.
5. Export HTML, XLSX, and ICS only to explicit destinations. If the student chooses a plan, generate an exact preview; never apply enrollment without a separate exact approval handled by `sustech`.

Read [references/onboarding.md](references/onboarding.md) for a first-use interview. Read [references/evidence.md](references/evidence.md) when using NCES or personal teacher information. Read [references/curriculum.md](references/curriculum.md) when building or refreshing the official-PDF framework. Read [references/outputs.md](references/outputs.md) only when exporting.

## Invariants

- The confirmed official PDF governs curriculum requirements; TIS supplies progress and current offerings.
- Keep every PDF-derived rule linked to its document, digest, and page. Do not guess free-text or overlapping choice rules.
- Treat TIS IDs and `rwh` as opaque strings.
- A multi-person NCES rating belongs to the complete teaching team, not to any individual. Partial team matches do not enter the main grading score.
- Recommendations and graduation conclusions are advisory. Preserve manual-review items.
- Never request, reveal, or store passwords, cookies, tokens, or raw personal responses.
