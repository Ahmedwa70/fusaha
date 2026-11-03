#!/bin/bash
# One-command Real-Data Inventory runner (Phase 10).
#
#   bash poc/runtime-persistence/inventory/run-inventory.sh <export.json> [decisions.json]
#
# - Read-only: only reads the export (and optional decisions) file.
# - Validates per EXPORT_CONTRACT.md, classifies every lesson version,
#   and writes a timestamped report under poc/runtime-persistence/migration/reports/.
# - Exit codes: 0 = valid export, report written; 1 = invalid export;
#   2 = bad invocation. Never classifies silently.

set -uo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: bash poc/runtime-persistence/inventory/run-inventory.sh <export.json> [decisions.json]" >&2
  exit 2
fi

EXPORT_FILE="$1"
DECISIONS_ARG=()
if [ "$#" -eq 2 ]; then
  DECISIONS_ARG=(--decisions "$2")
fi

if [ ! -f "$EXPORT_FILE" ]; then
  echo "error: export file not found: $EXPORT_FILE" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
REPORTS_DIR="$REPO_ROOT/poc/runtime-persistence/migration/reports"
mkdir -p "$REPORTS_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORTS_DIR/inventory-$STAMP.txt"

{
  echo "# Real-Data Inventory Report"
  echo "# run: $STAMP"
  echo "# export: $EXPORT_FILE"
  echo "# decisions: ${2:-none}"
  echo "# tool: poc/runtime-persistence/inventory/inventory-tool.mjs (read-only, no DB access)"
  echo
  node "$REPO_ROOT/poc/runtime-persistence/inventory/inventory-tool.mjs" \
    "$EXPORT_FILE" ${DECISIONS_ARG[@]+"${DECISIONS_ARG[@]}"}
} | tee "$REPORT_FILE"

NODE_STATUS=${PIPESTATUS[0]:-$?}

echo
if [ "$NODE_STATUS" -eq 0 ]; then
  echo "report written: $REPORT_FILE"
else
  echo "INVALID EXPORT (tool exit $NODE_STATUS) — report written for evidence: $REPORT_FILE" >&2
fi
exit "$NODE_STATUS"
