'use client';

import { Copy, Facebook, Linkedin, MessageCircle, Send, Share2 } from 'lucide-react';
import { useToast } from '@/providers/ToastProvider';

type BlogShareBarProps = {
  title: string;
  url: string;
};

const popupFeatures = 'noopener,noreferrer,width=720,height=620';

export default function BlogShareBar({ title, url }: BlogShareBarProps) {
  const { addToast } = useToast();
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const openShare = (target: string) => {
    window.open(target, '_blank', popupFeatures);
  };

  const actions = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      onClick: () => openShare(`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`),
    },
    {
      label: 'Telegram',
      icon: Send,
      onClick: () => openShare(`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`),
    },
    {
      label: 'Facebook',
      icon: Facebook,
      onClick: () => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`),
    },
    {
      label: 'LinkedIn',
      icon: Linkedin,
      onClick: () => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Compartilhar notícia">
      <span className="mr-1 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
        <Share2 size={15} /> Compartilhar
      </span>
      {actions.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          title={`Compartilhar no ${label}`}
          aria-label={`Compartilhar no ${label}`}
          className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        >
          <Icon size={16} />
        </button>
      ))}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          addToast('Link copiado.', 'success');
        }}
        title="Copiar link"
        aria-label="Copiar link"
        className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
      >
        <Copy size={16} />
      </button>
    </div>
  );
}
