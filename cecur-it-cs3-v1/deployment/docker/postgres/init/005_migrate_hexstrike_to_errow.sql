-- One-shot, idempotent migration for standing databases: renames the legacy offensive-engine
-- tables to their errow names without data loss, then re-binds indexes, touch/notify triggers.
-- Run it BEFORE re-applying 002_schema.sql on an existing database (otherwise 002 creates empty
-- errow_* tables and the rename is skipped to avoid clobbering them). No-op on fresh installs.
-- cs3.audit_logs, its triggers and RLS policies are not touched.

SET client_min_messages = warning;
SET ROLE cs3_migrator;
SET search_path = cs3, public;

DO $$
DECLARE
  pair text[];
  old_t text;
  new_t text;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['hexstrike_allowlist', 'errow_allowlist'],
    ARRAY['hexstrike_jobs',      'errow_jobs']
  ] LOOP
    old_t := pair[1];
    new_t := pair[2];
    IF to_regclass(format('cs3.%I', old_t)) IS NOT NULL
       AND to_regclass(format('cs3.%I', new_t)) IS NULL THEN
      EXECUTE format('ALTER TABLE cs3.%I RENAME TO %I', old_t, new_t);
      EXECUTE format('ALTER INDEX IF EXISTS cs3.%I RENAME TO %I', old_t || '_data_gin',    new_t || '_data_gin');
      EXECUTE format('ALTER INDEX IF EXISTS cs3.%I RENAME TO %I', old_t || '_updated_idx', new_t || '_updated_idx');
      EXECUTE format('ALTER INDEX IF EXISTS cs3.%I RENAME TO %I', old_t || '_pkey',        new_t || '_pkey');
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON cs3.%I', old_t || '_touch',  new_t);
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON cs3.%I', old_t || '_notify', new_t);
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON cs3.%I
                      FOR EACH ROW EXECUTE FUNCTION cs3.touch_updated_at()', new_t || '_touch', new_t);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON cs3.%I
                      FOR EACH ROW EXECUTE FUNCTION cs3.notify_change()', new_t || '_notify', new_t);
    END IF;
  END LOOP;
END
$$;

-- Grants travel with the renamed tables; re-assert them idempotently.
GRANT SELECT, INSERT, UPDATE, DELETE ON cs3.errow_allowlist, cs3.errow_jobs TO cs3_app;

RESET ROLE;
