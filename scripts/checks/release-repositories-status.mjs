import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));

const readArgValue = (name, fallback = undefined) => {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
};

const frontendRoot = path.resolve(readArgValue('frontend-root', process.cwd()));
const backendRoot = path.resolve(readArgValue('backend-root', process.env.BACKEND_ROOT || 'C:/xampp/htdocs/questao-pro-backend'));
const strict = args.has('--strict') || process.env.RELEASE_REPOS_STRICT === 'true';
const jsonOnly = args.has('--json');
const reportFile = readArgValue('report-file', process.env.RELEASE_REPOS_REPORT_FILE);

const runGit = (cwd, gitArgs, options = {}) => {
  const result = spawnSync('git', gitArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
};

const parsePorcelainStatus = (stdout) => stdout
  .split(/\r?\n/)
  .map((line) => line.trimEnd())
  .filter(Boolean)
  .map((line) => ({
    code: line.slice(0, 2),
    path: line.slice(3),
  }));

const isRiskyTrackedPath = (filePath) => {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.posix.basename(normalized);

  if (base === '.env' || base === '.env.local' || base === '.env.production') {
    return true;
  }

  const isAllowedSqlSource = normalized.startsWith('database/migrations/')
    || normalized.startsWith('database/seeds/')
    || normalized === 'database/schema.sql'
    || normalized.startsWith('docs/examples/');

  if ((normalized.endsWith('.sql') || normalized.endsWith('.sql.gz')) && !isAllowedSqlSource) {
    return true;
  }

  if (normalized.endsWith('.log')) {
    return true;
  }

  return (normalized.startsWith('storage/backups/') && base !== '.gitignore')
    || (normalized.startsWith('runtime/') && base !== '.gitignore')
    || (normalized.startsWith('uploads/') && base !== '.gitignore')
    || normalized.includes('/storage/backups/');
};

const inspectRepo = (name, root) => {
  const repo = {
    name,
    root,
    exists: fs.existsSync(root),
    is_git_repo: false,
    branch: null,
    head: null,
    upstream: null,
    remote_origin: null,
    dirty_count: 0,
    modified_count: 0,
    untracked_count: 0,
    ahead: null,
    behind: null,
    risky_tracked_files: [],
    warnings: [],
    errors: [],
  };

  if (!repo.exists) {
    repo.errors.push(`Diretorio nao encontrado: ${root}`);
    return repo;
  }

  const topLevel = runGit(root, ['rev-parse', '--show-toplevel']);
  if (!topLevel.ok) {
    repo.errors.push('Nao e um repositorio Git.');
    return repo;
  }

  repo.is_git_repo = true;
  repo.root = path.resolve(topLevel.stdout);
  repo.branch = runGit(repo.root, ['branch', '--show-current']).stdout || '(detached)';
  repo.head = runGit(repo.root, ['rev-parse', '--short=12', 'HEAD']).stdout || null;
  repo.remote_origin = runGit(repo.root, ['remote', 'get-url', 'origin']).stdout || null;

  if (!repo.remote_origin) {
    repo.errors.push('Remote origin nao configurado.');
  }

  const upstream = runGit(repo.root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.ok) {
    repo.upstream = upstream.stdout;
    const counts = runGit(repo.root, ['rev-list', '--left-right', '--count', `${repo.upstream}...HEAD`]);
    if (counts.ok) {
      const [behind, ahead] = counts.stdout.split(/\s+/).map((value) => Number.parseInt(value, 10));
      repo.behind = Number.isFinite(behind) ? behind : null;
      repo.ahead = Number.isFinite(ahead) ? ahead : null;
    }
  } else {
    repo.warnings.push('Branch sem upstream configurado; push/pull de release precisa ser manualmente conferido.');
  }

  const status = parsePorcelainStatus(runGit(repo.root, ['status', '--porcelain']).stdout);
  repo.dirty_count = status.length;
  repo.modified_count = status.filter((entry) => entry.code !== '??').length;
  repo.untracked_count = status.filter((entry) => entry.code === '??').length;
  if (repo.dirty_count > 0) {
    repo.warnings.push(`Worktree possui ${repo.dirty_count} alteracao(oes) local(is).`);
  }

  const trackedFiles = runGit(repo.root, ['ls-files']).stdout.split(/\r?\n/).filter(Boolean);
  repo.risky_tracked_files = trackedFiles.filter(isRiskyTrackedPath);
  if (repo.risky_tracked_files.length > 0) {
    repo.errors.push('Arquivos sensiveis/operacionais rastreados pelo Git.');
  }

  if ((repo.ahead ?? 0) > 0) {
    repo.warnings.push(`Branch possui ${repo.ahead} commit(s) local(is) ainda nao enviado(s).`);
  }

  if ((repo.behind ?? 0) > 0) {
    repo.warnings.push(`Branch esta ${repo.behind} commit(s) atras do upstream.`);
  }

  return repo;
};

const frontend = inspectRepo('frontend', frontendRoot);
const backend = inspectRepo('backend', backendRoot);
const repositories = [frontend, backend];

const sameRepository = frontend.is_git_repo
  && backend.is_git_repo
  && path.resolve(frontend.root).toLowerCase() === path.resolve(backend.root).toLowerCase();

const warnings = [];
const errors = [];

if (sameRepository) {
  errors.push('Frontend e backend apontam para o mesmo repositorio; o release esperado usa repositorios separados.');
}

for (const repo of repositories) {
  warnings.push(...repo.warnings.map((message) => `${repo.name}: ${message}`));
  errors.push(...repo.errors.map((message) => `${repo.name}: ${message}`));
}

if (strict) {
  for (const repo of repositories) {
    if (repo.dirty_count > 0) {
      errors.push(`${repo.name}: modo strict nao permite worktree suja.`);
    }
    if (!repo.upstream) {
      errors.push(`${repo.name}: modo strict exige upstream configurado.`);
    }
    if ((repo.ahead ?? 0) > 0 || (repo.behind ?? 0) > 0) {
      errors.push(`${repo.name}: modo strict exige branch sincronizada com upstream.`);
    }
  }
}

const payload = {
  success: errors.length === 0,
  strict,
  checked_at: new Date().toISOString(),
  repositories,
  same_repository: sameRepository,
  warnings,
  errors,
};

if (reportFile) {
  const resolvedReportFile = path.resolve(reportFile);
  fs.mkdirSync(path.dirname(resolvedReportFile), { recursive: true });
  fs.writeFileSync(resolvedReportFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

if (jsonOnly) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  console.log('[release-repos] Frontend:', `${frontend.branch}@${frontend.head || 'sem-head'}`, frontend.remote_origin || 'sem-origin');
  console.log('[release-repos] Backend :', `${backend.branch}@${backend.head || 'sem-head'}`, backend.remote_origin || 'sem-origin');
  console.log('[release-repos] Separados:', sameRepository ? 'nao' : 'sim');

  for (const warning of warnings) {
    console.warn(`[release-repos] Aviso: ${warning}`);
  }

  for (const error of errors) {
    console.error(`[release-repos] Erro: ${error}`);
  }

  if (reportFile) {
    console.log(`[release-repos] Relatorio: ${path.resolve(reportFile)}`);
  }
}

process.exit(payload.success ? 0 : 1);
