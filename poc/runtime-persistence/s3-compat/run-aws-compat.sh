#!/bin/bash
# One-command AWS S3 compatibility runner (Phase 10).
#
#   bash poc/runtime-persistence/s3-compat/run-aws-compat.sh [A|B]
#
# Prerequisites (environment variables — never hardcode credentials here):
#   RUNTIME_CONTENT_S3_ENDPOINT   e.g. https://s3.eu-west-1.amazonaws.com
#   RUNTIME_CONTENT_S3_REGION     must match the bucket region
#   RUNTIME_CONTENT_S3_ACCESS_KEY test-scoped IAM access key
#   RUNTIME_CONTENT_S3_SECRET_KEY test-scoped IAM secret key
#   RUNTIME_CONTENT_S3_BUCKET     the versioned + object-locked bucket
#   S3_COMPAT_RUN                 (optional) stable run label; required for
#                                 phase B to match a previous phase A run
#
# - Phase A (default): writes the compatibility matrix under
#   poc/s3-compat/<run>/ in the bucket (a few KB) and verifies
#   conditional writes, presigned GET, versioning, object lock, listing.
# - Phase B: re-reads the phase-A marker (persistence over time on AWS).
#   Requires the SAME S3_COMPAT_RUN value as the phase-A run.
# - Writes a timestamped report under poc/runtime-persistence/migration/reports/.
# - Exit codes: 0 = all required checks passed; 1 = required check failed;
#   2 = bad invocation or missing configuration.
#
# This script creates NO cloud resources and never echoes credentials.

set -uo pipefail

PHASE="${1:-A}"
if [ "$PHASE" != "A" ] && [ "$PHASE" != "B" ]; then
  echo "usage: bash poc/runtime-persistence/s3-compat/run-aws-compat.sh [A|B]" >&2
  exit 2
fi

REQUIRED_VARS=(RUNTIME_CONTENT_S3_ENDPOINT RUNTIME_CONTENT_S3_REGION
               RUNTIME_CONTENT_S3_ACCESS_KEY RUNTIME_CONTENT_S3_SECRET_KEY
               RUNTIME_CONTENT_S3_BUCKET)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "error: missing environment variable $var (see AWS_S3_READINESS.md)" >&2
    exit 2
  fi
done

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
REPORTS_DIR="$REPO_ROOT/poc/runtime-persistence/migration/reports"
mkdir -p "$REPORTS_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_LABEL="${S3_COMPAT_RUN:-aws-$STAMP}"
REPORT_FILE="$REPORTS_DIR/aws-s3-compat-$RUN_LABEL-$PHASE.txt"

{
  echo "# AWS S3 Compatibility Report — phase $PHASE"
  echo "# run: $STAMP   label: $RUN_LABEL"
  echo "# endpoint: $RUNTIME_CONTENT_S3_ENDPOINT   region: $RUNTIME_CONTENT_S3_REGION"
  echo "# bucket: $RUNTIME_CONTENT_S3_BUCKET"
  echo "# credentials: present (not shown)"
  echo
  S3_COMPAT_RUN="$RUN_LABEL" \
    node "$REPO_ROOT/poc/runtime-persistence/s3-compat/s3-compat-check.mjs" "$PHASE"
} | tee "$REPORT_FILE"

NODE_STATUS=${PIPESTATUS[0]:-$?}

echo
if [ "$NODE_STATUS" -eq 0 ]; then
  echo "report written: $REPORT_FILE"
  if [ "$PHASE" = "A" ]; then
    echo "NEXT (persistence over time): re-run later with:"
    echo "  S3_COMPAT_RUN=$RUN_LABEL bash poc/runtime-persistence/s3-compat/run-aws-compat.sh B"
  fi
else
  echo "COMPATIBILITY FAILURE (exit $NODE_STATUS) — report kept: $REPORT_FILE" >&2
fi
exit "$NODE_STATUS"
