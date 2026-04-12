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

import { useState } from 'react';
import type { SystemSettings } from '@types';

interface UseAdminImportSettingsBridgeOptions {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => Promise<any> | any;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings> | SystemSettings;
}

export const useAdminImportSettingsBridge = ({
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
}: UseAdminImportSettingsBridgeOptions) => {
  const [isSavingImportSettings, setIsSavingImportSettings] = useState(false);

  const handleGeminiApiKeyChange = (value: string) => {
    updateSystemSettings({
      ...systemSettings,
      geminiApiKey: value,
    });
  };

  const handleSaveImportSettings = async () => {
    if (isSavingImportSettings) {
      return;
    }

    setIsSavingImportSettings(true);
    try {
      await saveSystemSettingsNow({
        ...systemSettings,
      });
    } finally {
      setIsSavingImportSettings(false);
    }
  };

  return {
    handleGeminiApiKeyChange,
    handleSaveImportSettings,
    isSavingImportSettings,
  };
};
