#!/bin/sh
# Creates least-privilege runtime roles. Executed once by the official postgres
# image entrypoint (docker-entrypoint-initdb.d) on first initialisation.
#   CS3_APP_PASSWORD      - password for cs3_app (console runtime, DML only)
#   CS3_MIGRATOR_PASSWORD - password for cs3_migrator (schema owner, DDL)
#   CS3_ARCHIVER_PASSWORD - password for cs3_archiver (read-only audit export)
set -eu

: "${CS3_APP_PASSWORD:?CS3_APP_PASSWORD must be set}"
: "${CS3_MIGRATOR_PASSWORD:?CS3_MIGRATOR_PASSWORD must be set}"
: "${CS3_ARCHIVER_PASSWORD:?CS3_ARCHIVER_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_pw="$CS3_APP_PASSWORD" \
  -v mig_pw="$CS3_MIGRATOR_PASSWORD" \
  -v arc_pw="$CS3_ARCHIVER_PASSWORD" <<'SQL'
CREATE ROLE cs3_migrator LOGIN PASSWORD :'mig_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE cs3_app      LOGIN PASSWORD :'app_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE cs3_archiver LOGIN PASSWORD :'arc_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE :"DBNAME" TO cs3_migrator, cs3_app, cs3_archiver;
SQL
