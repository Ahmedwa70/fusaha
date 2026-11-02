# Disposable Runtime Persistence Integration Environment

This directory is an isolated local environment for the Runtime Persistence POC. It is not part of the Fusaha application runtime and must not be pointed at Fusaha Staging or Production.

Object storage is provided by **SeaweedFS** (S3-compatible gateway). MinIO was replaced because its open-source project was archived (February 2026) and its images were withdrawn from Docker Hub; SeaweedFS is Apache-2.0, actively maintained, and publishes public multi-arch images.

## What it starts

- PostgreSQL 16 on `127.0.0.1:55432` by default.
- SeaweedFS S3-compatible API on `127.0.0.1:59000` by default.
- SeaweedFS Filer UI on `127.0.0.1:59001` by default.
- A private bucket named `runtime-poc-private` by default.
- A private Docker network named `fusaha-runtime-poc-network`.
- Named volumes `fusaha-runtime-poc-pgdata` and `fusaha-runtime-poc-s3data`.

All images are pinned by exact tag (`chrislusf/seaweedfs:4.48`, `amazon/aws-cli:2.39.3`, `postgres:16-alpine`). All names, ports, volumes, schema, credentials, and fixture values are POC-only.

## macOS requirements

Install Docker Desktop for Mac or OrbStack with:

- Docker Engine and Docker Compose v2 enabled.
- At least 2 CPU cores and 4 GB memory assigned to the Docker VM.
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

Start PostgreSQL and the SeaweedFS S3 gateway:

```sh
docker compose --env-file .env.integration up -d postgres seaweedfs

docker compose --env-file .env.integration run --rm s3-init
```

Or start the full Compose graph in one command:

```sh
docker compose --env-file .env.integration up -d
```

View service logs:

```sh
docker compose --env-file .env.integration logs -f postgres seaweedfs s3-init
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

The `down -v` command is destructive for this POC's local volumes only. It does not affect any Fusaha or Supabase resource because the Compose file uses only its own named volumes and network.

## Readiness checks

PostgreSQL:

```sh
docker compose --env-file .env.integration exec postgres pg_isready -U "$POC_POSTGRES_USER" -d "$POC_POSTGRES_DB"
```

If shell expansion is inconvenient, use the values from `.env.integration` explicitly:

```sh
docker compose --env-file .env.integration exec postgres pg_isready -U runtime_poc_user -d runtime_poc
```

S3 gateway readiness (an unauthenticated request to the S3 endpoint must answer `200` or `403`; both prove the gateway is serving):

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:59000/
```

Filer UI: open `http://127.0.0.1:59001` in a browser. No login is required for the POC network; treat anything shown there as disposable.

Verify the private bucket from the init container:

```sh
docker compose --env-file .env.integration run --rm s3-init
```

Inspect service state:

```sh
docker compose --env-file .env.integration ps
```

The environment is ready only when PostgreSQL reports accepting connections, the S3 endpoint answers `200`/`403`, and `s3-init` exits with code 0.

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

Create an S3 mirror using the AWS CLI container (credentials come from `.env.integration`, never from project files):

```sh
docker compose --env-file .env.integration run --rm --entrypoint sh s3-init -c \
  'aws s3 sync --endpoint-url "$POC_S3_ENDPOINT" "s3://$POC_S3_BUCKET" "/backups/s3/$POC_S3_BUCKET"'
```

(Requires a `./backups` bind mount if you want the copy on the host; otherwise the mirror lives only inside the container.)

Restore PostgreSQL into a fresh volume/database:

```sh
docker compose --env-file .env.integration down -v --remove-orphans
docker compose --env-file .env.integration up -d postgres
docker compose --env-file .env.integration exec -T postgres \
  pg_restore -U runtime_poc_user -d runtime_poc --clean --if-exists \
  < backups/runtime-poc-YYYYMMDD-HHMMSS.dump
```

After restore, compare every database object row's `content_sha256` and `size_bytes` with the restored object bytes. This environment does not provide an automated hash reconciler; that remains part of the integration POC.

## Write-once limitation

The init script enables bucket versioning and keeps the bucket private. Versioning preserves previous object versions, but it does **not** by itself reject overwrite requests.

The Runtime storage adapter must still:

- create final objects with a no-overwrite/conditional-create precondition (`If-None-Match: *` on `PutObject`);
- treat an existing key with different bytes as an integrity conflict;
- persist provider version/ETag metadata;
- deny update/delete of published objects through its own service boundary;
- test overwrite rejection explicitly.

Note: the SeaweedFS ETag is not guaranteed to be the MD5 of the object bytes (especially for multipart uploads). Integrity checks must use the adapter's own `content_sha256`, never the ETag alone. SeaweedFS also does not add `X-Content-Type-Options: nosniff`; delivery hardening remains an application-level concern.

## Lifecycle policy

The bucket carries one disposable-data rule:

- Current versions expire 1 day after creation.
- Noncurrent versions expire 1 day after they are superseded.
- Incomplete multipart uploads abort after 1 day.

Every test run writes keys under a unique, timestamped prefix and asserts within minutes, so no test depends on data older than a day. Anything left in the bucket is purged automatically within about 48 hours. This matches the disposable intent of the environment; do not store anything you need to keep.

## Isolation and cleanup

- The Compose project name is fixed to `fusaha-runtime-persistence-poc`.
- Services use a private internal Docker network and loopback-only host bindings.
- Volumes and bucket names are POC-specific.
- No application code imports this directory.
- No migration is run against the platform database.
- Remove the environment completely with `docker compose --env-file .env.integration down -v --remove-orphans` after the POC.
