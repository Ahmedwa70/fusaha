CREATE SCHEMA IF NOT EXISTS runtime_poc;

CREATE TABLE runtime_poc.runtime_versions (
  id uuid PRIMARY KEY,
  identity text NOT NULL,
  identity_algorithm text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'published', 'failed', 'quarantined', 'deletion_pending', 'collected')),
  manifest jsonb NOT NULL,
  manifest_sha256 text NOT NULL,
  asset_count integer NOT NULL CHECK (asset_count > 0),
  package_size_bytes bigint NOT NULL CHECK (package_size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (identity_algorithm, identity)
);

CREATE TABLE runtime_poc.runtime_publication_attempts (
  id uuid PRIMARY KEY,
  runtime_version_id uuid REFERENCES runtime_poc.runtime_versions(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL,
  state text NOT NULL CHECK (state IN ('created', 'leased', 'uploading', 'verifying', 'finalizing', 'published', 'failed', 'expired', 'quarantined')),
  lease_owner text,
  fencing_token bigint NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  staging_namespace text NOT NULL,
  expected_asset_count integer NOT NULL CHECK (expected_asset_count > 0),
  expected_package_size_bytes bigint NOT NULL CHECK (expected_package_size_bytes >= 0),
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runtime_poc.runtime_storage_objects (
  id uuid PRIMARY KEY,
  content_sha256 text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  content_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('staged', 'available', 'missing', 'quarantined', 'deleted')),
  provider text NOT NULL DEFAULT 'minio-poc',
  bucket text NOT NULL,
  object_key text NOT NULL,
  provider_generation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (provider, bucket, object_key)
);

CREATE TABLE runtime_poc.runtime_assets (
  id uuid PRIMARY KEY,
  runtime_version_id uuid NOT NULL REFERENCES runtime_poc.runtime_versions(id) ON DELETE RESTRICT,
  storage_object_id uuid NOT NULL REFERENCES runtime_poc.runtime_storage_objects(id) ON DELETE RESTRICT,
  path text NOT NULL,
  content_sha256 text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (runtime_version_id, path)
);

-- Synthetic-only proof data. It is not Fusaha application data.
INSERT INTO runtime_poc.runtime_versions (
  id, identity, identity_algorithm, state, manifest, manifest_sha256, asset_count, package_size_bytes, published_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'sha256-v1-poc-fixture-only',
  'runtime-package/v1',
  'pending',
  '{"entryPoint":"index.html","packageKind":"multi-file","assets":[{"path":"index.html","contentSha256":"fixture-hash-index","sizeBytes":119,"contentType":"text/html; charset=utf-8"}]}',
  'poc-fixture-manifest-only',
  1,
  0,
  NULL
);
