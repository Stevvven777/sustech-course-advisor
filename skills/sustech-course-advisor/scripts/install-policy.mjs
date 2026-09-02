#!/usr/bin/env node
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const [operation, ...args] = process.argv.slice(2);

function rejectLauncherControlCharacters(value, label) {
  if (/[\0\r\n]/.test(value)) throw new Error(`${label} cannot contain control characters.`);
  return value;
}

function posixQuote(value) {
  return `'${rejectLauncherControlCharacters(value, "Launcher path").replaceAll("'", `'"'"'`)}'`;
}

function batchValue(value) {
  const safe = rejectLauncherControlCharacters(value, "Launcher path");
  if (safe.includes('"')) throw new Error("Windows launcher paths cannot contain double quotes.");
  return safe.replaceAll("%", "%%");
}

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
  const expectedAdvisorSpecifier = `file:../releases/sustech-course-advisor-${advisorVersion}.tgz`;
  const consumerManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const consumerLock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  const lockedAdvisor = consumerLock.packages?.["node_modules/sustech-course-advisor"];
  if (consumerManifest.dependencies?.["sustech-course-advisor"] !== expectedAdvisorSpecifier) {
    throw new Error("Installed advisor no longer points to the verified GitHub Release archive.");
  }
  if (!lockedAdvisor || lockedAdvisor.link === true || lockedAdvisor.resolved !== expectedAdvisorSpecifier) {
    throw new Error("Installed advisor lock entry is not the verified GitHub Release archive.");
  }
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
} else if (operation === "launchers") {
  const [rootInput, binInput, nodeInput] = args;
  if (!rootInput || !binInput || !nodeInput) throw new Error("launchers requires package root, bin root, and Node executable.");
  const root = resolve(rootInput);
  const binRoot = resolve(binInput);
  const nodeBin = resolve(nodeInput);
  const advisorEntry = join(root, "node_modules", "sustech-course-advisor", "dist", "cli.js");
  const sustechEntry = join(root, "node_modules", "sustech-cli", "dist", "cli.js");
  mkdirSync(binRoot, { recursive: true });

  if (process.platform === "win32") {
    const advisorLauncher = join(binRoot, "sustech-advisor.cmd");
    const sustechLauncher = join(binRoot, "sustech.cmd");
    writeFileSync(advisorLauncher, [
      "@echo off",
      "setlocal DisableDelayedExpansion",
      `if not defined SUSTECH_BIN set "SUSTECH_BIN=${batchValue(sustechLauncher)}"`,
      `"${batchValue(nodeBin)}" "${batchValue(advisorEntry)}" %*`,
      "exit /b %ERRORLEVEL%",
      "",
    ].join("\r\n"), "ascii");
    writeFileSync(sustechLauncher, [
      "@echo off",
      "setlocal DisableDelayedExpansion",
      `"${batchValue(nodeBin)}" "${batchValue(sustechEntry)}" %*`,
      "exit /b %ERRORLEVEL%",
      "",
    ].join("\r\n"), "ascii");
  } else {
    const advisorLauncher = join(binRoot, "sustech-advisor");
    const sustechLauncher = join(binRoot, "sustech");
    writeFileSync(advisorLauncher, [
      "#!/bin/sh",
      `SUSTECH_BIN=\${SUSTECH_BIN:-${posixQuote(sustechLauncher)}}`,
      "export SUSTECH_BIN",
      `exec ${posixQuote(nodeBin)} ${posixQuote(advisorEntry)} "$@"`,
      "",
    ].join("\n"), { mode: 0o700 });
    writeFileSync(sustechLauncher, [
      "#!/bin/sh",
      `exec ${posixQuote(nodeBin)} ${posixQuote(sustechEntry)} "$@"`,
      "",
    ].join("\n"), { mode: 0o700 });
    chmodSync(advisorLauncher, 0o700);
    chmodSync(sustechLauncher, 0o700);
  }
} else {
  throw new Error(`Unknown install-policy operation: ${operation ?? "(missing)"}.`);
}
