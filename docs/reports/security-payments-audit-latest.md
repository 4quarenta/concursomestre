# Auditoria de Seguranca e Pagamentos

Data: `2026-04-19`

## Escopo desta rodada

Fechar o risco mais urgente encontrado na etapa 4:

- segredos administrativos expostos ao frontend
- uso direto do Gemini no navegador do admin
- dependencias do importador em `geminiApiKey` no estado cliente

## Achados confirmados

### 1. Chave Gemini exposta no navegador

Antes desta correcao, o frontend administrativo:

- recebia `geminiApiKey` em `systemSettings`
- instanciava `@google/genai` no browser
- enviava imagem, PDF e prompts diretamente ao Gemini a partir do cliente

Impacto:

- exposicao da chave Gemini ao admin frontend
- acoplamento inseguro entre UI e segredo operacional

### 2. Segredos de integracao trafegando no payload de settings

Antes desta correcao, a camada de settings do admin trabalhava com valores crus de:

- `stripeSecretKey`
- `stripeWebhookSecret`
- `geminiApiKey`
- `recaptchaSecretKey`

Impacto:

- leitura direta desses valores no frontend
- risco de sobrescrita indevida em saves futuros

## Correcao aplicada

### Backend de IA autenticado

Arquivos ajustados no backend local:

- `C:/xampp/htdocs/questao-pro-backend/modules/ai/routes.php`
- `C:/xampp/htdocs/questao-pro-backend/modules/ai/controllers/AiController.php`
- `C:/xampp/htdocs/questao-pro-backend/modules/ai/services/AiService.php`
- `C:/xampp/htdocs/questao-pro-backend/modules/ai/validators/AiValidator.php`

Mudancas:

- o endpoint `ai/generate.php` passou a exigir admin autenticado
- o backend passou a aceitar `prompt`, `attachments`, `responseMimeType` e `responseSchema`
- a chave Gemini agora e resolvida apenas no backend
- o frontend nao precisa mais instanciar o SDK do Gemini nem conhecer o segredo

### Frontend migrado para gateway backend

Arquivos ajustados:

- `src/services/questions/aiService.ts`
- `src/app/admin/components/import/useAdminImportWorkflow.ts`
- `src/app/admin/components/questions/useManualQuestionWorkflow.ts`

Mudancas:

- removido o uso de `@google/genai` no browser
- `extractQuestionsFromPage`, `extractAnswerKeyMapping`, `generateDetailedAnalysis` e `generateTeacherComment` agora usam o endpoint autenticado do backend
- o fluxo do importador e da criacao manual nao depende mais da chave Gemini no estado do cliente

### Settings com segredos write-only

Arquivo ajustado no backend:

- `C:/xampp/htdocs/questao-pro-backend/modules/admin/services/AdminSettingsService.php`

Mudancas:

- `getSettings()` agora mascara valores crus de segredo antes de responder
- adicionadas flags:
  - `hasGeminiApiKeyConfigured`
  - `hasRecaptchaSecretConfigured`
  - aproveitamento das flags existentes do Stripe
- `persistSpecialSettings()` passou a salvar `geminiApiKey` e `recaptchaSecretKey` apenas quando novos valores sao enviados
- `persistGenericSettings()` passou a ignorar flags e segredos write-only
- `testIntegrations()` agora usa flags persistidas quando os campos secretos estao vazios no frontend

### UI do admin alinhada ao modelo write-only

Arquivos ajustados:

- `src/app/admin/components/settings/AdminSettings.tsx`
- `src/app/admin/components/import/AdminImportSection.tsx`
- `src/app/admin/components/panel/AdminPanelSection.tsx`
- `src/components/shared/feedback/DevModeBanner.tsx`
- `src/state/app-config/useSystemSettingsActions.ts`
- `src/types/global.ts`

Mudancas:

- inputs secretos exibem status de configuracao em vez de depender do valor cru
- os campos aceitam apenas substituicao de segredo, nao leitura
- indicadores do admin e do banner de desenvolvimento passaram a usar flags
- o painel nao depende mais de `stripeWebhookSecret` para determinar saude operacional

## Validacoes executadas

- `npm run typecheck`: ok
- `npm run check:text-encoding`: ok
- `C:/xampp/php/php.exe -l` nos arquivos PHP alterados: ok

## Rodada complementar - SMTP write-only

O fluxo de SMTP foi alinhado ao mesmo modelo de segredos administrativos:

Arquivos ajustados:

- `src/types/global.ts`
- `src/state/app-config/useSystemSettingsActions.ts`
- `src/app/admin/components/settings/AdminSettings.tsx`
- `C:/xampp/htdocs/questao-pro-backend/modules/admin/services/AdminSettingsService.php`

Mudancas:

- `smtpPass` nao fica mais retido no estado persistido do frontend apos leitura do backend
- a UI mostra apenas status `Configurada` ou `Ausente`
- senha SMTP vazia nao e enviada no save, evitando apagar a senha existente por acidente
- backend adiciona `hasSmtpPasswordConfigured`
- backend mascara `smtpPass` tambem para admin
- backend preserva `smtpPass` como write-only e salva apenas quando um novo valor e informado
- teste SMTP consegue usar a senha salva quando o campo vem oculto do frontend

## Resultado

O risco mais grave desta etapa foi removido:

- Gemini nao roda mais no browser
- segredos principais de pagamentos e IA nao voltam mais crus em `systemSettings`
- SMTP, Gemini, Stripe e reCAPTCHA agora seguem politica de segredo oculto/write-only
- a UI administrativa atual foi ajustada para operar com flags e substituicao controlada enquanto o rebuild total do admin fica documentado como macrofase futura
