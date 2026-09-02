# Environment preflight

Support macOS, Windows, and Linux. Keep runtime behavior in cross-platform Node.js code; use platform-specific shell syntax only in clearly labeled examples. On Windows, account for npm-installed `.cmd` launchers. On macOS and Linux, invoke the executable directly without Windows shell wrapping.

Run this after the brief process introduction and planning-path choice, but before authenticated onboarding or personal academic reads.

## Platform and shell

Detect the operating system and active shell before presenting or executing commands. Do not give POSIX-only syntax to Windows users. On Windows, use PowerShell syntax, preserve Windows path quoting, and treat Windows Credential Manager as the expected secure credential backend. The ordinary advisor, doctor, and interactive login commands below have the same argument form in PowerShell; do not wrap them in `bash`, translate them into `cmd.exe`, or tell the student to install a separate PowerShell skill. If a remediation command differs by platform, execute only the branch that matches the student's environment.

1. Resolve the advisor command. Prefer `sustech-advisor` on `PATH`; from this source checkout, use `node <skill-root>/../../dist/cli.js`.
2. Run `sustech-advisor doctor --profile NAME`. It reports `installationReady` separately from `authenticationReady`, and checks the advisor build, supported Node.js runtime, the selected `sustech` executable, required capabilities and consequence records, credential backend, and locally available credential source.
   Each underlying CLI probe is limited to ten seconds. `COMMAND_TIMEOUT` from `auth status` or `auth check` leaves a compatible installation ready but authentication not ready; do not loop, export credentials, or misclassify it as a proxy failure. The same default boundary protects direct `init` inference, `refresh`, and exact `preview` calls: init continues with its guided fallback, while refresh and preview stop without retrying or changing campus state.
3. For personalized planning, run it again with `--live` to perform one authenticated TIS check. This is a read, not permission for an enrollment mutation.
4. Inspect both the process exit status and the JSON `ok` field. Summarize failures and the provided `remediation`; do not proceed as if a partial check passed.

Compatibility is capability-first, not a version-range guess. An older or newer `sustech-cli` build is core-ready only when it exposes every required command (`version`, `capabilities`, `consequences`, `auth status`, `auth check`, `tis courses search`, `tis courses available`, `tis degree progress`, `nces search`, and `tis selection preview`) and every required consequence record (`tis.enroll` and `tis.cart.update`). `doctor` prints each missing core name, marks installation and personalized planning not ready, and skips live authentication until this contract passes. Do not infer compatibility from the version string alone.

Automatic curriculum acquisition is a separately reported optional feature requiring both `curriculum sources` and `curriculum fetch` plus the `curriculum.fetch` consequence record. The public `sustech-cli@0.10.0` core is compatible but does not expose that optional feature. This does not relax the confirmed-curriculum gate: follow `curriculum.md` to use an exact official public PDF or a student-provided official PDF, retain its digest and page references, and obtain student confirmation before recommendation. Never substitute a general catalog or community page for the missing official document.

Release availability is a separate publication gate. The advisor itself is not published to npm. The default bootstrap downloads exactly `sustech-course-advisor-0.2.8.tgz` and its sibling `.sha256` file from this repository's `v0.2.8` GitHub Release, verifies the archive, and only then passes that local archive to npm for dependency resolution. The upstream CLI currently has no GitHub Release package asset, so the bootstrap separately verifies and installs its official `sustech-cli@0.10.0` npm package. Do not confuse that upstream dependency channel with publication of the advisor. Verify the GitHub asset, checksum, and both platform bootstrap paths before calling release installation ready.

Treat preflight remediation as work for the agent instead of handing a command list to the student.

## Agent-run installation

Prefer an already compatible Node.js and existing verified commands. When anything is missing or incompatible, inspect the matching bootstrap script under this Skill's `scripts/` directory and verify that the exact GitHub Release assets and every exact dependency package it requests exist. Then present one scoped approval covering the exact downloads, package versions, user-level destination, and network/local-write effects. After approval, the agent runs the script, observes its exit status, and reruns `doctor`; the student should not have to translate remediation into commands. Do not use a failed install as release-availability discovery.

