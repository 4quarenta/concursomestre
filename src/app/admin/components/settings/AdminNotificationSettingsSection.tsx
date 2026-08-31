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
import { Bell, CheckCircle2, MessageSquareText, SlidersHorizontal } from 'lucide-react';
import type { NotificationRuleSettings, NotificationSettings } from '@types';
import { normalizeNotificationSettings } from '@constants/gamificationNotificationSettings';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

interface AdminNotificationSettingsSectionProps {
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}

const groupRulesByCategory = (rules: NotificationRuleSettings[]) => (
  rules.reduce<Record<string, NotificationRuleSettings[]>>((groups, rule) => {
    const category = rule.category || 'Outros';
    groups[category] = [...(groups[category] || []), rule];
    return groups;
  }, {})
);

const notificationToneClass = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'error':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    default:
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  }
};

const TogglePill = ({ enabled }: { enabled: boolean }) => (
  <span className={`inline-flex min-w-20 justify-center rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
    enabled
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  }`}>
    {enabled ? 'Ativa' : 'Inativa'}
  </span>
);

const AdminNotificationSettingsSection = ({
  settings,
  onChange,
}: AdminNotificationSettingsSectionProps) => {
  const normalizedSettings = React.useMemo(() => normalizeNotificationSettings(settings), [settings]);
  const groupedRules = React.useMemo(() => groupRulesByCategory(normalizedSettings.rules), [normalizedSettings.rules]);
  const enabledRules = normalizedSettings.rules.filter((rule) => rule.enabled).length;
  const visibleCategories = Object.keys(groupedRules).length;

  const emitChange = (nextSettings: NotificationSettings) => {
    onChange({
      ...normalizeNotificationSettings(nextSettings),
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

  const updateRule = (ruleKey: string, patch: Partial<NotificationRuleSettings>) => {
    emitChange({
      ...normalizedSettings,
      rules: normalizedSettings.rules.map((rule) => (
        rule.key === ruleKey ? { ...rule, ...patch } : rule
      )),
    });
  };

  return (
    <div className="space-y-5">
      <div className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
              <Bell size={20} className="text-sky-700 dark:text-sky-300" />
              Central de notificacoes
            </h3>
            <p className="mt-2 max-w-3xl text-xs font-medium text-slate-500 dark:text-slate-400">
              Controle os eventos que geram notificacoes para alunos e administradores. Regras pausadas bloqueiam novos avisos equivalentes quando passam pelo helper central.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGlobalEnabled(!normalizedSettings.enabled)}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em]`}
          >
            <SlidersHorizontal size={14} />
            {normalizedSettings.enabled ? 'Desativar notificacoes' : 'Ativar notificacoes'}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status geral</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{normalizedSettings.enabled ? 'Ativas' : 'Pausadas'}</p>
          </div>
          <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Regras ativas</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{enabledRules}/{normalizedSettings.rules.length}</p>
          </div>
          <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Categorias</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{visibleCategories}</p>
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
                <MessageSquareText size={16} className="text-sky-700 dark:text-sky-300" />
                {category}
              </h4>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {rules.filter((rule) => rule.enabled).length} de {rules.length} notificacoes ativas
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {rules.map((rule) => (
              <div
                key={rule.key}
                className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.25fr)_180px_100px] lg:items-start"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{rule.label}</p>
                    <span className={`rounded-sm px-2 py-1 text-[10px] font-black uppercase ${notificationToneClass(rule.type)}`}>
                      {rule.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{rule.trigger}</p>
                </div>
                <div className="grid gap-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Titulo</span>
                    <input
                      value={rule.title}
                      onChange={(event) => updateRule(rule.key, { title: event.target.value })}
                      className={`mt-1 w-full ${ADMIN_FIELD_CLASS}`}
                    />
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Mensagem</span>
                    <textarea
                      value={rule.message}
                      onChange={(event) => updateRule(rule.key, { message: event.target.value })}
                      className={`${ADMIN_TEXTAREA_CLASS} mt-1 min-h-[76px] resize-y text-xs`}
                    />
                  </label>
                </div>
                <div className="grid gap-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Tipo</span>
                    <select
                      value={rule.type || 'info'}
                      onChange={(event) => updateRule(rule.key, { type: event.target.value })}
                      className={`mt-1 w-full ${ADMIN_FIELD_CLASS}`}
                    >
                      <option value="info">Info</option>
                      <option value="success">Sucesso</option>
                      <option value="warning">Alerta</option>
                      <option value="error">Erro</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Destino</span>
                    <input
                      value={rule.link || ''}
                      placeholder="/notifications"
                      onChange={(event) => updateRule(rule.key, { link: event.target.value.trim() || null })}
                      className={`mt-1 w-full ${ADMIN_FIELD_CLASS}`}
                    />
                  </label>
                </div>
                <div className="lg:text-right">
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.key)}
                    className="inline-flex rounded-sm focus:outline-none focus:ring-2 focus:ring-sky-700 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    aria-pressed={normalizedSettings.enabled && rule.enabled}
                  >
                    <TogglePill enabled={normalizedSettings.enabled && rule.enabled} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminNotificationSettingsSection;
