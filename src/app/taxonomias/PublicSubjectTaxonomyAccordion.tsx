'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, CircleDot, LoaderCircle } from 'lucide-react';
import type { PublicTaxonomyDirectoryItem } from './taxonomyDirectoryServerData';

type PublicTaxonomyChild = {
  id: number;
  name: string;
  slug: string;
  taxonomyLevel: string;
  questionCount: number;
  hasChildren: boolean;
};

type HierarchyPage = {
  items: PublicTaxonomyChild[];
  pageInfo: { page: number; pages: number; total: number; hasMore: boolean };
};

const EMPTY_PAGE: HierarchyPage = {
  items: [],
  pageInfo: { page: 1, pages: 1, total: 0, hasMore: false },
};

const readHierarchyPage = (payload: unknown): HierarchyPage => {
  if (!payload || typeof payload !== 'object') return EMPTY_PAGE;
  const envelope = payload as { data?: unknown };
  const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : payload) as Partial<HierarchyPage>;
  const pageInfo = data.pageInfo || EMPTY_PAGE.pageInfo;

  return {
    items: Array.isArray(data.items) ? data.items.map((item) => ({
      id: Number(item.id || 0),
      name: String(item.name || '').trim(),
      slug: String(item.slug || '').trim(),
      taxonomyLevel: String(item.taxonomyLevel || 'assunto').trim().toLowerCase(),
      questionCount: Math.max(0, Number(item.questionCount || 0)),
      hasChildren: Boolean(item.hasChildren),
    })).filter((item) => item.id > 0 && item.name !== '') : [],
    pageInfo: {
      page: Math.max(1, Number(pageInfo.page || 1)),
      pages: Math.max(1, Number(pageInfo.pages || 1)),
      total: Math.max(0, Number(pageInfo.total || 0)),
      hasMore: Boolean(pageInfo.hasMore),
    },
  };
};

function TaxonomyBranch({ parentId, depth = 0 }: { parentId: number; depth?: number }) {
  const [items, setItems] = useState<PublicTaxonomyChild[]>([]);
  const [pageInfo, setPageInfo] = useState(EMPTY_PAGE.pageInfo);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const loadPage = useCallback(async (page: number, signal?: AbortSignal) => {
    setStatus('loading');
    try {
      const response = await fetch(`/api/filters/directory.php?view=hierarchy&parent_id=${parentId}&page=${page}&per_page=50`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      if (!response.ok) throw new Error('hierarchy_request_failed');
      const nextPage = readHierarchyPage(await response.json());
      setItems((current) => page === 1
        ? nextPage.items
        : [...current, ...nextPage.items.filter((item) => !current.some((entry) => entry.id === item.id))]);
      setPageInfo(nextPage.pageInfo);
      setStatus('ready');
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') setStatus('error');
    }
  }, [parentId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPage(1, controller.signal);
    return () => controller.abort();
  }, [loadPage]);

  if (status === 'loading' && items.length === 0) {
    return <div className="flex items-center gap-2 px-4 py-4 text-xs font-bold text-slate-400"><LoaderCircle size={15} className="animate-spin" /> Carregando taxonomias...</div>;
  }
  if (status === 'error' && items.length === 0) {
    return <button type="button" onClick={() => void loadPage(1)} className="mx-4 my-3 text-xs font-bold text-rose-600 hover:underline">Não foi possível carregar. Tentar novamente</button>;
  }
  if (items.length === 0) {
    return <p className="px-4 py-4 text-xs font-medium text-slate-400">Nenhum tópico ou assunto publicado neste ramo.</p>;
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((item) => <TaxonomyTreeItem key={item.id} item={item} depth={depth} />)}
      {pageInfo.hasMore ? (
        <div className="p-3">
          <button type="button" disabled={status === 'loading'} onClick={() => void loadPage(pageInfo.page + 1)} className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:border-[#615fff]/40 hover:text-[#615fff] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {status === 'loading' ? 'Carregando...' : 'Carregar mais'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TaxonomyTreeItem({ item, depth }: { item: PublicTaxonomyChild; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const queryKey = item.taxonomyLevel === 'topico' ? 'topico' : 'assunto';
  const levelLabel = item.taxonomyLevel === 'topico' ? 'Tópico' : 'Assunto';

  return (
    <div>
      <div className="flex min-h-14 items-center gap-2 px-3 py-2 sm:px-4" style={{ paddingLeft: `${Math.min(16 + depth * 18, 70)}px` }}>
        {item.hasChildren ? (
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={`${expanded ? 'Ocultar' : 'Mostrar'} itens de ${item.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-[#615fff] dark:hover:bg-indigo-500/10">
            <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        ) : <span className="grid h-8 w-8 shrink-0 place-items-center text-slate-300"><CircleDot size={12} /></span>}
        <Link href={{ pathname: '/practice', query: { [queryKey]: item.name } }} prefetch={false} className="min-w-0 flex-1 py-1 hover:text-[#615fff]">
          <span className="block truncate text-sm font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">{levelLabel}</span>
        </Link>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">{item.questionCount.toLocaleString('pt-BR')} questões</span>
      </div>
      {expanded ? <div className="border-t border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40"><TaxonomyBranch parentId={item.id} depth={depth + 1} /></div> : null}
    </div>
  );
}

export default function PublicSubjectTaxonomyAccordion({ item }: { item: PublicTaxonomyDirectoryItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="overflow-hidden bg-white transition-colors dark:bg-slate-900">
      <div className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/40 sm:px-5">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[#615fff] dark:bg-indigo-500/10 dark:text-indigo-300"><BookOpen size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Mostrar tópicos e assuntos</span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180 text-[#615fff]' : ''}`} />
        </button>
        <Link href={{ pathname: '/practice', query: { materia: item.name } }} prefetch={false} className="hidden shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 transition-colors hover:bg-indigo-50 hover:text-[#615fff] sm:inline-flex dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-500/10">
          {item.questionCount.toLocaleString('pt-BR')} questões
        </Link>
      </div>
      {expanded ? <div className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30"><TaxonomyBranch parentId={item.id} /></div> : null}
    </article>
  );
}
