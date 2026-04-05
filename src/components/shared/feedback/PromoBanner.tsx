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
import { useData } from '@providers/DataProvider';
import { Link } from 'react-router-dom';
import { Timer, ArrowRight, X } from 'lucide-react';

const PromoBanner: React.FC = () => {
  const { systemSettings } = useData();
  const [isVisible, setIsVisible] = React.useState(true);
  const promo = systemSettings.activePromotion;
  const promoEnabled = systemSettings.features.landingPagePromoEnabled;

  if (!promo.isActive || !isVisible || !promoEnabled) return null;

  return (
    <div
      className="w-full py-2.5 px-4 flex items-center justify-between text-white text-xs md:text-sm font-bold shadow-lg relative z-50 animate-slide-down transition-all duration-300"
      style={{ backgroundColor: promo.themeColor }}
    >
      <div className="flex items-center gap-3 mx-auto">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/10">
          <Timer size={14} className="animate-pulse" />
          <span className="uppercase tracking-[0.1em] text-[10px]">{promo.bannerText}</span>
        </div>
        <Link
          to={`/promo/${promo.slug}`}
          className="bg-white text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
        >
          Aproveitar Agora <ArrowRight size={10} />
        </Link>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors"
        title="Fechar banner"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default PromoBanner;
