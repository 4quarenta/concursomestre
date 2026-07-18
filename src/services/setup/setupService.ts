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

import type { AxiosRequestConfig } from 'axios';
import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { ApiResponse } from '@services/api';

type PublicSetupRequestConfig = AxiosRequestConfig & { _skipRefreshHandling: true };

const publicSetupRequestConfig = (config: AxiosRequestConfig = {}): PublicSetupRequestConfig => ({
  ...config,
  _skipRefreshHandling: true,
});

export interface SetupStatus {
  installed?: false;
  needsSetup: boolean;
  canInstall: boolean;
  message?: string;
  checks?: Record<string, unknown> & {
    databaseReadiness?: Record<string, unknown>;
  };
}

export interface SetupInstallPayload {
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  appUrl: string;
  corsAllowedOrigins: string;
  appEnv: 'production' | 'staging' | 'development';
  appTimezone: string;
  setupToken: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirmation: string;
}

export interface SetupInstallResult {
  installed: boolean;
  admin: {
    id: string;
    email: string;
    name: string;
  };
  database: {
    name: string;
    host: string;
  };
  nextUrl: string;
}

const unwrap = <T>(response: unknown, fallback: T): T => readApiData<T>(response, fallback);

export const setupService = {
  async getStatus(): Promise<SetupStatus> {
    const response = await apiClient.get<ApiResponse<SetupStatus>>(
      ENDPOINTS.setup.status,
      publicSetupRequestConfig(),
    );

    return unwrap<SetupStatus>(response, {
      needsSetup: true,
      canInstall: false,
    });
  },

  async install(payload: SetupInstallPayload): Promise<SetupInstallResult> {
    const response = await apiClient.post<ApiResponse<SetupInstallResult>>(
      ENDPOINTS.setup.install,
      payload,
      publicSetupRequestConfig(),
    );
    return assertApiSuccess<SetupInstallResult>(response, 'Nao foi possivel concluir a configuracao inicial.').data!;
  },
};

export default setupService;
