<?php

declare(strict_types=1);

require '/home/concursomestre/htdocs/concursomestre.com/backend/config/database.php';

$db = (new Database())->getConnection();
$queries = [
    'editorials' => <<<'SQL'
        SELECT editorial_type, status, COUNT(*) total,
               SUM(TRIM(body) <> '') nonempty
        FROM question_editorials
        GROUP BY editorial_type, status
        ORDER BY editorial_type, status
        SQL,
    'legacy' => <<<'SQL'
        SELECT
          SUM(COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.teacherComment'))), ''), '') <> '') teacher_nonempty,
          SUM(COALESCE(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.detailedComment'))), ''), '') <> '') detailed_nonempty
        FROM questions
        SQL,
    'flags' => <<<'SQL'
        SELECT SUM(has_teacher_comment = 1) teacher_flags,
               SUM(has_detailed_comment = 1) detailed_flags,
               COUNT(*) total
        FROM questions
        SQL,
    'samples' => <<<'SQL'
        SELECT q.id, q.updated_at, q.has_teacher_comment, q.has_detailed_comment,
               LENGTH(COALESCE(e1.body, '')) teacher_len,
               LENGTH(COALESCE(e2.body, '')) detailed_len,
               LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.teacherComment')), '')) legacy_teacher_len,
               LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.detailedComment')), '')) legacy_detailed_len
        FROM questions q
        LEFT JOIN question_editorials e1
          ON e1.question_id = q.id AND e1.editorial_type = 'teacher_comment'
        LEFT JOIN question_editorials e2
          ON e2.question_id = q.id AND e2.editorial_type = 'detailed_analysis'
        WHERE LENGTH(COALESCE(e1.body, '')) > 0
           OR LENGTH(COALESCE(e2.body, '')) > 0
           OR LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.teacherComment')), '')) > 0
           OR LENGTH(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.detailedComment')), '')) > 0
        ORDER BY q.updated_at DESC
        LIMIT 5
        SQL,
];

foreach ($queries as $name => $sql) {
    echo "---{$name}---\n";
    echo json_encode($db->query($sql)->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
}
