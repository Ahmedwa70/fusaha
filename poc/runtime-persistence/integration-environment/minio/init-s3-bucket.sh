#!/bin/sh
set -eu

: "${POC_S3_BUCKET:?Set POC_S3_BUCKET}"
: "${POC_S3_ENDPOINT:?Set POC_S3_ENDPOINT}"
: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"

# Create the private bucket only if it does not exist.
if ! aws s3api head-bucket --bucket "$POC_S3_BUCKET" --endpoint-url "$POC_S3_ENDPOINT" >/dev/null 2>&1; then
  aws s3api create-bucket --bucket "$POC_S3_BUCKET" --endpoint-url "$POC_S3_ENDPOINT"
fi

# Versioning preserves prior bytes if a test client accidentally overwrites an
# object. It does not itself reject overwrite requests; the adapter must use a
# no-overwrite/If-None-Match precondition and tests must assert that behavior.
aws s3api put-bucket-versioning \
  --bucket "$POC_S3_BUCKET" \
  --endpoint-url "$POC_S3_ENDPOINT" \
  --versioning-configuration Status=Enabled

# Disposable-data lifecycle. Strict: any failure here aborts initialization.
# - Expiration Days=1: current object versions are deleted 1 day after creation.
# - NoncurrentVersionExpiration NoncurrentDays=1: superseded versions are
#   deleted 1 day after they stop being current.
# - AbortIncompleteMultipartUpload DaysAfterInitiation=1: stale uploads are
#   aborted after 1 day.
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$POC_S3_BUCKET" \
  --endpoint-url "$POC_S3_ENDPOINT" \
  --lifecycle-configuration '{"Rules":[{"ID":"poc-disposable-expiry","Status":"Enabled","Filter":{},"Expiration":{"Days":1},"NoncurrentVersionExpiration":{"NoncurrentDays":1},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

# Anonymous access stays denied (SeaweedFS default). The integration test plan
# verifies that an unauthenticated GET receives HTTP 403.
echo "Initialized private versioned bucket with disposable lifecycle: $POC_S3_BUCKET"
