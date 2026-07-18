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

require_once __DIR__ . '/../repositories/RankingsRepository.php';
require_once __DIR__ . '/../validators/RankingsValidator.php';

/**
 * Service do dominio de rankings.
 *
 * @since 1.0.0
 */
class RankingsService
{
    private PDO $db;
    private RankingsRepository $repository;
    private RankingsValidator $validator;

    /**
     * Inicializa o service de rankings.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        RankingsRepository $repository,
        RankingsValidator $validator
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Lista rankings e suas entradas.
     *
     * @since 1.0.0
     */
    public function list(bool $isAdmin): array
    {
        if (!$this->repository->rankingsTableExists()) {
            return [];
        }

        $rankingsMap = [];
        foreach ($this->repository->fetchRankings($isAdmin) as $row) {
            $rankingsMap[$row['id']] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'institution' => $row['institution'] ?? '',
                'imageUrl' => $row['image_url'] ?? '',
                'totalQuestions' => (int) ($row['total_questions'] ?? 60),
                'vacancies' => (int) ($row['vacancies'] ?? 10),
                'vacanciesAc' => (int) ($row['vacancies_ac'] ?? 0),
                'vacanciesAfro' => (int) ($row['vacancies_afro'] ?? 0),
                'vacanciesPcd' => (int) ($row['vacancies_pcd'] ?? 0),
                'reserveLimit' => (int) ($row['reserve_limit'] ?? 10),
                'correctKey' => $row['correct_key'] ?? '',
                'keyStatus' => $row['key_status'] ?? 'pending',
                'officialKeyReleaseDate' => $row['official_key_release_date'] ?? null,
                'examTypes' => json_decode($row['exam_types'] ?? '[]', true),
                'hasDiscursive' => (bool) ($row['has_discursive'] ?? false),
                'createdAt' => strtotime((string) $row['created_at']) * 1000,
                'status' => $row['status'] ?? 'active',
                'entries' => [],
            ];
        }

        if (!empty($rankingsMap)) {
            foreach ($this->repository->fetchEntries() as $row) {
                if (!isset($rankingsMap[$row['ranking_id']])) {
                    continue;
                }

                $rankingsMap[$row['ranking_id']]['entries'][] = [
                    'id' => $row['id'],
                    'userId' => $row['user_id'] ?? '',
                    'userName' => $row['user_name'] ?? 'Candidato',
                    'registrationNumber' => $row['registration_number'] ?? '',
                    'examType' => $row['exam_type'] ?? 'Geral',
                    'category' => $row['category'] ?? 'AC',
                    'userAnswers' => $row['user_answers'] ?? '',
                    'score' => (float) ($row['score'] ?? 0),
                    'discursiveScore' => $row['discursive_score'] !== null ? (float) $row['discursive_score'] : null,
                    'status' => $row['status'] ?? 'active',
                    'timestamp' => strtotime((string) $row['created_at']) * 1000,
                ];
            }
        }

