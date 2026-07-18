<?php

declare(strict_types=1);

function readPersonalProfileContractFile(string $path): string
{
    $contents = file_get_contents($path);
    if (!is_string($contents)) {
        throw new RuntimeException("Unable to read {$path}");
    }
    return $contents;
}

function assertPersonalProfileContract(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$service = readPersonalProfileContractFile($base . '/modules/users/services/UsersService.php');
$repository = readPersonalProfileContractFile($base . '/modules/users/repositories/UsersRepository.php');
$routes = readPersonalProfileContractFile($base . '/modules/users/routes.php');
$migration = readPersonalProfileContractFile($base . '/database/migrations/20260718_010000_user_profile_contract.php');

assertPersonalProfileContract(strpos($service, "'profile' => [") !== false, 'Private profile root is missing.');
assertPersonalProfileContract(strpos($service, "'personal' => [") !== false, 'Personal profile section is missing.');
assertPersonalProfileContract(strpos($service, "'address' => \$this->buildAddressPayload(\$row)") !== false, 'Address is not serialized in the private profile.');
assertPersonalProfileContract(strpos($routes, 'ensurePaymentProviderSchema();') === false, 'Profile route still mutates billing schema.');
assertPersonalProfileContract(strpos($repository, 'ensureUserProfileColumns') === false, 'Profile repository still performs runtime schema repair.');
assertPersonalProfileContract(strpos($repository, 'ALTER TABLE users ADD COLUMN') === false, 'Profile repository still executes runtime DDL.');
assertPersonalProfileContract(strpos($migration, "'phone' => 'VARCHAR(30) NULL'") !== false, 'Profile migration does not formalize the phone column.');

$methodStart = strpos($service, 'public function getAuthenticatedProfile');
$methodEnd = strpos($service, 'public function getAuthenticatedSession', $methodStart ?: 0);
$profileMethod = ($methodStart !== false && $methodEnd !== false)
    ? substr($service, $methodStart, $methodEnd - $methodStart)
    : '';
foreach (["'subscription' =>", "'billing' =>", "'bankAccount' =>", "'hasSavedCard' =>", "'isAdmin' =>", "'canAccessAdmin' =>"] as $forbidden) {
    assertPersonalProfileContract(strpos($profileMethod, $forbidden) === false, "Private profile mixes unrelated domain: {$forbidden}");
}

fwrite(STDOUT, "Personal profile contract wiring assertions passed.\n");
