#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ignoredPaths = [
  /^backend\/tests\//,
  /(^|\/)\.env(?:\..+)?\.example$/,
  /(^|\/)\.env\.example$/,
];

const checks = [
  { name: 'Google AI key', pattern: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: 'OpenAI secret key', pattern: /sk-(?:proj-)?[0-9A-Za-z_-]{20,}/g },
  { name: 'Stripe secret key', pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g },
  { name: 'Stripe webhook secret', pattern: /whsec_[0-9A-Za-z]{16,}/g },
  { name: 'Private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !ignoredPaths.some((pattern) => pattern.test(file)));

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(resolve(file), 'utf8');
  } catch {
    continue;
  }

  for (const check of checks) {
    const match = content.match(check.pattern)?.[0];
    if (match) {
      findings.push(`${file}: ${check.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error('[secrets] Segredo potencial rastreado pelo Git:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log('[secrets] OK: nenhum segredo de provedor, webhook ou chave privada rastreado.');
