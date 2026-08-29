-- Database Schema for ConcursoMestre
-- Generated based on types.ts and project requirements

CREATE DATABASE IF NOT EXISTS concursomestre DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE concursomestre;

-- =============================================
-- 1. Users & Authentication
-- =============================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- Nullable for OAuth users
    email_verified BOOLEAN DEFAULT FALSE,
    cpf VARCHAR(14) UNIQUE,
    phone VARCHAR(30) NULL,
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'email',
    google_sub VARCHAR(255) NULL,
    facebook_id VARCHAR(255) NULL,
    apple_sub VARCHAR(255) NULL,
    
    -- Profile Stats
    level INT DEFAULT 1,
    xp INT DEFAULT 0,
    reputation INT DEFAULT 0,
    target_exam VARCHAR(255),
    
    -- Access Control
    role ENUM('user', 'admin', 'partner') DEFAULT 'user',
    status ENUM('active', 'suspended', 'banned', 'pending') DEFAULT 'active',
    plan ENUM('Gratuito', 'Essencial', 'Pro', 'Elite') DEFAULT 'Gratuito',
    
    -- Billing Info (Simplified)
    billing_cycle ENUM('monthly', 'quarterly', 'annual') DEFAULT 'monthly',
    next_billing_date DATETIME,
    current_plan_id INT NULL,
    subscription_end DATETIME NULL,
    stripe_customer_id VARCHAR(255) NULL,
    has_saved_card TINYINT(1) NOT NULL DEFAULT 0,
    stripe_account_id VARCHAR(255) NULL,
    stripe_onboarding_complete TINYINT(1) NOT NULL DEFAULT 0,
    
    -- Preferences (stored as JSON for flexibility)
    preferences JSON, 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    interval_unit VARCHAR(20) NOT NULL DEFAULT 'month',
    interval_count INT NOT NULL DEFAULT 1,
    tier INT NOT NULL DEFAULT 1,
    features LONGTEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_test_plan TINYINT(1) NOT NULL DEFAULT 0,
    external_plan_id VARCHAR(255) NULL,
    stripe_product_id VARCHAR(255) NULL,
    stripe_price_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_plans_active_price (active, price),
    INDEX idx_plans_tier (tier),
    INDEX idx_plans_external_plan (external_plan_id),
    INDEX idx_plans_stripe_price (stripe_price_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    plan_id INT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    current_period_start DATETIME NULL,
    current_period_end DATETIME NULL,
    external_subscription_id VARCHAR(255) NULL,
    mp_preapproval_id VARCHAR(255) NULL,
    payment_provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
    provider_subscription_id VARCHAR(255) NULL,
    provider_customer_id VARCHAR(255) NULL,
    provider_checkout_session_id VARCHAR(255) NULL,
    provider_current_period_start DATETIME NULL,
    provider_current_period_end DATETIME NULL,
    provider_last_webhook_event_at DATETIME NULL,
    provider_schedule_id VARCHAR(255) NULL,
    auto_renew TINYINT(1) NOT NULL DEFAULT 1,
    cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
    is_recurring TINYINT(1) NOT NULL DEFAULT 1,
    total_installments INT NOT NULL DEFAULT 1,
    paid_installments INT NOT NULL DEFAULT 0,
    antifraud_blocked TINYINT(1) NOT NULL DEFAULT 0,
    antifraud_reason TEXT NULL,
    renewal_iteration INT NOT NULL DEFAULT 0,
    superseded_by_subscription_id INT NULL,
    recurring_amount DECIMAL(10,2) NULL,
    next_renewal_amount DECIMAL(10,2) NULL,
    next_renewal_date DATETIME NULL,
    next_renewal_price_source VARCHAR(50) NULL,
    next_renewal_cycle_label VARCHAR(80) NULL,
    next_renewal_snapshot_json LONGTEXT NULL,
    renewal_reminder_sent_for VARCHAR(80) NULL,
    renewal_reminder_sent_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_subscriptions_user_status (user_id, status),
    INDEX idx_user_subscriptions_provider_subscription (provider_subscription_id),
    INDEX idx_user_subscriptions_period_end (current_period_end),
    UNIQUE KEY uniq_user_subscriptions_provider_subscription (provider_subscription_id),
    UNIQUE KEY uniq_user_subscriptions_mp_preapproval (mp_preapproval_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_cards (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    payment_provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
    mp_card_id VARCHAR(255) NULL,
    mp_customer_id VARCHAR(255) NULL,
    stripe_payment_method_id VARCHAR(255) NULL,
    provider_customer_id VARCHAR(255) NULL,
    brand VARCHAR(80) NULL,
    last_four_digits VARCHAR(8) NULL,
    exp_month INT NULL,
    exp_year INT NULL,
    holder_name VARCHAR(255) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    locked_by_recurring TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_cards_user (user_id),
    INDEX idx_user_cards_provider (payment_provider),
    INDEX idx_user_cards_stripe_pm (stripe_payment_method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plans (name, description, price, interval_unit, interval_count, tier, features, active, is_active, is_test_plan)
VALUES
('Essencial', 'Plano essencial da plataforma.', 19.90, 'month', 1, 1, '[]', 1, 1, 0),
('Pro', 'Plano profissional da plataforma.', 29.90, 'month', 1, 2, '[]', 1, 1, 0),
('Elite', 'Plano completo da plataforma.', 33.27, 'month', 1, 3, '[]', 1, 1, 0)
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    price = VALUES(price),
    interval_unit = VALUES(interval_unit),
    interval_count = VALUES(interval_count),
    tier = VALUES(tier),
    active = VALUES(active),
    is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS addresses (
    user_id VARCHAR(36) PRIMARY KEY,
    zip_code VARCHAR(10),
    street VARCHAR(255),
    number VARCHAR(20),
    complement VARCHAR(255),
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(2),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bank_accounts (
    user_id VARCHAR(36) PRIMARY KEY,
    bank_code VARCHAR(10),
    bank_name VARCHAR(255),
    agency VARCHAR(20),
    account VARCHAR(20),
    account_digit VARCHAR(5),
    holder_name VARCHAR(255),
    holder_document VARCHAR(20),
    account_type ENUM('checking', 'savings') DEFAULT 'checking',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- 2. Taxonomies (Filters System)
-- =============================================

-- Unified table for hierarchical data to support fast filtering
CREATE TABLE IF NOT EXISTS filters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('banca', 'orgao', 'cargo', 'assunto', 'ano', 'carreira', 'area', 'nivel', 'tipo_prova', 'modalidade') NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    acronym VARCHAR(40) DEFAULT NULL,
    parent_id INT DEFAULT NULL,
    description TEXT NULL,
    website VARCHAR(1000) NULL,
    asset_url VARCHAR(1000) NULL,
    icon_key VARCHAR(120) NULL,
    keywords_json JSON NULL,
    taxonomy_level VARCHAR(20) NULL,
    meta_carreira BOOLEAN DEFAULT FALSE,
    source_provider VARCHAR(40) NULL,
    source_entity_type VARCHAR(40) NULL,
    source_external_id VARCHAR(120) NULL,
    source_parent_external_id VARCHAR(120) NULL,
    source_root_external_id VARCHAR(120) NULL,
    
    -- Metadata fields specific to certain types (e.g., UF for Orgao, OAB for Banca)
    meta_uf VARCHAR(2),
    meta_esfera VARCHAR(50),
    meta_oab BOOLEAN DEFAULT FALSE,
    meta_materia BOOLEAN DEFAULT FALSE, -- For Subject roots
    
    UNIQUE KEY unique_type_slug (type, slug),
    UNIQUE KEY uq_filters_type_acronym (type, acronym),
    UNIQUE KEY uq_filters_source_identity (type, source_provider, source_entity_type, source_external_id),
    FOREIGN KEY (parent_id) REFERENCES filters(id) ON DELETE SET NULL,
    INDEX idx_type (type),
    INDEX idx_filters_type_name_id (type, name, id),
    INDEX idx_filters_source_parent (type, source_provider, source_entity_type, source_parent_external_id)
);

-- Stable many-to-one identities for imported taxonomies. A provider may keep
-- more than one historical external ID for the same canonical filter.
CREATE TABLE IF NOT EXISTS filter_source_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    filter_id INT NOT NULL,
    filter_type VARCHAR(40) NOT NULL,
    source_provider VARCHAR(40) NOT NULL,
    source_entity_type VARCHAR(40) NOT NULL,
    source_external_id VARCHAR(120) NOT NULL,
    source_parent_external_id VARCHAR(120) NULL,
    source_root_external_id VARCHAR(120) NULL,
    source_metadata_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_filter_source_identity (
        filter_type, source_provider, source_entity_type, source_external_id
    ),
    INDEX idx_filter_source_filter (filter_id),
    INDEX idx_filter_source_parent (
        filter_type, source_provider, source_entity_type, source_parent_external_id
    ),
    FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
);

-- Directed relations that cannot be represented by the single legacy
-- filters.parent_id column (for example, one cargo linked to many careers).
CREATE TABLE IF NOT EXISTS filter_relationships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_filter_id INT NOT NULL,
    target_filter_id INT NOT NULL,
    relation_type VARCHAR(60) NOT NULL,
    source_provider VARCHAR(40) NOT NULL DEFAULT 'platform',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_filter_relationship (
        source_filter_id, target_filter_id, relation_type, source_provider
    ),
    INDEX idx_filter_relationship_target (target_filter_id, relation_type, source_filter_id),
    INDEX idx_filter_relationship_source (source_filter_id, relation_type, target_filter_id),
    FOREIGN KEY (source_filter_id) REFERENCES filters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_filter_id) REFERENCES filters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS filter_aliases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    filter_id INT NOT NULL,
    alias VARCHAR(255) NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_filter_alias (filter_id, normalized_alias),
    INDEX idx_filter_alias_lookup (normalized_alias),
    INDEX idx_filter_alias_filter (filter_id),
    FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
);

-- Provas (Exams)
CREATE TABLE IF NOT EXISTS provas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    ano INT NOT NULL,
    
    banca_id INT,
    orgao_id INT,
    cargo_id INT,
    nivel_id INT, -- Link to filter of type 'nivel'
    tipo_prova_id INT, -- Link to filter of type 'tipo_prova'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_provas_slug (slug),
    
    FOREIGN KEY (banca_id) REFERENCES filters(id) ON DELETE SET NULL,
    FOREIGN KEY (orgao_id) REFERENCES filters(id) ON DELETE SET NULL,
    FOREIGN KEY (cargo_id) REFERENCES filters(id) ON DELETE SET NULL,
    FOREIGN KEY (nivel_id) REFERENCES filters(id) ON DELETE SET NULL,
    FOREIGN KEY (tipo_prova_id) REFERENCES filters(id) ON DELETE SET NULL
);

-- =============================================
-- 3. Questions
-- =============================================

CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hash_id VARCHAR(64) UNIQUE, -- Public secure ID
    
    enunciado TEXT NOT NULL,
    enunciado_clean TEXT, -- Strip tags for search
    intro_text TEXT,
    reference_text TEXT NULL,
    
    tipo ENUM('multipla_escolha', 'certo_errado') DEFAULT 'multipla_escolha',
    dificuldade INT DEFAULT 1, -- 1=Easy, 2=Medium, 3=Hard
    
    -- Status flags
    anulada BOOLEAN DEFAULT FALSE,
    desatualizada BOOLEAN DEFAULT FALSE,
    resolvida_por_prof BOOLEAN DEFAULT FALSE,
    publish_status ENUM('published', 'draft', 'scheduled') NOT NULL DEFAULT 'published',
    visibility_status ENUM('public', 'elite', 'internal') NOT NULL DEFAULT 'public',
    scheduled_at DATETIME NULL,
    published_at DATETIME NULL,
    
    resposta_correta_item_index INT, -- Index of correct item (0, 1, 2...) or ID
    
    -- Rich Content
    data_json LONGTEXT, -- Stores 'itens', 'images', etc.
    
    -- Links
    prova_id INT,
    grupo_questao_id INT DEFAULT NULL, -- For grouped questions (text interpretation)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FULLTEXT idx_texto (enunciado_clean)
);

