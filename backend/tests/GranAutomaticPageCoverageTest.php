<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/services/AdminGranCrawlerService.php';

final class GranCoveragePdo extends PDO
{
    public function __construct() {}
}

$service = new AdminGranCrawlerService(new GranCoveragePdo());
$method = new ReflectionMethod($service, 'assertCompleteAutomaticPage');
$cases = [
    ['full page', 1, 100, 100, 100, 62169, false],
    ['short final page', 622, 100, 100, 69, 62169, false],
    ['provider shrinks to five', 202, 100, 5, 5, 62169, true],
    ['false final page', 622, 100, 1, 1, 62169, true],
    ['missing rows', 200, 100, 100, 10, 62169, true],
    ['empty page before end', 2, 100, 100, 0, 62169, true],
    ['empty result', 1, 100, 100, 0, 0, false],
];
foreach ($cases as [$name, $page, $requested, $effective, $received, $total, $mustFail]) {
    $failed = false;
    try {
        $method->invoke($service, ['data' => [
            'page' => $page, 'perPage' => $effective, 'total' => $total,
            'rows' => array_fill(0, $received, ['id' => 1]),
        ]], $page, $requested);
    } catch (InvalidArgumentException $error) {
        $failed = true;
        if (!str_contains($error->getMessage(), 'enfileirada')) throw $error;
    }
    if ($failed !== $mustFail) throw new RuntimeException('Unexpected coverage decision: ' . $name);
}
$pagination = new ReflectionMethod($service, 'readPagination');
$result = $pagination->invoke($service, ['data' => ['total' => 62169, 'perPage' => 1, 'pages' => 62169]], 100);
if ($result['pages'] !== 62169) throw new RuntimeException('Effective page size must determine page count.');
echo "Gran automatic page coverage: 8 cases PASS\n";
