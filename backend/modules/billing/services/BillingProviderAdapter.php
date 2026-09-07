<?php

declare(strict_types=1);

/**
 * Contrato minimo para operacoes de extensao de cobranca.
 * O dominio nao conhece os detalhes do SDK do provedor.
 */
interface BillingProviderAdapter
{
    /**
     * Estende uma assinatura existente e devolve somente fatos confirmados.
     *
     * @return array{provider_subscription_id:string,livemode:bool,status:string,old_period_end:int,new_period_end:int}
     */
    public function extendExistingSubscription(string $subscriptionId, int $days, string $grantId): array;

    /** @return array{provider_subscription_id:string,livemode:bool,status:string,current_period_end:int,metadata:array} */
    public function inspectExistingSubscription(string $subscriptionId): array;
}