-- Link Questions to Filters (Many-to-Many)
CREATE TABLE IF NOT EXISTS question_filters (
    question_id INT NOT NULL,
    filter_id INT NOT NULL,
    PRIMARY KEY (question_id, filter_id),
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
);

-- Question Statistics (Aggregated)
CREATE TABLE IF NOT EXISTS question_stats (
    question_id INT PRIMARY KEY,
    total_attempts INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    wrong_count INT DEFAULT 0,
    option_distribution JSON DEFAULT NULL,
    average_time_spent INT DEFAULT 0,
    difficulty_rating DECIMAL(3,2) DEFAULT 0.00,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- =============================================
-- 4. Learning & Practice (Simulations)
-- =============================================

CREATE TABLE IF NOT EXISTS simulations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255),
    
    -- Configuration Snapshot
    config_json JSON, -- Stores subjects, difficulty, timer settings
    
    status ENUM('in_progress', 'completed', 'abandoned') DEFAULT 'in_progress',
    score DECIMAL(5, 2),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_answers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    question_id INT NOT NULL,
    simulation_id VARCHAR(36) NULL, -- Optional, if part of a sim
    
    selected_option_index INT,
    is_correct BOOLEAN NOT NULL,
    time_taken_seconds INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE SET NULL,
    
    INDEX idx_user_history (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS user_statistics (
    user_id VARCHAR(36) PRIMARY KEY,
    total_questions_answered INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
    current_streak INT DEFAULT 0,
    best_streak INT DEFAULT 0,
    total_study_time INT DEFAULT 0,
    question_study_time INT DEFAULT 0,
    reading_study_time INT DEFAULT 0,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_statistics_user (user_id)
);

CREATE TABLE IF NOT EXISTS subject_statistics (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
    average_time INT DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subject_statistics_user (user_id),
    INDEX idx_subject_statistics_subject (subject),
    UNIQUE KEY unique_user_subject (user_id, subject)
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    practice_study_time INT DEFAULT 0,
    simulation_study_time INT DEFAULT 0,
    reading_study_time INT DEFAULT 0,
    question_study_time INT DEFAULT 0,
    total_study_time INT DEFAULT 0,
    started_at DATETIME NULL,
    ended_at DATETIME NOT NULL,
    source_context JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_study_sessions_user (user_id),
    INDEX idx_study_sessions_ended_at (ended_at)
);



CREATE TABLE IF NOT EXISTS user_notes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    type ENUM('question', 'material') NOT NULL DEFAULT 'question',
    note_text TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY user_item_unique (user_id, item_id, type),
    INDEX idx_user_notes_item_id (item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- 5. Marketplace & Social
-- =============================================

CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(36) PRIMARY KEY,
    author_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    type ENUM('PDF', 'Simulado', 'Resumo') NOT NULL,
    
    subject_id INT, -- Main subject filter
    subject_text VARCHAR(255) NULL,
    topic_id INT NULL,
    topic VARCHAR(255) NULL,
    page_count INT NULL,
    year INT NULL,
    exam_target VARCHAR(255),
    
    files_json JSON, -- URLs for cover, preview, main file
    preview_url VARCHAR(500) NULL,
    cover_url VARCHAR(500) NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT NULL,
    
    sales_count INT DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES filters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS material_ratings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    material_id VARCHAR(64) NOT NULL,
    rating DECIMAL(3,1) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uniq_material_ratings_user_material (user_id, material_id),
    INDEX idx_material_ratings_material (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_bookmarks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    material_id VARCHAR(36) NOT NULL,
    page_num INT NOT NULL,
    label VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_bookmarks_material (user_id, material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_highlights (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    material_id VARCHAR(36) NOT NULL,
    page_num INT NOT NULL,
    color VARCHAR(7) NULL,
    rects LONGTEXT NOT NULL,
    text TEXT NULL,
    type VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_highlights_material (user_id, material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    external_id VARCHAR(255) NULL,
    user_id VARCHAR(64) NULL,
    material_id VARCHAR(36) NULL,
    plan_id INT NULL,
    plan_name VARCHAR(255) NULL,
    seller_id VARCHAR(64) NULL,
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'completed',
    due_date DATETIME NULL,
    refund_reason TEXT NULL,
    refund_requested_at DATETIME NULL,
    refunded_at DATETIME NULL,
    payment_method VARCHAR(50) NULL,
    payment_provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
    provider_payment_intent_id VARCHAR(255) NULL,
    provider_invoice_id VARCHAR(255) NULL,
    provider_refund_id VARCHAR(255) NULL,
    provider_customer_id VARCHAR(255) NULL,
    provider_refund_details_json LONGTEXT NULL,
    installments INT DEFAULT 1,
    payer_email VARCHAR(255) NULL,
    type VARCHAR(20) DEFAULT 'material',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_transactions_user_created (user_id, created_at),
    INDEX idx_transactions_material (material_id),
    INDEX idx_transactions_provider_payment_intent (provider_payment_intent_id),
    UNIQUE KEY uniq_transactions_provider_payment_intent (provider_payment_intent_id),
    INDEX idx_transactions_provider_invoice (provider_invoice_id),
    UNIQUE KEY uniq_transactions_provider_invoice (provider_invoice_id),
    INDEX idx_transactions_plan_id (plan_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    
    target_type ENUM('question', 'material') NOT NULL,
    target_id VARCHAR(255) NOT NULL, -- Generic ID holder
    
    content TEXT NOT NULL,
    parent_id VARCHAR(36) DEFAULT NULL, -- For threaded replies
    
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_target (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS comment_likes (
    user_id VARCHAR(36) NOT NULL,
    comment_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, comment_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_saved_questions (
    user_id VARCHAR(36) NOT NULL,
    question_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(64) PRIMARY KEY,
    reporter_id VARCHAR(36) NOT NULL,
    target_type ENUM('question', 'material', 'comment', 'law_section') NOT NULL,
    target_id VARCHAR(255) NOT NULL,

    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status ENUM('pending', 'resolved', 'ignored') DEFAULT 'pending',
    evidence_url VARCHAR(2048) NULL,
    resolved_at DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    category VARCHAR(40) DEFAULT 'system',
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    evidence_url VARCHAR(500),
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_visible (user_id, deleted_at, created_at),
    INDEX idx_notifications_user_unread (user_id, is_read, deleted_at)
);

CREATE TABLE IF NOT EXISTS user_streaks (
    user_id VARCHAR(64) PRIMARY KEY,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_streaks_last_activity (last_activity_date)
);

CREATE TABLE IF NOT EXISTS user_badges (
    user_id VARCHAR(64) NOT NULL,
    badge_key VARCHAR(80) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(255) NULL,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_key),
    INDEX idx_user_badges_awarded_at (awarded_at)
);

CREATE TABLE IF NOT EXISTS user_gamification_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(180) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    xp_delta INT NOT NULL DEFAULT 0,
    reputation_delta INT NOT NULL DEFAULT 0,
    badge_key VARCHAR(80) NULL,
    metadata_json TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_gamification_event_key (event_key),
    INDEX idx_user_gamification_user_created (user_id, created_at),
    INDEX idx_user_gamification_event_name (event_name)
);

CREATE TABLE IF NOT EXISTS user_study_schedules (
    user_id VARCHAR(64) PRIMARY KEY,
    form_json MEDIUMTEXT NOT NULL,
    plan_json MEDIUMTEXT NULL,
    generated_at DATETIME NULL,
    saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_study_schedules_saved_at (saved_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_webhook_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(40) NOT NULL,
    event_id VARCHAR(191) NOT NULL,
    event_type VARCHAR(120) NULL,
    object_id VARCHAR(191) NULL,
    payload_hash VARCHAR(128) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    event_created_at DATETIME NULL,
    processed_at DATETIME NULL,
    error_message VARCHAR(1000) NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_provider_webhook_event (provider, event_id),
    INDEX idx_provider_webhook_status (provider, status, updated_at),
    INDEX idx_provider_webhook_object (provider, object_id)
);

CREATE TABLE IF NOT EXISTS marketing_automation_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    campaign_slug VARCHAR(120) NOT NULL,
    rule_id VARCHAR(120) NOT NULL,
    rule_condition VARCHAR(60) NOT NULL,
    user_id VARCHAR(80) NOT NULL,
    event_key VARCHAR(160) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'claimed',
    delivery_json LONGTEXT NULL,
    error_message VARCHAR(1000) NULL,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_marketing_automation_event (campaign_slug, rule_id, user_id, event_key),
    INDEX idx_marketing_automation_status (status, created_at),
    INDEX idx_marketing_automation_user (user_id, created_at)
);

-- =============================================
-- 6. Rankings & Events
-- =============================================

CREATE TABLE IF NOT EXISTS rankings (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),
    total_questions INT,
    vacancies INT NOT NULL DEFAULT 10,
    vacancies_ac INT NOT NULL DEFAULT 0,
    vacancies_afro INT NOT NULL DEFAULT 0,
    vacancies_pcd INT NOT NULL DEFAULT 0,
    official_key_release_date DATETIME NULL,
    key_status ENUM('pending', 'official') NOT NULL DEFAULT 'pending',
    has_discursive TINYINT(1) NOT NULL DEFAULT 0,
    exam_types JSON NULL,
    correct_key TEXT NULL,
    image_url VARCHAR(255) NULL,
    reserve_limit INT NOT NULL DEFAULT 10,
    start_date DATETIME,
    end_date DATETIME,
    status ENUM('pending', 'approved', 'rejected', 'archived', 'draft', 'active') NOT NULL DEFAULT 'pending',
    created_by_user_id VARCHAR(64) NULL,
    updated_by_user_id VARCHAR(64) NULL,
    published_by_user_id VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ranking_entries (
    id VARCHAR(36) PRIMARY KEY,
    ranking_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(255) NULL,
    registration_number VARCHAR(100) NULL,
    exam_type VARCHAR(100) NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'AC',
    user_answers TEXT NULL,
    score DECIMAL(10, 2) DEFAULT 0,
    discursive_score DECIMAL(5, 2) NULL,
    status ENUM('active', 'disqualified') NOT NULL DEFAULT 'active',
    details_json JSON, -- Answers snapshot
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (ranking_id, user_id)
);

-- =============================================
-- 7. System Settings
-- =============================================

CREATE TABLE IF NOT EXISTS system_settings (
    key_name VARCHAR(50) PRIMARY KEY,
    value_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initial Data Seeding (Basic System Settings)
INSERT IGNORE INTO system_settings (key_name, value_json) VALUES 
('features', '{"marketplace": true, "simulation": true, "ai_comments": false, "bulkImportEnabled": true}'),
('pricing', '{"pro_monthly": 29.90, "elite_monthly": 49.90}');
