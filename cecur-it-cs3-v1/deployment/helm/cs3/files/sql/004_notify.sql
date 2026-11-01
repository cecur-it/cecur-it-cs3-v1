-- Real-time change feed: replaces Firestore onSnapshot listeners.
-- Triggers publish a small JSON envelope on channel "cs3_events"; the console
-- (server/pg/events.ts) LISTENs and fans the payload out over the SSE stream
-- (/api/events, alias of /api/live/stream). Payloads stay well below the
-- 8000-byte NOTIFY limit: the envelope carries identifiers, never full rows.

SET client_min_messages = warning;
SET ROLE cs3_migrator;
SET search_path = cs3, public;

CREATE OR REPLACE FUNCTION cs3.notify_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  PERFORM pg_notify('cs3_events', json_build_object(
    'collection', TG_TABLE_NAME,
    'op',         TG_OP,
    'id',         to_jsonb(rec)->>'id',
    'ts',         to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::text);
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'incidents', 'audit_logs', 'sensors', 'transactions',
    'errow_allowlist', 'errow_jobs', 'wazuh_alerts',
    'activtrak_sessions', 'agents'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON cs3.%I', t || '_notify', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON cs3.%I
                    FOR EACH ROW EXECUTE FUNCTION cs3.notify_change()',
                   t || '_notify', t);
  END LOOP;
END
$$;

RESET ROLE;
