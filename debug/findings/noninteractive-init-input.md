# Redirected profile interviews could exit without a profile

- Symptom: `sustech-advisor init --path PROFILE.json` accepted a complete newline-delimited stdin stream, printed only its first prompts, exited with status zero, and created no destination file.
- Root cause: `readline.question()` consumed one answer at a time while a redirected stream delivered all lines immediately. Lines emitted before the next question listener was attached were discarded, and the unresolved prompt did not keep Node.js alive after stdin closed.
- Safety impact: an Agent could report onboarding success while no profile existed, then repeat personal-data reads or improvise an unreviewed profile. A partial or shifted answer stream could also associate a confirmation with the wrong question if handled permissively.
- Downstream containment: interactive TTY behavior is unchanged. Non-TTY input is buffered once, consumed in prompt order, and fails explicitly when any answer is missing; the atomic profile writer still creates only a complete schema v2 file with mode `0600`.
- Upstream owner: `Stevvven777/sustech-course-advisor`; this is local interview orchestration and does not require a `sustech-cli` protocol change.
- Test/fixture evidence: the cross-platform CLI test sends all eleven invented answers in one stdin write, verifies the resulting schema v2 fields, then sends a truncated stream and proves the command exits non-zero without creating a file. The independent Darwin arm64 validation originally reproduced the zero-exit/no-file state against public v0.2.4.
- Maintenance rule: for commands that promise an artifact, assert both process status and the artifact contract. Keep redirected interview fixtures synthetic, and never persist real profile answers in the repository or CI logs.
