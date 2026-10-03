BEGIN;
-- Preserve legacy quotes without inventing historical product terms.
ALTER TABLE quotes ADD COLUMN product_snapshot jsonb;
ALTER TABLE quotes ADD CONSTRAINT quotes_snapshot_identity CHECK (
  product_snapshot IS NULL OR (
    jsonb_typeof(product_snapshot)='object'
    AND product_snapshot->>'id'=product_id
    AND product_snapshot->>'version'=product_version
    AND product_snapshot->>'ruleVersion'=rule_version
  ) IS TRUE
);
INSERT INTO schema_migrations(version) VALUES ('003');
COMMIT;
