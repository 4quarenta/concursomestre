#!/usr/bin/env node
/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE_PATH = path.resolve(SCRIPT_DIR, '..', '..', 'docs', 'reports', 'artifacts', 'hard-refresh-baseline-latest.json');
const BASELINE_PATH = process.env.CM_BASELINE_OUTPUT_PATH || DEFAULT_BASELINE_PATH;

const DEFAULT_ROUTE_BUDGETS = {
  '/dashboard': {
    maxXhrFetchRequests: 3,
    maxLoadMs: 1500,
  },
  '/questoes': {
    maxXhrFetchRequests: 4,
    maxLoadMs: 1800,
  },
  '/admin/panel/dashboard': {
    maxXhrFetchRequests: 3,
    maxLoadMs: 2000,
  },
  '/admin/support/comments': {
    maxXhrFetchRequests: 4,
    maxLoadMs: 2200,
  },
};

const parseBudgets = () => {
  if (!process.env.CM_HARD_REFRESH_BUDGETS_JSON) {
    return DEFAULT_ROUTE_BUDGETS;
  }

  try {
    return {
      ...DEFAULT_ROUTE_BUDGETS,
      ...JSON.parse(process.env.CM_HARD_REFRESH_BUDGETS_JSON),
    };
  } catch (error) {
    throw new Error(`CM_HARD_REFRESH_BUDGETS_JSON invalido: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const readBaseline = async () => {
  const raw = await readFile(BASELINE_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || parsed.success !== true || !Array.isArray(parsed.routes)) {
    throw new Error(`Baseline invalido em ${BASELINE_PATH}. Rode scripts/checks/hard-refresh-baseline.mjs antes.`);
  }

  return parsed;
};

const formatRouteName = (route) => route.route || route.finalUrl || 'rota-desconhecida';

const run = async () => {
  const budgets = parseBudgets();
  const baseline = await readBaseline();
  const findings = [];

  for (const route of baseline.routes) {
    const routeName = formatRouteName(route);
    const budget = budgets[routeName];
    const totals = route.totals || {};
    const duplicateRequests = Array.isArray(route.duplicateRequests) ? route.duplicateRequests : [];
    const failedRequests = Array.isArray(route.failedRequests) ? route.failedRequests : [];

    if (duplicateRequests.length > 0) {
      findings.push(`${routeName}: possui requests duplicadas (${duplicateRequests.map((item) => `${item.request} x${item.count}`).join(', ')})`);
    }

    if (failedRequests.length > 0) {
      findings.push(`${routeName}: possui requests com falha (${failedRequests.map((item) => `${item.request} x${item.count}`).join(', ')})`);
    }

    if (!budget) {
      continue;
    }

    if (Number(totals.xhrFetchRequests || 0) > Number(budget.maxXhrFetchRequests)) {
      findings.push(`${routeName}: xhr/fetch=${totals.xhrFetchRequests}, limite=${budget.maxXhrFetchRequests}`);
    }

    if (Number(totals.loadMs || 0) > Number(budget.maxLoadMs)) {
      findings.push(`${routeName}: load=${totals.loadMs}ms, limite=${budget.maxLoadMs}ms`);
    }
  }

  if (findings.length > 0) {
    console.error('Hard refresh budget falhou:');
    findings.forEach((finding) => console.error(`- ${finding}`));
    process.exit(1);
  }

  console.log('OK: hard refresh dentro do budget.');
};

await run();
