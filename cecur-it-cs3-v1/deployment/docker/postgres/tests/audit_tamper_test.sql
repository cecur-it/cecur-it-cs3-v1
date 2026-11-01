-- Verifies NIST AU-9 tamper protection. Run against an initialised database:
--   psql -v ON_ERROR_STOP=1 -d cs3 -f deployment/docker/postgres/tests/audit_tamper_test.sql
-- Must be run by a superuser (it uses SET ROLE). Exits non-zero on failure.
\set ON_ERROR_STOP on
SET search_path = cs3, public;
BEGIN;
SET LOCAL ROLE cs3_app;

INSERT INTO cs3.audit_logs (id, data) VALUES ('t-1', '{"action":"LOGIN"}'), ('t-2', '{"action":"LOGOUT"}');

DO $$
DECLARE
  n int;
BEGIN
  -- 1. UPDATE must raise (BEFORE trigger) – never silently succeed.
  BEGIN
    UPDATE cs3.audit_logs SET data = '{"action":"FORGED"}' WHERE id = 't-1';
    RAISE EXCEPTION 'TEST FAILED: UPDATE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- 2. DELETE must raise.
  BEGIN
    DELETE FROM cs3.audit_logs WHERE id = 't-1';
    RAISE EXCEPTION 'TEST FAILED: DELETE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- 3. TRUNCATE must be denied (no privilege for cs3_app).
  BEGIN
    TRUNCATE cs3.audit_logs;
    RAISE EXCEPTION 'TEST FAILED: TRUNCATE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- 4. Chain must be intact.
  IF cs3.verify_audit_chain() IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAILED: chain broken at %', cs3.verify_audit_chain();
  END IF;
  SELECT count(*) INTO n FROM cs3.audit_logs WHERE id IN ('t-1','t-2');
  IF n <> 2 THEN RAISE EXCEPTION 'TEST FAILED: expected 2 rows, saw %', n; END IF;
  RAISE NOTICE 'audit_logs tamper-protection: PASS';
END
$$;
ROLLBACK;
