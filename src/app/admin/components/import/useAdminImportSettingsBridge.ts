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

import type { SystemSettings } from '@types';
import { useData } from '@providers/DataProvider';

interface UseAdminImportSettingsBridgeOptions {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => Promise<any> | any;
}

export const useAdminImportSettingsBridge = ({
  systemSettings,
  updateSystemSettings,
}: UseAdminImportSettingsBridgeOptions) => {
  const { dispatch } = useData();

  const handleGeminiApiKeyChange = (value: string) => {
    dispatch({
      type: 'UPDATE_SYSTEM_SETTINGS',
      payload: {
        ...systemSettings,
        geminiApiKey: value,
      },
    });
  };

  const handleSaveImportSettings = () => {
    return updateSystemSettings(systemSettings);
  };

  return {
    handleGeminiApiKeyChange,
    handleSaveImportSettings,
  };
};
