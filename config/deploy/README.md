# Deploy templates

Estes arquivos sao modelos para a futura VPS/staging. Eles nao contem segredos e devem ser copiados para os caminhos reais do servidor somente depois de ajustar dominio, usuario, caminhos, versao do PHP e certificados.

Arquivos:

- `nginx.concursomestre.conf.example`: reverse proxy HTTPS para Next.js e PHP-FPM do backend.
- `systemd.concursomestre-web.service.example`: servico do frontend Next.js.
- `cron.concursomestre.example`: crons operacionais de assinaturas, marketing, recompensas, backup e Lei Comentada.
- `logrotate.concursomestre.example`: rotacao de logs privados da aplicacao.

Fluxo recomendado quando a VPS existir:

1. Clonar frontend em `/var/www/concursomestre`.
2. Clonar backend em `/var/www/questao-pro-backend`.
3. Criar `.env` reais a partir dos `.env.production.example`.
4. Copiar e ajustar estes templates para `/etc/nginx/sites-available`, `/etc/systemd/system`, `/etc/cron.d` e `/etc/logrotate.d`.
5. Rodar `npm run check:release-local` antes de subir.
6. Rodar `production_readiness_suite.php --profile=staging` no servidor com dominio real.

Seguranca de borda:

- Preserve os bloqueios de `questao-pro-backend`, `setup`, `scripts` e diretorios internos presentes no template Nginx.
- Mantenha `/import-extractor/` como `internal`; o navegador deve usar somente a API publica autenticada.
- Configure `AUTH_TRUST_PROXY_HEADERS=true` somente junto de `AUTH_TRUSTED_PROXY_CIDRS`, com os IPs/CIDRs reais do Nginx/Cloudflare. Sem allowlist, headers como `X-Forwarded-For` e `X-Forwarded-Proto` sao ignorados. Mantenha `NEXT_PUBLIC_AUTH_REFRESH_COOKIE_NAME` igual a `AUTH_REFRESH_COOKIE_NAME` (padrao `cm_refresh`).
