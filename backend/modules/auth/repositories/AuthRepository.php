<?php

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

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Repositorio do dominio de autenticacao.
 * Centraliza SQL de recuperacao de senha, confirmacao de e-mail e notificacoes.
 *
 * @since 1.0.0
 */
class AuthRepository
{
    private PDO $db;

    /**
     * Injeta o PDO usado pelos fluxos de autenticacao.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Exponde a conexao quando funcoes compartilhadas de sessao precisam dela.
     *
     * @since 1.0.0
     */
    public function getConnection(): PDO
    {
        return $this->db;
    }

    /**
     * Inicia transacao explicita para fluxos que escrevem em mais de uma tabela.
     *
     * @since 1.0.0
     */
    public function beginTransaction(): void
    {
        if (!$this->db->inTransaction()) {
            $this->db->beginTransaction();
        }
    }

    /**
     * Conclui a transacao atual.
     *
     * @since 1.0.0
     */
    public function commit(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->commit();
        }
    }

    /**
     * Reverte a transacao atual quando alguma etapa falha.
     *
     * @since 1.0.0
     */
    public function rollBack(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }

    /**
     * Indica se a conexao esta em transacao aberta.
     *
     * @since 1.0.0
     */
    public function inTransaction(): bool
    {
        return $this->db->inTransaction();
    }

    /**
     * Garante a existencia da tabela de resets em bases legadas/locales.
     *
     * @since 1.0.0
     */
    public function ensurePasswordResetTable(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'recuperacao de senha', [
            'password_resets' => ['id', 'user_id', 'token', 'expires_at', 'used', 'created_at'],
        ]);
    }

    /**
     * Garante a existencia da tabela de verificacao de e-mail.
     *
     * @since 1.0.0
     */
    public function ensureEmailVerificationTable(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'verificacao de e-mail', [
            'email_verifications' => ['id', 'user_id', 'token', 'expires_at', 'used', 'created_at'],
        ]);
    }

    /**
     * Busca o usuario com os campos necessarios para login por senha.
     *
     * @since 1.0.0
     */
    public function findUserForLoginByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT
                id,
                name,
                email,
                password_hash,
                role,
                plan,
                email_verified,
                two_factor_enabled,
                two_factor_secret,
                status,
                deletion_requested_at
             FROM users
             WHERE email = :email
             LIMIT 1"
        );
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Busca o usuario minimo necessario para fluxos de autenticacao por e-mail.
     *
     * @since 1.0.0
     */
    public function findUserByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, xp, email_verified
             FROM users
             WHERE email = :email
             LIMIT 1"
        );
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Busca usuario por CPF para impedir cadastros duplicados.
     *
     * @since 1.0.0
     */
    public function findUserByCpf(string $cpf): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email
             FROM users
             WHERE cpf = :cpf
             LIMIT 1"
        );
        $stmt->execute([':cpf' => $cpf]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Garante campos basicos de perfil exigidos no cadastro.
     *
     * @since 1.0.0
     */
    public function ensureAuthProfileColumns(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'perfil de autenticacao', [
            'users' => ['id', 'name', 'email', 'cpf', 'phone'],
        ]);
    }

    /**
     * Garante os campos usados para vincular uma conta local ao Google.
     *
     * @since 1.0.0
     */
    public function ensureGoogleAuthColumns(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'autenticacao social', [
            'users' => ['id', 'name', 'email', 'cpf', 'phone', 'auth_provider', 'google_sub', 'photo_url', 'facebook_id', 'apple_sub'],
        ]);
    }

    /**
     * Busca usuario pelo identificador estavel do Google.
     *
     * @since 1.0.0
     */
    public function findUserForSocialByGoogleSub(string $googleSub): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, role, plan, email_verified, two_factor_enabled, two_factor_secret, google_sub, facebook_id, apple_sub,
                    status, deletion_requested_at
             FROM users
             WHERE google_sub = :google_sub
             LIMIT 1"
        );
        $stmt->execute([':google_sub' => $googleSub]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Busca usuario por e-mail para vincular uma conta Google verificada.
     *
     * @since 1.0.0
     */
    public function findUserForSocialByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, role, plan, email_verified, two_factor_enabled, two_factor_secret, google_sub, facebook_id, apple_sub,
                    status, deletion_requested_at
             FROM users
             WHERE email = :email
             LIMIT 1"
        );
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Cria usuario estudante vindo do Google ja com e-mail verificado.
     *
     * @since 1.0.0
     */
    public function insertGoogleUser(array $userData): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO users (
                id,
                name,
                cpf,
                phone,
                email,
                photo_url,
                password_hash,
                auth_provider,
                google_sub,
                role,
                plan,
                level,
                xp,
                reputation,
                email_verified,
                referral_code,
                referred_by_id,
                preferences,
                created_at
            ) VALUES (
                :id,
                :name,
                :cpf,
                :phone,
                :email,
                :photo_url,
                :password_hash,
                'google',
                :google_sub,
                'student',
                'Gratuito',
                1,
                0,
                100,
                1,
                :referral_code,
                :referred_by_id,
                :preferences,
                NOW()
            )"
        );
        $stmt->execute([
            ':id' => $userData['id'],
            ':name' => $userData['name'],
            ':cpf' => $userData['cpf'] ?? null,
            ':phone' => $userData['phone'] ?? null,
            ':email' => $userData['email'],
            ':photo_url' => $userData['photo_url'],
            ':password_hash' => $userData['password_hash'],
            ':google_sub' => $userData['google_sub'],
            ':referral_code' => $userData['referral_code'],
            ':referred_by_id' => $userData['referred_by_id'],
            ':preferences' => $userData['preferences'],
        ]);
    }

    /**
     * Vincula uma conta existente ao Google preservando senha e permissoes.
     *
     * @since 1.0.0
     */
    public function linkGoogleAccount(string $userId, string $googleSub, ?string $photoUrl): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET google_sub = :google_sub,
                 auth_provider = CASE
                    WHEN auth_provider IS NULL OR auth_provider = '' OR auth_provider = 'email' THEN 'email_google'
                    ELSE auth_provider
                 END,
                 email_verified = 1,
                 photo_url = CASE
                    WHEN (photo_url IS NULL OR photo_url = '') AND :photo_url_check <> '' THEN :photo_url
                    ELSE photo_url
                 END,
                 updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([
            ':google_sub' => $googleSub,
            ':photo_url_check' => trim((string) $photoUrl),
            ':photo_url' => $photoUrl,
            ':id' => $userId,
        ]);
    }

    /**
     * Busca usuario pelo identificador estavel do Facebook.
     *
     * @since 1.0.0
     */
    public function findUserForSocialByFacebookId(string $facebookId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, role, plan, email_verified, two_factor_enabled, two_factor_secret, google_sub, facebook_id, apple_sub,
                    status, deletion_requested_at
             FROM users
             WHERE facebook_id = :facebook_id
             LIMIT 1"
        );
        $stmt->execute([':facebook_id' => $facebookId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Busca usuario pelo identificador estavel da Apple.
     *
     * @since 1.0.0
     */
    public function findUserForSocialByAppleSub(string $appleSub): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, role, plan, email_verified, two_factor_enabled, two_factor_secret, google_sub, facebook_id, apple_sub,
                    status, deletion_requested_at
             FROM users
             WHERE apple_sub = :apple_sub
             LIMIT 1"
        );
        $stmt->execute([':apple_sub' => $appleSub]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Cria usuario estudante vindo do Facebook ja com e-mail verificado.
     *
     * @since 1.0.0
     */
    public function insertFacebookUser(array $userData): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO users (
                id,
                name,
                cpf,
                phone,
                email,
                photo_url,
                password_hash,
                auth_provider,
                facebook_id,
                role,
                plan,
                level,
                xp,
                reputation,
                email_verified,
                referral_code,
                referred_by_id,
                preferences,
                created_at
            ) VALUES (
                :id,
                :name,
                :cpf,
                :phone,
                :email,
                :photo_url,
                :password_hash,
                'facebook',
                :facebook_id,
                'student',
                'Gratuito',
                1,
                0,
                100,
                1,
                :referral_code,
                :referred_by_id,
                :preferences,
                NOW()
            )"
        );
        $stmt->execute([
            ':id' => $userData['id'],
            ':name' => $userData['name'],
            ':cpf' => $userData['cpf'] ?? null,
            ':phone' => $userData['phone'] ?? null,
            ':email' => $userData['email'],
            ':photo_url' => $userData['photo_url'],
            ':password_hash' => $userData['password_hash'],
            ':facebook_id' => $userData['facebook_id'],
            ':referral_code' => $userData['referral_code'],
            ':referred_by_id' => $userData['referred_by_id'],
            ':preferences' => $userData['preferences'],
        ]);
    }

    /**
     * Cria usuario estudante vindo da Apple ja com e-mail verificado.
     *
     * @since 1.0.0
     */
    public function insertAppleUser(array $userData): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO users (
                id,
                name,
                cpf,
                phone,
                email,
                photo_url,
                password_hash,
                auth_provider,
                apple_sub,
                role,
                plan,
                level,
                xp,
                reputation,
                email_verified,
                referral_code,
                referred_by_id,
                preferences,
                created_at
            ) VALUES (
                :id,
                :name,
                :cpf,
                :phone,
                :email,
                :photo_url,
                :password_hash,
                'apple',
                :apple_sub,
                'student',
                'Gratuito',
                1,
                0,
                100,
                1,
                :referral_code,
                :referred_by_id,
                :preferences,
                NOW()
            )"
        );
        $stmt->execute([
            ':id' => $userData['id'],
            ':name' => $userData['name'],
            ':cpf' => $userData['cpf'] ?? null,
            ':phone' => $userData['phone'] ?? null,
            ':email' => $userData['email'],
            ':photo_url' => $userData['photo_url'],
            ':password_hash' => $userData['password_hash'],
            ':apple_sub' => $userData['apple_sub'],
            ':referral_code' => $userData['referral_code'],
            ':referred_by_id' => $userData['referred_by_id'],
            ':preferences' => $userData['preferences'],
        ]);
    }

    /**
     * Vincula uma conta existente ao Facebook preservando senha e permissoes.
     *
     * @since 1.0.0
     */
    public function linkFacebookAccount(string $userId, string $facebookId, ?string $photoUrl): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET facebook_id = :facebook_id,
                 auth_provider = CASE
                    WHEN auth_provider IS NULL OR auth_provider = '' OR auth_provider = 'email' THEN 'email_facebook'
                    ELSE auth_provider
                 END,
                 email_verified = 1,
                 photo_url = CASE
                    WHEN (photo_url IS NULL OR photo_url = '') AND :photo_url_check <> '' THEN :photo_url
                    ELSE photo_url
                 END,
                 updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([
            ':facebook_id' => $facebookId,
            ':photo_url_check' => trim((string) $photoUrl),
            ':photo_url' => $photoUrl,
            ':id' => $userId,
        ]);
    }

    /**
     * Vincula uma conta existente a Apple preservando senha e permissoes.
     *
     * @since 1.0.0
     */
    public function linkAppleAccount(string $userId, string $appleSub, ?string $photoUrl): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET apple_sub = :apple_sub,
                 auth_provider = CASE
                    WHEN auth_provider IS NULL OR auth_provider = '' OR auth_provider = 'email' THEN 'email_apple'
                    ELSE auth_provider
                 END,
                 email_verified = 1,
                 photo_url = CASE
                    WHEN (photo_url IS NULL OR photo_url = '') AND :photo_url_check <> '' THEN :photo_url
                    ELSE photo_url
                 END,
                 updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([
            ':apple_sub' => $appleSub,
            ':photo_url_check' => trim((string) $photoUrl),
            ':photo_url' => $photoUrl,
            ':id' => $userId,
        ]);
    }

    /**
     * Busca o usuario minimo necessario por ID autenticado.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, xp, email_verified, role, plan, two_factor_enabled, two_factor_secret, google_sub, facebook_id, apple_sub,
                    status, deletion_requested_at
             FROM users
             WHERE id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Procura um possivel referrer pelo codigo informado no cadastro.
     *
     * @since 1.0.0
     */
    public function findReferrerByCode(string $referralCode): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id FROM users WHERE referral_code = :code LIMIT 1'
        );
        $stmt->execute([':code' => $referralCode]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Cria um novo usuario de estudante com os defaults da plataforma.
     *
     * @since 1.0.0
     */
    public function insertUser(array $userData): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO users (
                id,
                name,
                cpf,
                email,
                phone,
                password_hash,
                role,
                plan,
                level,
                xp,
                reputation,
                email_verified,
                referral_code,
                referred_by_id,
                preferences,
                created_at
            ) VALUES (
                :id,
                :name,
                :cpf,
                :email,
                :phone,
                :password_hash,
                'student',
                'Gratuito',
                1,
                0,
                100,
                0,
                :referral_code,
                :referred_by_id,
                :preferences,
                NOW()
            )"
        );
        $stmt->execute([
            ':id' => $userData['id'],
            ':name' => $userData['name'],
            ':cpf' => $userData['cpf'] ?? null,
            ':email' => $userData['email'],
            ':phone' => $userData['phone'] ?? null,
            ':password_hash' => $userData['password_hash'],
            ':referral_code' => $userData['referral_code'],
            ':referred_by_id' => $userData['referred_by_id'],
            ':preferences' => $userData['preferences'],
        ]);
    }

    /**
     * Registra o relacionamento de referral quando o cadastro veio por indicacao.
     *
     * @since 1.0.0
     */
    public function insertReferral(array $referralData): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO referrals (referrer_id, referred_user_id, status)
             VALUES (:referrer_id, :referred_user_id, 'pending')"
        );
        $stmt->execute([
            ':referrer_id' => $referralData['referrer_id'],
            ':referred_user_id' => $referralData['referred_user_id'],
        ]);
    }

    /**
     * Remove tokens antigos de reset antes de criar um novo.
     *
     * @since 1.0.0
     */
    public function deletePasswordResetsByUserId(string $userId): void
    {
        $stmt = $this->db->prepare('DELETE FROM password_resets WHERE user_id = :user_id');
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Persiste um novo token de reset para o usuario.
     *
     * @since 1.0.0
     */
    public function createPasswordReset(string $userId, string $token, string $expiresAt): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES (:user_id, :token, :expires_at)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':token' => $token,
            ':expires_at' => $expiresAt,
        ]);
    }

    /**
     * Busca um reset ativo e nao utilizado.
     *
     * @since 1.0.0
     */
    public function findActivePasswordResetByToken(string $token): ?array
    {
        $tokenHash = hash('sha256', $token);
        $stmt = $this->db->prepare(
            "SELECT user_id
             FROM password_resets
             WHERE (token = :token_hash OR token = :legacy_token)
               AND expires_at > NOW()
               AND used = 0
             LIMIT 1"
        );
        $stmt->execute([
            ':token_hash' => $tokenHash,
            ':legacy_token' => $token,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Marca o token de reset como utilizado.
     *
     * @since 1.0.0
     */
    public function markPasswordResetAsUsed(string $token): void
    {
        $stmt = $this->db->prepare(
            'UPDATE password_resets
             SET used = 1
             WHERE token = :token_hash OR token = :legacy_token'
        );
        $stmt->execute([
            ':token_hash' => hash('sha256', $token),
            ':legacy_token' => $token,
        ]);
    }

    /**
     * Atualiza a senha hash do usuario.
     *
     * @since 1.0.0
     */
    public function updateUserPasswordHash(string $userId, string $passwordHash): void
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :id'
        );
        $stmt->execute([
            ':password_hash' => $passwordHash,
            ':id' => $userId,
        ]);
    }

    /**
     * Remove tokens antigos de verificacao antes de emitir um novo.
     *
     * @since 1.0.0
     */
    public function deleteEmailVerificationsByUserId(string $userId): void
    {
        $stmt = $this->db->prepare('DELETE FROM email_verifications WHERE user_id = :user_id');
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Persiste um novo token de confirmacao de e-mail.
     *
     * @since 1.0.0
     */
    public function createEmailVerification(string $userId, string $token, string $expiresAt): void
    {
        $hasDeliveryStatus = $this->tableColumnExists('email_verifications', 'delivery_status');
        $stmt = $this->db->prepare($hasDeliveryStatus
            ? "INSERT INTO email_verifications
               (user_id, token, expires_at, delivery_status)
               VALUES (:user_id, :token, :expires_at, 'pending')"
            : 'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (:user_id, :token, :expires_at)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':token' => $token,
            ':expires_at' => $expiresAt,
        ]);
    }

    /**
     * Registra a disponibilidade do pipeline de verificacao sem persistir o
     * token ou a mensagem de erro completa do provider.
     */
    public function markEmailVerificationDelivery(string $token, string $status, ?string $error = null): void
    {
        if (!$this->tableColumnExists('email_verifications', 'delivery_status')) {
            return;
        }
        $stmt = $this->db->prepare(
            'UPDATE email_verifications
             SET delivery_status = :status,
                 delivery_attempted_at = UTC_TIMESTAMP(),
                 last_delivery_error = :error
             WHERE token = :token'
        );
        $stmt->execute([
            ':status' => substr(trim($status), 0, 24),
            ':error' => $error !== null ? substr(trim($error), 0, 500) : null,
            ':token' => $token,
        ]);
    }

    /**
     * Busca um token de confirmacao ativo.
     *
     * @since 1.0.0
     */
    public function findActiveEmailVerificationByToken(string $token): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT user_id
             FROM email_verifications
             WHERE token = :token
               AND expires_at > NOW()
               AND used = 0
             LIMIT 1"
        );
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Marca o token de confirmacao como utilizado.
     *
     * @since 1.0.0
     */
    public function markEmailVerificationAsUsed(string $token): void
    {
        $stmt = $this->db->prepare('UPDATE email_verifications SET used = 1 WHERE token = :token');
        $stmt->execute([':token' => $token]);
    }

    /**
     * Marca o usuario como verificado e soma o bonus inicial de XP.
     *
     * @since 1.0.0
     */
    public function markUserEmailVerified(string $userId, int $newXp): void
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET email_verified = 1, xp = :xp, updated_at = NOW() WHERE id = :id'
        );
        $stmt->execute([
            ':xp' => $newXp,
            ':id' => $userId,
        ]);
    }

    /**
     * Registra a notificacao de boas-vindas apos a verificacao do e-mail.
     *
     * @since 1.0.0
     */
    public function insertNotification(array $notification): void
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';
        if (!isNotificationDeliveryEnabled(
            $this->db,
            (string) ($notification['title'] ?? ''),
            (string) ($notification['category'] ?? 'system')
        )) {
            return;
        }

        ensureNotificationTableSupportsCurrentContract($this->db);

        $stmt = $this->db->prepare(
            'INSERT INTO notifications (id, user_id, title, message, category, type, link)
             VALUES (:id, :user_id, :title, :message, :category, :type, :link)'
        );
        $stmt->execute([
            ':id' => $notification['id'],
            ':user_id' => $notification['user_id'],
            ':title' => $notification['title'],
            ':message' => $notification['message'],
            ':category' => $notification['category'],
            ':type' => $notification['type'],
            ':link' => $notification['link'],
        ]);
    }

    /**
     * Atualiza o segredo e o flag de 2FA do usuario admin.
     *
     * @since 1.0.0
     */
    public function enableTwoFactor(string $userId, string $secret): void
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET two_factor_secret = :secret, two_factor_enabled = 1, updated_at = NOW() WHERE id = :id'
        );
        $stmt->execute([
            ':secret' => $secret,
            ':id' => $userId,
        ]);
    }

    /**
     * Busca o usuario com o estado do 2FA para verificacao do codigo.
     *
     * @since 1.0.0
     */
    public function findUserForTwoFactorByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, email, role, two_factor_secret, two_factor_enabled
             FROM users
             WHERE email = :email
             LIMIT 1"
        );
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    private function usersColumnExists(string $column): bool
    {
        if (!preg_match('/^[a-z0-9_]+$/i', $column)) {
            return false;
        }

        $stmt = $this->db->query("SHOW COLUMNS FROM users LIKE " . $this->db->quote($column));
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function tableColumnExists(string $table, string $column): bool
    {
        if (!preg_match('/^[a-z0-9_]+$/i', $table) || !preg_match('/^[a-z0-9_]+$/i', $column)) {
            return false;
        }

        $stmt = $this->db->query(
            "SHOW COLUMNS FROM `{$table}` LIKE " . $this->db->quote($column)
        );
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function usersIndexExists(string $index): bool
    {
        if (!preg_match('/^[a-z0-9_]+$/i', $index)) {
            return false;
        }

        $stmt = $this->db->query("SHOW INDEX FROM users WHERE Key_name = " . $this->db->quote($index));
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
