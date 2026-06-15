'use client';

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

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { readApiErrorMessage } from '@services/api';
import { setupService, type SetupInstallPayload, type SetupStatus } from '@services/setup/setupService';
import { useToast } from '@providers/ToastProvider';

const makeInitialForm = (): SetupInstallPayload => ({
  dbHost: 'localhost',
  dbPort: '3306',
  dbName: 'concursomestre',
  dbUser: '',
  dbPassword: '',
  appUrl: '',
  corsAllowedOrigins: '',
  appEnv: 'production',
  appTimezone: 'America/Sao_Paulo',
  setupToken: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPasswordConfirmation: '',
});

const CHECK_LABELS: Record<string, string> = {
  envFileExists: '.env',
  setupCompletedFlag: 'Setup concluido',
  dbConfigured: 'Banco configurado',
  dbReachable: 'Conexao com banco',
  usersTableExists: 'Tabela users',
  adminUserExists: 'Administrador',
  schemaFileExists: 'Schema SQL',
  envWritable: '.env gravavel',
  setupTokenAvailable: 'Chave local',
  existingConfigurationLocked: 'Reconfiguracao bloqueada',
};

const READINESS_LABELS: Record<string, string> = {
  database_charset_nao_utf8mb4: 'Charset diferente de utf8mb4',
  tabelas_essenciais_ausentes: 'Tabelas essenciais ausentes',
  engine_nao_innodb: 'Tabelas fora de InnoDB',
  users_schema_incompleto: 'Schema de usuarios incompleto',
  indices_criticos_ausentes: 'Indices criticos ausentes',
};

