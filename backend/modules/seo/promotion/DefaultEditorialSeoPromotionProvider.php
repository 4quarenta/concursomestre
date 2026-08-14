<?php

declare(strict_types=1);

require_once __DIR__ . '/EditorialSeoPromotionProvider.php';

/**
 * Provider sem persistencia. Familias que exigem promocao permanecem
 * pendentes; as demais nao dependem de decisao editorial.
 */
final class DefaultEditorialSeoPromotionProvider implements EditorialSeoPromotionProvider
{
    public function resolve(array $routeFamily, array $resource): array
    {
        if (!empty($routeFamily['supportsEditorialPromotion'])) {
            return [
                'status' => 'pending',
                'reasonCodes' => ['indexability.editorial_promotion_required'],
            ];
        }

        return ['status' => 'not_required', 'reasonCodes' => []];
    }
}
