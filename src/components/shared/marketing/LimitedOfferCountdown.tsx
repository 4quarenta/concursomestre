import React from 'react';
import { Flame } from 'lucide-react';
import { useLimitedOfferCountdown } from '@services/offers/useLimitedOfferCountdown';

interface LimitedOfferCountdownProps {
  enabled: boolean;
  endsAt?: string | null;
  className?: string;
}

const TIMEBOX_CLASS_NAME =
  'min-w-[50px] rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-center shadow-sm shadow-black/20 backdrop-blur-sm sm:min-w-[58px]';

const LimitedOfferCountdown: React.FC<LimitedOfferCountdownProps> = ({
  enabled,
  endsAt,
  className = '',
}) => {
  const countdown = useLimitedOfferCountdown(enabled, endsAt);

  if (!countdown.isActive) {
    return null;
  }

  const items = [
    { label: 'Dias', value: countdown.days },
    { label: 'Horas', value: countdown.hours },
    { label: 'Min', value: countdown.minutes },
    { label: 'Seg', value: countdown.seconds },
  ];

  return (
    <div className={`relative overflow-hidden rounded-[1.25rem] border border-amber-300/40 bg-[radial-gradient(circle_at_top_left,#1f2937_0%,#111827_45%,#0b0f1d_100%)] p-[1px] shadow-lg shadow-amber-500/20 animate-[limited-offer-pulse_1.8s_ease-in-out_infinite] ${className}`}>
      <style>{`
        @keyframes limited-offer-pulse {
          0%, 100% {
            box-shadow: 0 10px 24px rgba(245, 158, 11, 0.14);
            border-color: rgba(252, 211, 77, 0.35);
          }
          50% {
            box-shadow: 0 14px 34px rgba(245, 158, 11, 0.38);
            border-color: rgba(252, 211, 77, 0.75);
          }
        }
      `}</style>
      <div className="relative flex flex-col gap-2 rounded-[calc(1.25rem-1px)] bg-gradient-to-r from-slate-950 via-slate-900 to-[#1c130a] px-3 py-2 text-white sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left,#f59e0b33_0%,transparent_55%)]" />
        <div className="relative space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-0.5 text-[7px] font-black uppercase tracking-[0.16em] text-amber-200 sm:text-[8px]">
            Oferta por tempo limitado
          </div>
          <div className="flex items-center gap-2 text-xs font-black leading-tight tracking-tight sm:text-base">
            <Flame size={16} className="shrink-0 text-amber-300" />
            <span>O tempo está acabando! Garanta sua oferta agora.</span>
          </div>
        </div>

        <div className="relative grid grid-cols-4 gap-1.5 sm:gap-2">
          {items.map((item) => (
            <div key={item.label} className={TIMEBOX_CLASS_NAME}>
              <p className="text-base font-black leading-none tracking-tight text-amber-300 sm:text-xl">{item.value}</p>
              <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-slate-400 sm:text-[8px]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LimitedOfferCountdown;
