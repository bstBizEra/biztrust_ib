BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS auth_sessions (token_hash text PRIMARY KEY, data jsonb NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS memberships (subject text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL UNIQUE, role text NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','operations')), enabled boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
  product_id text NOT NULL, product_version text NOT NULL, rule_version text NOT NULL,
  input jsonb NOT NULL, premium bigint NOT NULL CHECK(premium>0), fee bigint NOT NULL CHECK(fee>=0), total bigint NOT NULL CHECK(total=premium+fee),
  currency text NOT NULL CHECK(currency='LAK'), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY, reference text UNIQUE NOT NULL, tenant_id text NOT NULL, owner_id text NOT NULL,
  quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id), product_id text NOT NULL, product_snapshot jsonb NOT NULL,
  customer jsonb NOT NULL, consent jsonb NOT NULL, status text NOT NULL DEFAULT 'submitted',
  insurer_status text NOT NULL DEFAULT 'awaiting_payment', insurer_reference text, evidence jsonb,
  idempotency_key text NOT NULL, request_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,owner_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
  application_id uuid NOT NULL UNIQUE REFERENCES applications(id), provider_reference text NOT NULL UNIQUE,
  amount bigint NOT NULL CHECK(amount>0), currency text NOT NULL CHECK(currency='LAK'), status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL, settled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS provider_events (
  id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
  invoice_id uuid NOT NULL REFERENCES invoices(id), body_hash text NOT NULL, outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
  application_id uuid NOT NULL UNIQUE REFERENCES applications(id), kind text NOT NULL, status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
  action text NOT NULL, resource_id text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applications_owner ON applications(tenant_id,owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_resource ON audit_events(tenant_id,resource_id);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['quotes','applications','invoices','provider_events','outbox','audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_ownership ON %I', table_name);
    EXECUTE format('CREATE POLICY tenant_ownership ON %I USING (tenant_id = current_setting(''app.tenant'', true) AND (owner_id = current_setting(''app.user'', true) OR current_setting(''app.role'', true) = ''operations'')) WITH CHECK (tenant_id = current_setting(''app.tenant'', true) AND (owner_id = current_setting(''app.user'', true) OR current_setting(''app.role'', true) = ''operations''))', table_name);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM biztrust_app;
GRANT USAGE ON SCHEMA public TO biztrust_app;
GRANT SELECT, INSERT, DELETE ON auth_sessions TO biztrust_app;
GRANT SELECT, INSERT ON memberships TO biztrust_app;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_read ON memberships;
CREATE POLICY membership_read ON memberships FOR SELECT USING (true);
DROP POLICY IF EXISTS membership_enrol ON memberships;
CREATE POLICY membership_enrol ON memberships FOR INSERT WITH CHECK(role='customer');
GRANT SELECT, INSERT ON quotes, audit_events, provider_events TO biztrust_app;
GRANT SELECT, INSERT, UPDATE ON applications, invoices, outbox TO biztrust_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO biztrust_app;
INSERT INTO schema_migrations(version) VALUES ('001') ON CONFLICT DO NOTHING;
COMMIT;
