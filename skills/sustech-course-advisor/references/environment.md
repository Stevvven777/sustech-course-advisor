# Environment preflight

Run this before asking onboarding questions or reading personal academic data.

1. Resolve the advisor command. Prefer `sustech-advisor` on `PATH`; from this source checkout, use `node <skill-root>/../../dist/cli.js`.
2. Run `sustech-advisor doctor --profile NAME`. It checks the advisor build, supported Node.js runtime, the selected `sustech` executable, required capabilities and consequence records, credential backend, and locally available credential source.
3. For personalized planning, run it again with `--live` to perform one authenticated TIS check. This is a read, not permission for an enrollment mutation.
4. Inspect both the process exit status and the JSON `ok` field. Summarize failures and the provided `remediation`; do not proceed as if a partial check passed.

If `sustech-advisor` is not installed but this is a complete source checkout, inspect `package.json`, then build with `npm run build`. Installing dependencies or changing a global installation requires the user's approval when it is not already within the requested setup work. Do not silently switch to an unrelated checkout.

If no `sustech` executable is on `PATH`, use `SUSTECH_BIN` only when it already identifies an explicit trusted executable, or ask the user to choose the intended installation. Never invent an endpoint or replace the CLI with direct campus requests.

If credentials are unavailable, direct the student to `sustech auth login --profile NAME` in an interactive terminal. Never ask them to paste a password, cookie, token, or one-time code into chat. If live verification reports an interactive CAS challenge or a network gate, stop and explain it rather than retrying repeatedly.

After the environment passes, still preserve source-level failures from later curriculum, TIS, and NCES calls. A successful preflight establishes compatibility and authentication only; it does not prove that every upstream source is currently available.
