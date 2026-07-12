<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionOwnershipPolicy.php';

function assertQuestionOwnershipPolicy(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$policy = new QuestionOwnershipPolicy();
$record = [
    'created_by_user_id' => 'author-uuid',
    'updated_by_user_id' => 'staff-editor-uuid',
    'published_by_user_id' => 'staff-publisher-uuid',
];

assertQuestionOwnershipPolicy($policy->canManage('admin', 'other-admin-uuid', $record), 'Admin must manage every record.');
assertQuestionOwnershipPolicy($policy->canManage('staff', 'author-uuid', $record), 'Staff author must manage own record.');
assertQuestionOwnershipPolicy(!$policy->canManage('staff', 'staff-editor-uuid', $record), 'Updating a record must not transfer ownership to staff.');
assertQuestionOwnershipPolicy(!$policy->canManage('staff', 'staff-publisher-uuid', $record), 'Publishing a record must not transfer ownership to staff.');
assertQuestionOwnershipPolicy(!$policy->canManage('user', 'author-uuid', $record), 'Non-admin roles must not use administrative content commands.');

$serviceSource = file_get_contents(__DIR__ . '/../modules/questions/services/QuestionsService.php');
assertQuestionOwnershipPolicy(
    is_string($serviceSource) && str_contains($serviceSource, "'prova_' . \$examId . '_' . \$tempId"),
    'Imported context external keys must be scoped by the persisted exam.'
);
assertQuestionOwnershipPolicy(
    is_string($serviceSource) && str_contains($serviceSource, "\$canonicalContext['tempId'] = 'legacy_group_' . \$groupId"),
    'Manual contexts must receive a stable key derived from their own record.'
);

fwrite(STDOUT, "QuestionOwnershipPolicyTest: PASS\n");
