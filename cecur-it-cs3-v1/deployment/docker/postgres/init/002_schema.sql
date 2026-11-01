-- CS3 PostgreSQL + JSONB persistence layer.
--
-- Maps each Firestore collection used by demo/demo-100226 (see firestore.rules)
-- to a table with the document body stored in a JSONB column:
--
--   Firestore collection   ->  PostgreSQL table
--   users                  ->  cs3.users
--   credentials            ->  cs3.credentials
--   incidents              ->  cs3.incidents
--   auditLogs              ->  cs3.audit_logs        (append-only, see 003)
--   sensors                ->  cs3.sensors
--   transactions           ->  cs3.transactions
--   errowAllowlist     ->  cs3.errow_allowlist
--   errowJobs          ->  cs3.errow_jobs
--   wazuhAlerts            ->  cs3.wazuh_alerts
--   activtrakSessions      ->  cs3.activtrak_sessions
--   (new) fleet            ->  cs3.agents, cs3.enrollments
--
-- Runs as the bootstrap superuser during first init; objects are then owned
-- by cs3_migrator so the runtime role (cs3_app) never owns, and therefore can
-- never alter, any table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS cs3 AUTHORIZATION cs3_migrator;
GRANT USAGE ON SCHEMA cs3 TO cs3_app, cs3_archiver;

SET client_min_messages = warning;
SET ROLE cs3_migrator;
SET search_path = cs3, public;

-- Generic touch trigger -----------------------------------------------------
CREATE OR REPLACE FUNCTION cs3.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Document tables -----------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'credentials', 'incidents', 'sensors', 'transactions',
    'errow_allowlist', 'errow_jobs', 'wazuh_alerts',
    'activtrak_sessions', 'agents'
  ] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS cs3.%I (
        id         text PRIMARY KEY,
        data       jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )$f$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON cs3.%I USING gin (data jsonb_path_ops)',
                   t || '_data_gin', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON cs3.%I (updated_at DESC)',
                   t || '_updated_idx', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON cs3.%I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON cs3.%I
                    FOR EACH ROW EXECUTE FUNCTION cs3.touch_updated_at()',
                   t || '_touch', t);
  END LOOP;
END
$$;

-- Hot-path expression indexes (keep in sync with queries in server/pg/store.ts)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq   ON cs3.users ((lower(data->>'username')));
CREATE INDEX IF NOT EXISTS incidents_status_idx       ON cs3.incidents ((data->>'status'));
CREATE INDEX IF NOT EXISTS agents_status_idx          ON cs3.agents ((data->>'status'));
CREATE UNIQUE INDEX IF NOT EXISTS agents_hostname_uq  ON cs3.agents ((lower(data->>'hostname')));
CREATE INDEX IF NOT EXISTS wazuh_alerts_level_idx     ON cs3.wazuh_alerts (((data->>'ruleLevel')::int));

-- Fleet enrollment (bulk enrollment API) -----------------------------------
-- Only SHA-256 digests of one-time tokens / agent keys are stored.
CREATE TABLE IF NOT EXISTS cs3.enrollments (
  agent_id      text PRIMARY KEY,
  token_sha256  text NOT NULL,
  key_sha256    text,
  batch_id      text NOT NULL,
  requested_by  text NOT NULL,
  expires_at    timestamptz NOT NULL,
  claimed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enrollments_batch_idx ON cs3.enrollments (batch_id);
CREATE INDEX IF NOT EXISTS enrollments_key_idx   ON cs3.enrollments (key_sha256) WHERE key_sha256 IS NOT NULL;

-- Runtime grants (DML only; no DDL, no TRUNCATE) ----------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  cs3.users, cs3.credentials, cs3.incidents, cs3.sensors, cs3.transactions,
  cs3.errow_allowlist, cs3.errow_jobs, cs3.wazuh_alerts,
  cs3.activtrak_sessions, cs3.agents, cs3.enrollments
TO cs3_app;

-- transactions mirror the Firestore "immutable audit trail" rule
-- (allow update, delete: if false) once COMPLETED; enforced by trigger.
CREATE OR REPLACE FUNCTION cs3.transactions_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.data->>'status' = 'COMPLETED' THEN
    RAISE EXCEPTION 'cs3.transactions: COMPLETED rows are immutable (op=%)', TG_OP
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transactions_immutable ON cs3.transactions;
CREATE TRIGGER transactions_immutable BEFORE UPDATE OR DELETE ON cs3.transactions
  FOR EACH ROW EXECUTE FUNCTION cs3.transactions_immutable();
