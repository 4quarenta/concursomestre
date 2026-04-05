# Users Referral Rewards

## Escopo desta rodada

Esta passada oficializou o processamento periodico de recompensas por indicacao dentro do dominio `users`.

O fluxo saiu de:

- `api/tasks/ProcessRewards.php`
- `api/utils/RewardHelper.php`

E passou para:

- `C:\xampp\htdocs\questao-pro-backend\modules\users\controllers\UsersRewardsController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\services\UsersReferralRewardsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\repositories\UsersRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\scripts\tasks\process_referral_rewards.php`

## Regras aplicadas

- o job legado em `api/tasks` virou bridge fino
- a regra de negocio saiu do script procedural
- SQL de referrals, users e notifications ficou no repository
- o processamento periodico agora tem script CLI oficial
- o bridge HTTP passou a exigir `CRON_SECRET`

## Seguranca

- `api/tasks/ProcessRewards.php` nao fica mais aberto sem chave
- a execucao oficial recomendada passa a ser o script CLI `scripts/tasks/process_referral_rewards.php`
- o helper legado foi removido para evitar regra duplicada fora do modulo

## Compatibilidade

- o bridge `api/tasks/ProcessRewards.php` permanece para compatibilidade temporaria
- o schema real da base local usa `referred_user_id`, e o modulo novo respeita essa realidade
- bases sem `reward_amount` em `referrals` deixam de quebrar o resumo de indicacoes e passam a retornar `0`
