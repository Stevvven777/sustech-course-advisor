#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const mode = process.argv[2] || "--staged";
if (mode !== "--staged" && mode !== "--tracked") throw new Error("Use --staged or --tracked.");
const gitArgs = mode === "--staged"
  ? ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]
  : ["ls-files", "-z"];
const files = execFileSync("git", gitArgs, { encoding: "utf8" }).split("\0").filter(Boolean);
const deniedPaths = [
  /(^|\/)docs\/snapshots\//,
  /(^|\/)docs\/(?:friction-log|token-usage-log)\.md$/,
  /(^|\/)(?:student|personal).*(?:\.advisor|\.plan)?\.json$/i,
];
const findings = [];
for (const file of files) {
  if (deniedPaths.some((pattern) => pattern.test(file))) findings.push(`${file}: forbidden personal or hosting artifact path`);
  if (file === "scripts/check-privacy.mjs" || /(^|\/)debug\/fixtures\//.test(file)) continue;
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  if (/(^|\/)\.openai\/hosting\.json$/.test(file)) {
    try {
      const hosting = JSON.parse(content);
      if (file !== "web/.openai/hosting.json" || hosting.project_id !== null) {
        findings.push(`${file}: hosting configuration must remain the unbound web project`);
      }
    } catch {
      findings.push(`${file}: invalid hosting configuration`);
    }
  }
  for (const [label, pattern] of [
    ["absolute macOS user path", /\/Users\/[A-Za-z0-9._-]+\//],
    ["absolute Windows user path", /[A-Za-z]:\\Users\\[^\\\r\n]+\\/],
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["GitHub token", /gh[pousr]_[A-Za-z0-9]{20,}/],
    ["npm token", /npm_[A-Za-z0-9]{20,}/],
    ["cookie assignment", /(?:^|[\s"'])cookie\s*[:=]\s*["'][^"']{8,}/i],
  ]) if (pattern.test(content)) findings.push(`${file}: ${label}`);
}
if (findings.length) {
  process.stderr.write(`Privacy scan failed:\n${findings.map((item) => `- ${item}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Privacy scan passed for ${files.length} ${mode.slice(2)} files.\n`);
