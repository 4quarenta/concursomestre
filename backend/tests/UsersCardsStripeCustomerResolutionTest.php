<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/users/services/UsersCardsStripeSupport.php';

function stripeCustomerResolutionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$stripe = new class {
    public object $customers;

    public function __construct()
    {
        $this->customers = new class {
            public function all(array $params): object
            {
                return new class {
                    public function autoPagingIterator(): array
                    {
                        return [];
                    }
                };
            }
        };
    }
};

stripeCustomerResolutionAssert(
    findExistingStripeCustomerForUser($stripe, 'user-1', 'person@example.com') === null,
    'Um customer ID obsoleto do banco nao pode ser selecionado sem confirmacao da Stripe.'
);

$stripe->customers = new class {
    public function retrieve(string $customerId, array $params): object
    {
        if ($customerId === 'cus_stale') {
            throw new RuntimeException('No such customer');
        }

        return (object) ['id' => $customerId, 'deleted' => false];
    }

    public function all(array $params): object
    {
        return new class {
            public function autoPagingIterator(): array
            {
                return [
                    (object) [
                        'id' => 'cus_verified',
                        'email' => 'person@example.com',
                        'metadata' => (object) ['user_id' => 'user-1'],
                    ],
                ];
            }
        };
    }
};

stripeCustomerResolutionAssert(
    resolveVerifiedStripeCustomerIdForReadOnly($stripe, 'user-1', 'person@example.com', ['cus_stale']) === 'cus_verified',
    'A leitura deve ignorar um ID expirado e localizar um customer atual sem criar recursos.'
);

$stripe->customers = new class {
    public function all(array $params): object
    {
        return new class {
            public function autoPagingIterator(): array
            {
                return [
                    (object) [
                        'id' => 'cus_verified',
                        'email' => 'person@example.com',
                        'metadata' => (object) ['user_id' => 'user-1'],
                    ],
                ];
            }
        };
    }
};

stripeCustomerResolutionAssert(
    findExistingStripeCustomerForUser($stripe, 'user-1', 'person@example.com') === 'cus_verified',
    'Um customer retornado pela Stripe deve continuar sendo reutilizado.'
);

$stripe->customers = new class {
    public function all(array $params): object
    {
        throw new RuntimeException('stripe lookup unavailable');
    }
};

$lookupFailed = false;
try {
    findExistingStripeCustomerForUser($stripe, 'user-1', 'person@example.com');
} catch (RuntimeException $error) {
    $lookupFailed = $error->getMessage() === 'stripe lookup unavailable';
}

stripeCustomerResolutionAssert(
    $lookupFailed,
    'Falha de API ao procurar customers deve interromper o fluxo, sem cair em criacao duplicada.'
);

echo "UsersCardsStripeCustomerResolutionTest: PASS\n";
