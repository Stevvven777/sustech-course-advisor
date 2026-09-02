#!/usr/bin/env node
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const [operation, ...args] = process.argv.slice(2);

if (operation === "prepare") {
  const [rootInput, sourceArchive, assetName, cliVersion] = args;
  if (!rootInput || !sourceArchive || !assetName || !cliVersion) throw new Error("prepare requires root, archive, asset, and CLI version.");

  const root = resolve(rootInput);
  const manifestPath = join(root, "package.json");
  if (existsSync(manifestPath)) {
    const existing = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!["packages", "sustech-course-advisor-installation"].includes(existing.name)) {
      throw new Error("Refusing to replace an unrelated package manifest.");
    }
  }

  const releaseDirectory = join(dirname(root), "releases");
  const retainedArchive = join(releaseDirectory, assetName);
  mkdirSync(releaseDirectory, { recursive: true });
  copyFileSync(sourceArchive, retainedArchive);
  const manifest = {
    name: "sustech-course-advisor-installation",
    private: true,
    version: "1.0.0",
    dependencies: {
      "sustech-course-advisor": `file:../releases/${assetName}`,
      "sustech-cli": cliVersion,
    },
    overrides: { uuid: "^11.1.1" },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  if (process.platform !== "win32") {
    chmodSync(retainedArchive, 0o600);
    chmodSync(manifestPath, 0o600);
  }
} else if (operation === "verify") {
  const [rootInput, advisorVersion, cliVersion] = args;
  if (!rootInput || !advisorVersion || !cliVersion) throw new Error("verify requires root and exact package versions.");
  const root = resolve(rootInput);
  const installedAdvisor = JSON.parse(readFileSync(join(root, "node_modules", "sustech-course-advisor", "package.json"), "utf8")).version;
  const installedCli = JSON.parse(readFileSync(join(root, "node_modules", "sustech-cli", "package.json"), "utf8")).version;
  const requireFromAdvisor = createRequire(join(root, "node_modules", "sustech-course-advisor", "package.json"));
  const exceljsPackagePath = requireFromAdvisor.resolve("exceljs/package.json");
  const requireFromExceljs = createRequire(exceljsPackagePath);
  const installedUuid = JSON.parse(readFileSync(requireFromExceljs.resolve("uuid/package.json"), "utf8")).version;
  if (installedAdvisor !== advisorVersion) throw new Error(`Expected advisor ${advisorVersion}, received ${installedAdvisor}.`);
  if (installedCli !== cliVersion) throw new Error(`Expected CLI ${cliVersion}, received ${installedCli}.`);
  const versionParts = installedUuid.split(".");
  if (versionParts.length !== 3 || versionParts.some((part) => !/^(0|[1-9]\d*)$/.test(part))) {
    throw new Error(`Installed uuid ${installedUuid} is below the stable 11.1.1 boundary.`);
  }
  const actual = versionParts.map(Number);
  const minimum = [11, 1, 1];
  for (let index = 0; index < minimum.length; index += 1) {
    if ((actual[index] ?? 0) > minimum[index]) break;
    if ((actual[index] ?? 0) < minimum[index]) throw new Error(`Installed uuid ${installedUuid} is below the stable 11.1.1 boundary.`);
  }
} else {
  throw new Error(`Unknown install-policy operation: ${operation ?? "(missing)"}.`);
}
