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

import { requestAuthenticatedResource } from '@/lib/authSession';

export type ProtectedMaterialFile = {
  blob: Blob;
  contentType: string;
  fileName: string;
};

const MATERIAL_ENDPOINTS = {
  access: 'materials/access.php',
  download: 'materials/download.php',
} as const;

const getFilenameFromDisposition = (contentDisposition: string | null, fallbackName: string) => {
  if (!contentDisposition) {
    return fallbackName;
  }

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/[/\\?%*:|"<>]/g, '_');
  }

  const simpleMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1].replace(/[/\\?%*:|"<>]/g, '_');
  }

  return fallbackName;
};

const buildMaterialEndpoint = (endpoint: string, materialId: string) => {
  const searchParams = new URLSearchParams();
  searchParams.set(endpoint === MATERIAL_ENDPOINTS.download ? 'material_id' : 'id', materialId);
  return `${endpoint}?${searchParams.toString()}`;
};

const readProtectedFile = async (endpoint: string, materialId: string): Promise<ProtectedMaterialFile> => {
  const fallbackFileName = `material-${materialId}.pdf`;
  const response = await requestAuthenticatedResource(buildMaterialEndpoint(endpoint, materialId), {
    method: 'GET',
  });

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || 'application/pdf',
    fileName: getFilenameFromDisposition(response.headers.get('content-disposition'), fallbackFileName),
  };
};

export const materialAccessService = {
  async openProtectedMaterial(materialId: string): Promise<ProtectedMaterialFile> {
    return readProtectedFile(MATERIAL_ENDPOINTS.access, materialId);
  },

  async downloadProtectedMaterial(materialId: string): Promise<ProtectedMaterialFile> {
    return readProtectedFile(MATERIAL_ENDPOINTS.download, materialId);
  },
};

export default materialAccessService;
