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

const versions = (source, pattern) => [...source.matchAll(pattern)].map((match) => match[1]);
const exact = (values, count) => values.length === count && values.every((value) => value === version);
const checks = [
  ["package version", /^\d+\.\d+\.\d+$/.test(version)],
  ["root lockfile version", lock.version === version && lock.packages?.[""]?.version === version],
  ["README current Release fields", exact([
    ...versions(readme, /version-(\d+\.\d+\.\d+)-173F5F/g),
    ...versions(readme, /\/releases\/tag\/v(\d+\.\d+\.\d+)/g),
    ...versions(readme, /当前版本为 \*\*(\d+\.\d+\.\d+) early preview\*\*/g),
    ...versions(readme, /The current release is \*\*(\d+\.\d+\.\d+) early preview\*\*/g),
  ], 4)],
  ["environment current Release fields", exact([
    ...versions(environment, /downloads exactly `sustech-course-advisor-(\d+\.\d+\.\d+)\.tgz`/g),
    ...versions(environment, /repository's `v(\d+\.\d+\.\d+)` GitHub Release/g),
  ], 2)],
  ["POSIX bootstrap default", exact(versions(posix, /^ADVISOR_VERSION=\$\{SUSTECH_ADVISOR_VERSION:-(\d+\.\d+\.\d+)\}\r?$/gm), 1)],
  ["PowerShell bootstrap default", exact(versions(powershell, /^\$AdvisorVersion = if \(\$env:SUSTECH_ADVISOR_VERSION\) \{ \$env:SUSTECH_ADVISOR_VERSION \} else \{ "(\d+\.\d+\.\d+)" \}\r?$/gm), 1)],
  ["Release smoke default", exact(versions(smoke, /^\s{8}default: "(\d+\.\d+\.\d+)"\r?$/gm), 1)],
  ["release-policy fixtures", exact([
    ...versions(tests, /sustech-course-advisor-(\d+\.\d+\.\d+)\.tgz/g),
    ...versions(tests, /packageRoot, "(\d+\.\d+\.\d+)", "0\.10\.0"/g),
  ], 8)],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  process.stderr.write(`Release version ${version || "<missing>"} is inconsistent in: ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write(`Release version ${version} is consistent across ${checks.length} publication surfaces.\n`);