- macOS/Linux: run `sh <skill-root>/scripts/bootstrap.sh`.
- Windows PowerShell: run `& <skill-root>\scripts\bootstrap.ps1`.

The scripts download the exact advisor archive and checksum from GitHub, reject a missing or mismatched checksum, verify the exact upstream CLI dependency version, and install both into an isolated per-user directory. Before resolution they retain the verified archive under that dedicated root and write a private manifest with exact dependency entries plus the reviewed `uuid >=11.1.1` override; dependency-package overrides are not inherited by npm consumers. npm install and audit execute with that isolated consumer directory as their actual working directory, avoiding platform-specific `--prefix` resolution and override behavior. Every npm invocation also uses the dedicated installation-root cache rather than the user's global cache, so unrelated permissions or root-owned legacy entries under `~/.npm` cannot break the Skill flow. The post-install policy rejects a manifest or lock entry that no longer points to the retained Release archive, verifies the resolved uuid boundary, and runs a fail-closed audit against the actual installed runtime lockfile and tree. Generated advisor launchers bind the audited sibling `sustech` executable by default, so the printed absolute path cannot silently select an older global CLI; an explicit caller-provided `SUSTECH_BIN` remains the only override. npm is used as the local package installer and to resolve runtime dependencies; it is not the advisor's publication channel. Registry fetches use one bounded retry and a 15-second per-request timeout so a broken proxy or DNS path does not wait indefinitely. The scripts do not use `sudo`, run `chown`, modify global npm configuration, modify the system Node installation, edit shell startup files, or change the global `PATH`. If the existing Node.js is older than 20.18.0, they download the official Node.js archive from `nodejs.org`, verify it against the release `SHASUMS256.txt`, and use that isolated runtime. After installation they run `doctor` through that generated launcher and require `installationReady: true`; authentication may remain independently not ready. They stop on unsupported platforms, release or dependency unavailability, missing checksum tooling, provenance or version verification failure, installed-tree audit failure, package-install failure, or capability-contract failure. Maintainers run the repository's `Release smoke` workflow for each published version; it executes the real POSIX and PowerShell bootstraps from that tag on fresh macOS, Ubuntu, and Windows runners and emits a bounded dependency summary when a Windows consumer install fails.

Do not run a bootstrap script merely because authentication is not ready. Installation and authentication are independent states. Do not substitute an unreviewed package source or relax checksum/version checks. If the user declines the scoped installation, stop the personalized workflow with the readiness report; only then may you give the already-selected single script invocation for them to run later.

- If `sustech-advisor` is not installed but this is a complete source checkout, inspect `package.json`. Build directly when dependencies are already present. If dependencies are missing, show the exact package source, lockfile, destination, and local-write/network impact; after one scoped approval, install from the lockfile and build, then rerun `doctor`.
- If an installed advisor is outdated or incompatible, show the detected and required versions plus the exact trusted update source. Ask once before a download or global change, perform the approved update, and verify the installed version. Do not silently switch to an unrelated checkout or package source.
- Apply non-networked, reversible fixes inside the selected project when they are already within the user's setup request. Never treat a request to plan courses as permission for a system-wide install.

If no `sustech` executable is on `PATH`, use `SUSTECH_BIN` only when it already identifies an explicit trusted executable. Otherwise, identify the official package or repository recorded by this project, show the version and installation scope, and offer to install it after approval. If no trusted source is recorded, ask the user to choose one; never guess a package, invent an endpoint, or replace the CLI with direct campus requests.

## Exact TIS login flow

Login changes the student's local credential store. Before starting it, name the exact profile and explain the local effect: the CLI will verify the account against TIS, then store the password in macOS Keychain, Windows Credential Manager, or Linux Secret Service only after successful verification. Use `default` unless the student already selected another profile; never silently choose or switch accounts.

The login UI is a secure interactive terminal prompt, not a separate graphical window, browser form, or chat input. Whenever the client can open or attach to a real interactive terminal and hand input control to the student, launch this command for them:

```text
sustech auth login --profile NAME --service tis
```

Do not omit `--service tis`: bare `sustech auth login` verifies Blackboard by default and does not establish TIS readiness. Tell the student what to expect: `Student ID:` asks for the SID; `Password:` is hidden; the CLI verifies TIS before saving; success identifies the profile, masked SID, and credential backend.

