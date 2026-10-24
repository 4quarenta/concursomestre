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
        $taxonomyId = static function ($value): ?string {
            if ($value === null || $value === '') return null;
            $value = (string) $value;
            if (preg_match('/^[1-9][0-9]{0,17}$/', $value) !== 1) throw new InvalidArgumentException('Selecao de taxonomia invalida.');
            return $value;
        };
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
        if (!is_array($raw['availability'] ?? null) && !is_array($raw['availabilityWindows'] ?? null)) throw new InvalidArgumentException('Informe sua disponibilidade.');
        $availability = $windows = [];
        for ($day = 1; $day <= 7; $day++) {
            $key = (string) $day;
            if (is_array($raw['availabilityWindows'][$key] ?? null)) {
                $window = $raw['availabilityWindows'][$key];
                $startLabel = (string) ($window['start'] ?? '');
                $endLabel = (string) ($window['end'] ?? '');
                if ($startLabel === $endLabel) {
                    $from = self::timeMinutes($startLabel);
                    $to = $from;
                } else {
                    $from = self::timeMinutes($startLabel);
                    $to = self::timeMinutes($endLabel, true);
                }
                if ($from === null || $to === null || ($startLabel !== $endLabel && $to <= $from && !($to === 1440 && $from < 1440))) {
                    throw new InvalidArgumentException('Informe um período válido para cada dia selecionado.');
                }
                $minutes = $to - $from;
                if ($minutes > 600) throw new InvalidArgumentException('O período de estudo deve ter no máximo 10 horas por dia.');
                $windows[$key] = ['start' => self::timeLabel($from), 'end' => self::timeLabel($to)];
            } else {
                // Existing plans store only daily minutes; keep them editable without data migration.
                $minutes = (int) ($raw['availability'][$key] ?? 0);
                if ($minutes < 0 || $minutes > 600) throw new InvalidArgumentException('Disponibilidade deve ficar entre 0 e 600 minutos por dia.');
                $from = min(19 * 60, 1440 - $minutes);
                $windows[$key] = ['start' => self::timeLabel($from), 'end' => self::timeLabel($from + $minutes)];
            }
            $availability[$key] = $minutes;
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
            'organizationId' => $taxonomyId($raw['organizationId'] ?? null),
            'positionId' => $taxonomyId($raw['positionId'] ?? null),
            'boardId' => $taxonomyId($raw['boardId'] ?? null),
            'areaId' => $taxonomyId($raw['areaId'] ?? null),
            'sourceUrl' => $source, 'dateConfirmed' => !empty($raw['dateConfirmed']),
            'startDate' => $start->format('Y-m-d'), 'examDate' => $end->format('Y-m-d'),
            'availability' => $availability, 'availabilityWindows' => $windows, 'sessionMinutes' => $session,
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
            $cursor = self::timeMinutes($config['availabilityWindows'][$date->format('N')]['start']);
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
                if ($cursor + $duration > self::timeMinutes($config['availabilityWindows'][$date->format('N')]['end'], true)) break;
                $sessions[] = ['id' => bin2hex(random_bytes(12)), 'ordinal' => count($sessions), 'date' => $date->format('Y-m-d'), 'subjectId' => $id,
                    'startTime' => self::timeLabel($cursor), 'endTime' => self::timeLabel($cursor + $duration),
                    'subject' => $selected['name'], 'topic' => $topic, 'kind' => $kind, 'minutes' => $duration,
                    'questionGoal' => $kind === 'questions' ? max(1, (int) floor($config['questionGoal'] * $duration / $config['sessionMinutes'])) : 0,
                    'status' => 'planned', 'actualMinutes' => 0];
                $allocated[$id] += $duration;
                $budget -= $duration + 5;
                $cursor += $duration + 5;
            }
        }
        if (!$sessions) throw new InvalidArgumentException('Nenhuma sessao cabe antes da prova. Ajuste a disponibilidade ou a data.');
        return $sessions;
    }

    public static function findSlot(array $config, string $date, int $duration, array $sessions, ?string $excludeId = null): ?array
    {
        $weekday = self::date($date)->format('N');
        $window = $config['availabilityWindows'][$weekday] ?? null;
        if (!$window) return null;
        $from = self::timeMinutes($window['start']);
        $to = self::timeMinutes($window['end'], true);
        $capacity = (int) floor(($config['availability'][$weekday] ?? 0) * (1 - ($config['reservePercent'] ?? 0) / 100));
        $items = array_values(array_filter($sessions, static fn($session) => $session['date'] === $date && $session['id'] !== $excludeId));
        usort($items, static fn($a, $b) => ($a['startTime'] ?? '') <=> ($b['startTime'] ?? ''));
        $used = 0;
        foreach ($items as $item) $used += (int) $item['minutes'] + 5;
        if ($used + $duration > $capacity) return null;
        $cursor = $from;
        foreach ($items as $item) {
            $itemStart = isset($item['startTime']) ? self::timeMinutes($item['startTime']) : $cursor;
            $itemEnd = isset($item['endTime']) ? self::timeMinutes($item['endTime'], true) : $itemStart + (int) $item['minutes'];
            if ($cursor + $duration <= $itemStart) break;
            $cursor = max($cursor, $itemEnd + 5);
        }
        if ($cursor + $duration > $to) return null;
        return ['startTime' => self::timeLabel($cursor), 'endTime' => self::timeLabel($cursor + $duration)];
    }

    private static function timeMinutes(string $value, bool $endBoundary = false): ?int
    {
        if ($value === '00:00') return $endBoundary ? 1440 : 0;
        if (preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/', $value) !== 1) return null;
        [$hour, $minute] = array_map('intval', explode(':', $value));
        return $hour * 60 + $minute;
    }

    private static function timeLabel(int $minutes): string
    {
        if ($minutes === 1440) return '00:00';
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }
}
