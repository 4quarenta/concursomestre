-- Seed Data for ConcursoMestre (Comprehensive & Complete)
USE concursomestre;

SET FOREIGN_KEY_CHECKS = 0;
-- Truncate all tables to ensure clean state
TRUNCATE TABLE user_notes;
TRUNCATE TABLE user_answers;
TRUNCATE TABLE simulations;
TRUNCATE TABLE question_filters;
TRUNCATE TABLE question_stats;
TRUNCATE TABLE questions;
TRUNCATE TABLE provas;
TRUNCATE TABLE filters;
TRUNCATE TABLE bank_accounts;
TRUNCATE TABLE addresses;
TRUNCATE TABLE users;
TRUNCATE TABLE transactions;
TRUNCATE TABLE materials;
TRUNCATE TABLE comments;
TRUNCATE TABLE reports;
TRUNCATE TABLE notifications;
TRUNCATE TABLE ranking_entries;
TRUNCATE TABLE rankings;
TRUNCATE TABLE system_settings;
TRUNCATE TABLE user_saved_questions;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------
-- 1. Users
('u-student', 'JoÃ£o da Silva', 'student@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 15, 3200, 10, 'active', 1, NOW()),
('u-student2', 'Maria Souza', 'maria@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 5, 800, 0, 'active', 1, NOW()),
('u-student3', 'Carlos Pereira', 'carlos@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 25, 8000, 50, 'active', 1, NOW());

-- =============================================
-- 2. Addresses & Bank Accounts
-- =============================================
INSERT INTO addresses (user_id, zip_code, street, number, complement, neighborhood, city, state) VALUES 
('u-partner', '01001-000', 'PraÃ§a da SÃ©', '10', 'Sala 5', 'SÃ©', 'SÃ£o Paulo', 'SP'),
('u-student', '20040-002', 'Rua da Assembleia', '50', '', 'Centro', 'Rio de Janeiro', 'RJ');

INSERT INTO bank_accounts (user_id, bank_code, bank_name, agency, account, account_digit, holder_name, holder_document, account_type) VALUES 
('u-partner', '001', 'Banco do Brasil', '1234', '56789', 'X', 'Renato Silva', '12345678900', 'checking');

-- =============================================
-- 3. Filters (Taxonomies)
-- =============================================
INSERT INTO filters (type, name, slug) VALUES 
-- Bancas
('banca', 'Cebraspe', 'cebraspe'), ('banca', 'FGV', 'fgv'), ('banca', 'Vunesp', 'vunesp'), ('banca', 'FCC', 'fcc'),
-- NÃ­vel
('nivel', 'NÃ­vel Superior', 'superior'), ('nivel', 'NÃ­vel MÃ©dio', 'medio'),
-- Tipo de Prova
('tipo_prova', 'Objetiva', 'objetiva'), ('tipo_prova', 'Discursiva', 'discursiva');

-- Orgaos with meta
INSERT INTO filters (type, name, slug, meta_esfera, meta_uf) VALUES 
('orgao', 'PolÃ­cia Federal', 'pf', 'Federal', NULL),
('orgao', 'TJ-SP', 'tjsp', 'Estadual', 'SP'),
('orgao', 'INSS', 'inss', 'Federal', NULL);

-- Cargos
INSERT INTO filters (type, name, slug) VALUES 
('cargo', 'Agente', 'agente'), ('cargo', 'EscrivÃ£o', 'escrivao'), ('cargo', 'Auditor', 'auditor');

-- Anos
INSERT INTO filters (type, name, slug) VALUES 
('ano', '2024', '2024'), ('ano', '2023', '2023'), ('ano', '2022', '2022');

-- Assuntos Hierarchy
INSERT INTO filters (type, name, slug, meta_materia) VALUES 
('assunto', 'LÃ­ngua Portuguesa', 'portugues', 1),
('assunto', 'Direito Constitucional', 'constitucional', 1),
('assunto', 'InformÃ¡tica', 'informatica', 1);

SET @id_port = (SELECT id FROM filters WHERE slug='portugues');
SET @id_const = (SELECT id FROM filters WHERE slug='constitucional');
SET @id_info = (SELECT id FROM filters WHERE slug='informatica');

INSERT INTO filters (type, name, slug, parent_id) VALUES 
('assunto', 'Sintaxe', 'sintaxe', @id_port),
('assunto', 'Direitos Fundamentais', 'direitos-fundamentais', @id_const),
('assunto', 'SeguranÃ§a da InformaÃ§Ã£o', 'seguranca', @id_info);

-- =============================================
-- 4. Provas (Exams)
-- =============================================
-- Links: Banca=Cebraspe, Orgao=PF, Cargo=Agente, Nivel=Superior
SET @id_cebraspe = (SELECT id FROM filters WHERE slug='cebraspe');
SET @id_pf = (SELECT id FROM filters WHERE slug='pf');
SET @id_agente = (SELECT id FROM filters WHERE slug='agente');
SET @id_sup = (SELECT id FROM filters WHERE slug='superior');
SET @id_obj = (SELECT id FROM filters WHERE slug='objetiva');

INSERT INTO provas (nome, slug, ano, banca_id, orgao_id, cargo_id, nivel_id, tipo_prova_id) VALUES 
('Prova PF Agente 2021', 'pf-agente-2021', 2021, @id_cebraspe, @id_pf, @id_agente, @id_sup, @id_obj);
SET @id_prova_pf = LAST_INSERT_ID();

-- =============================================
-- 5. Questions
-- =============================================
-- Q1: Linked to Prova PF
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, prova_id, created_at) VALUES 
('<p>A palavra "imprescindÃ­vel" Ã© acentuada por ser paroxÃ­tona terminada em ditongo.</p>', 
'A palavra "imprescindÃ­vel" Ã© acentuada por ser paroxÃ­tona terminada em ditongo.', 
'certo_errado', 2, 0, 
'{"itens": [{"id": 1, "rotulo": "C", "corpo": "Certo"}, {"id": 2, "rotulo": "E", "corpo": "Errado"}], "teacherComment": "Correto."}', @id_prova_pf, NOW());
SET @q1 = LAST_INSERT_ID();

-- Q2: Independent Question (Math)
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES 
('<p>Quanto Ã© 2 + 2?</p>', 'Quanto Ã© 2 + 2?', 'multipla_escolha', 1, 1, 
'{"itens": [{"id": 1, "rotulo": "A", "corpo": "3"}, {"id": 2, "rotulo": "B", "corpo": "4"}, {"id": 3, "rotulo": "C", "corpo": "5"}, {"id": 4, "rotulo": "D", "corpo": "6"}]}', NOW());
SET @q2 = LAST_INSERT_ID();

-- Link Q1 to Filters
INSERT INTO question_filters (question_id, filter_id) VALUES 
(@q1, @id_cebraspe), (@q1, @id_port), (@q1, (SELECT id FROM filters WHERE slug='sintaxe'));

-- Link Q2 to Filters (FCC, Maths simulated)
INSERT INTO question_filters (question_id, filter_id) VALUES 
(@q2, (SELECT id FROM filters WHERE slug='fcc'));

-- Stats
INSERT INTO question_stats (question_id, total_attempts, correct_count, wrong_count) VALUES 
(@q1, 10, 8, 2), (@q2, 5, 5, 0);

-- =============================================
-- 6. Simulations & User Answers
-- =============================================
INSERT INTO simulations (id, user_id, name, config_json, status, score, start_time, end_time) VALUES 
('sim-1', 'u-student', 'Simulado Reta Final PF', '{"banca": "Cebraspe", "materia": "Portugues"}', 'completed', 100.00, DATE_SUB(NOW(), INTERVAL 1 HOUR), NOW());

-- Answers
INSERT INTO user_answers (user_id, question_id, simulation_id, selected_option_index, is_correct, time_taken_seconds, created_at) VALUES 
('u-student', @q1, 'sim-1', 0, 1, 45, NOW()), -- Correct answer in Sim
('u-student', @q2, NULL, 1, 1, 10, DATE_SUB(NOW(), INTERVAL 1 DAY)); -- Practice mode answer

-- =============================================
-- 7. User Notes
-- =============================================
INSERT INTO user_notes (id, user_id, question_id, note_text) VALUES 
('note-1', 'u-student', @q1, 'Revisar regra de acentuaÃ§Ã£o de ditongos.');

-- =============================================
-- 8. Marketplace (Materials & Transactions)
-- =============================================
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES 
('mat-1', 'u-partner', 'Resumo de Direito Constitucional', 'O melhor resumo.', 29.90, 'PDF', 'approved', 10),
('mat-2', 'u-partner', '500 QuestÃµes Comentadas', 'Essencial.', 49.90, 'PDF', 'approved', 50);

INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES 
('tx-1', 'u-student', 'u-partner', 'mat-1', 29.90, 2.99, 'completed', NOW()),
('tx-2', 'u-student3', 'u-partner', 'mat-2', 49.90, 4.99, 'completed', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- =============================================
-- 9. Social (Comments, Reports, Notifications)
-- =============================================
INSERT INTO comments (id, user_id, target_type, target_id, content, likes_count, created_at) VALUES 
('c-1', 'u-student', 'question', @q1, 'DÃºvida: e se fosse proparoxÃ­tona?', 2, NOW()),
('c-2', 'u-partner', 'question', @q1, 'AÃ­ seria acentuada pela regra das proparoxÃ­tonas.', 5, DATE_ADD(NOW(), INTERVAL 10 MINUTE));

INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status) VALUES 
('rep-1', 'u-student2', 'question', @q2, 'QuestÃ£o muito fÃ¡cil', 'ignored');

INSERT INTO notifications (id, user_id, type, title, message, is_read) VALUES 
('not-1', 'u-student', 'success', 'Compra Confirmada', 'Seu material jÃ¡ estÃ¡ disponÃ­vel.', 0);

-- =============================================
-- 10. Rankings
-- =============================================
INSERT INTO rankings (id, name, institution, total_questions, status) VALUES 
('rank-1', 'Simulado Nacional PF', 'PolÃ­cia Federal', 120, 'active');

INSERT INTO ranking_entries (id, ranking_id, user_id, score, details_json) VALUES 
('re-1', 'rank-1', 'u-student', 85.0, '{"correct": 85, "wrong": 35}'),
('re-2', 'rank-1', 'u-student3', 92.0, '{"correct": 92, "wrong": 28}');

-- =============================================
-- 11. System Settings
-- =============================================
INSERT INTO system_settings (key_name, value_json) VALUES 
('features', '{"marketplace": true, "simulation": true, "ai_comments": false, "bulkImportEnabled": true, "loginRequired": false, "maintenanceMode": false, "registrationEnabled": true}'),
('pricing', '{"pro_monthly": 29.90, "elite_monthly": 49.90, "pro_annual": 299.90, "elite_annual": 499.90}');

-- GENERATED USERS --
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-101', 'User Test 1', 'user1@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 22, 8701, 9, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-102', 'User Test 2', 'user2@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 68, 2406, 3, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-103', 'User Test 3', 'user3@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 93, 8296, 9, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-104', 'User Test 4', 'user4@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 27, 9726, 10, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-105', 'User Test 5', 'user5@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 20, 7738, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-106', 'User Test 6', 'user6@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 43, 3614, 4, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-107', 'User Test 7', 'user7@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 81, 1570, 2, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-108', 'User Test 8', 'user8@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 5, 2592, 3, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-109', 'User Test 9', 'user9@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 20, 7303, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-110', 'User Test 10', 'user10@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 54, 9189, 10, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-111', 'User Test 11', 'user11@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 16, 8682, 9, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-112', 'User Test 12', 'user12@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 72, 2466, 3, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-113', 'User Test 13', 'user13@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 96, 7740, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-114', 'User Test 14', 'user14@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 60, 3302, 4, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-115', 'User Test 15', 'user15@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 44, 3081, 4, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-116', 'User Test 16', 'user16@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 85, 7853, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-117', 'User Test 17', 'user17@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 3, 7211, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-118', 'User Test 18', 'user18@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 67, 9689, 10, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-119', 'User Test 19', 'user19@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 37, 9194, 10, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-120', 'User Test 20', 'user20@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 69, 1775, 2, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-121', 'User Test 21', 'user21@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 5, 7419, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-122', 'User Test 22', 'user22@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 74, 4422, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-123', 'User Test 23', 'user23@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 80, 3968, 4, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-124', 'User Test 24', 'user24@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 43, 4859, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-125', 'User Test 25', 'user25@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 50, 4465, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-126', 'User Test 26', 'user26@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 16, 1766, 2, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-127', 'User Test 27', 'user27@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 7, 4519, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-128', 'User Test 28', 'user28@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 8, 201, 1, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-129', 'User Test 29', 'user29@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 60, 4090, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-130', 'User Test 30', 'user30@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 34, 9251, 10, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-131', 'User Test 31', 'user31@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 40, 5797, 6, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-132', 'User Test 32', 'user32@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 59, 6924, 7, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-133', 'User Test 33', 'user33@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 82, 2499, 3, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-134', 'User Test 34', 'user34@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 66, 747, 1, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-135', 'User Test 35', 'user35@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 7, 8908, 9, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-136', 'User Test 36', 'user36@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Gratuito', 89, 2534, 3, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-137', 'User Test 37', 'user37@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 34, 4060, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-138', 'User Test 38', 'user38@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 79, 7370, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-139', 'User Test 39', 'user39@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 67, 6024, 7, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-140', 'User Test 40', 'user40@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 49, 4746, 5, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-141', 'User Test 41', 'user41@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 2, 7872, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-142', 'User Test 42', 'user42@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 6, 1144, 2, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-143', 'User Test 43', 'user43@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 48, 7769, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-144', 'User Test 44', 'user44@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 34, 3177, 4, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-145', 'User Test 45', 'user45@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 6, 1863, 2, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-146', 'User Test 46', 'user46@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 71, 7627, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-147', 'User Test 47', 'user47@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Essencial', 14, 7088, 8, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-148', 'User Test 48', 'user48@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 25, 1818, 2, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-149', 'User Test 49', 'user49@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Pro', 13, 3388, 4, 'active', 1, NOW());
INSERT INTO users (id, name, email, password, role, plan_tier, reputation, xp, level, status, terms_agreed, created_at) VALUES ('user-150', 'User Test 50', 'user50@test.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Elite', 41, 7853, 8, 'active', 1, NOW());

-- GENERATED QUESTIONS --
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 1 - Quanto Ú 1 + 1?</p>', 'QuestÒo Gerada 1 - Quanto Ú 1 + 1?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 2 - Quanto Ú 2 + 2?</p>', 'QuestÒo Gerada 2 - Quanto Ú 2 + 2?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 3 - Quanto Ú 3 + 3?</p>', 'QuestÒo Gerada 3 - Quanto Ú 3 + 3?', 'multipla_escolha', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 4 - Quanto Ú 4 + 4?</p>', 'QuestÒo Gerada 4 - Quanto Ú 4 + 4?', 'multipla_escolha', 3, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 5 - Quanto Ú 5 + 5?</p>', 'QuestÒo Gerada 5 - Quanto Ú 5 + 5?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 6 - Quanto Ú 6 + 6?</p>', 'QuestÒo Gerada 6 - Quanto Ú 6 + 6?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 7 - Quanto Ú 7 + 7?</p>', 'QuestÒo Gerada 7 - Quanto Ú 7 + 7?', 'certo_errado', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 8 - Quanto Ú 8 + 8?</p>', 'QuestÒo Gerada 8 - Quanto Ú 8 + 8?', 'multipla_escolha', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 9 - Quanto Ú 9 + 9?</p>', 'QuestÒo Gerada 9 - Quanto Ú 9 + 9?', 'multipla_escolha', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 10 - Quanto Ú 10 + 10?</p>', 'QuestÒo Gerada 10 - Quanto Ú 10 + 10?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 11 - Quanto Ú 11 + 11?</p>', 'QuestÒo Gerada 11 - Quanto Ú 11 + 11?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 12 - Quanto Ú 12 + 12?</p>', 'QuestÒo Gerada 12 - Quanto Ú 12 + 12?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 13 - Quanto Ú 13 + 13?</p>', 'QuestÒo Gerada 13 - Quanto Ú 13 + 13?', 'multipla_escolha', 3, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 14 - Quanto Ú 14 + 14?</p>', 'QuestÒo Gerada 14 - Quanto Ú 14 + 14?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 15 - Quanto Ú 15 + 15?</p>', 'QuestÒo Gerada 15 - Quanto Ú 15 + 15?', 'certo_errado', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 16 - Quanto Ú 16 + 16?</p>', 'QuestÒo Gerada 16 - Quanto Ú 16 + 16?', 'certo_errado', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 17 - Quanto Ú 17 + 17?</p>', 'QuestÒo Gerada 17 - Quanto Ú 17 + 17?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 18 - Quanto Ú 18 + 18?</p>', 'QuestÒo Gerada 18 - Quanto Ú 18 + 18?', 'certo_errado', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 19 - Quanto Ú 19 + 19?</p>', 'QuestÒo Gerada 19 - Quanto Ú 19 + 19?', 'multipla_escolha', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 20 - Quanto Ú 20 + 20?</p>', 'QuestÒo Gerada 20 - Quanto Ú 20 + 20?', 'multipla_escolha', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 21 - Quanto Ú 21 + 21?</p>', 'QuestÒo Gerada 21 - Quanto Ú 21 + 21?', 'multipla_escolha', 3, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 22 - Quanto Ú 22 + 22?</p>', 'QuestÒo Gerada 22 - Quanto Ú 22 + 22?', 'multipla_escolha', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 23 - Quanto Ú 23 + 23?</p>', 'QuestÒo Gerada 23 - Quanto Ú 23 + 23?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 24 - Quanto Ú 24 + 24?</p>', 'QuestÒo Gerada 24 - Quanto Ú 24 + 24?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 25 - Quanto Ú 25 + 25?</p>', 'QuestÒo Gerada 25 - Quanto Ú 25 + 25?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 26 - Quanto Ú 26 + 26?</p>', 'QuestÒo Gerada 26 - Quanto Ú 26 + 26?', 'certo_errado', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 27 - Quanto Ú 27 + 27?</p>', 'QuestÒo Gerada 27 - Quanto Ú 27 + 27?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 28 - Quanto Ú 28 + 28?</p>', 'QuestÒo Gerada 28 - Quanto Ú 28 + 28?', 'certo_errado', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 29 - Quanto Ú 29 + 29?</p>', 'QuestÒo Gerada 29 - Quanto Ú 29 + 29?', 'certo_errado', 3, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 30 - Quanto Ú 30 + 30?</p>', 'QuestÒo Gerada 30 - Quanto Ú 30 + 30?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 31 - Quanto Ú 31 + 31?</p>', 'QuestÒo Gerada 31 - Quanto Ú 31 + 31?', 'certo_errado', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 32 - Quanto Ú 32 + 32?</p>', 'QuestÒo Gerada 32 - Quanto Ú 32 + 32?', 'certo_errado', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 33 - Quanto Ú 33 + 33?</p>', 'QuestÒo Gerada 33 - Quanto Ú 33 + 33?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 34 - Quanto Ú 34 + 34?</p>', 'QuestÒo Gerada 34 - Quanto Ú 34 + 34?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 35 - Quanto Ú 35 + 35?</p>', 'QuestÒo Gerada 35 - Quanto Ú 35 + 35?', 'multipla_escolha', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 36 - Quanto Ú 36 + 36?</p>', 'QuestÒo Gerada 36 - Quanto Ú 36 + 36?', 'certo_errado', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 37 - Quanto Ú 37 + 37?</p>', 'QuestÒo Gerada 37 - Quanto Ú 37 + 37?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 38 - Quanto Ú 38 + 38?</p>', 'QuestÒo Gerada 38 - Quanto Ú 38 + 38?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 39 - Quanto Ú 39 + 39?</p>', 'QuestÒo Gerada 39 - Quanto Ú 39 + 39?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 40 - Quanto Ú 40 + 40?</p>', 'QuestÒo Gerada 40 - Quanto Ú 40 + 40?', 'certo_errado', 3, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 41 - Quanto Ú 41 + 41?</p>', 'QuestÒo Gerada 41 - Quanto Ú 41 + 41?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 42 - Quanto Ú 42 + 42?</p>', 'QuestÒo Gerada 42 - Quanto Ú 42 + 42?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 43 - Quanto Ú 43 + 43?</p>', 'QuestÒo Gerada 43 - Quanto Ú 43 + 43?', 'multipla_escolha', 2, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 44 - Quanto Ú 44 + 44?</p>', 'QuestÒo Gerada 44 - Quanto Ú 44 + 44?', 'multipla_escolha', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 45 - Quanto Ú 45 + 45?</p>', 'QuestÒo Gerada 45 - Quanto Ú 45 + 45?', 'multipla_escolha', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 46 - Quanto Ú 46 + 46?</p>', 'QuestÒo Gerada 46 - Quanto Ú 46 + 46?', 'multipla_escolha', 1, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 47 - Quanto Ú 47 + 47?</p>', 'QuestÒo Gerada 47 - Quanto Ú 47 + 47?', 'certo_errado', 5, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 48 - Quanto Ú 48 + 48?</p>', 'QuestÒo Gerada 48 - Quanto Ú 48 + 48?', 'certo_errado', 3, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 49 - Quanto Ú 49 + 49?</p>', 'QuestÒo Gerada 49 - Quanto Ú 49 + 49?', 'certo_errado', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());
INSERT INTO questions (enunciado, enunciado_clean, tipo, dificuldade, resposta_correta_item_index, data_json, created_at) VALUES ('<p>QuestÒo Gerada 50 - Quanto Ú 50 + 50?</p>', 'QuestÒo Gerada 50 - Quanto Ú 50 + 50?', 'certo_errado', 4, 1, '{"itens": [{"id": 1, "rotulo": "A", "corpo": "Errado"}, {"id": 2, "rotulo": "B", "corpo": "Certo"}]}', NOW());

-- GENERATED MATERIALS --
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-101', 'u-partner', 'Material de Estudo 1', 'DescriþÒo do material gerado 1.', 29.9, 'PDF', 'approved', 30);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-102', 'u-partner', 'Material de Estudo 2', 'DescriþÒo do material gerado 2.', 49.9, 'PDF', 'approved', 57);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-103', 'u-partner', 'Material de Estudo 3', 'DescriþÒo do material gerado 3.', 49.9, 'PDF', 'approved', 0);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-104', 'u-partner', 'Material de Estudo 4', 'DescriþÒo do material gerado 4.', 19.9, 'PDF', 'approved', 9);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-105', 'u-partner', 'Material de Estudo 5', 'DescriþÒo do material gerado 5.', 29.9, 'PDF', 'approved', 47);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-106', 'u-partner', 'Material de Estudo 6', 'DescriþÒo do material gerado 6.', 29.9, 'PDF', 'approved', 18);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-107', 'u-partner', 'Material de Estudo 7', 'DescriþÒo do material gerado 7.', 99.9, 'PDF', 'approved', 51);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-108', 'u-partner', 'Material de Estudo 8', 'DescriþÒo do material gerado 8.', 19.9, 'PDF', 'approved', 35);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-109', 'u-partner', 'Material de Estudo 9', 'DescriþÒo do material gerado 9.', 19.9, 'PDF', 'approved', 14);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-110', 'u-partner', 'Material de Estudo 10', 'DescriþÒo do material gerado 10.', 29.9, 'PDF', 'approved', 96);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-111', 'u-partner', 'Material de Estudo 11', 'DescriþÒo do material gerado 11.', 29.9, 'PDF', 'approved', 13);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-112', 'u-partner', 'Material de Estudo 12', 'DescriþÒo do material gerado 12.', 99.9, 'PDF', 'approved', 44);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-113', 'u-partner', 'Material de Estudo 13', 'DescriþÒo do material gerado 13.', 99.9, 'PDF', 'approved', 77);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-114', 'u-partner', 'Material de Estudo 14', 'DescriþÒo do material gerado 14.', 49.9, 'PDF', 'approved', 11);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-115', 'u-partner', 'Material de Estudo 15', 'DescriþÒo do material gerado 15.', 49.9, 'PDF', 'approved', 51);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-116', 'u-partner', 'Material de Estudo 16', 'DescriþÒo do material gerado 16.', 29.9, 'PDF', 'approved', 19);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-117', 'u-partner', 'Material de Estudo 17', 'DescriþÒo do material gerado 17.', 29.9, 'PDF', 'approved', 71);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-118', 'u-partner', 'Material de Estudo 18', 'DescriþÒo do material gerado 18.', 49.9, 'PDF', 'approved', 54);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-119', 'u-partner', 'Material de Estudo 19', 'DescriþÒo do material gerado 19.', 99.9, 'PDF', 'approved', 42);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-120', 'u-partner', 'Material de Estudo 20', 'DescriþÒo do material gerado 20.', 19.9, 'PDF', 'approved', 39);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-121', 'u-partner', 'Material de Estudo 21', 'DescriþÒo do material gerado 21.', 29.9, 'PDF', 'approved', 78);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-122', 'u-partner', 'Material de Estudo 22', 'DescriþÒo do material gerado 22.', 99.9, 'PDF', 'approved', 56);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-123', 'u-partner', 'Material de Estudo 23', 'DescriþÒo do material gerado 23.', 19.9, 'PDF', 'approved', 48);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-124', 'u-partner', 'Material de Estudo 24', 'DescriþÒo do material gerado 24.', 19.9, 'PDF', 'approved', 48);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-125', 'u-partner', 'Material de Estudo 25', 'DescriþÒo do material gerado 25.', 99.9, 'PDF', 'approved', 63);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-126', 'u-partner', 'Material de Estudo 26', 'DescriþÒo do material gerado 26.', 19.9, 'PDF', 'approved', 83);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-127', 'u-partner', 'Material de Estudo 27', 'DescriþÒo do material gerado 27.', 19.9, 'PDF', 'approved', 55);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-128', 'u-partner', 'Material de Estudo 28', 'DescriþÒo do material gerado 28.', 99.9, 'PDF', 'approved', 44);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-129', 'u-partner', 'Material de Estudo 29', 'DescriþÒo do material gerado 29.', 49.9, 'PDF', 'approved', 63);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-130', 'u-partner', 'Material de Estudo 30', 'DescriþÒo do material gerado 30.', 19.9, 'PDF', 'approved', 40);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-131', 'u-partner', 'Material de Estudo 31', 'DescriþÒo do material gerado 31.', 19.9, 'PDF', 'approved', 24);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-132', 'u-partner', 'Material de Estudo 32', 'DescriþÒo do material gerado 32.', 19.9, 'PDF', 'approved', 92);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-133', 'u-partner', 'Material de Estudo 33', 'DescriþÒo do material gerado 33.', 19.9, 'PDF', 'approved', 91);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-134', 'u-partner', 'Material de Estudo 34', 'DescriþÒo do material gerado 34.', 49.9, 'PDF', 'approved', 51);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-135', 'u-partner', 'Material de Estudo 35', 'DescriþÒo do material gerado 35.', 99.9, 'PDF', 'approved', 90);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-136', 'u-partner', 'Material de Estudo 36', 'DescriþÒo do material gerado 36.', 99.9, 'PDF', 'approved', 85);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-137', 'u-partner', 'Material de Estudo 37', 'DescriþÒo do material gerado 37.', 49.9, 'PDF', 'approved', 17);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-138', 'u-partner', 'Material de Estudo 38', 'DescriþÒo do material gerado 38.', 29.9, 'PDF', 'approved', 99);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-139', 'u-partner', 'Material de Estudo 39', 'DescriþÒo do material gerado 39.', 99.9, 'PDF', 'approved', 80);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-140', 'u-partner', 'Material de Estudo 40', 'DescriþÒo do material gerado 40.', 49.9, 'PDF', 'approved', 50);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-141', 'u-partner', 'Material de Estudo 41', 'DescriþÒo do material gerado 41.', 99.9, 'PDF', 'approved', 25);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-142', 'u-partner', 'Material de Estudo 42', 'DescriþÒo do material gerado 42.', 99.9, 'PDF', 'approved', 25);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-143', 'u-partner', 'Material de Estudo 43', 'DescriþÒo do material gerado 43.', 99.9, 'PDF', 'approved', 0);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-144', 'u-partner', 'Material de Estudo 44', 'DescriþÒo do material gerado 44.', 19.9, 'PDF', 'approved', 44);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-145', 'u-partner', 'Material de Estudo 45', 'DescriþÒo do material gerado 45.', 19.9, 'PDF', 'approved', 26);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-146', 'u-partner', 'Material de Estudo 46', 'DescriþÒo do material gerado 46.', 49.9, 'PDF', 'approved', 36);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-147', 'u-partner', 'Material de Estudo 47', 'DescriþÒo do material gerado 47.', 29.9, 'PDF', 'approved', 29);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-148', 'u-partner', 'Material de Estudo 48', 'DescriþÒo do material gerado 48.', 49.9, 'PDF', 'approved', 97);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-149', 'u-partner', 'Material de Estudo 49', 'DescriþÒo do material gerado 49.', 29.9, 'PDF', 'approved', 39);
INSERT INTO materials (id, author_id, title, description, price, type, status, sales_count) VALUES ('mat-150', 'u-partner', 'Material de Estudo 50', 'DescriþÒo do material gerado 50.', 19.9, 'PDF', 'approved', 17);

