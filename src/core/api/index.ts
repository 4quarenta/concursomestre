// Core API Exports

// Client
export {
    apiClient,
    getAssetUrl,
    buildDownloadUrl,
    buildMaterialAccessEndpoint,
    buildMaterialDownloadEndpoint,
    downloadAuthenticatedFile,
    openAuthenticatedFile,
} from './client';
export { default as default } from './client';

// Endpoints
export { ENDPOINTS } from './endpoints';
export { default as endpoints } from './endpoints';

// Types
export type { ApiResponse, PaginatedResponse, ApiError } from './types';