        return array_values($rankingsMap);
    }

    /**
     * Cria um ranking novo.
     *
     * @since 1.0.0
     */
    public function create(array $data, bool $isAdmin, ?string $createdByUserId = null): array
    {
        $this->validator->validateCreatePayload($data);

        $payload = $this->buildRankingPayload($data, $isAdmin ? 'approved' : 'pending', $createdByUserId);
        $this->repository->insertRanking($payload);

        if (!$isAdmin) {
            $this->repository->notifyAdminsPendingRanking($payload[':id'], $payload[':name']);
        }

        return [
            'id' => $payload[':id'],
            'message' => 'Ranking created.',
        ];
    }

    /**
     * Registra a entrada de um participante.
     *
     * @since 1.0.0
     */
    public function join(array $data): array
    {
        $this->validator->validateJoinPayload($data);

        $entry = $data['entry'] ?? [];
        $ranking = $this->repository->findRankingById((string) $data['rankingId']);
        if (!$ranking || ($ranking['status'] ?? '') !== 'approved') {
            throw new OutOfBoundsException('Ranking nao encontrado ou indisponivel.');
        }

        $existingEntry = $this->repository->findEntryByRankingAndUser((string) $data['rankingId'], (string) $data['userId']);
        $entryId = $existingEntry
            ? (string) $existingEntry['id']
            : (trim((string) ($entry['id'] ?? '')) !== '' ? (string) $entry['id'] : uniqid('e-'));
        $payload = [
            ':id' => $entryId,
            ':ranking_id' => (string) $data['rankingId'],
            ':user_id' => (string) $data['userId'],
            ':user_name' => (string) ($entry['userName'] ?? ''),
            ':registration_number' => (string) ($entry['registrationNumber'] ?? ''),
            ':exam_type' => (string) ($entry['examType'] ?? 'Geral'),
            ':category' => (string) ($entry['category'] ?? 'AC'),
            ':user_answers' => (string) ($entry['userAnswers'] ?? ''),
            ':score' => (float) ($entry['score'] ?? 0),
            ':discursive_score' => array_key_exists('discursiveScore', $entry) ? $entry['discursiveScore'] : null,
            ':status' => (string) ($entry['status'] ?? 'active'),
            ':user_name_up' => (string) ($entry['userName'] ?? ''),
            ':registration_number_up' => (string) ($entry['registrationNumber'] ?? ''),
            ':category_up' => (string) ($entry['category'] ?? 'AC'),
            ':user_answers_up' => (string) ($entry['userAnswers'] ?? ''),
            ':score_up' => (float) ($entry['score'] ?? 0),
            ':discursive_score_up' => array_key_exists('discursiveScore', $entry) ? $entry['discursiveScore'] : null,
            ':exam_type_up' => (string) ($entry['examType'] ?? 'Geral'),
            ':status_up' => (string) ($entry['status'] ?? 'active'),
        ];

        $this->repository->upsertEntry($payload);
        if (!$existingEntry) {
            $this->repository->notifyRankingParticipantJoin(
                (string) $data['rankingId'],
                (string) $data['userId'],
                (string) ($ranking['name'] ?? 'ranking')
            );
            $this->repository->applyRankingParticipantJoinGamification(
                (string) $data['rankingId'],
                (string) $data['userId'],
                (string) ($ranking['name'] ?? 'ranking')
            );
        }

        return [
            'id' => $entryId,
            'message' => 'Participation registered.',
        ];
    }

    /**
     * Modera o ranking.
     *
     * @since 1.0.0
     */
    public function moderate(string $rankingId, string $status): void
    {
        $this->validator->validateRankingId($rankingId, 'Parametros invalidos para moderar o ranking.');
        $this->validator->validateModerationStatus($status);

        $ranking = $this->repository->findRankingById($rankingId);
        if (!$ranking) {
            throw new OutOfBoundsException('Ranking nao encontrado.');
        }

        $previousStatus = (string) ($ranking['status'] ?? '');
        $updated = $this->repository->updateRankingStatus($rankingId, $status);
        if ($updated === 0 && $previousStatus !== $status) {
            throw new OutOfBoundsException('Ranking nao encontrado.');
        }

        if ($previousStatus !== $status) {
            $this->repository->notifyRankingCreatorModeration($ranking, $status);
            $this->repository->applyRankingCreatorModerationGamification($ranking, $status);
        }
    }

    /**
     * Atualiza o ranking.
     *
     * @since 1.0.0
     */
    public function update(array $data): void
    {
        $rankingId = trim((string) ($data['id'] ?? ''));
        $name = trim((string) ($data['name'] ?? ''));
        $institution = trim((string) ($data['institution'] ?? ''));

        if ($rankingId === '' || $name === '' || $institution === '') {
            throw new InvalidArgumentException('ID, nome e instituicao sao obrigatorios.');
        }

        $previous = $this->repository->findRankingById($rankingId);
        $payload = $this->buildRankingPayload($data, null);
        $updated = $this->repository->updateRanking($payload);
        if ($updated === 0 && !$this->repository->findRankingById($rankingId)) {
            throw new OutOfBoundsException('Ranking nao encontrado.');
        }

        if (
            $previous
            && ($previous['key_status'] ?? '') !== 'official'
            && ($data['keyStatus'] ?? '') === 'official'
        ) {
            $ranking = array_merge($previous, [
                'key_status' => 'official',
                'name' => $name,
            ]);
            $this->repository->notifyRankingParticipantsOfficialKey($ranking);
            $this->repository->applyRankingOfficialKeyGamification($ranking);
        }
    }

    /**
     * Exclui um ranking.
     *
     * @since 1.0.0
     */
    public function delete(string $rankingId): array
    {
        $this->validator->validateRankingId($rankingId, 'ID do ranking e obrigatorio.');

        $ranking = $this->repository->findRankingById($rankingId);
        if (!$ranking) {
            throw new OutOfBoundsException('Ranking nao encontrado.');
        }

        $this->db->beginTransaction();
        $this->repository->deleteEntriesByRankingId($rankingId);
        $this->repository->deleteRanking($rankingId);
        $this->db->commit();

        return [
            'name' => $ranking['name'] ?? '',
        ];
    }

    /**
     * Instala as tabelas do modulo.
     *
     * @since 1.0.0
     */
    public function install(): array
    {
        $this->repository->assertCanonicalSchema();
        return ['steps' => ['Schema de rankings validado. Nenhum DDL foi executado.']];
    }

    /**
     * Migra o schema do modulo.
     *
     * @since 1.0.0
     */
    public function migrate(): array
    {
        $this->repository->assertCanonicalSchema();
        return ['steps' => ['Migration 20260718_020000 aplicada; schema validado sem DDL HTTP.']];
    }

    /**
     * Monta o payload base para insercao/atualizacao.
     *
     * @since 1.0.0
     */
    private function buildRankingPayload(array $data, ?string $status, ?string $createdByUserId = null): array
    {
        $rankingId = trim((string) ($data['id'] ?? '')) !== '' ? (string) $data['id'] : uniqid('r-');
        $vacanciesAc = max(0, (int) ($data['vacanciesAc'] ?? 0));
        $vacanciesAfro = max(0, (int) ($data['vacanciesAfro'] ?? 0));
        $vacanciesPcd = max(0, (int) ($data['vacanciesPcd'] ?? 0));
        $fallbackVacancies = max(0, (int) ($data['vacancies'] ?? 0));
        $vacancies = $vacanciesAc + $vacanciesAfro + $vacanciesPcd;
        if ($vacancies <= 0) {
            $vacancies = $fallbackVacancies > 0 ? $fallbackVacancies : 10;
        }

        $payload = [
            ':id' => $rankingId,
            ':name' => trim((string) ($data['name'] ?? '')),
            ':institution' => trim((string) ($data['institution'] ?? '')),
            ':total_questions' => max(1, (int) ($data['totalQuestions'] ?? 60)),
            ':vacancies' => $vacancies,
            ':vacancies_ac' => $vacanciesAc,
            ':vacancies_afro' => $vacanciesAfro,
            ':vacancies_pcd' => $vacanciesPcd,
            ':reserve_limit' => max(0, (int) ($data['reserveLimit'] ?? 0)),
            ':official_key_release_date' => !empty($data['officialKeyReleaseDate']) ? $data['officialKeyReleaseDate'] : null,
            ':key_status' => in_array(($data['keyStatus'] ?? 'pending'), ['official', 'pending'], true) ? $data['keyStatus'] : 'pending',
            ':correct_key' => isset($data['correctKey']) ? (string) $data['correctKey'] : '',
            ':has_discursive' => !empty($data['hasDiscursive']) ? 1 : 0,
            ':exam_types' => $this->normalizeRankingExamTypes($data['examTypes'] ?? []),
        ];

        if ($status !== null) {
            $payload[':status'] = $status;
            $payload[':created_by_user_id'] = $createdByUserId;
        }

        return $payload;
    }

    /**
     * Normaliza a lista de tipos de prova.
     *
     * @since 1.0.0
     */
    private function normalizeRankingExamTypes($examTypes): string
    {
        if (!is_array($examTypes)) {
            return json_encode([], JSON_UNESCAPED_UNICODE);
        }

        $normalized = array_values(array_filter(array_map(static function ($value) {
            $text = trim((string) $value);
            return $text === '' ? null : $text;
        }, $examTypes)));

        return json_encode($normalized, JSON_UNESCAPED_UNICODE);
    }
}
