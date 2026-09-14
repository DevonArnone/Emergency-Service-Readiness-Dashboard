-- Local development only. Replace credentials through a secret manager in deployment.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aegis_runtime') THEN
    CREATE ROLE aegis_runtime LOGIN PASSWORD 'aegis-runtime-local-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT CONNECT ON DATABASE aegis TO aegis_runtime;
GRANT USAGE ON SCHEMA public TO aegis_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aegis_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE aegis IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aegis_runtime;
