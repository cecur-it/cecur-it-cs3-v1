-- Append-only, tamper-evident audit ledger.
--
-- Replaces the Firestore rule:
--     match /auditLogs/{logId} { allow create: if true; allow update, delete: if false; }
--
-- Controls (NIST SP 800-53 AU-9 "Protection of Audit Information",
--           AU-10 non-repudiation, SP 800-171r3 03.03.08):
--   1. Row-Level Security ENABLED and FORCED; policies exist only for SELECT
--      and INSERT, so UPDATE/DELETE match zero rows for every non-superuser.
--   2. BEFORE UPDATE OR DELETE row triggers raise an exception (defence in
--      depth for roles that bypass RLS, e.g. table owner / BYPASSRLS).
--   3. BEFORE TRUNCATE statement trigger raises an exception.
--   4. Privileges: cs3_app gets SELECT, INSERT only. Nothing else.
--   5. BEFORE INSERT trigger chains rows with SHA-256 so deletion/reordering
--      by a superuser is detectable via cs3.verify_audit_chain().
--      The chain runs as the invoking role (cs3_app), never SECURITY DEFINER,
--      so FORCE RLS applies uniformly.

SET client_min_messages = warning;
SET ROLE cs3_migrator;
SET search_path = cs3, public;

CREATE TABLE IF NOT EXISTS cs3.audit_logs (
  chain_no    bigint PRIMARY KEY,          -- assigned by cs3.audit_chain() under an advisory lock
  id          text NOT NULL UNIQUE,
  data        jsonb NOT NULL,
  prev_hash   text NOT NULL,
  chain_hash  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON cs3.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_data_gin    ON cs3.audit_logs USING gin (data jsonb_path_ops);

-- Hash chain ----------------------------------------------------------------
-- Timestamp is rendered in UTC so the digest does not depend on session TimeZone.
CREATE OR REPLACE FUNCTION cs3.audit_hash(prev text, rid text, ts timestamptz, body jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'sha256-' || encode(
    digest(prev || ':' || rid || ':' ||
           to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || ':' || body::text,
           'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION cs3.audit_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path = cs3, public AS $$
DECLARE
  last_no   bigint;
  last_hash text;
BEGIN
  -- Serialise writers so the chain has a single linear order.
  PERFORM pg_advisory_xact_lock(hashtext('cs3.audit_logs'));
  SELECT chain_no, chain_hash INTO last_no, last_hash
    FROM cs3.audit_logs ORDER BY chain_no DESC LIMIT 1;
  NEW.chain_no   := COALESCE(last_no, 0) + 1;
  NEW.prev_hash  := COALESCE(last_hash, 'genesis-root-000000000000');
  NEW.created_at := clock_timestamp();
  NEW.chain_hash := cs3.audit_hash(NEW.prev_hash, NEW.id, NEW.created_at, NEW.data);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_chain ON cs3.audit_logs;
CREATE TRIGGER audit_logs_chain BEFORE INSERT ON cs3.audit_logs
  FOR EACH ROW EXECUTE FUNCTION cs3.audit_chain();

-- Tamper protection ---------------------------------------------------------
CREATE OR REPLACE FUNCTION cs3.audit_logs_deny_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'cs3.audit_logs is append-only (NIST AU-9): % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT = 'Audit records can only be INSERTed. Retention is handled by export to cold storage, see deployment/operations/log-retention-archival.md';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_mutate   ON cs3.audit_logs;
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON cs3.audit_logs;
CREATE TRIGGER audit_logs_no_mutate BEFORE UPDATE OR DELETE ON cs3.audit_logs
  FOR EACH ROW EXECUTE FUNCTION cs3.audit_logs_deny_mutation();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON cs3.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION cs3.audit_logs_deny_mutation();

-- Row-Level Security --------------------------------------------------------
ALTER TABLE cs3.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs3.audit_logs FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select ON cs3.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON cs3.audit_logs;
CREATE POLICY audit_logs_select ON cs3.audit_logs FOR SELECT
  TO cs3_app, cs3_archiver USING (true);
CREATE POLICY audit_logs_insert ON cs3.audit_logs FOR INSERT
  TO cs3_app WITH CHECK (true);
-- Intentionally NO UPDATE / DELETE policies: RLS denies them by default.

REVOKE ALL ON cs3.audit_logs FROM PUBLIC;
GRANT SELECT, INSERT ON cs3.audit_logs TO cs3_app;
GRANT SELECT         ON cs3.audit_logs TO cs3_archiver;

-- Verification --------------------------------------------------------------
-- Returns the first broken chain_no, or NULL when the whole chain is intact.
-- The first retained row's prev_hash is trusted (older rows may be archived).
CREATE OR REPLACE FUNCTION cs3.verify_audit_chain() RETURNS bigint
LANGUAGE plpgsql STABLE SET search_path = cs3, public AS $$
DECLARE
  r record;
  expected_prev text := NULL;
  expected_hash text;
BEGIN
  FOR r IN SELECT * FROM cs3.audit_logs ORDER BY chain_no LOOP
    expected_hash := cs3.audit_hash(r.prev_hash, r.id, r.created_at, r.data);
    IF expected_prev IS NOT NULL AND r.prev_hash <> expected_prev THEN
      RETURN r.chain_no;
    END IF;
    IF r.chain_hash <> expected_hash THEN
      RETURN r.chain_no;
    END IF;
    expected_prev := r.chain_hash;
  END LOOP;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION cs3.verify_audit_chain() TO cs3_app, cs3_archiver;

RESET ROLE;
