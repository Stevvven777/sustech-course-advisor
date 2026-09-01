# Environment preflight

Support macOS, Windows, and Linux. Keep runtime behavior in cross-platform Node.js code; use platform-specific shell syntax only in clearly labeled examples. On Windows, account for npm-installed `.cmd` launchers. On macOS and Linux, invoke the executable directly without Windows shell wrapping.

Run this after the brief process introduction and planning-path choice, but before authenticated onboarding or personal academic reads.

1. Resolve the advisor command. Prefer `sustech-advisor` on `PATH`; from this source checkout, use `node <skill-root>/../../dist/cli.js`.
2. Run `sustech-advisor doctor --profile NAME`. It checks the advisor build, supported Node.js runtime, the selected `sustech` executable, required capabilities and consequence records, credential backend, and locally available credential source.
3. For personalized planning, run it again with `--live` to perform one authenticated TIS check. This is a read, not permission for an enrollment mutation.
4. Inspect both the process exit status and the JSON `ok` field. Summarize failures and the provided `remediation`; do not proceed as if a partial check passed.

Treat preflight remediation as part of the guided experience instead of handing a command list to the student.

- If `sustech-advisor` is not installed but this is a complete source checkout, inspect `package.json`. Build directly when dependencies are already present. If dependencies are missing, show the exact package source, lockfile, destination, and local-write/network impact; after one scoped approval, install from the lockfile and build, then rerun `doctor`.
- If an installed advisor is outdated or incompatible, show the detected and required versions plus the exact trusted update source. Ask once before a download or global change, perform the approved update, and verify the installed version. Do not silently switch to an unrelated checkout or package source.
- Apply non-networked, reversible fixes inside the selected project when they are already within the user's setup request. Never treat a request to plan courses as permission for a system-wide install.

If no `sustech` executable is on `PATH`, use `SUSTECH_BIN` only when it already identifies an explicit trusted executable. Otherwise, identify the official package or repository recorded by this project, show the version and installation scope, and offer to install it after approval. If no trusted source is recorded, ask the user to choose one; never guess a package, invent an endpoint, or replace the CLI with direct campus requests.

If credentials are unavailable, launch or guide `sustech auth login --profile NAME` in a secure interactive terminal after explaining that it verifies and stores the credential in the operating-system keyring. The student types the secret only into that local prompt; never ask them to paste a password, cookie, token, or one-time code into chat. If the agent cannot provide an interactive terminal, give one exact command rather than a setup tutorial. If live verification reports an interactive CAS challenge or a network gate, stop and explain it rather than retrying repeatedly.

## Credential isolation

An execution sandbox may be able to read profile metadata while being unable to see the operating-system keyring. A sandboxed `credentialAvailable: false` immediately after a successful interactive login is therefore not, by itself, evidence that saving failed.

- Never read, extract, print, copy, or transport the password outside the keyring.
- When the runtime supports scoped escalation, ask permission to run the entire credential-consuming `sustech-advisor` or `sustech` command in a host context that can access the keyring. Keep authentication checks and later personalized reads in that same approved context.
- Request the narrowest reusable command scope that supports the selected read workflow. Permission to access the keyring is not permission to mutate campus state.
- Do not work around isolation with a plaintext credentials file, environment variable, temporary file, clipboard transfer, or visible command argument.
- If host execution is unavailable, ask the student to run the exact redacted status or live-doctor command in their trusted interactive terminal and return only its structured, secret-free result.

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
