#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const lgplEntries = Object.entries(lock.packages || {}).filter(([, value]) => typeof value.license === 'string' && /LGPL/.test(value.license));
const invalid = lgplEntries.filter(([path, value]) => !path.startsWith('node_modules/@img/sharp-') || value.dev !== true || value.optional !== true);
if (invalid.length) {
  process.stderr.write(`Unreviewed LGPL package boundary:\n${invalid.map(([path, value]) => `- ${path}: ${value.license}`).join('\n')}\n`);
  process.exit(1);
}

const artifactMatches = [];
if (existsSync('dist')) {
  for (const path of files('dist')) {
    const stats = statSync(path);
    if (stats.size > 5_000_000 || !/\.(?:js|json|css|html|txt)$/i.test(path)) continue;
    if (/sharp-libvips|node_modules[\\/]sharp|libvips/i.test(readFileSync(path, 'utf8'))) artifactMatches.push(path);
  }
}
if (artifactMatches.length) {
  process.stderr.write(`Sharp/libvips unexpectedly appears in deployable output:\n${artifactMatches.map((path) => `- ${path}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`License boundary passed: ${lgplEntries.length} LGPL-tagged packages are optional development-only Sharp binaries; none appear in dist.\n`);

function files(directory) {
  return readdirSync(directory, { withFileTypes:true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
