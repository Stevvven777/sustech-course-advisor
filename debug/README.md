# Debug and maintenance records

This directory contains repository-safe engineering notes and synthetic fixtures. It never contains live TIS/NCES responses, student profiles, grades, credentials, cookies, tokens, local diagnostic logs, or absolute user paths.

- `findings/` records reproducible defects, their safety impact, the downstream containment, and the upstream status.
- `fixtures/` contains invented data used to reproduce boundary conditions without personal information.

Runtime diagnostics are written outside the repository in the operating system's per-user application-data directory with mode `0600` where supported. The advisor retains at most ten. A support bundle contains only the documented diagnostic schema and is never uploaded automatically.

Before attaching any support bundle to an issue or pull request:

1. show the user the exact file list;
2. run the diagnostic privacy scan;
3. obtain explicit approval for that exact destination;
4. replace any unsafe reproduction material with a synthetic fixture.