const SetupStatusGrid: React.FC<{ status: SetupStatus | null }> = ({ status }) => {
  if (!status) return null;

  const checkEntries = Object.entries(status.checks).filter(([key, value]) => (
    typeof value === 'boolean'
    && key in CHECK_LABELS
    && (key !== 'existingConfigurationLocked' || value)
  ));
  const readiness = status.checks.databaseReadiness as {
    status?: string;
    issues?: string[];
    recommendations?: string[];
    charset?: string | null;
    collation?: string | null;
  } | undefined;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">Diagnostico</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{status.message || 'Status da instalacao'}</h2>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${
          status.installed
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30'
            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30'
        }`}>
          {status.installed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {status.installed ? 'Configurado' : 'Setup pendente'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {checkEntries.map(([key, value]) => (
          <div key={key} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{CHECK_LABELS[key]}</p>
            <p className={`mt-2 flex items-center gap-2 text-sm font-black ${value ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
              {value ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {key === 'existingConfigurationLocked' ? (value ? 'Bloqueada' : 'Livre') : (value ? 'OK' : 'Pendente')}
            </p>
          </div>
        ))}
      </div>

      {readiness && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Banco para producao</p>
              <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                {readiness.charset || '-'} / {readiness.collation || '-'}
              </p>
            </div>
            <span className={`rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${
              readiness.status === 'ok'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
            }`}>
              {readiness.status === 'ok' ? 'Pronto' : 'Revisar'}
            </span>
          </div>

          {Array.isArray(readiness.issues) && readiness.issues.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {readiness.issues.map((issue) => (
                <span key={issue} className="rounded-md bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-200 dark:bg-slate-950 dark:text-amber-200 dark:ring-amber-400/30">
                  {READINESS_LABELS[issue] || issue}
                </span>
              ))}
            </div>
          )}

          {Array.isArray(readiness.recommendations) && readiness.recommendations.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              {readiness.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

const SetupPage: React.FC = () => {
  const router = useRouter();
  const { addToast } = useToast();
  const [status, setStatus] = React.useState<SetupStatus | null>(null);
  const [form, setForm] = React.useState<SetupInstallPayload>(() => makeInitialForm());
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const nextStatus = await setupService.getStatus();
      setStatus(nextStatus);
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Nao foi possivel consultar o status do setup.'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const origin = window.location.origin;
      setForm((current) => ({
        ...current,
        appUrl: current.appUrl || origin,
        corsAllowedOrigins: current.corsAllowedOrigins || origin,
      }));
      void loadStatus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [loadStatus]);

  const updateField = <K extends keyof SetupInstallPayload>(field: K, value: SetupInstallPayload[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await setupService.install(form);
      window.sessionStorage.removeItem('cm_setup_status_checked_at');
      addToast('Configuracao inicial concluida.', 'success');
      router.replace(result.nextUrl || '/auth');
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Nao foi possivel concluir a configuracao inicial.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.28em] text-indigo-600 dark:text-indigo-300">ConcursoMestre</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Configuracao inicial</h1>
          </div>
          <button
            type="button"
            onClick={() => void loadStatus()}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </header>

        {isLoading ? (
          <section className="flex min-h-72 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <Loader2 className="animate-spin text-indigo-500" size={34} />
          </section>
        ) : (
          <>
            <SetupStatusGrid status={status} />

            {status?.installed ? (
              <section className="rounded-md border border-emerald-200 bg-emerald-50 p-6 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={26} />
                    <div>
                      <h2 className="text-xl font-black">Plataforma configurada</h2>
                      <p className="text-sm font-semibold opacity-80">O instalador esta bloqueado porque ja existe administrador.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.replace('/auth')}
                    className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-emerald-700"
                  >
                    Entrar
                  </button>
                </div>
              </section>
            ) : (
              <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
                <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-5 flex items-center gap-3">
                    <Database className="text-indigo-600 dark:text-indigo-300" size={22} />
                    <h2 className="text-xl font-black">Banco de dados</h2>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      Host
                      <input value={form.dbHost} onChange={(event) => updateField('dbHost', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      Porta
                      <input value={form.dbPort} onChange={(event) => updateField('dbPort', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      Nome do banco
                      <input value={form.dbName} onChange={(event) => updateField('dbName', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      Usuario do banco
                      <input value={form.dbUser} onChange={(event) => updateField('dbUser', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold sm:col-span-2">
                      Senha do banco
                      <input type="password" value={form.dbPassword} onChange={(event) => updateField('dbPassword', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" />
                    </label>
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-5 flex items-center gap-3">
                    <LockKeyhole className="text-indigo-600 dark:text-indigo-300" size={22} />
                    <h2 className="text-xl font-black">Aplicacao</h2>
                  </div>

                  <div className="grid gap-4">
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      URL publica
                      <input value={form.appUrl} onChange={(event) => updateField('appUrl', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      Origens CORS
                      <input value={form.corsAllowedOrigins} onChange={(event) => updateField('corsAllowedOrigins', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-bold">
                        Ambiente
                        <select value={form.appEnv} onChange={(event) => updateField('appEnv', event.target.value as SetupInstallPayload['appEnv'])} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900">
                          <option value="production">Producao</option>
                          <option value="staging">Homologacao</option>
                          <option value="development">Desenvolvimento</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-bold">
                        Timezone
                        <input value={form.appTimezone} onChange={(event) => updateField('appTimezone', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                      </label>
                    </div>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                      Chave de instalacao
                      <input
                        type="password"
                        value={form.setupToken}
                        onChange={(event) => updateField('setupToken', event.target.value)}
                        className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900"
                        required
                      />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Leia esta chave no servidor em {status?.setupToken?.path || 'storage/setup/install.key'}.
                      </span>
                    </label>
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:col-span-2">
                  <div className="mb-5 flex items-center gap-3">
                    <UserPlus className="text-indigo-600 dark:text-indigo-300" size={22} />
                    <h2 className="text-xl font-black">Primeiro administrador</h2>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-4">
                    <label className="flex flex-col gap-2 text-sm font-bold lg:col-span-2">
                      Nome
                      <input value={form.adminName} onChange={(event) => updateField('adminName', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold lg:col-span-2">
                      E-mail
                      <input type="email" value={form.adminEmail} onChange={(event) => updateField('adminEmail', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold lg:col-span-2">
                      Senha
                      <input type="password" value={form.adminPassword} onChange={(event) => updateField('adminPassword', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold lg:col-span-2">
                      Confirmar senha
                      <input type="password" value={form.adminPasswordConfirmation} onChange={(event) => updateField('adminPasswordConfirmation', event.target.value)} className="h-12 rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900" required />
                    </label>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <p className="max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">
                      O instalador sera bloqueado apos a criacao do administrador e gravara `SETUP_COMPLETED=true` no backend.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting || !status?.canInstall}
                      className="inline-flex h-12 min-w-52 items-center justify-center gap-2 rounded-md bg-indigo-600 px-6 text-sm font-black uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                      Instalar
                    </button>
                  </div>
                </section>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default SetupPage;
