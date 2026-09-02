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

1. Resolve and read the official PDF. Present the extracted current-semester frame: required courses, choice pools, recommended sequencing, and manual-review rules. Do not continue until the student confirms the document identity; confirmation of the identity does not resolve ambiguous clauses. Before optimization, classify every candidate as confirmed required, confirmed eligible choice, or unresolved/outside; a general course-catalog match is not curriculum membership.
2. Ask for minimum, target, and maximum credits; must-take and excluded courses; blocked periods; early/late, laboratory, and campus tolerance. Before accepting the credit range, explain the applicable spring/fall boundaries:
   - Track main-program and minor-program credits separately. Do not consume the main-program allowance with minor-program credits, but still check combined timetable conflicts and workload.
   - The ordinary main-program ceiling is 25 credits. In this workflow, minor-program credits have no preset ceiling; if live TIS or a newer official notice reports a limit, preserve the disagreement and ask the student which current rule applies.
   - The ordinary recommended/principled lower bound is 15 credits. Students who have completed most requirements may be permitted below 15, but the generally documented floor is 9 credits; fewer than 9 may trigger an academic warning. Freshmen in their first semester and graduating-year students can be exceptions.
   - Verify the current-semester notice or personalized TIS constraint when available. Never silently invent a lower or upper bound, and keep user-supplied corrections separate from official and live-source evidence.
   - Policy references: [SUSTech course-selection consultation](https://sscsop.sustech.edu.cn/2021/0803/c1116a5402/page.htm) and the [SUSTech Student Handbook (2022)](https://welcome.sustech.edu.cn/uploads/file/NMhU6CeH6BpJ1bZmFljd.pdf). Retain their dates and treat a newer official notice or personalized TIS rule as authoritative.
   - Treat the target as a soft preference. Do not add a course whose curriculum module is unresolved merely to reach the target or ceiling.
   - When confirmed candidates remain below target after searching confirmed choice pools, show the confirmed subtotal and shortfall. Ask whether the student prefers the smaller confirmed plan, wants to inspect named unresolved candidates, or wants to relax another constraint. Explicit permission to include an unresolved course does not reclassify it or prove that it counts toward graduation.
3. Ask for interest phrases rather than forcing a taxonomy. Accept course codes as strong interest signals.
4. Ask whether the student has direct experience with a complete teaching team or wants to avoid one. Store this separately from NCES evidence.
5. Summarize the confirmed framework and preferences before writing a profile. Obtain separate approval for the exact destination because the write stores personal planning data locally.

After that approval, drive `sustech-advisor init --path PROFILE.json` yourself. Prefer its local interactive prompt; when the execution client has no PTY, provide all eleven prompt answers in order over standard input. Do not place personal answers in command arguments, shell history, logs, or repository fixtures. Treat exit status alone as insufficient: verify that the exact destination now exists with private permissions, loads as `schemaVersion: "2"`, and contains the values the student confirmed. An empty, truncated, or surplus redirected interview must fail without creating a partial profile.

Offer reasonable defaults, but never silently choose a curriculum version, track, maximum credit load, or interpretation of a conditional requirement.

## Selection-phase drop semantics

Before describing the consequence of dropping a course, identify the live selection phase and keep phase-specific behavior explicit:

- During the preselection phase, dropping a selected course normally permits the student to select it again. Do not describe every preselection drop as permanent seat loss. Still verify the live TIS result and current eligibility because availability and round rules can change.
- After point-based selection has ended, dropping a course removes the enrollment in the consequential sense: the course may no longer be recoverable through ordinary reselection. Warn the student before applying the drop and verify the exact section is absent afterward.
- Treat this phase distinction as user-supplied operational knowledge until corroborated by a current official notice or live TIS capability. Preserve any conflict with newer official or personalized rules.
- For CLI mutations, resolve the live round that exposes the exact `rwh` in its enrolled collection. During the current preselection implementation, drops are submitted through that open course-type round (for example, `xxxk` for general electives), while a generic `yixuan` query can be unavailable. Generate a fresh exact preview with the resolved round before applying; do not reuse a round merely because another course used it.
