import type { ReactNode } from 'react';
import { adminRebuildDomains, type AdminRebuildDomainKey } from '../architecture/adminInformationArchitecture';

interface AdminShellFrameProps {
  activeDomain?: AdminRebuildDomainKey;
  children: ReactNode;
}

export default function AdminShellFrame({
  activeDomain = 'overview',
  children,
}: AdminShellFrameProps) {
  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#16211d]">
      <div className="grid min-h-screen lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="border-r border-[#d8e2dc] bg-white">
          <div className="border-b border-[#d8e2dc] px-5 py-5">
            <p className="text-xs font-black uppercase text-[#0f766e]">ConcursoMestre</p>
            <p className="mt-1 text-xl font-black tracking-normal text-[#16211d]">Admin OS</p>
            <p className="mt-2 text-sm leading-6 text-[#5f6f68]">Operacao, receita, suporte e risco em uma central.</p>
          </div>

          <nav className="space-y-1 px-3 py-4" aria-label="Dominios do admin">
            {adminRebuildDomains.map((domain) => {
              const Icon = domain.icon;
              const isActive = domain.key === activeDomain;

              return (
                <a
                  key={domain.key}
                  href={`#admin-${domain.key}`}
                  className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-transparent text-[#5f6f68] hover:border-[#d8e2dc] hover:bg-[#eef4ef] hover:text-[#16211d]'
                  }`}
                >
                  <Icon size={18} aria-hidden />
                  <span>{domain.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="sticky top-0 z-10 border-b border-[#d8e2dc] bg-white/95 px-5 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-[#5f6f68]">Rebuild privado</p>
                <p className="text-sm font-black text-[#16211d]">Arquitetura nova em construcao</p>
              </div>
              <div className="hidden min-h-10 min-w-80 items-center rounded-lg border border-[#d8e2dc] bg-[#f8faf9] px-3 text-sm text-[#5f6f68] md:flex">
                Buscar usuario, transacao, questao ou incidente...
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1440px] px-5 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
