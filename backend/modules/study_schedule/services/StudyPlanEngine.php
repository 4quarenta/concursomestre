<?php
declare(strict_types=1);

/** Pure calendar rules, shared by preview and persisted plans. */
final class StudyPlanEngine
{
    public static function date(string $value): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('America/Sao_Paulo'));
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException('Informe uma data valida.');
        }
        return $date;
    }

    public static function normalize(array $raw): array
    {
        $text = static fn($v) => mb_substr(trim(strip_tags((string) $v)), 0, 200);
        $title = $text($raw['title'] ?? '');
        if ($title === '') throw new InvalidArgumentException('Informe o concurso e cargo.');
        $subjects = [];
        if (!is_array($raw['subjects'] ?? null) || count($raw['subjects']) > 60) throw new InvalidArgumentException('Informe de 1 a 60 materias.');
        foreach ($raw['subjects'] as $index => $subject) {
            if (!is_array($subject)) throw new InvalidArgumentException('Materia invalida.');
            $name = $text($subject['name'] ?? '');
            if (!is_array($subject['topics'] ?? null) || count($subject['topics']) > 150) throw new InvalidArgumentException('Informe ate 150 assuntos por materia.');
            $topics = array_values(array_filter(array_map($text, $subject['topics'])));
            $questions = filter_var($subject['questions'] ?? 0, FILTER_VALIDATE_INT);
            $weight = (float) ($subject['weight'] ?? 0);
            if (!$name || !$topics || $questions < 1 || $questions > 300 || !is_finite($weight) || $weight <= 0 || $weight > 100) {
                throw new InvalidArgumentException('Cada materia precisa de nome, assuntos, quantidade e peso validos.');
            }
            $subjects[] = ['id' => 's' . $index, 'name' => $name, 'topics' => array_values(array_unique($topics)),
                'questions' => $questions, 'weight' => $weight,
                'minimum' => max(0, min(100, (float) ($subject['minimum'] ?? 0)))];
        }
        if (!$subjects) throw new InvalidArgumentException('Adicione ao menos uma materia.');
        if (count(array_unique(array_map(static fn($s) => mb_strtolower($s['name']), $subjects))) !== count($subjects)) throw new InvalidArgumentException('Nao repita a mesma materia.');
        if (!is_array($raw['availability'] ?? null)) throw new InvalidArgumentException('Informe sua disponibilidade.');
        $availability = [];
        for ($day = 1; $day <= 7; $day++) {
            $minutes = (int) ($raw['availability'][(string) $day] ?? 0);
            if ($minutes < 0 || $minutes > 600) throw new InvalidArgumentException('Disponibilidade deve ficar entre 0 e 600 minutos por dia.');
            $availability[(string) $day] = $minutes;
        }
        $session = (int) ($raw['sessionMinutes'] ?? 40);
        if ($session < 20 || $session > 90) throw new InvalidArgumentException('Sessao deve durar de 20 a 90 minutos.');
        if (max($availability) < 20) throw new InvalidArgumentException('Reserve ao menos 20 minutos em um dia da semana.');
        $start = self::date((string) ($raw['startDate'] ?? ''));
        $end = self::date((string) ($raw['examDate'] ?? ''));
        if ($end <= $start || $start->diff($end)->days > 730) throw new InvalidArgumentException('A prova deve estar depois do inicio, em ate dois anos.');
        $source = trim((string) ($raw['sourceUrl'] ?? ''));
        if ($source !== '' && (!filter_var($source, FILTER_VALIDATE_URL) || !in_array(parse_url($source, PHP_URL_SCHEME), ['https', 'http'], true))) {
            throw new InvalidArgumentException('Informe um link valido para o edital.');
        }
        return ['title' => $title, 'bank' => $text($raw['bank'] ?? ''), 'area' => $text($raw['area'] ?? ''),
            'sourceUrl' => $source, 'dateConfirmed' => !empty($raw['dateConfirmed']),
            'startDate' => $start->format('Y-m-d'), 'examDate' => $end->format('Y-m-d'),
            'availability' => $availability, 'sessionMinutes' => $session,
            'questionGoal' => max(1, min(100, (int) ($raw['questionGoal'] ?? 20))),
            'reservePercent' => max(0, min(30, (int) ($raw['reservePercent'] ?? 15))),
            'wrongPenalty' => max(0, min(10, (float) ($raw['wrongPenalty'] ?? 0))),
            'subjects' => $subjects];
    }

    public static function generate(array $config, array $performance = []): array
    {
        $sessions = [];
        $allocated = $positions = [];
        $weights = [];
        foreach ($config['subjects'] as $s) {
            $accuracy = $performance[$s['name']]['accuracy'] ?? null;
            $reliable = ($performance[$s['name']]['total'] ?? 0) >= 20;
            $weakness = !$reliable || $accuracy === null ? 1 : 1 + (1 - $accuracy / 100);
            $elimination = $reliable && $accuracy !== null && $accuracy < $s['minimum'] ? 1.5 : 1;
            $weights[$s['id']] = $s['questions'] * $s['weight'] * $weakness * $elimination;
            $allocated[$s['id']] = $positions[$s['id']] = 0;
        }
        $start = self::date($config['startDate']);
        $end = self::date($config['examDate']);
        for ($date = $start; $date < $end; $date = $date->modify('+1 day')) {
            $budget = (int) floor($config['availability'][$date->format('N')] * (1 - $config['reservePercent'] / 100));
            while ($budget >= 20) {
                $selected = $config['subjects'][0];
                foreach ($config['subjects'] as $s) {
                    if ($allocated[$s['id']] / $weights[$s['id']] < $allocated[$selected['id']] / $weights[$selected['id']]) $selected = $s;
                }
                $id = $selected['id'];
                $position = $positions[$id]++;
                $topic = $selected['topics'][(int) floor($position / 3) % count($selected['topics'])];
                $kind = ['study', 'questions', 'review'][$position % 3];
                if ($date->diff($end)->days <= 7 && $kind === 'study') $kind = 'review';
                $duration = min($config['sessionMinutes'], $budget);
                $sessions[] = ['id' => bin2hex(random_bytes(12)), 'ordinal' => count($sessions), 'date' => $date->format('Y-m-d'), 'subjectId' => $id,
                    'subject' => $selected['name'], 'topic' => $topic, 'kind' => $kind, 'minutes' => $duration,
                    'questionGoal' => $kind === 'questions' ? max(1, (int) floor($config['questionGoal'] * $duration / $config['sessionMinutes'])) : 0,
                    'status' => 'planned', 'actualMinutes' => 0];
                $allocated[$id] += $duration;
                $budget -= $duration + 5;
            }
        }
        if (!$sessions) throw new InvalidArgumentException('Nenhuma sessao cabe antes da prova. Ajuste a disponibilidade ou a data.');
        return $sessions;
    }
}
