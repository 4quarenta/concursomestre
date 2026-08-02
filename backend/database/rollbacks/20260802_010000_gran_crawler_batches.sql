ALTER TABLE private_ingestion_jobs DROP FOREIGN KEY fk_private_ingestion_jobs_batch;
ALTER TABLE private_ingestion_jobs DROP INDEX idx_private_ingestion_jobs_batch;
ALTER TABLE private_ingestion_jobs DROP COLUMN batch_id;
DROP TABLE IF EXISTS private_ingestion_batches;
DROP TABLE IF EXISTS gran_taxonomy_sync_manifests;
