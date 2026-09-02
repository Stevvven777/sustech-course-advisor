# Release smoke default could lag the packaged version

- Symptom: the repository and bootstrap defaults were prepared for v0.2.5 while the manual `Release smoke` form still proposed v0.2.4.
- Root cause: version propagation relied on search-and-edit across hidden workflow files, and the existing gates checked package contents without asserting that every publication surface named the same version.
- Safety impact: a maintainer could accept the default and obtain a green installation matrix for an older artifact, then incorrectly treat the new Release as cross-platform verified.
- Downstream containment: `release:check` derives the version from `package.json` and fails unless the root lockfile, README Release link, environment guide, both bootstrap defaults, Release-smoke input, and install-policy fixtures agree. CI and `prepack` both run the check before publication.
- Upstream owner: `Stevvven777/sustech-course-advisor`; the upstream CLI version is checked separately and is not changed by this fix.
- Test/fixture evidence: before the fix, package v0.2.5 and `.github/workflows/release-smoke.yml` default v0.2.4 contradicted each other. The repository check now validates eight named surfaces and reports the exact mismatched surface.
- Maintenance rule: change the package version once, update every surface named by `release:check`, and do not tag or dispatch Release smoke until the check passes. A successful older smoke run is not evidence for a newer tag.
