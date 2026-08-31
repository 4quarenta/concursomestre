# Stripe Renewal Pricing and Collections

## Regra oficial

- O contrato atual permanece congelado no valor aceito na contratação.
- A próxima renovação usa o preço efetivo vigente na data da renovação.
- "Preço efetivo vigente" significa:
  - preço público atual do plano;
  - promoções automáticas ativas;
  - cupons autoaplicados válidos.
- Cupom manual usado na compra antiga não reaplica automaticamente na renovação.

## Como a plataforma calcula a próxima renovação

- O backend reutiliza a mesma engine comercial do checkout para projetar a próxima cobrança.
- O snapshot da assinatura salva:
  - `next_renewal_amount`
  - `next_renewal_date`
  - `next_renewal_price_source`
  - `next_renewal_cycle_label`
  - `next_renewal_snapshot_json`
- Esses campos alimentam:
  - perfil do usuário;
  - cron de reconciliação Stripe;
  - lembrete preventivo de renovação.

## Como o Stripe é sincronizado

- A assinatura atual continua no preço original até o fim do período/termo atual.
- A próxima renovação é programada por `Subscription Schedule`.
- O schedule usa:
  - fase atual = preço vigente do contrato em andamento;
  - fase futura = preço efetivo vigente da próxima renovação.
- Se a renovação automática for desligada, o schedule futuro é liberado.

## Renovação por modalidade

### Mensal

- o ciclo atual segue no valor contratado;
- a próxima cobrança mensal usa o preço vigente na data da renovação.

### Trimestral e anual

- o termo atual segue congelado no valor contratado;
- a renovação do próximo termo usa o preço vigente naquele momento.

### Termo parcelado

- as parcelas do termo atual não mudam;
- ao iniciar um novo termo:
  - `paid_installments` reinicia para `1`;
  - `renewal_iteration` é incrementado;
  - a nova parcela passa a refletir o preço vigente do novo termo.

## Emails obrigatórios

### Pagamento aprovado

- email com recibo/comprovante;
- plano;
- modalidade;
- valor;
- data;
- links `hosted_invoice_url` / `invoice_pdf` quando existirem.

### Falha de cobrança

- email com:
  - valor em aberto;
  - modalidade;
  - impacto no acesso;
  - passo a passo para atualizar/trocar o cartão.

### Lembrete de renovação

- enviado 5 dias antes da próxima renovação;
- informa:
  - data prevista;
  - valor previsto;
  - modalidade;
  - origem do preço (`preço atual do plano` ou `cupom autoaplicado vigente`).

## Notificações in-app

O usuário recebe notificação na plataforma quando ocorre:

- pagamento aprovado;
- falha de pagamento;
- renovação em 5 dias;
- regularização concluída.

## Bloqueio por inadimplência

- `past_due` e falha de invoice contam como bloqueio real.
- Ao entrar em inadimplência:
  - o acesso premium é revogado;
  - o frontend exibe bloqueio global;
  - somente rotas de regularização permanecem liberadas.
- Rotas de regularização:
  - `/profile/billing`
  - `/profile/personal`
  - `/profile/billing-history`
  - `/checkout/...`
  - `/support`
  - autenticação e páginas públicas

## Reconciliação Stripe

O cron de reconciliação também valida:

- status remoto da assinatura;
- períodos locais/remotos;
- valor previsto da próxima renovação;
- schedule futuro;
- envio do reminder de 5 dias;
- materialização de invoices pagas;
- revogação ou devolução de acesso após falha/regularização.

## Arquivos centrais

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsBillingSupport.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\services\UsersService.php`
- `C:\dev\concursomestre\src\app\profile\ProfilePage.tsx`
- `C:\dev\concursomestre\src\providers\NextRouteFrame.tsx`
- `C:\dev\concursomestre\src\services\billing\paymentIssue.ts`
- `C:\dev\concursomestre\src\types\global.ts`
