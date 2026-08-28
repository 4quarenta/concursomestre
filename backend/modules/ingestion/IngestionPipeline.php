<?php

declare(strict_types=1);

require_once __DIR__ . '/contracts/CanonicalIngestionItem.php';
require_once __DIR__ . '/contracts/SourceAdapter.php';
require_once __DIR__ . '/contracts/DomainIngestionContract.php';
require_once __DIR__ . '/contracts/IngestionContractRegistry.php';
require_once __DIR__ . '/domain/IngestionStateMachine.php';
require_once __DIR__ . '/domain/IngestionWriterRegistry.php';
require_once __DIR__ . '/domain/IngestionPlan.php';
require_once __DIR__ . '/domain/IngestionFailureClassifier.php';
require_once __DIR__ . '/domain/IngestionRetryPolicy.php';
require_once __DIR__ . '/domain/IngestionRetryExecutor.php';
require_once __DIR__ . '/domain/TaxonomyResolutionPolicy.php';
require_once __DIR__ . '/domain/TaxonomyResolver.php';
require_once __DIR__ . '/domain/FieldOwnershipPolicy.php';
require_once __DIR__ . '/domain/DeprecationPolicy.php';
require_once __DIR__ . '/security/AssetUrlPolicy.php';
require_once __DIR__ . '/security/ContentSecurityPolicy.php';
require_once __DIR__ . '/persistence/IngestionPersistencePort.php';
require_once __DIR__ . '/persistence/CanonicalEntityPersistencePort.php';
require_once __DIR__ . '/persistence/InMemoryIngestionStore.php';
require_once __DIR__ . '/persistence/PdoIngestionMetadataRepository.php';
require_once __DIR__ . '/observability/IngestionObservability.php';
require_once __DIR__ . '/orchestration/IngestionOrchestrator.php';
require_once __DIR__ . '/orchestration/IngestionBatchRunner.php';
require_once __DIR__ . '/orchestration/IngestionRunTracker.php';
require_once __DIR__ . '/adapters/ArraySourceAdapter.php';
