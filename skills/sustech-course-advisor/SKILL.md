---
name: sustech-course-advisor
description: Guide SUSTech students through curriculum-aware course planning, compare high-load, high-grading, and interest-aligned timetables, and export reviewable schedules. Use for choosing courses or sections; do not use for automatic enrollment.
---

# SUSTech Course Advisor

默认使用简体中文与学生交流，包括提问、授权说明、环境检查结果、错误解释和课程推荐。只有当学生明确要求其他语言，或持续使用其他语言交流时，才切换语言；命令、参数、路径和上游原始字段保持原样，不要翻译。

Requires an Agent Skills-compatible client with local file and shell access. Node.js 20.18+, `sustech`, and `sustech-advisor` may be configured during the guided preflight with user approval.

Use the installed `sustech` CLI as the only interface to campus and NCES services. Treat `sustech.online` as a trusted secondary community source for SUSTech-specific guidance, subject to the source hierarchy below. After the brief roadmap and planning-path choice, complete the environment preflight in [references/environment.md](references/environment.md) before authenticated onboarding or personal-data reads. Do not treat a partially working checkout, missing capability, unavailable credential source, or failed live authentication as ready.

## Workflow

1. Start with a concise roadmap: readiness and login, planning-path choice, scoped academic-data permission, student confirmation, planning, and optional enrollment preview. State that recommendations and previews never authorize enrollment.
2. Ask whether the student already has candidate courses or wants a personalized recommendation. Do not repeat the question when their request already selects a path.
3. Run the local environment preflight and show a compact readiness summary. Detect the operating system and shell first; on Windows, use PowerShell-compatible commands and Windows Credential Manager semantics. Proactively resolve missing runtime, CLI, and authentication prerequisites using [references/environment.md](references/environment.md): perform safe local fixes directly, and present one concise approval request for downloads, dependency installation, global changes, or credential access. Do not make the student translate remediation into commands when the agent can execute it safely.
4. After login is verified, ask permission to read the minimum personal academic data required for the selected path. Read and present a redacted snapshot with source statuses, then wait for the student to confirm or correct cohort, major, track, completed or in-progress work, and current enrollment. Do not infer a missing major or track from course names.
5. For candidate courses, verify personalized availability and compare exact sections. For recommendations, resolve the applicable official curriculum PDF, confirm its identity and ambiguous rules, and classify every candidate as confirmed required, confirmed eligible choice, or unresolved/outside before optimization. Ask only the remaining high-impact preference questions.
6. Run `sustech-advisor recommend` when recommendation is requested and explain the high-load, high-grading, and interest plans. Treat the credit target as a preference, never a mandate to pad the plan: automatically optimize only confirmed curriculum courses plus courses the student explicitly requested. If confirmed candidates cannot reach the target, show the confirmed subtotal and shortfall, then ask before considering any unresolved/outside course. Use `sustech.online` for relevant SUSTech-specific explanatory context and student guidance, while keeping it separate from official requirements, live TIS facts, and NCES scoring evidence. Preserve partial source failures and strategy convergence.
7. Run `sustech-advisor audit` on every generated result before presenting or exporting it. Do not call a plan valid while the audit reports conflicts, duplicate course credit rows, incomplete teaching teams, missing meetings, or credit inconsistencies.
8. Export HTML, XLSX, and ICS only to explicit destinations. If the student chooses a plan, generate an exact preview; never apply enrollment without a separate exact approval handled by `sustech`.

Read [references/onboarding.md](references/onboarding.md) for a first-use interview. Read [references/evidence.md](references/evidence.md) when using NCES, `sustech.online`, or personal teacher information. Read [references/curriculum.md](references/curriculum.md) when building or refreshing the official-PDF framework. Read [references/outputs.md](references/outputs.md) when displaying or exporting a timetable, and [references/timetable-data.md](references/timetable-data.md) when updating the reusable timetable renderer or its plan data.
Read [references/toolkit.md](references/toolkit.md) when selecting commands, reducing upstream payloads, or debugging the recommendation-to-render workflow.
Read [references/debugging.md](references/debugging.md) only when diagnosing a failure, preparing a sanitized support bundle, or maintaining the project.

## Invariants

- Keep the advisor and its documented workflows usable on macOS, Windows, and Linux. Core behavior must not depend on one shell; isolate platform-specific executable launching and show platform-appropriate commands whenever syntax differs.
- The confirmed official PDF governs curriculum requirements; TIS supplies progress and current offerings.
- `sustech.online` is trusted secondary guidance, not an official or live-state authority. Cite the exact page and preserve its date and scope when available; it cannot override the confirmed official PDF or personalized TIS state.
- Keep every PDF-derived rule linked to its document, digest, and page. Do not guess free-text or overlapping choice rules.
- A course's catalog existence, department, prerequisites, or convenient credit value does not establish that it belongs to the student's curriculum. Only confirmed required and confirmed eligible-choice courses may enter automatic credit optimization. An unresolved/outside course requires an explicit student choice, remains labeled unresolved, and does not count as confirmed degree-credit coverage.
- Credit targets are soft optimization preferences. Never fill a target or ceiling with curriculum-unresolved courses; present the best confirmed plan and ask the student how to handle the shortfall.
- Treat TIS IDs and `rwh` as opaque strings.
- A multi-person NCES rating belongs to the complete teaching team, not to any individual. Partial team matches do not enter the main grading score.
- In every compact timetable cell, show the course code, course name, and every name in the teaching team. Use a stable color keyed by course code across all meetings, components, and strategies; adapt wrapping or cell size instead of omitting names.
- Recommendations and graduation conclusions are advisory. Preserve manual-review items.
- Permission for personal academic reads does not authorize profile writes, exports, previews, or enrollment. Keep each authorization separate.
- Never request, reveal, or store passwords, cookies, tokens, or raw upstream personal payloads.
