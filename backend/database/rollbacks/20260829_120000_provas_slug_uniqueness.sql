-- Rollback exclusivo do indice criado por
-- 20260829_120000_provas_slug_uniqueness.php. Nao remove nem altera rows.
DROP INDEX uq_provas_slug ON provas;
