<?php

declare(strict_types=1);

interface EditorialSeoPromotionProvider
{
    /**
     * @param array<string, mixed> $resource
     * @return array{status: string, reasonCodes: list<string>}
     */
    public function resolve(array $routeFamily, array $resource): array;
}
