<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/shared/security/Recaptcha.php';

function assertMobileRecaptchaTest(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$config = [
    'packageName' => 'com.concursomestre.mobile',
    'minimumScore' => 0.5,
];
$validAssessment = [
    'tokenProperties' => [
        'valid' => true,
        'action' => 'login',
        'androidPackageName' => 'com.concursomestre.mobile',
    ],
    'riskAnalysis' => ['score' => 0.9],
];

assertRecaptchaMobileAssessmentPassed($validAssessment, $config, 'login');
assertMobileRecaptchaTest(true, 'A valid assessment should pass.');

foreach ([
    [array_replace_recursive($validAssessment, ['tokenProperties' => ['valid' => false]]), 'invalid token'],
    [array_replace_recursive($validAssessment, ['tokenProperties' => ['action' => 'register']]), 'wrong action'],
    [array_replace_recursive($validAssessment, ['tokenProperties' => ['androidPackageName' => 'com.other.app']]), 'wrong package'],
    [array_replace_recursive($validAssessment, ['riskAnalysis' => ['score' => 0.1]]), 'low score'],
    [array_replace_recursive($validAssessment, ['riskAnalysis' => ['score' => 'unknown']]), 'nonnumeric score'],
] as [$assessment, $scenario]) {
    try {
        assertRecaptchaMobileAssessmentPassed($assessment, $config, 'login');
        throw new RuntimeException("Expected rejection for {$scenario}.");
    } catch (RecaptchaValidationException) {
        // expected
    }
}

fwrite(STDOUT, "Mobile reCAPTCHA assessment assertions passed.\n");
