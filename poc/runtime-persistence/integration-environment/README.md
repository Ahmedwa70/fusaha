# Disposable Runtime Persistence Integration Environment

This directory is an isolated local environment for the Runtime Persistence POC. It is not part of the Fusaha application runtime and must not be pointed at Fusaha Staging or Production.

## What it starts

- PostgreSQL 16 on `127.0.0.1:55432` by default.
- MinIO S3-compatible API on `127.0.0.1:59000` by default.
- MinIO console on `127.0.0.1:59001` by default.
- A private bucket named `runtime-poc-private` by default.
- A private Docker network named `fusaha-runtime-poc-network`.
- Named volumes `fusaha-runtime-poc-pgdata` and `fusaha-runtime-poc-miniodata`.

All names, ports, volumes, schema, credentials, and fixture values are POC-only.

## macOS requirements

Install Docker Desktop for Mac with:

- Docker Engine and Docker Compose v2 enabled.
- At least 2 CPU cores and 4 GB memory assigned to Docker Desktop.
- `docker compose version` available in a terminal.

No project `.env` file, `DATABASE_URL`, Supabase credential, or Fusaha secret is required or permitted.

## First-time setup

From this directory:

```sh
cp .env.integration.example .env.integration
```

The generated file contains disposable local credentials only. Change them if another local process already uses the same values. Do not commit `.env.integration` and do not reuse its values outside this environment.

Validate the Compose model without starting containers:

```sh
docker compose --env-file .env.integration config
```

## Start and stop

Start PostgreSQL, MinIO, and bucket initialization:

```sh
docker compose --env-file .env.integration up -d postgres minio

docker compose --env-file .env.integration run --rm minio-init
```

Or start the full Compose graph in one command:

```sh
docker compose --env-file .env.integration up -d
```

View service logs:

```sh
docker compose --env-file .env.integration logs -f postgres minio minio-init
```

Stop containers but preserve disposable volumes:

```sh
docker compose --env-file .env.integration down
```

Stop containers and delete all POC data, then recreate from zero:

```sh
docker compose --env-file .env.integration down -v --remove-orphans
docker compose --env-file .env.integration up -d
```

The `down -v` command is destructive for this POC's local volumes. It does not affect any Fusaha or Supabase resource because the Compose file uses only its own named volumes and network.

## Readiness checks

PostgreSQL:

```sh
docker compose --env-file .env.integration exec postgres pg_isready -U "$POC_POSTGRES_USER" -d "$POC_POSTGRES_DB"
```

If shell expansion is inconvenient, use the values from `.env.integration` explicitly:

```sh
docker compose --env-file .env.integration exec postgres pg_isready -U runtime_poc_user -d runtime_poc
```

MinIO API readiness:

```sh
curl -fsS http://127.0.0.1:59000/minio/health/ready
```

MinIO console: open `http://127.0.0.1:59001` and use only the disposable values from `.env.integration`.

Verify the private bucket from the init container:

```sh
docker compose --env-file .env.integration run --rm minio-init
```

Inspect service state:

```sh
docker compose --env-file .env.integration ps
```

The environment is ready only when PostgreSQL reports accepting connections, MinIO reports HTTP 200 from `/minio/health/ready`, and `minio-init` exits successfully.

## Synthetic data

`fixtures/runtime-package.json` contains fake package metadata and fake HTML/JavaScript only. It is not an export from Fusaha and must not be replaced with production data.

The PostgreSQL initializer creates only the `runtime_poc` schema and POC tables:

- `runtime_poc.runtime_versions`
- `runtime_poc.runtime_publication_attempts`
- `runtime_poc.runtime_storage_objects`
- `runtime_poc.runtime_assets`

The initializer inserts one pending synthetic Runtime row. No application tables are touched.

## Backup and restore

Create a disposable PostgreSQL custom-format backup:

```sh
mkdir -p backups

docker compose --env-file .env.integration exec -T postgres \
  pg_dump -U runtime_poc_user -d runtime_poc -Fc \
  > backups/runtime-poc-$(date +%Y%m%d-%H%M%S).dump
```

Create a MinIO mirror using the MinIO client if `mc` is installed locally:

```sh
mc alias set runtime-poc http://127.0.0.1:59000 "$POC_MINIO_ROOT_USER" "$POC_MINIO_ROOT_PASSWORD"
mc mirror --preserve runtime-poc/runtime-poc-private backups/minio/runtime-poc-private
```

Alternatively, run the client inside a disposable MinIO client container and write the backup to a mounted local directory; do not use a project credential.

Restore PostgreSQL into a fresh volume/database:

```sh
docker compose --env-file .env.integration down -v --remove-orphans
docker compose --env-file .env.integration up -d postgres
docker compose --env-file .env.integration exec -T postgres \
  pg_restore -U runtime_poc_user -d runtime_poc --clean --if-exists \
  < backups/runtime-poc-YYYYMMDD-HHMMSS.dump
```

Restore the MinIO mirror only after the fresh MinIO service is ready and the private bucket has been initialized:

```sh
mc mirror --preserve backups/minio/runtime-poc-private runtime-poc/runtime-poc-private
```

After restore, compare every database object row's `content_sha256` and `size_bytes` with the restored object bytes. This environment does not provide an automated hash reconciler; that remains part of the integration POC.

## Write-once limitation

The init script enables MinIO versioning and keeps the bucket private. Versioning preserves previous object versions, but it does **not** by itself reject overwrite requests.

The Runtime storage adapter must still:

- create final objects with a no-overwrite/conditional-create precondition;
- treat an existing key with different bytes as an integrity conflict;
- persist provider version/ETag metadata;
- deny update/delete of published objects through its own service boundary;
- test overwrite rejection explicitly.

MinIO bucket policy alone cannot express the full application-level rule “allow create only if this exact object key does not already exist” across all client operations. Therefore this Compose environment can support the POC, but it cannot claim provider-enforced immutability without an adapter test.

## Isolation and cleanup

- The Compose project name is fixed to `fusaha-runtime-persistence-poc`.
- Services use a private internal Docker network and loopback-only host bindings.
- Volumes and bucket names are POC-specific.
- No application code imports this directory.
- No migration is run against the platform database.
- Remove the environment completely with `docker compose --env-file .env.integration down -v --remove-orphans` after the POC.
