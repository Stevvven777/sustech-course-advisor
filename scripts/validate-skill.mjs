#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(projectRoot, "skills", "sustech-course-advisor");
const skillPath = resolve(root, "SKILL.md");
const content = readFileSync(skillPath, "utf8");
const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatter) throw new Error("SKILL.md must begin with YAML frontmatter.");
if (!/^name:\s*sustech-course-advisor\s*$/m.test(frontmatter[1])) throw new Error("Skill name is missing or invalid.");
if (!/^description:\s*\S.+$/m.test(frontmatter[1])) throw new Error("Skill description is missing.");
const references = [...content.matchAll(/\]\((references\/[^)#]+)(?:#[^)]+)?\)/g)].map((match) => match[1]);
for (const reference of references) if (!existsSync(resolve(root, reference))) throw new Error(`Missing Skill reference: ${reference}`);
for (const script of ["scripts/bootstrap.sh", "scripts/bootstrap.ps1", "scripts/install-policy.mjs"]) if (!existsSync(resolve(root, script))) throw new Error(`Missing bootstrap script: ${script}`);

const manifest = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const posixBootstrap = readFileSync(resolve(root, "scripts", "bootstrap.sh"), "utf8");
const powershellBootstrap = readFileSync(resolve(root, "scripts", "bootstrap.ps1"), "utf8");
const installPolicy = readFileSync(resolve(root, "scripts", "install-policy.mjs"), "utf8");
const releaseWorkflow = readFileSync(resolve(projectRoot, ".github", "workflows", "release.yml"), "utf8");
const releaseSmokeWorkflow = readFileSync(resolve(projectRoot, ".github", "workflows", "release-smoke.yml"), "utf8");
for (const [name, script] of [["POSIX", posixBootstrap], ["PowerShell", powershellBootstrap]]) {
  if (!script.includes(manifest.version)) throw new Error(`${name} bootstrap version differs from package.json.`);
  if (!script.includes("Stevvven777/sustech-course-advisor")) throw new Error(`${name} bootstrap is not pinned to the project GitHub repository.`);
  if (!script.includes(".sha256")) throw new Error(`${name} bootstrap does not fetch the advisor checksum asset.`);
  if (!script.includes("install-policy.mjs") || !script.includes("audit --prefix")) throw new Error(`${name} bootstrap does not enforce and audit the installed runtime dependency policy.`);
  if (/view\s+["']?sustech-course-advisor@/i.test(script)) throw new Error(`${name} bootstrap still treats npm as the advisor publication channel.`);
}
if (!posixBootstrap.includes("shasum") || !posixBootstrap.includes("sha256sum")) throw new Error("POSIX bootstrap must support a SHA-256 verifier.");
if (!powershellBootstrap.includes("Get-FileHash")) throw new Error("PowerShell bootstrap must verify the advisor archive hash.");
if (!installPolicy.includes('file:../releases/${assetName}') || !installPolicy.includes('uuid: "^11.1.1"')) throw new Error("Installation policy does not retain the verified archive or enforce the reviewed uuid boundary.");
if (!powershellBootstrap.trimEnd().endsWith("exit 0")) throw new Error("PowerShell bootstrap must clear a non-ready doctor exit after validating installation readiness.");
if (!releaseWorkflow.includes('tags: ["v*"]') || !releaseWorkflow.includes("gh release create")) throw new Error("GitHub Release workflow is missing its tag trigger or publication step.");
if (!releaseSmokeWorkflow.includes("workflow_dispatch:") || !releaseSmokeWorkflow.includes("bootstrap.sh") || !releaseSmokeWorkflow.includes("bootstrap.ps1")) throw new Error("Cross-platform GitHub Release smoke workflow is incomplete.");
for (const [name, workflow] of [["release", releaseWorkflow], ["release smoke", releaseSmokeWorkflow]]) {
  if (/uses:\s+actions\/(?:checkout|setup-node)@v\d+/i.test(workflow)) throw new Error(`${name} workflow uses a mutable major-version action reference.`);
}
process.stdout.write(`Skill validation passed (${new Set(references).size} references).\n`);
