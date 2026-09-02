# Debugging and support

Use this reference only when a readiness check, authenticated read, recommendation, audit, export, or preview fails, or when maintaining the project.

Run `sustech-advisor diagnose --profile NAME` after the failing stage. Add `--live` only when the user has approved the authenticated read and the same credential-capable execution context is available. The command stores a rotating local diagnostic outside the repository, keeps at most ten reports, and prints only schema v1 projected metadata:

- operating system, architecture, Node and package versions;
- installation and authentication readiness as separate states;
- missing required capability/consequence names and unavailable optional features with their missing contract names;
- proxy mode, credential backend availability, and stable failure codes.

Every `sustech` subprocess has a ten-second default upper bound; bounded live workflows may supply a per-stage value within their documented total budget. A credential backend, authenticated check, init inference, refresh, or preview that does not return is recorded as `COMMAND_TIMEOUT`. Diagnostics and guided init must still finish without repeatedly invoking the credential store, while refresh and preview stop without retrying. Treat the stage and a bounded direct-versus-inherited-proxy comparison as evidence before classifying the timeout; the code alone does not prove that credentials expired or that the proxy is broken.

Keep the timeout layers distinct. `COMMAND_TIMEOUT` means the whole installed
`sustech` command exceeded the advisor's boundary. An upstream version that
includes bounded credential helpers may instead finish normally with
`reasonCode: CREDENTIAL_STORE_TIMEOUT` in `auth status`; that means the
operating-system helper exceeded its own five-second deadline. Neither code
proves that credentials expired, and neither permits an automatic retry or
login attempt. Retain the advisor boundary for compatibility with older
upstream versions even after the upstream fix is released.

It excludes SID, profile contents, grades, credentials, cookies, tokens, raw upstream payloads, queries, and absolute user paths. Do not add any of those fields to diagnostics.

When collaboration is needed, create a sanitized JSON bundle with `--support-bundle FILE`. This is a local write only; it never uploads or opens an issue. Before submitting it externally, the agent must show the exact bundle file list, run the built-in privacy scan, name the destination, and obtain the user's explicit approval. Approval to diagnose or create a local bundle is not approval to submit it. If a reproduction needs unsafe data, replace it with a synthetic fixture under the repository's `debug/fixtures/` directory.

Maintain durable, non-personal findings under the repository's `debug/findings/` directory. Record the symptom, safety impact, downstream containment, upstream owner, and test/fixture. Never place runtime logs in the repository.
