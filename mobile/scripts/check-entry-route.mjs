import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = process.cwd();
const entryPath = path.join(mobileRoot, 'app', 'index.tsx');

if (!fs.existsSync(entryPath)) {
  console.error('Mobile entry route FAILED: mobile/app/index.tsx ausente.');
  process.exit(1);
}

const source = fs.readFileSync(entryPath, 'utf8');
const required = [
  "Redirect",
  "useAuth",
  "'/questoes'",
  "'/login'",
];

const missing = required.filter((token) => !source.includes(token));
if (missing.length > 0) {
  console.error(`Mobile entry route FAILED: faltam tokens obrigatorios: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Mobile entry route PASS');
