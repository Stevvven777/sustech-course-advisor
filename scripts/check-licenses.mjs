#!/usr/bin/env node
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const allowed = new Set(["MIT", "MIT/X11", "Apache-2.0", "BSD-3-Clause", "ISC", "Unlicense", "(MIT AND Zlib)"]);
const manual = new Map([
  ["node_modules/buffers", "MIT; npm metadata is blank, resolved by upstream commit and Debian source record in THIRD_PARTY_NOTICES.md"],
  ["node_modules/jszip", "MIT selected from (MIT OR GPL-3.0-or-later); notice recorded in THIRD_PARTY_NOTICES.md"],
]);
const failures = [];
const resolutions = [];
for (const [path, data] of Object.entries(lock.packages || {})) {
  if (!path || data.dev === true) continue;
  const resolution = manual.get(path);
  if (resolution) { resolutions.push(`${path}: ${resolution}`); continue; }
  if (typeof data.license !== "string") { failures.push(`${path}: missing license metadata and no reviewed resolution`); continue; }
  if (!allowed.has(data.license)) failures.push(`${path}: unreviewed license ${data.license}`);
}
if (failures.length) {
  process.stderr.write(`Runtime license check failed:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Runtime license check passed.\n${resolutions.map((item) => `- ${item}`).join("\n")}\n`);
