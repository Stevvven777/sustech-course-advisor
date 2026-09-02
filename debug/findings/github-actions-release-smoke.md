# GitHub Actions release verification

- Symptom: the first `v0.2.0` publication run warned that the Node.js 20 action runtime used by `actions/checkout@v4` and `actions/setup-node@v4` was deprecated and being forced onto Node.js 24. The release workflow also had no durable post-publication matrix that exercised the public assets.
- Maintenance impact: a later runner cutoff could break CI or publication independently of the project's supported Node.js version, while a syntactically valid bootstrap could still fail only on one operating system.
- Containment: all workflows pin the current official action releases to immutable commit SHAs. The explicit `node-version: 20.18.0` remains the project runtime under test and is separate from the action implementation runtime.
- Release evidence: the manually dispatched `Release smoke` workflow checks out the exact published tag, downloads the public advisor archive and checksum, then runs the real POSIX bootstrap on macOS and Ubuntu and the real PowerShell bootstrap on Windows from clean runner-local roots.
- Maintenance rule: run the smoke workflow after every GitHub Release, record failures here or in a new synthetic finding, and update action pins only after checking the official release and commit provenance.
