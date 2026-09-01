# Downstream #3: capability-first CLI compatibility

- Downstream: `Stevvven777/sustech-course-advisor#3`
- Symptom: a nominally current `sustech-cli` version may omit a command or consequence contract required by the advisor, while an older build may already expose the full compatible surface.
- Safety impact: version-only readiness can start authenticated reads or planning against a CLI that cannot complete the later audit, curriculum, query, or preview steps.
- Containment: `doctor` enumerates required capabilities and consequence records, reports exact missing names, and keeps installation and personalized planning not ready. A requested live authentication check is skipped until the runtime, advisor installation, and CLI contract pass.
- Evidence: synthetic older-complete and current-incomplete command surfaces prove that capability completeness, not the version label, controls readiness; the incomplete fixture also proves that TIS auth check is never called.
- Publication gate: registry metadata checked on 2026-09-02 confirms `sustech-cli@0.10.0` exists and `sustech-course-advisor@0.2.0` is still E404. Keep the issue open until the advisor package is published and both bootstrap scripts pass from clean user-level roots.
- Published CLI containment: an isolated macOS arm64 install confirmed `sustech-cli@0.10.0` provides the planning core but not `curriculum sources`, `curriculum fetch`, or `curriculum.fetch`. These form one optional automatic-acquisition feature; their absence is visible but does not misclassify the core as incompatible. The Skill still requires an exact confirmed official PDF before recommendation.
- Maintenance rule: when the advisor adopts a new upstream command, add it to the capability baseline and both fixture surfaces before using it. Keep bootstrap versions aligned with packages that actually exist in the selected registry.
