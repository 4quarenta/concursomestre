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
    
    -- Preferences (stored as JSON for flexibility)
    preferences JSON, 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
    parent_id INT DEFAULT NULL,
    
    -- Metadata fields specific to certain types (e.g., UF for Orgao, OAB for Banca)
    meta_uf VARCHAR(2),
    meta_esfera VARCHAR(50),
    meta_oab BOOLEAN DEFAULT FALSE,
    meta_materia BOOLEAN DEFAULT FALSE, -- For Subject roots
    
    UNIQUE KEY unique_type_slug (type, slug),
    FOREIGN KEY (parent_id) REFERENCES filters(id) ON DELETE SET NULL,
    INDEX idx_type (type)
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
    
    tipo ENUM('multipla_escolha', 'certo_errado') DEFAULT 'multipla_escolha',
    dificuldade INT DEFAULT 1, -- 1=Easy, 2=Medium, 3=Hard
    
    -- Status flags
    anulada BOOLEAN DEFAULT FALSE,
    desatualizada BOOLEAN DEFAULT FALSE,
    resolvida_por_prof BOOLEAN DEFAULT FALSE,
    
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



CREATE TABLE IF NOT EXISTS user_notes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    question_id INT NOT NULL,
    note_text TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY (user_id, question_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
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
    exam_target VARCHAR(255),
    
    files_json JSON, -- URLs for cover, preview, main file
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    
    sales_count INT DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES filters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    buyer_id VARCHAR(36) NOT NULL,
    material_id VARCHAR(36) NOT NULL,
    seller_id VARCHAR(36) NOT NULL,
    
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    
    status ENUM('completed', 'refunded', 'cancelled') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
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
    id VARCHAR(36) PRIMARY KEY,
    reporter_id VARCHAR(36) NOT NULL,
    target_type ENUM('question', 'material', 'comment') NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status ENUM('pending', 'resolved', 'ignored') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- 6. Rankings & Events
-- =============================================

CREATE TABLE IF NOT EXISTS rankings (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),
    total_questions INT,
    start_date DATETIME,
    end_date DATETIME,
    status ENUM('active', 'archived', 'draft') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ranking_entries (
    id VARCHAR(36) PRIMARY KEY,
    ranking_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    score DECIMAL(5, 2),
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
