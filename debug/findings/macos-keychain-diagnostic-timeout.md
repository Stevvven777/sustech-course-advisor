# macOS Keychain status can stall diagnostics

- Symptom: in a full macOS host context, public `sustech-cli@0.10.0` can leave `sustech auth status --profile default --json` waiting indefinitely while the same advisor doctor returns quickly in a Keychain-inaccessible sandbox.
- Safety impact: an unbounded doctor or diagnose blocks maintenance, can leave users unsure whether to retry login, and prevents the sanitized diagnostic from being written. Repeated manual retries may cause more credential-store prompts without improving state.
- Downstream containment: every environment probe and optional live auth check now has a ten-second subprocess limit. A stall becomes the stable projected code `COMMAND_TIMEOUT`; installation readiness remains independent from authentication readiness, and no automatic retry occurs.
- Upstream owner: the underlying Keychain status stall belongs to `sustech-cli`; the advisor owns the bounded-call contract at its process boundary.
- Evidence: injected never-settling auth-status and auth-check fixtures prove that doctor returns promptly, retains a compatible installation state, marks authentication not ready, and emits only `COMMAND_TIMEOUT`. The real hanging process was terminated before any support bundle was written.
- Maintenance rule: all new environment or credential probes must use the bounded runner. Never add an unbounded direct `runSustech` call to doctor or diagnose.
