#!/usr/bin/env bash
# Certified safe-mode smoke tests. NEVER sends WhatsApp messages.
set -euo pipefail
BASE_URL="${BASE_URL:-http://10.0.0.218:3082}"
BASE_URL="${BASE_URL%/}"
for path in / /app.js /styles.css /api/healthz /api/readyz /adapter/healthz /adapter/readyz; do
  code="$(curl --connect-timeout 5 --max-time 12 -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"
  test "$code" = 200 || { echo "FAIL GET $path -> $code"; exit 1; }
  echo "PASS GET $path -> 200"
done
curl --connect-timeout 5 --max-time 12 -fsS "$BASE_URL/api/readyz" |
 python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["safe_mode"] is True; assert d["middleware_command_type_configured"] is False; print("PASS API remains locked to safe-mode")'
curl --connect-timeout 5 --max-time 12 -fsS "$BASE_URL/adapter/readyz" |
 python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["safe_mode"] is True; print("PASS provider remains locked to safe-mode")'

payload='{"recipient":"15550000000","consent_status":"unknown","suppressed":false,"opted_out":false}'
curl --connect-timeout 5 --max-time 12 -fsS -H 'content-type: application/json' -d "$payload" "$BASE_URL/api/contacts/eligibility" |
 python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["eligible"] is False; assert "consent_not_opted_in" in d["reasons"]; print("PASS negative consent eligibility")'
payload='{"recipient":"15550000000","consent_status":"opted_in","suppressed":false,"opted_out":false}'
curl --connect-timeout 5 --max-time 12 -fsS -H 'content-type: application/json' -d "$payload" "$BASE_URL/api/contacts/eligibility" |
 python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["eligible"] is True; print("PASS positive consent eligibility")'
payload='{"owner_id":"qa-owner","template_id":"qa-template","audience_count":2,"bulk_approved":false}'
result="$(curl --connect-timeout 5 --max-time 12 -sS -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d "$payload" "$BASE_URL/api/campaigns/validate")"
test "$result" = 422 || { echo "FAIL missing bulk approval accepted";exit 1; }
echo 'PASS bulk-approval requirement enforced'
payload='{"owner_id":"qa-owner","template_id":"qa-template","audience_count":2,"bulk_approved":true}'
curl --connect-timeout 5 --max-time 12 -fsS -H 'content-type: application/json' -d "$payload" "$BASE_URL/api/campaigns/validate" |
 python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["valid"] is True; print("PASS approved campaign draft validation")'
code="$(curl --connect-timeout 5 --max-time 12 -sS -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/platform/v1/whatsapp/messages")"
test "$code" = 404 || { echo "FAIL message route not closed: $code";exit 1; }
echo 'PASS message effects inaccessible at browser gateway'
code="$(curl --connect-timeout 5 --max-time 12 -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/internal")"
test "$code" = 404 || { echo "FAIL internal route exposed: $code";exit 1; }
echo 'PASS internal API surface inaccessible'
echo 'STAGING_SMOKE=PASS; PRODUCTION_CERTIFICATION=NO'
