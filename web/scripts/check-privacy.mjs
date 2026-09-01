#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z', 'web'], { encoding:'utf8', cwd:'..' }).split('\0').filter(Boolean);
const findings = [];
for (const repositoryPath of files) {
  const path = repositoryPath.replace(/^web\//, '');
  if (/(^|\/)(?:\.env|snapshots?|student-data|personal-data)(?:\/|$)/i.test(path)) findings.push(`${repositoryPath}: forbidden local-data path`);
  if (path === 'scripts/check-privacy.mjs') continue;
  let content;
  try { content = readFileSync(path, 'utf8'); } catch { continue; }
  for (const [label, pattern] of [
    ['absolute macOS user path', /\/Users\/[A-Za-z0-9._-]+\//],
    ['absolute Windows user path', /[A-Za-z]:\\Users\\[^\\\r\n]+\\/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/],
    ['npm token', /npm_[A-Za-z0-9]{20,}/],
  ]) if (pattern.test(content)) findings.push(`${repositoryPath}: ${label}`);
}
const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
if (hosting.project_id !== null) findings.push('web/.openai/hosting.json: project_id must remain null in this unbound PR');
if (findings.length) {
  process.stderr.write(`Web privacy scan failed:\n${findings.map((item) => `- ${item}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Web privacy scan passed for ${files.length} tracked files.\n`);
