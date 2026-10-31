#!/bin/sh
set -eu

mc alias set poc http://minio:9000 "$POC_MINIO_ROOT_USER" "$POC_MINIO_ROOT_PASSWORD"
mc mb --ignore-existing "poc/$POC_MINIO_BUCKET"

# Keep the bucket private. The integration client must use the server-side
# adapter credentials; anonymous reads/writes are intentionally disabled.
mc anonymous set none "poc/$POC_MINIO_BUCKET"

# Versioning preserves prior bytes if a test client accidentally overwrites an
# object. It does not itself reject overwrite requests; the adapter must use a
# no-overwrite/If-None-Match precondition and tests must assert that behavior.
mc version enable "poc/$POC_MINIO_BUCKET"

mc ilm add --expiry-days 1 "poc/$POC_MINIO_BUCKET" --noncurrent-expire-days 1 || true

echo "Initialized private MinIO bucket: $POC_MINIO_BUCKET"
