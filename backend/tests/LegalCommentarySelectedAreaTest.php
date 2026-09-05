<?php
declare(strict_types=1);

require_once __DIR__ . '/../modules/legal_commentary/repositories/LegalCommentaryRepository.php';

final class SelectedAreaStatement extends PDOStatement
{
    private array $parameters = [];
    public function __construct(private SelectedAreaConnection $connection) {}
    public function execute(?array $params = null): bool
    {
        $this->parameters = $params ?? [];
        $this->connection->lookups[] = $this->parameters[':slug'];
        return true;
    }
    public function fetchColumn(int $column = 0): mixed
    {
        return in_array($this->parameters[':slug'], ['macro20f-area', 'explicit-area', 'constitucional'], true) ? 42 : false;
    }
}
final class SelectedAreaConnection extends PDO
{
    public array $lookups = [];
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        if (!str_contains($query, 'SELECT id FROM legal_areas WHERE slug')) {
            throw new RuntimeException('Unexpected query: test must not write.');
        }
        return new SelectedAreaStatement($this);
    }
}

$cases = [
    [['area' => ['slug' => 'macro20f-area']], 'macro20f-area', false],
    [['areaSlug' => 'explicit-area', 'area' => ['slug' => 'macro20f-area']], 'explicit-area', false],
    [['area' => ['slug' => 'missing-area']], 'missing-area', true],
    [[], 'constitucional', false],
];
foreach ($cases as [$payload, $slug, $missing]) {
    $db = new SelectedAreaConnection();
    $repository = new LegalCommentaryRepository($db);
    $method = new ReflectionMethod($repository, 'upsertLaw');
    try {
        // Empty title stops after area resolution and before any write.
        $method->invoke($repository, $payload);
        throw new RuntimeException('Expected validation error.');
    } catch (InvalidArgumentException $error) {
        $expected = $missing ? 'Area juridica invalida.' : 'Informe o nome da lei e o slug antes de salvar.';
        if ($error->getMessage() !== $expected || $db->lookups !== [$slug]) {
            throw new RuntimeException('Selected legal area was not respected.');
        }
    }
}
echo "LegalCommentarySelectedAreaTest: PASS\n";
