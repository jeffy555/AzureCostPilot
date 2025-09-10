#!/bin/bash
set -euo pipefail

PUBLIC_KEY=${1:?"PUBLIC_KEY arg required"}
PRIVATE_KEY=${2:?"PRIVATE_KEY arg required"}
ORG_ID=${3:?"ORG_ID arg required"}
START_DATE=${4:-"$(date -u +"%Y-%m-01")"}
END_DATE=${5:-"$(date -u -v+1m +"%Y-%m-01" 2>/dev/null || date -u -d"+1 month" +"%Y-%m-01")"}

REQ_BODY=$(cat <<EOF
{"startDate":"${START_DATE}","endDate":"${END_DATE}","organizations":["${ORG_ID}"],"groupBy":"organizations"}
EOF
)

HDR_ACCEPT="Accept: application/vnd.atlas.2023-01-01+json"
HDR_JSON="Content-Type: application/json"

TMP_HEADERS=$(mktemp)
TMP_BODY=$(mktemp)

curl --digest -u "${PUBLIC_KEY}:${PRIVATE_KEY}" \
  -sS -D "$TMP_HEADERS" -o "$TMP_BODY" \
  -H "$HDR_ACCEPT" -H "$HDR_JSON" \
  -X POST --data "$REQ_BODY" \
  "https://cloud.mongodb.com/api/atlas/v2/orgs/${ORG_ID}/billing/costExplorer/usage"

TOKEN=$(grep -i '^Location:' "$TMP_HEADERS" | sed -E 's/.*\/usage\/([^[:space:]]+).*/\1/' | tr -d '\r' | tail -n1)
if [[ -z "$TOKEN" ]]; then
  TOKEN=$(sed -n 's/.*\"\(token\|id\|usageId\)\"[[:space:]]*:[[:space:]]*\"\([^\"]\+\)\".*/\2/p' "$TMP_BODY" | head -n1 || true)
fi

echo "TOKEN:$TOKEN"

curl --digest -u "${PUBLIC_KEY}:${PRIVATE_KEY}" \
  -sS -H "$HDR_ACCEPT" \
  "https://cloud.mongodb.com/api/atlas/v2/orgs/${ORG_ID}/billing/costExplorer/usage/${TOKEN}"


