# Bootstrap launchers must bind the audited sibling CLI

- Symptom: the public v0.2.7 POSIX bootstrap installed `sustech-cli@0.10.0`, but invoking the printed absolute `sustech-advisor` path resolved a stale global `sustech 0.8.4` from `PATH`.
- Root cause: bootstrap verified advisor readiness with a temporary `SUSTECH_BIN` override, then generated a launcher that did not retain the verified sibling selection for ordinary calls.
- Risk: the selected CLI defines capability, privacy-projection, timeout, and mutation-safety contracts. Silently selecting another version breaks the integrity of an otherwise pinned and audited installation.
- Fix: generate POSIX and Windows launchers through the shared installation policy. The advisor launcher sets the sibling `sustech` path only when the caller has not explicitly supplied `SUSTECH_BIN`, and bootstrap verifies `doctor` through the ordinary generated launcher.
- Regression coverage: create a stale `sustech` shim earlier on `PATH`, execute the generated advisor launcher, and require the sibling result. Repeat with an explicit `SUSTECH_BIN` and require that override to remain effective. CI exercises the platform-native launcher on macOS, Ubuntu, and Windows; the Windows fixture uses an installation path containing `!` and an invoking shell with delayed expansion enabled.
- Maintenance rule: never prove installation readiness with an environment override that ordinary post-install invocation does not retain. Keep the absolute-path, no-global-PATH contract executable in tests.