-- GENERATED TRANSACTIONS --
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-101', 'user-147', 'u-partner', 'mat-126', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-102', 'user-101', 'u-partner', 'mat-104', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-103', 'user-123', 'u-partner', 'mat-143', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-104', 'user-110', 'u-partner', 'mat-141', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-105', 'user-120', 'u-partner', 'mat-125', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-106', 'user-119', 'u-partner', 'mat-140', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-107', 'user-124', 'u-partner', 'mat-127', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-108', 'user-114', 'u-partner', 'mat-125', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-109', 'user-117', 'u-partner', 'mat-104', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-110', 'user-144', 'u-partner', 'mat-139', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-111', 'user-112', 'u-partner', 'mat-105', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-112', 'user-116', 'u-partner', 'mat-131', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-113', 'user-115', 'u-partner', 'mat-123', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-114', 'user-123', 'u-partner', 'mat-150', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-115', 'user-135', 'u-partner', 'mat-149', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-116', 'user-109', 'u-partner', 'mat-119', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-117', 'user-103', 'u-partner', 'mat-116', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-118', 'user-148', 'u-partner', 'mat-103', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-119', 'user-123', 'u-partner', 'mat-103', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-120', 'user-148', 'u-partner', 'mat-134', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-121', 'user-120', 'u-partner', 'mat-125', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-122', 'user-107', 'u-partner', 'mat-101', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-123', 'user-133', 'u-partner', 'mat-148', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-124', 'user-119', 'u-partner', 'mat-125', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-125', 'user-117', 'u-partner', 'mat-123', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-126', 'user-117', 'u-partner', 'mat-116', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-127', 'user-103', 'u-partner', 'mat-102', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-128', 'user-115', 'u-partner', 'mat-111', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-129', 'user-146', 'u-partner', 'mat-121', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-130', 'user-128', 'u-partner', 'mat-141', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-131', 'user-148', 'u-partner', 'mat-133', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-132', 'user-120', 'u-partner', 'mat-138', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-133', 'user-113', 'u-partner', 'mat-123', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-134', 'user-128', 'u-partner', 'mat-109', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-135', 'user-135', 'u-partner', 'mat-125', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-136', 'user-106', 'u-partner', 'mat-133', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-137', 'user-118', 'u-partner', 'mat-111', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-138', 'user-125', 'u-partner', 'mat-143', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-139', 'user-109', 'u-partner', 'mat-148', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-140', 'user-109', 'u-partner', 'mat-148', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-141', 'user-124', 'u-partner', 'mat-113', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-142', 'user-142', 'u-partner', 'mat-150', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-143', 'user-122', 'u-partner', 'mat-110', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-144', 'user-113', 'u-partner', 'mat-134', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-145', 'user-141', 'u-partner', 'mat-110', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-146', 'user-143', 'u-partner', 'mat-107', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-147', 'user-108', 'u-partner', 'mat-139', 29.9, 2.99, 'completed', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-148', 'user-138', 'u-partner', 'mat-143', 29.9, 2.99, 'refunded', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-149', 'user-123', 'u-partner', 'mat-141', 29.9, 2.99, 'pending', NOW());
INSERT INTO transactions (id, buyer_id, seller_id, material_id, amount, platform_fee, status, created_at) VALUES ('tx-150', 'user-137', 'u-partner', 'mat-114', 29.9, 2.99, 'pending', NOW());
