# First-use interview

Use short batches, explain the next step before taking it, and show what came from each source.

## Start and route

Begin with a compact process preview covering readiness, authentication, permission for academic reads, student confirmation, planning, and the separate enrollment-preview boundary. Then determine the planning path:

- **Candidate path:** the student already has courses or sections in mind. Ask for those candidates and the intended semester, then focus later reads on eligibility, conflicts, and section comparison.
- **Recommendation path:** the student wants the advisor to propose a plan. Collect curriculum progress, current enrollment, and preferences after the permission gate below.

Do not ask this choice again when the initial request already makes it clear.

## Personal-data permission and confirmation

After the selected profile is authenticated, describe the minimum data needed and ask for scoped permission before reading it. Depending on the chosen path, this can include cohort, major or track, cultivation-plan context, completed and in-progress courses, requirement gaps, and current-semester enrollment. Do not read detailed grades or expose numeric marks unless the student explicitly chooses a performance-informed recommendation that needs them.

Permission for these reads does not authorize saving an advisor profile or export, and it never authorizes enrollment.

After permission is granted:

1. Use the installed structured `sustech` commands, preferring whitelisted profile and degree surfaces over raw upstream data.
2. Present a concise redacted snapshot that separates TIS-reported fields, advisor inferences, user-supplied corrections, missing fields, source failures, and manual-review items.
3. Ask the student to confirm or correct cohort, major, track, completed or in-progress work, and current enrollment before using them. If major or track is missing, blank, or returned as `无`, ask the student; never infer it from course codes, department names, or the current timetable.
4. Preserve any disagreement between TIS summaries instead of choosing the more convenient value.

Do not proceed to curriculum interpretation or recommendation until the student confirms the snapshot or supplies the missing high-impact information.

## Curriculum and preferences

1. Resolve and read the official PDF. Present the extracted current-semester frame: required courses, choice pools, recommended sequencing, and manual-review rules. Do not continue until the student confirms the document identity; confirmation of the identity does not resolve ambiguous clauses.
2. Ask for minimum, target, and maximum credits; must-take and excluded courses; blocked periods; early/late, laboratory, and campus tolerance.
3. Ask for interest phrases rather than forcing a taxonomy. Accept course codes as strong interest signals.
4. Ask whether the student has direct experience with a complete teaching team or wants to avoid one. Store this separately from NCES evidence.
5. Summarize the confirmed framework and preferences before writing a profile. Obtain separate approval for the exact destination because the write stores personal planning data locally.

Offer reasonable defaults, but never silently choose a curriculum version, track, maximum credit load, or interpretation of a conditional requirement.
