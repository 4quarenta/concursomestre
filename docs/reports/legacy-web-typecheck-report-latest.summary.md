# Legacy Web Typecheck Report

- **Generated at:** 2026-04-18T18:28:02.350Z
- **Status:** type-errors-found
- **Command exit code:** 2
- **Total errors:** 70
- **Affected files:** 29
- **Affected domains:** 15

## Top Domains

- `app/admin`: 38
- `app/profile`: 13
- `router`: 3
- `services/subscriptions`: 3
- `providers`: 2
- `services/questions`: 2
- `app/checkout`: 1
- `app/questions`: 1
- `app/simulation`: 1
- `components/shared/layout`: 1

## Top Files

- `src/app/profile/page.tsx`: 13
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx`: 9
- `src/app/admin/components/finance/AdminFinance.tsx`: 8
- `src/app/admin/components/database/AdminDatabaseModals.tsx`: 3
- `src/app/admin/components/exams/useAdminExamBankWorkflow.ts`: 3
- `src/app/admin/components/marketing/AdminLandingPagesManager.tsx`: 3
- `src/router/index.tsx`: 3
- `src/services/subscriptions/subscriptionsService.ts`: 3
- `src/app/admin/components/database/FiltersManagementSection.tsx`: 2
- `src/app/admin/components/questions/ManualQuestionModal.tsx`: 2

## Top Error Codes

- `TS2322`: 22
- `TS2339`: 20
- `TS2345`: 12
- `TS2304`: 8
- `TS2367`: 3
- `TS2554`: 2
- `TS18047`: 1
- `TS2353`: 1
- `TS2741`: 1

## Sample Errors

- `src/app/admin/components/database/AdminDatabaseModals.tsx:121:9` TS2322: Type 'string' is not assignable to type 'DetailTab'.
- `src/app/admin/components/database/AdminDatabaseModals.tsx:152:9` TS2322: Type 'string' is not assignable to type 'number'.
- `src/app/admin/components/database/AdminDatabaseModals.tsx:159:9` TS2322: Type '(value: string) => void' is not assignable to type '(value: number) => void'.
- `src/app/admin/components/database/FiltersManagementSection.tsx:50:27` TS2339: Property 'areas' does not exist on type 'GlobalTaxonomies'.
- `src/app/admin/components/database/FiltersManagementSection.tsx:79:20` TS2339: Property 'areas' does not exist on type 'GlobalTaxonomies'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:89:5` TS2322: Type 'string' is not assignable to type 'AdminDatabaseSubTab'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:180:24` TS2304: Cannot find name 'ensureUsersLoaded'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:193:5` TS2322: Type '(settings?: any) => void | Promise<void>' is not assignable to type '(settings?: SystemSettings) => SystemSettings | Promise<SystemSettings>'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:247:5` TS2322: Type '(settings?: any) => void | Promise<void>' is not assignable to type '(settings?: SystemSettings) => SystemSettings | Promise<SystemSettings>'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:348:5` TS2322: Type '(report: ErrorReport) => void' is not assignable to type '(reportId: any, reason?: string) => Promise<any>'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:354:5` TS2322: Type '(type: string, parentId: number) => void' is not assignable to type '(item: any) => void'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:374:5` TS2322: Type 'Dispatch<SetStateAction<DetailTab>>' is not assignable to type '(tab: string) => void'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:395:5` TS2322: Type 'number' is not assignable to type 'string'.
- `src/app/admin/components/database/useAdminDatabaseManagerController.tsx:402:5` TS2322: Type 'Dispatch<SetStateAction<number>>' is not assignable to type '(value: string) => void'.
- `src/app/admin/components/database/useAdminTaxonomyWorkflow.ts:66:42` TS2322: Type '{ agencies: { id: any; name: any; sigla: any; slug: any; description: any; website: any; type: string; }[]; organizations: { id: any; name: any; sigla: any; slug: any; description: any; website: any; type: string; }[]; ... 5 more ...; modalities: string[]; }' is not assignable to type 'GlobalTaxonomies'.

