import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const text = async (path) => readFile(resolve(root, path), "utf8");
const manifest = JSON.parse(await text("package.json"));
const lock = JSON.parse(await text("package-lock.json"));
const version = String(manifest.version ?? "");

const [readme, environment, posix, powershell, smoke, tests] = await Promise.all([
  text("README.md"),
  text("skills/sustech-course-advisor/references/environment.md"),
  text("skills/sustech-course-advisor/scripts/bootstrap.sh"),
  text("skills/sustech-course-advisor/scripts/bootstrap.ps1"),
  text(".github/workflows/release-smoke.yml"),
  text("src/test/advisor.test.ts"),
]);

const checks = [
  ["package version", /^\d+\.\d+\.\d+$/.test(version)],
  ["root lockfile version", lock.version === version && lock.packages?.[""]?.version === version],
  ["README badge and Release link", readme.includes(`version-${version}-`) && readme.includes(`/releases/tag/v${version}`)],
  ["environment Release asset", environment.includes(`sustech-course-advisor-${version}.tgz`) && environment.includes(`v${version}`)],
  ["POSIX bootstrap default", posix.includes(`ADVISOR_VERSION=\${SUSTECH_ADVISOR_VERSION:-${version}}`)],
  ["PowerShell bootstrap default", powershell.includes(`$AdvisorVersion = if ($env:SUSTECH_ADVISOR_VERSION) { $env:SUSTECH_ADVISOR_VERSION } else { "${version}" }`)],
  ["Release smoke default", smoke.includes(`default: "${version}"`)],
  ["release-policy fixtures", tests.includes(`sustech-course-advisor-${version}.tgz`) && tests.includes(`packageRoot, "${version}", "0.10.0"`)],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  process.stderr.write(`Release version ${version || "<missing>"} is inconsistent in: ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write(`Release version ${version} is consistent across ${checks.length} publication surfaces.\n`);
