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
import { CheckCircle2, SlidersHorizontal, Trophy, Zap } from 'lucide-react';
import type { GamificationRuleSettings, GamificationSettings } from '@types';
import { normalizeGamificationSettings } from '@constants/gamificationNotificationSettings';
import {
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';

interface AdminGamificationSettingsSectionProps {
  settings: GamificationSettings;
  onChange: (settings: GamificationSettings) => void;
}

const groupRulesByCategory = (rules: GamificationRuleSettings[]) => (
  rules.reduce<Record<string, GamificationRuleSettings[]>>((groups, rule) => {
    const category = rule.category || 'Outros';
    groups[category] = [...(groups[category] || []), rule];
    return groups;
  }, {})
);

const formatXp = (rule: GamificationRuleSettings) => {
  if (rule.maxXp && rule.maxXp > rule.xp) {
    return `+${rule.xp} a +${rule.maxXp} XP`;
  }

  return `+${rule.xp} XP`;
};

const formatReputation = (value?: number) => {
  const reputation = Number(value || 0);
  if (reputation === 0) return 'Sem reputacao';
  return reputation > 0 ? `+${reputation} reputacao` : `${reputation} reputacao`;
};

const TogglePill = ({ enabled }: { enabled: boolean }) => (
  <span className={`inline-flex min-w-20 justify-center rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
    enabled
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  }`}>
    {enabled ? 'Ativo' : 'Inativo'}
  </span>
);

const AdminGamificationSettingsSection = ({
  settings,
  onChange,
}: AdminGamificationSettingsSectionProps) => {
  const normalizedSettings = React.useMemo(() => normalizeGamificationSettings(settings), [settings]);
  const groupedRules = React.useMemo(() => groupRulesByCategory(normalizedSettings.rules), [normalizedSettings.rules]);
  const enabledRules = normalizedSettings.rules.filter((rule) => rule.enabled).length;
  const maxXpShown = normalizedSettings.rules.reduce((total, rule) => total + Math.max(rule.xp || 0, rule.maxXp || 0), 0);

  const emitChange = (nextSettings: GamificationSettings) => {
    onChange({
      ...normalizeGamificationSettings(nextSettings),
      updatedAt: new Date().toISOString(),
    });
  };

  const setGlobalEnabled = (enabled: boolean) => {
    emitChange({ ...normalizedSettings, enabled });
  };

  const setAllRules = (enabled: boolean) => {
    emitChange({
      ...normalizedSettings,
      rules: normalizedSettings.rules.map((rule) => ({ ...rule, enabled })),
    });
  };

  const toggleRule = (ruleKey: string) => {
    emitChange({
      ...normalizedSettings,
      rules: normalizedSettings.rules.map((rule) => (
        rule.key === ruleKey ? { ...rule, enabled: !rule.enabled } : rule
      )),
    });
  };

  return (
    <div className="space-y-5">
      <div className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
              <Trophy size={20} className="text-amber-600 dark:text-amber-300" />
              Gamificacao e XP
            </h3>
            <p className="mt-2 max-w-3xl text-xs font-medium text-slate-500 dark:text-slate-400">
              Controle o que gera XP, reputacao e badges na plataforma. Regras desativadas deixam de aplicar novos eventos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGlobalEnabled(!normalizedSettings.enabled)}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em]`}
          >
            <SlidersHorizontal size={14} />
            {normalizedSettings.enabled ? 'Desativar gamificacao' : 'Ativar gamificacao'}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status geral</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{normalizedSettings.enabled ? 'Ativa' : 'Pausada'}</p>
          </div>
          <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Regras ativas</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{enabledRules}/{normalizedSettings.rules.length}</p>
          </div>
          <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Mapa de XP</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{maxXpShown}+ XP</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAllRules(true)}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
          >
            <CheckCircle2 size={14} />
            Ativar todas
          </button>
          <button
            type="button"
            onClick={() => setAllRules(false)}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
          >
            Pausar todas
          </button>
        </div>
      </div>

      {Object.entries(groupedRules).map(([category, rules]) => (
        <div key={category} className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
          <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex items-center justify-between gap-3`}>
            <div>
              <h4 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                <Zap size={16} className="text-sky-700 dark:text-sky-300" />
                {category}
              </h4>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {rules.filter((rule) => rule.enabled).length} de {rules.length} regras ativas
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {rules.map((rule) => (
              <button
                key={rule.key}
                type="button"
                onClick={() => toggleRule(rule.key)}
                className="grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_160px_140px_92px] md:items-center dark:hover:bg-slate-950/60"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{rule.label}</p>
                    <span className="rounded-sm bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {rule.eventName}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{rule.description}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">XP</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatXp(rule)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Repeticao</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{rule.repeatability || '-'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{formatReputation(rule.reputation)}</p>
                </div>
                <div className="md:text-right">
                  <TogglePill enabled={normalizedSettings.enabled && rule.enabled} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminGamificationSettingsSection;
