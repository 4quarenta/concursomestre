#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const hardLimit = 4500;
const reviewThreshold = 4000;
const knownDebt = new Map(Object.entries({
  'backend/modules/subscriptions/services/SubscriptionsService.php': 7463,
  'src/app/admin/components/import/useAdminImportWorkflow.ts': 7101,
  'src/app/profile/ProfilePage.tsx': 5919,
  'src/app/lei-comentada/[slug]/page.tsx': 5211,
  'backend/modules/legal_commentary/repositories/LegalCommentaryRepository.php': 5082,
  'src/app/admin/components/finance/AdminFinance.tsx': 4563,
  'backend/modules/legal_commentary/services/LegalCommentaryAiGenerationService.php': 4535,
}));
const extensions = new Set(['.ts', '.tsx', '.php']);
const files = [];

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (extensions.has(path.extname(entry.name))) {
      files.push({
        relativePath: path.relative(process.cwd(), fullPath).replaceAll('\\', '/'),
        lines: fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).length,
      });
    }
  }
};
walk(path.resolve('src'));
walk(path.resolve('backend/modules'));

const failures = [];
const review = [];
for (const file of files) {
  const debtCeiling = knownDebt.get(file.relativePath);
  if (debtCeiling !== undefined) {
    if (file.lines > debtCeiling) failures.push(`${file.relativePath}: ${file.lines} > teto historico ${debtCeiling}`);
    review.push(file);
  } else if (file.lines > hardLimit) {
    failures.push(`${file.relativePath}: ${file.lines} > limite ${hardLimit}`);
  } else if (file.lines > reviewThreshold) {
    review.push(file);
  }
}

if (failures.length > 0) {
  console.error('[source-size] FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[source-size] PASS: nenhum arquivo novo excede ${hardLimit} linhas e a divida conhecida nao cresceu.`);
if (review.length > 0) {
  console.log('[source-size] Divida estrutural ainda aberta:');
  review.sort((a, b) => b.lines - a.lines).forEach((file) => console.log(`- ${file.relativePath}: ${file.lines}`));
}