The student types the SID and password only into that local terminal prompt. Never ask them to paste a password, cookie, token, or one-time code into chat or place a password in a visible command argument. Do not use `--password-stdin` for an ordinary interactive login.

After login, the agent runs both checks itself in the same profile and credential-capable execution context, then reruns live doctor:

```text
sustech auth status --profile NAME --json
sustech auth check --profile NAME --service tis --json
sustech-advisor doctor --profile NAME --live
```

Require successful exits, JSON `ok: true`, `credentialAvailable: true`, and a successful TIS check. If the client cannot hand an interactive terminal to the student, say so plainly and give only the exact login command above. After the student reports completion, attempt verification directly before asking them to return anything.

If login fails, distinguish the observed state. For `CREDENTIAL_STORE_UNAVAILABLE` or Linux Secret Service lookup errors, repair or select the supported secure backend and do not create a plaintext fallback. For `CAS_INTERACTIVE_CHALLENGE_REQUIRED`, let the student complete the required account flow and do not bypass or repeatedly retry it. Report a network gate as observed rather than declaring the password wrong.

## Credential isolation

An execution sandbox may be able to read profile metadata while being unable to see the operating-system keyring. A sandboxed `credentialAvailable: false` immediately after a successful interactive login is therefore not, by itself, evidence that saving failed.

- Never read, extract, print, copy, or transport the password outside the keyring.
- When the runtime supports scoped escalation, ask permission to run the entire credential-consuming `sustech-advisor` or `sustech` command in a host context that can access the keyring. Keep authentication checks and later personalized reads in that same approved context.
- Request the narrowest reusable command scope that supports the selected read workflow. Permission to access the keyring is not permission to mutate campus state.
- Do not work around isolation with a plaintext credentials file, environment variable, temporary file, clipboard transfer, or visible command argument.
- If host execution is unavailable, first state that automatic validation is unavailable in this client. Only then ask the student to run one exact redacted live-doctor command in their trusted interactive terminal and return only its structured, secret-free result.

After login, verify readiness from the same execution context that will run personalized reads. If that context reports the credential ready, do not send the student through another login merely because an isolated context still reports it missing.

## Campus network routing

The advisor defaults to direct access. It launches every `sustech` child process with proxy variables removed and `NO_PROXY=*`. This affects only that child process; it does not change the user's shell, operating-system proxy, browser, or other applications. TIS, curriculum, authentication, and NCES commands therefore attempt a direct connection by default.

The proxy mode is an explicit per-process switch:

- `SUSTECH_ADVISOR_PROXY_MODE=direct` removes proxy variables. This is the default when the variable is absent.
- `SUSTECH_ADVISOR_PROXY_MODE=inherit` preserves the current terminal's proxy variables for the `sustech` child process.

Do not switch after one slow response. When multiple forced-live, read-only requests in the same network context repeatedly end in `NETWORK_TIMEOUT`, try one bounded comparison run with `inherit`. Report which mode was used and the result; do not persist the setting or modify the operating-system proxy automatically. If the inherited-proxy run is better, the student may keep the switch for that terminal session. An unsupported value is an error rather than a silent fallback.

Windows PowerShell session:

```powershell
$env:SUSTECH_ADVISOR_PROXY_MODE = "inherit"
sustech-advisor doctor --profile default --live
```

Return to the Windows default with:

```powershell
Remove-Item Env:SUSTECH_ADVISOR_PROXY_MODE
```

macOS or Linux POSIX shell session:

```sh
export SUSTECH_ADVISOR_PROXY_MODE=inherit
sustech-advisor doctor --profile default --live
```

Return to the macOS/Linux default with:

```sh
unset SUSTECH_ADVISOR_PROXY_MODE
```

The switch applies to commands launched through the advisor; a separately invoked global `sustech` command is outside this wrapper.

After the environment passes, still preserve source-level failures from later curriculum, TIS, and NCES calls. A successful preflight establishes compatibility and authentication only; it does not prove that every upstream source is currently available.

When readiness or a later stage fails, use [debugging.md](debugging.md). Do not collect raw personal payloads to compensate for missing diagnostics.
