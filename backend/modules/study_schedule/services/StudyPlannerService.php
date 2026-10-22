<?php
declare(strict_types=1);
require_once __DIR__ . '/StudyPlanEngine.php';
require_once __DIR__ . '/../repositories/StudyScheduleRepository.php';

final class StudyPlannerService
{
    public function __construct(private PDO $db, private string $userId, private bool $admin) {}

    private function query(string $sql, array $args = []): PDOStatement
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($args);
        return $stmt;
    }

    private function access(): void
    {
        $legacy = new StudyScheduleRepository($this->db);
        if (!$this->admin && (!$legacy->isFeatureEnabled() || !str_contains(strtolower($legacy->resolveUserPlanName($this->userId)), 'elite'))) {
            throw new DomainException('Cronogramas personalizados exigem o plano Elite e o modulo habilitado.');
        }
    }

    private function plan(string $id, bool $lock = false): array
    {
        $row = $this->query('SELECT * FROM study_plans WHERE id = ? AND user_id = ?' . ($lock ? ' FOR UPDATE' : ''), [$id, $this->userId])->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException('Cronograma nao encontrado.');
        $row['config'] = json_decode($row['config_json'], true, 512, JSON_THROW_ON_ERROR);
        unset($row['config_json'], $row['user_id']);
        $rows = $this->query('SELECT * FROM study_plan_sessions WHERE plan_id = ? ORDER BY scheduled_date, id', [$id])->fetchAll(PDO::FETCH_ASSOC);
        $row['sessions'] = array_map(static function ($s) {
            return array_merge(json_decode($s['payload_json'], true), ['id' => $s['id'], 'date' => $s['scheduled_date'], 'status' => $s['status'], 'startedAt' => $s['started_at'], 'completedAt' => $s['completed_at']]);
        }, $rows);
        usort($row['sessions'], static fn($a, $b) => [$a['date'], $a['ordinal'] ?? 0, $a['id']] <=> [$b['date'], $b['ordinal'] ?? 0, $b['id']]);
        return $row;
    }

    private function performance(array $config, string $since): array
    {
        // Select first-ever answers across live and archived history before filtering the period.
        $rows = $this->query("SELECT f.name, COUNT(DISTINCT a.question_id) AS total,
                COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.question_id END) AS correct
            FROM (
                SELECT question_id, is_correct, created_at, ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY created_at, id) AS rn
                FROM (
                    SELECT id, question_id, is_correct, created_at FROM user_answers WHERE user_id = ?
                    UNION ALL SELECT id, question_id, is_correct, created_at FROM user_answers_archive WHERE user_id = ?
                ) history
            ) a
            JOIN question_filters qf ON qf.question_id = a.question_id
            JOIN filters f ON f.id = qf.filter_id AND f.type = 'assunto' AND (f.meta_materia = 1 OR f.taxonomy_level = 'materia')
            WHERE a.rn = 1 AND a.created_at >= ? GROUP BY f.name", [$this->userId, $this->userId, $since])->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($config['subjects'] as $s) {
            $result[$s['name']] = ['total' => 0, 'correct' => 0, 'accuracy' => null];
            foreach ($rows as $row) if (mb_strtolower($row['name']) === mb_strtolower($s['name'])) {
                $result[$s['name']] = ['total' => (int) $row['total'], 'correct' => (int) $row['correct'], 'accuracy' => round(100 * $row['correct'] / max(1, $row['total']), 1)];
            }
        }
        return $result;
    }

    private function insertSessions(string $planId, array $sessions): void
    {
        foreach ($sessions as $session) $this->query('INSERT INTO study_plan_sessions (id, plan_id, scheduled_date, payload_json) VALUES (?, ?, ?, ?)',
            [$session['id'], $planId, $session['date'], json_encode($session, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    }

    public function read(array $request): array
    {
        $this->access();
        if (!empty($request['id'])) {
            $plan = $this->plan((string) $request['id']);
            $days = (int) ($request['days'] ?? 0);
            $since = $days > 0 ? (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->modify('-' . min(365, $days) . ' days')->format('Y-m-d') : $plan['created_at'];
            return ['plan' => $plan, 'performance' => $this->performance($plan['config'], max($since, $plan['created_at']))];
        }
        $templates = $this->query('SELECT * FROM study_plan_templates' . ($this->admin ? '' : " WHERE status = 'published'") . ' ORDER BY title')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($templates as &$template) { $template['config'] = json_decode($template['config_json'], true); unset($template['config_json']); }
        $plans = $this->query('SELECT id, title, status, revision, created_at, updated_at FROM study_plans WHERE user_id = ? ORDER BY updated_at DESC', [$this->userId])->fetchAll(PDO::FETCH_ASSOC);
        $legacy = (new StudyScheduleRepository($this->db))->findByUserId($this->userId);
        return ['plans' => $plans, 'templates' => $templates, 'legacy' => $legacy, 'canManageTemplates' => $this->admin];
    }

    public function write(array $input): array
    {
        $this->access();
        $action = (string) ($input['action'] ?? '');
        if (in_array($action, ['preview', 'create', 'template'], true)) {
            $config = StudyPlanEngine::normalize($input['config'] ?? []);
            if ($action === 'template') {
                if (!$this->admin) throw new DomainException('Apenas administradores podem publicar modelos.');
                if (($input['status'] ?? '') === 'published' && !$config['sourceUrl']) throw new InvalidArgumentException('Informe a fonte do edital para publicar o modelo.');
                $id = (string) ($input['id'] ?? bin2hex(random_bytes(12)));
                if (!preg_match('/^[a-f0-9]{24}$/', $id)) throw new InvalidArgumentException('Modelo invalido.');
                $this->query('INSERT INTO study_plan_templates (id, title, config_json, status, updated_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE title=VALUES(title), config_json=VALUES(config_json), status=VALUES(status), version=version+1, updated_at=UTC_TIMESTAMP()',
                    [$id, $config['title'], json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), ($input['status'] ?? '') === 'published' ? 'published' : 'draft']);
                return ['id' => $id];
            }
            $today = (new DateTimeImmutable('today', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
            if ($config['startDate'] < $today) throw new InvalidArgumentException('O inicio do plano nao pode estar no passado.');
            $performance = $this->performance($config, (new DateTimeImmutable('-90 days'))->format('Y-m-d'));
            $sessions = StudyPlanEngine::generate($config, $performance);
            if ($action === 'preview') return ['sessions' => $sessions, 'config' => $config];
            $id = bin2hex(random_bytes(12));
            if ((int) $this->query("SELECT COUNT(*) FROM study_plans WHERE user_id=? AND status<>'archived'", [$this->userId])->fetchColumn() >= 20) throw new InvalidArgumentException('Arquive um plano antes de criar outro. Limite de 20 planos ativos.');
            $templateId = $input['templateId'] ?? null;
            $version = null;
            if ($templateId) {
                $version = $this->query("SELECT version FROM study_plan_templates WHERE id = ? AND status = 'published'", [$templateId])->fetchColumn();
                if (!$version) throw new InvalidArgumentException('Modelo indisponivel.');
            }
            $this->db->beginTransaction();
            try {
                $this->query('INSERT INTO study_plans (id,user_id,title,config_json,template_id,template_version,created_at,updated_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',
                    [$id, $this->userId, $config['title'], json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $templateId, $version]);
                $this->insertSessions($id, $sessions);
                $this->db->commit();
            } catch (Throwable $e) { $this->db->rollBack(); throw $e; }
            return ['plan' => $this->plan($id)];
        }
        $this->db->beginTransaction();
        try {
            // Serialize changes across this user's plans, including simultaneous starts.
            $this->query('SELECT id FROM users WHERE id = ? FOR UPDATE', [$this->userId]);
            $plan = $this->plan((string) ($input['id'] ?? ''), true);
            if ((int) ($input['revision'] ?? 0) !== (int) $plan['revision']) throw new UnexpectedValueException('O plano mudou em outra aba. Atualize antes de continuar.');
            if ($action === 'status') {
                $status = (string) ($input['status'] ?? '');
                if (!in_array($status, ['active', 'paused', 'completed', 'archived'], true)) throw new InvalidArgumentException('Situacao invalida.');
                if ($status !== 'active' && array_filter($plan['sessions'], static fn($s) => $s['status'] === 'started')) throw new InvalidArgumentException('Conclua a atividade em andamento antes de pausar ou arquivar o plano.');
                $this->query('UPDATE study_plans SET status = ? WHERE id = ?', [$status, $plan['id']]);
            } elseif ($action === 'session') {
                if ($plan['status'] !== 'active') throw new InvalidArgumentException('Retome o plano antes de alterar atividades.');
                $matches = array_values(array_filter($plan['sessions'], static fn($s) => $s['id'] === ($input['sessionId'] ?? '')));
                if (!$matches) throw new OutOfBoundsException('Atividade nao encontrada.');
                $s = $matches[0];
                $operation = (string) ($input['operation'] ?? '');
                if ($operation === 'start' && $s['status'] === 'planned') {
                    if ($this->query("SELECT s.id FROM study_plan_sessions s JOIN study_plans p ON p.id=s.plan_id WHERE p.user_id=? AND s.status='started' LIMIT 1", [$this->userId])->fetchColumn()) throw new InvalidArgumentException('Conclua a atividade em andamento antes de iniciar outra.');
                    $this->query("UPDATE study_plan_sessions SET status='started', started_at=UTC_TIMESTAMP() WHERE id=?", [$s['id']]);
                } elseif ($operation === 'complete' && $s['status'] === 'started') {
                    $elapsed = max(0, time() - strtotime($s['startedAt'] . ' UTC'));
                    $s['actualMinutes'] = min($s['minutes'], (int) floor($elapsed / 60));
                    $this->query("UPDATE study_plan_sessions SET status='completed', completed_at=UTC_TIMESTAMP(), payload_json=? WHERE id=?", [json_encode($s, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $s['id']]);
                } elseif ($operation === 'reschedule' && $s['status'] === 'planned') {
                    $date = StudyPlanEngine::date((string) ($input['date'] ?? ''));
                    $today = new DateTimeImmutable('today', new DateTimeZone('America/Sao_Paulo'));
                    if ($date < $today || $date >= StudyPlanEngine::date($plan['config']['examDate'])) throw new InvalidArgumentException('Escolha uma data entre hoje e a vespera da prova.');
                    $used = array_sum(array_map(static fn($item) => $item['date'] === $date->format('Y-m-d') && $item['id'] !== $s['id'] ? $item['minutes'] + 5 : 0, $plan['sessions']));
                    if ($used + $s['minutes'] > $plan['config']['availability'][$date->format('N')]) throw new InvalidArgumentException('Nao ha tempo disponivel nesse dia.');
                    $this->query('UPDATE study_plan_sessions SET scheduled_date=? WHERE id=?', [$date->format('Y-m-d'), $s['id']]);
                } else throw new InvalidArgumentException('A atividade ja mudou de estado. Atualize o plano.');
            } elseif ($action === 'revise') {
                $config = StudyPlanEngine::normalize($input['config'] ?? []);
                $today = (new DateTimeImmutable('today', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
                $config['startDate'] = max($config['startDate'], $today);
                if ($config['examDate'] <= $config['startDate']) throw new InvalidArgumentException('A data da prova precisa estar no futuro.');
                $sessions = StudyPlanEngine::generate($config, $this->performance($config, $plan['created_at']));
                // Keep completed, running and past pending sessions; avoid overbooking preserved dates.
                $reserved = [];
                foreach ($plan['sessions'] as $s) if ($s['status'] !== 'planned' || $s['date'] < $today) $reserved[$s['date']] = ($reserved[$s['date']] ?? 0) + $s['minutes'] + 5;
                $remaining = [];
                foreach ($sessions as $s) {
                    $day = StudyPlanEngine::date($s['date'])->format('N');
                    $cap = (int) floor($config['availability'][$day] * (1 - $config['reservePercent'] / 100));
                    if (($reserved[$s['date']] ?? 0) + $s['minutes'] <= $cap) { $remaining[] = $s; $reserved[$s['date']] = ($reserved[$s['date']] ?? 0) + $s['minutes'] + 5; }
                }
                $this->query("DELETE FROM study_plan_sessions WHERE plan_id=? AND status='planned' AND scheduled_date>=?", [$plan['id'], $today]);
                $this->insertSessions($plan['id'], $remaining);
                $this->query('UPDATE study_plans SET config_json=?, title=? WHERE id=?', [json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $config['title'], $plan['id']]);
            } else throw new InvalidArgumentException('Operacao invalida.');
            $this->query('UPDATE study_plans SET revision=revision+1, updated_at=UTC_TIMESTAMP() WHERE id=?', [$plan['id']]);
            $this->db->commit();
            return ['plan' => $this->plan($plan['id'])];
        } catch (Throwable $e) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $e; }
    }
}
