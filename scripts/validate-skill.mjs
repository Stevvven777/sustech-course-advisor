#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills", "sustech-course-advisor");
const skillPath = resolve(root, "SKILL.md");
const content = readFileSync(skillPath, "utf8");
const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatter) throw new Error("SKILL.md must begin with YAML frontmatter.");
if (!/^name:\s*sustech-course-advisor\s*$/m.test(frontmatter[1])) throw new Error("Skill name is missing or invalid.");
if (!/^description:\s*\S.+$/m.test(frontmatter[1])) throw new Error("Skill description is missing.");
const references = [...content.matchAll(/\]\((references\/[^)#]+)(?:#[^)]+)?\)/g)].map((match) => match[1]);
for (const reference of references) if (!existsSync(resolve(root, reference))) throw new Error(`Missing Skill reference: ${reference}`);
for (const script of ["scripts/bootstrap.sh", "scripts/bootstrap.ps1"]) if (!existsSync(resolve(root, script))) throw new Error(`Missing bootstrap script: ${script}`);
process.stdout.write(`Skill validation passed (${new Set(references).size} references).\n`);
