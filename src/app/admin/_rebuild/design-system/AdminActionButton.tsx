import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AdminActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

interface AdminActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminActionButtonVariant;
  icon?: ReactNode;
}

const variantClassNames: Record<AdminActionButtonVariant, string> = {
  primary: 'border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800',
  secondary: 'border-zinc-300 bg-white text-zinc-900 hover:border-teal-700 hover:text-teal-800',
  danger: 'border-red-700 bg-red-700 text-white hover:border-red-800 hover:bg-red-800',
  quiet: 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
};

export default function AdminActionButton({
  variant = 'secondary',
  icon,
  children,
  className = '',
  ...props
}: AdminActionButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClassNames[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
