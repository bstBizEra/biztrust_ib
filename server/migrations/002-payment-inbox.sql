BEGIN;
CREATE TABLE payment_inbox (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  owner_id text NOT NULL,
  event jsonb NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','failed','processed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  outcome text,
  failure_code text CHECK (failure_code IN ('INVOICE_NOT_FOUND','EVENT_CONFLICT','PAYMENT_PROCESSING_FAILED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CHECK (event->>'eventId'=id AND event->>'tenant'=tenant_id AND event->>'owner'=owner_id),
  CHECK ((status='processed' AND outcome IS NOT NULL AND processed_at IS NOT NULL AND failure_code IS NULL)
      OR (status<>'processed' AND outcome IS NULL AND processed_at IS NULL))
);
CREATE INDEX payment_inbox_tenant_status ON payment_inbox(tenant_id,status,received_at);
ALTER TABLE payment_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_inbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_ownership ON payment_inbox
  USING (tenant_id=current_setting('app.tenant',true) AND (owner_id=current_setting('app.user',true) OR current_setting('app.role',true)='operations'))
  WITH CHECK (tenant_id=current_setting('app.tenant',true) AND (owner_id=current_setting('app.user',true) OR current_setting('app.role',true)='operations'));
GRANT SELECT ON payment_inbox TO biztrust_app;
GRANT INSERT(id,tenant_id,owner_id,event,digest) ON payment_inbox TO biztrust_app;
GRANT UPDATE(status,attempts,outcome,failure_code,last_received_at,processed_at) ON payment_inbox TO biztrust_app;
INSERT INTO schema_migrations(version) VALUES ('002');
COMMIT;
