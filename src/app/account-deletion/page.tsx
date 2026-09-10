import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Exclusão de conta | ConcursoMestre',
  description: 'Como solicitar a exclusão da sua conta e dos dados associados ao ConcursoMestre.',
  robots: { index: true, follow: true },
};

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Privacidade e conta
          </p>
          <h1 className="text-3xl font-black tracking-tight">Exclusão de conta</h1>
          <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
            Usuários do ConcursoMestre podem solicitar a exclusão da própria conta pelo aplicativo ou pela plataforma web.
            Por segurança, a solicitação exige autenticação da conta antes de ser registrada.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black">Solicitar pela plataforma web</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-600 dark:text-slate-300">
            <li>Entre na sua conta do ConcursoMestre.</li>
            <li>Abra Perfil e acesse a área de Segurança.</li>
            <li>Localize “Excluir Conta”, informe o motivo solicitado e confirme a verificação de segurança.</li>
            <li>Confirme a solicitação. A sessão será encerrada após o registro do pedido.</li>
          </ol>
          <Link
            href="/profile/security"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            Acessar exclusão de conta
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black">Solicitar pelo aplicativo</h2>
          <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
            No aplicativo ConcursoMestre, abra a aba Conta e use a seção “Exclusão da conta”. A confirmação exige a senha atual.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black">Dados e retenção</h2>
          <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
            A solicitação inicia o processo de exclusão da conta e dos dados associados. Informações que precisem ser mantidas
            por obrigação legal, fiscal, prevenção a fraude, exercício regular de direitos ou outra base legal aplicável podem
            permanecer pelo período necessário, conforme descrito na Política de Privacidade.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">
            <Link href="/privacy">Política de Privacidade</Link>
            <Link href="/terms">Termos de Uso</Link>
            <Link href="/support">Suporte</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
