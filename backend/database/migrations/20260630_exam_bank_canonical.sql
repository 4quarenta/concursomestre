-- Canonical Banco de Provas infrastructure.
-- Provas remain the source of truth; filters stay in the shared taxonomy table.

ALTER TABLE provas
    ADD COLUMN IF NOT EXISTS titulo_oficial VARCHAR(255) NULL AFTER nome,
    ADD COLUMN IF NOT EXISTS nome_curto VARCHAR(180) NULL AFTER titulo_oficial,
    ADD COLUMN IF NOT EXISTS edital_numero VARCHAR(80) NULL AFTER slug,
    ADD COLUMN IF NOT EXISTS inscricoes_inicio DATETIME NULL AFTER edital_numero,
    ADD COLUMN IF NOT EXISTS inscricoes_fim DATETIME NULL AFTER inscricoes_inicio,
    ADD COLUMN IF NOT EXISTS data_prova DATETIME NULL AFTER inscricoes_fim,
    ADD COLUMN IF NOT EXISTS resultado_data DATETIME NULL AFTER data_prova,
    ADD COLUMN IF NOT EXISTS vagas_total INT NULL AFTER resultado_data,
    ADD COLUMN IF NOT EXISTS cadastro_reserva_total INT NULL AFTER vagas_total,
    ADD COLUMN IF NOT EXISTS url_oficial VARCHAR(500) NULL AFTER cadastro_reserva_total,
    ADD COLUMN IF NOT EXISTS status_editorial VARCHAR(30) NOT NULL DEFAULT 'draft' AFTER url_oficial,
    ADD COLUMN IF NOT EXISTS visibility_status VARCHAR(30) NOT NULL DEFAULT 'public' AFTER status_editorial,
    ADD COLUMN IF NOT EXISTS scheduled_at DATETIME NULL AFTER visibility_status,
    ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL AFTER scheduled_at;

CREATE TABLE IF NOT EXISTS prova_filters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NOT NULL,
    filter_id INT NOT NULL,
    role VARCHAR(40) NULL,
    context_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_prova_filter_role (prova_id, filter_id, role),
    INDEX idx_prova_filters_prova (prova_id),
    INDEX idx_prova_filters_filter (filter_id),
    CONSTRAINT fk_prova_filters_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
    CONSTRAINT fk_prova_filters_filter FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_cargo_detalhes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NOT NULL,
    cargo_filter_id INT NULL,
    nome VARCHAR(255) NOT NULL,
    remuneracao VARCHAR(255) NULL,
    carga_horaria VARCHAR(120) NULL,
    escolaridade VARCHAR(180) NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prova_cargo_detalhes_prova (prova_id),
    INDEX idx_prova_cargo_detalhes_cargo (cargo_filter_id),
    CONSTRAINT fk_prova_cargo_detalhes_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
    CONSTRAINT fk_prova_cargo_detalhes_cargo FOREIGN KEY (cargo_filter_id) REFERENCES filters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_cargo_requisitos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NOT NULL,
    cargo_detalhe_id BIGINT UNSIGNED NULL,
    requisito TEXT NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prova_cargo_requisitos_prova (prova_id),
    CONSTRAINT fk_prova_cargo_requisitos_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
    CONSTRAINT fk_prova_cargo_requisitos_cargo FOREIGN KEY (cargo_detalhe_id) REFERENCES prova_cargo_detalhes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_cargo_vagas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NOT NULL,
    cargo_detalhe_id BIGINT UNSIGNED NULL,
    ampla INT NOT NULL DEFAULT 0,
    pcd INT NOT NULL DEFAULT 0,
    cotas INT NOT NULL DEFAULT 0,
    cadastro_reserva INT NOT NULL DEFAULT 0,
    descricao VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prova_cargo_vagas_prova (prova_id),
    CONSTRAINT fk_prova_cargo_vagas_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
    CONSTRAINT fk_prova_cargo_vagas_cargo FOREIGN KEY (cargo_detalhe_id) REFERENCES prova_cargo_detalhes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_cadernos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NOT NULL,
    nome VARCHAR(180) NOT NULL,
    tipo VARCHAR(80) NULL,
    cor VARCHAR(80) NULL,
    ordem INT NOT NULL DEFAULT 0,
    metadata_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_prova_caderno_nome (prova_id, nome),
    INDEX idx_prova_cadernos_prova (prova_id),
    CONSTRAINT fk_prova_cadernos_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_caderno_cargos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    caderno_id BIGINT UNSIGNED NOT NULL,
    cargo_filter_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_caderno_cargo (caderno_id, cargo_filter_id),
    CONSTRAINT fk_prova_caderno_cargos_caderno FOREIGN KEY (caderno_id) REFERENCES prova_cadernos(id) ON DELETE CASCADE,
    CONSTRAINT fk_prova_caderno_cargos_cargo FOREIGN KEY (cargo_filter_id) REFERENCES filters(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_caderno_filters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    caderno_id BIGINT UNSIGNED NOT NULL,
    filter_id INT NOT NULL,
    role VARCHAR(40) NULL,
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_caderno_filter_role (caderno_id, filter_id, role),
    CONSTRAINT fk_prova_caderno_filters_caderno FOREIGN KEY (caderno_id) REFERENCES prova_cadernos(id) ON DELETE CASCADE,
    CONSTRAINT fk_prova_caderno_filters_filter FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_arquivos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NOT NULL,
    tipo ENUM('edital', 'prova', 'gabarito', 'outro') NOT NULL,
    nome_original VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NULL,
    tamanho BIGINT UNSIGNED NULL,
    versao INT NOT NULL DEFAULT 1,
    visibility_status VARCHAR(30) NOT NULL DEFAULT 'public',
    uploaded_by_user_id VARCHAR(64) NULL,
    metadata_json JSON NULL,
    archived_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prova_arquivos_prova (prova_id),
    CONSTRAINT fk_prova_arquivos_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_provas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    prova_id INT NOT NULL,
    caderno_id BIGINT UNSIGNED NULL,
    numero_na_prova INT NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_question_prova_caderno (question_id, prova_id, caderno_id),
    INDEX idx_question_provas_question (question_id),
    INDEX idx_question_provas_prova (prova_id),
    CONSTRAINT fk_question_provas_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    CONSTRAINT fk_question_provas_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
    CONSTRAINT fk_question_provas_caderno FOREIGN KEY (caderno_id) REFERENCES prova_cadernos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prova_extracoes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prova_id INT NULL,
    arquivo_id BIGINT UNSIGNED NULL,
    origem ENUM('edital', 'prova', 'gabarito', 'manual') NOT NULL,
    status ENUM('pending', 'processing', 'review', 'done', 'failed') NOT NULL DEFAULT 'pending',
    parser_profile VARCHAR(80) NULL,
    extracted_json JSON NULL,
    review_json JSON NULL,
    error_message TEXT NULL,
    created_by VARCHAR(64) NULL,
    reviewed_by VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prova_extracoes_prova (prova_id),
    CONSTRAINT fk_prova_extracoes_prova FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE SET NULL,
    CONSTRAINT fk_prova_extracoes_arquivo FOREIGN KEY (arquivo_id) REFERENCES prova_arquivos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO question_provas (question_id, prova_id, numero_na_prova)
SELECT id, prova_id, numero
FROM questions
WHERE prova_id IS NOT NULL AND prova_id > 0;
