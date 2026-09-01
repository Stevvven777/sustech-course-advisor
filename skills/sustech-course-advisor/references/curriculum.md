# Official curriculum framework

Inspect `doctor.sustech.optionalFeatures` before acquiring the framework. When `automatic-curriculum-acquisition` is available, use `sustech curriculum sources` to locate the cohort and major PDF, then `curriculum fetch` with an explicit destination. When it is unavailable, locate the exact public PDF on an official university or department domain, or use an official PDF supplied by the student; preserve the authoritative URL when public, calculate its SHA-256, and ask the student to confirm title, cohort, major/track, and revision before extraction. A student-provided newer official PDF takes precedence. Never use `sustech.online`, NCES, a general catalog page, or course-name inference as the curriculum authority.

For every structured course rule record the course code, requirement/module, required versus choice status, recommended semester when explicit, source page, and confidence. Record the document title, URL when public, and SHA-256.

## Candidate membership gate

Classify each candidate relative to the student's confirmed curriculum before scheduling:

- `confirmed-required`: the applicable official framework explicitly requires the course.
- `confirmed-choice`: the framework explicitly places the course in an eligible choice pool or module for this student.
- `unresolved-or-outside`: the course is absent from the extracted framework, its module is ambiguous, or only the general catalog confirms that it exists.

Only the first two statuses enter automatic credit-load optimization. A catalog listing, offering record, prerequisite relationship, department ownership, or convenient fit in the timetable does not prove curriculum membership. Never add an `unresolved-or-outside` course merely to reach a target or maximum credit value.

If confirmed candidates cannot reach the target, first search the remaining confirmed choice pools. If the shortfall remains, present the confirmed subtotal and a bounded choice: keep the confirmed plan below target, inspect specific unresolved candidates, or revise other constraints. A student's explicit choice may include a named unresolved course in a proposal, but keep its status visible and exclude it from confirmed requirement coverage until an official source resolves the module.

Do not reproduce whole PDFs in the repository. Do not turn prose such as placement conditions, overlapping category minima, substitutions, or track-specific exceptions into exact rules unless the document is unambiguous. Put unresolved text into `manualReview` with a page reference.

Use TIS grades and enrollment only to mark progress against this framework. If TIS disagrees, keep both observations and recommend confirmation with the department or Teaching Affairs.

`sustech.online` may supply trusted community explanations or help the student understand SUSTech-specific terminology, but it does not establish the applicable curriculum document or resolve an ambiguous requirement. Cite it separately from the official PDF and keep its date visible when available.
