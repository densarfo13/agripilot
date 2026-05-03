#!/usr/bin/env bash
# =============================================================
# Farroway — backend security smoke-test harness (curl edition)
# =============================================================
#
#   bash security-tests/curl-tests.sh
#   # or via npm:
#   npm run security:curl
#
# Exits 0 when every test passes. Exits 1 on the first failure
# bucket so CI can fail the gate. See security-test-plan.md for
# the canonical test matrix.
#
# Required env vars are listed in the README. Tests for which
# the required token / id is unset are SKIPPED (printed yellow)
# rather than failed — silent skips would mask gaps.

set -uo pipefail

# ─── Pre-flight (test-plan §0) ────────────────────────────
if [[ -z "${API_BASE_URL:-}" ]]; then
  echo "✗ API_BASE_URL is not set. Aborting."
  exit 2
fi
case "$API_BASE_URL" in
  *"//farroway.app"*|*"//www.farroway.app"*)
    echo "✗ API_BASE_URL points at the production apex (${API_BASE_URL})."
    echo "  This harness is staging-only. Use staging.farroway.app or localhost:4000."
    exit 2
    ;;
esac

# ─── Colour helpers ───────────────────────────────────────
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
  C_DIM=$'\033[2m';  C_BLD=$'\033[1m';  C_RST=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_YEL=""; C_DIM=""; C_BLD=""; C_RST=""
fi

PASS=0
FAIL=0
SKIP=0
FAIL_LINES=()

# ─── Sensitive-leak patterns (test-plan §3) ───────────────
# Anchored as a single ERE alternation so the subsequent
# `grep -Ei` runs in one pass per response body.
LEAK_PATTERNS='(at Object\.|Prisma|PrismaClientKnownRequestError|SQLSTATE|DATABASE_URL|JWT_SECRET|AUTH_SECRET|MFA_SECRET_KEY|SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|BEGIN PRIVATE KEY|node_modules|xox[abprs]-|AKIA[0-9A-Z]{16})'

# ─── Test runner ──────────────────────────────────────────
# Usage: run_test <#> <description> <method> <path> <expected> [<auth-header>] [<extra-curl-args>...]
# - <expected> is one of "401", "403", "200", "403|404", "400|413", "429-or-200" …
#   Use the literal string "429-eventually" for rate-limit tests, which
#   replays the request up to 50 times and passes if ANY response is 429.
run_test() {
  local num="$1"; shift
  local desc="$1"; shift
  local method="$1"; shift
  local pathspec="$1"; shift
  local expected="$1"; shift
  local auth="${1:-}"
  shift || true
  local -a extra=("$@")

  local label
  label="$(printf '[%2d] %-58s' "$num" "$desc")"

  # Skip when any required token is the literal "__SKIP__" sentinel
  for arg in "$auth" "${extra[@]}"; do
    if [[ "$arg" == *"__SKIP__"* ]]; then
      echo "${C_YEL}SKIP${C_RST} ${label} ${C_DIM}(missing env var)${C_RST}"
      SKIP=$((SKIP + 1))
      return 0
    fi
  done

  local url="${API_BASE_URL%/}$pathspec"
  local body_file
  body_file="$(mktemp)"
  trap 'rm -f "$body_file"' RETURN

  local -a curl_args=(
    -sS -o "$body_file"
    -w '%{http_code}'
    -X "$method"
    --max-time 15
  )
  if [[ -n "$auth" ]]; then
    curl_args+=(-H "Authorization: Bearer $auth")
  fi
  if (( ${#extra[@]} > 0 )); then
    curl_args+=("${extra[@]}")
  fi

  local code
  if [[ "$expected" == "429-eventually" ]]; then
    # Replay the request up to 50 times; pass if any returns 429.
    local seen429="no"
    for _ in $(seq 1 50); do
      code="$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo "000")"
      if [[ "$code" == "429" ]]; then
        seen429="yes"
        break
      fi
    done
    if [[ "$seen429" == "yes" ]]; then
      echo "${C_GRN}PASS${C_RST} ${label} ${C_DIM}(429 observed within 50 attempts)${C_RST}"
      PASS=$((PASS + 1))
      return 0
    else
      echo "${C_RED}FAIL${C_RST} ${label} ${C_DIM}(no 429 in 50 attempts; last code=$code)${C_RST}"
      FAIL=$((FAIL + 1))
      FAIL_LINES+=("$label  no rate-limit observed")
      return 0
    fi
  fi

  code="$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo "000")"

  # Status check — `expected` may be a single code or pipe-separated list.
  local status_ok="no"
  IFS='|' read -ra exp_codes <<< "$expected"
  for c in "${exp_codes[@]}"; do
    if [[ "$code" == "$c" ]]; then status_ok="yes"; fi
  done

  # Sensitive-leak scan (test-plan §3) — runs on every response.
  local leak_match=""
  if [[ -s "$body_file" ]]; then
    leak_match="$(grep -Eoi "$LEAK_PATTERNS" "$body_file" | head -1 || true)"
  fi

  if [[ "$status_ok" == "yes" && -z "$leak_match" ]]; then
    echo "${C_GRN}PASS${C_RST} ${label} ${C_DIM}(status=$code)${C_RST}"
    PASS=$((PASS + 1))
  else
    echo "${C_RED}FAIL${C_RST} ${label} ${C_DIM}(expected=$expected, got=$code${leak_match:+, leak=$leak_match})${C_RST}"
    FAIL=$((FAIL + 1))
    FAIL_LINES+=("$label  status=$code expected=$expected${leak_match:+ leak=$leak_match}")
  fi
}

# ─── Resolve env vars (with __SKIP__ sentinel) ────────────
TOK_A="${USER_A_FARMER_TOKEN:-__SKIP__}"
TOK_B="${USER_B_FARMER_TOKEN:-__SKIP__}"
TOK_BUYER="${BUYER_TOKEN:-__SKIP__}"
TOK_NGO_A="${NGO_A_TOKEN:-__SKIP__}"
TOK_NGO_B="${NGO_B_TOKEN:-__SKIP__}"
TOK_FA="${FIELD_AGENT_TOKEN:-__SKIP__}"
TOK_ADMIN="${PLATFORM_ADMIN_TOKEN:-__SKIP__}"
TOK_BAD="${INVALID_TOKEN:-not-a-real-jwt}"

ID_FARM_A="${USER_A_FARM_ID:-__SKIP__}"
ID_FARM_B="${USER_B_FARM_ID:-__SKIP__}"
ID_SCAN_A="${USER_A_SCAN_ID:-__SKIP__}"
ID_SCAN_B="${USER_B_SCAN_ID:-__SKIP__}"
ID_PROG_A="${PROGRAM_A_ID:-__SKIP__}"
ID_PROG_B="${PROGRAM_B_ID:-__SKIP__}"
ID_LIST_PRIV="${PRIVATE_LISTING_ID:-__SKIP__}"
ID_LIST_PUB="${PUBLIC_LISTING_ID:-__SKIP__}"
ID_FARMER_UNASSIGNED="${UNASSIGNED_FARMER_ID:-__SKIP__}"

echo
echo "${C_BLD}Farroway security test harness — curl edition${C_RST}"
echo "${C_DIM}Base URL: $API_BASE_URL${C_RST}"
echo

# ─── Test 1: Unauthenticated ──────────────────────────────
run_test 1 "Unauthenticated GET /api/farms returns 401" \
  GET /api/farms 401 ""

# ─── Test 2: Invalid token ────────────────────────────────
run_test 2 "Invalid bearer token returns 401" \
  GET /api/farms 401 "$TOK_BAD"

# ─── Test 3: Cross-user IDOR — farm ───────────────────────
run_test 3 "Farmer A reading Farmer B's farm is denied" \
  GET "/api/farms/$ID_FARM_B" "403|404" "$TOK_A"

# ─── Test 4: Cross-user IDOR — scan ───────────────────────
run_test 4 "Farmer A reading Farmer B's scan is denied" \
  GET "/api/scans/$ID_SCAN_B" "403|404" "$TOK_A"

# ─── Test 5: Buyer reading private farmer scan ────────────
run_test 5 "Buyer reading another user's scan is denied" \
  GET "/api/scans/$ID_SCAN_A" "403|404" "$TOK_BUYER"

# ─── Test 6: Buyer reading private listing ────────────────
run_test 6 "Buyer reading a private listing is denied" \
  GET "/api/buyer/listings/$ID_LIST_PRIV" "403|404" "$TOK_BUYER"

# ─── Test 7: Buyer reading public listing ─────────────────
run_test 7 "Buyer reading a public listing is allowed (200)" \
  GET "/api/buyer/listings/$ID_LIST_PUB" "200" "$TOK_BUYER"

# ─── Test 8: NGO cross-program leak ───────────────────────
run_test 8 "NGO A reading Program B is denied" \
  GET "/api/ngo/programs/$ID_PROG_B" "403|404" "$TOK_NGO_A"

# ─── Test 9: Field agent on unassigned farmer ─────────────
run_test 9 "Field agent reading unassigned farmer is denied" \
  GET "/api/ngo/farmers/$ID_FARMER_UNASSIGNED" "403|404" "$TOK_FA"

# ─── Test 10: Farmer reaching admin route ─────────────────
run_test 10 "Farmer reaching /api/admin/users is denied" \
  GET "/api/admin/users" 403 "$TOK_A"

# ─── Test 11: Admin can reach admin route ─────────────────
run_test 11 "Platform admin reaching /api/admin/users is allowed" \
  GET "/api/admin/users" 200 "$TOK_ADMIN"

# ─── Test 12: Scan rate-limit ─────────────────────────────
# Send up to 50 lightweight POSTs; the scanLimiter caps at
# 30/min/IP, so we expect a 429 within the burst.
run_test 12 "Scan endpoint rate-limit returns 429 on burst" \
  POST "/api/scan/analyze" "429-eventually" "$TOK_A" \
  -H "Content-Type: application/json" \
  --data '{"plantName":"tomato"}'

# ─── Test 13: Upload invalid MIME (.txt) ──────────────────
TXT_TMP="$(mktemp --suffix=.txt)"
printf 'this is not an image' > "$TXT_TMP"
run_test 13 "Upload of .txt as scan image is rejected" \
  POST "/api/scan/analyze" "400|415" "$TOK_A" \
  -H "Content-Type: application/json" \
  --data "{\"imageBase64\":\"$(base64 < "$TXT_TMP" | tr -d '\n')\"}"
rm -f "$TXT_TMP"

# ─── Test 14: Oversized upload (>10 MB) ───────────────────
# A 12-MB null buffer base64-encodes to ~16 MB which exceeds
# the express.json 2-MB cap before the route ever runs — the
# server returns 413 (or 400) at the body parser stage.
run_test 14 "Oversized scan upload is rejected" \
  POST "/api/scan/analyze" "400|413" "$TOK_A" \
  -H "Content-Type: application/json" \
  --data "{\"imageBase64\":\"$(head -c 12582912 /dev/zero 2>/dev/null | base64 | tr -d '\n')\"}"

# ─── Test 15: Error leak on invalid id ────────────────────
run_test 15 "Invalid farm id returns clean error (no stack/Prisma/JWT)" \
  GET "/api/farms/not-a-real-uuid" "400|404" "$TOK_A"

# ─── Test 16: Empty body on scan ──────────────────────────
run_test 16 "Empty scan body returns clean 400" \
  POST "/api/scan/analyze" "400" "$TOK_A" \
  -H "Content-Type: application/json" \
  --data '{}'

# ─── Test 17: Buyer trying farmer-only sell endpoint ──────
run_test 17 "Buyer calling farmer-only /api/sell/listings is denied" \
  POST "/api/sell/listings" "403|404" "$TOK_BUYER" \
  -H "Content-Type: application/json" \
  --data '{"crop":"tomato","quantity":100}'

# ─── Test 18: Field agent on admin route ──────────────────
run_test 18 "Field agent reaching /api/admin/users is denied" \
  GET "/api/admin/users" 403 "$TOK_FA"

# ─── Test 19: Buyer reading another farmer's farm ─────────
run_test 19 "Buyer reading a farmer's farm is denied" \
  GET "/api/farms/$ID_FARM_A" "403|404" "$TOK_BUYER"

# ─── Test 20: NGO B querying NGO A's roster ───────────────
run_test 20 "NGO B reading NGO A's farmer roster is denied/empty" \
  GET "/api/ngo/farmers?programId=$ID_PROG_A" "403|200" "$TOK_NGO_B"

# ─── Test 21: Health endpoint reachable ───────────────────
run_test 21 "Health endpoint is publicly reachable" \
  GET "/api/health" "200|503" ""

# ─── Test 22: Public marketplace ──────────────────────────
run_test 22 "Public marketplace listing reachable without auth" \
  GET "/api/marketplace" "200" ""

# ─── Test 23: CORS preflight ──────────────────────────────
run_test 23 "OPTIONS preflight is handled" \
  OPTIONS "/api/farms" "200|204" "" \
  -H "Origin: https://example.invalid" \
  -H "Access-Control-Request-Method: GET"

# ─── Summary ──────────────────────────────────────────────
echo
echo "${C_BLD}Summary:${C_RST} ${C_GRN}${PASS} pass${C_RST}, ${C_RED}${FAIL} fail${C_RST}, ${C_YEL}${SKIP} skip${C_RST}"
if (( FAIL > 0 )); then
  echo
  echo "${C_BLD}Failures:${C_RST}"
  for line in "${FAIL_LINES[@]}"; do
    echo "  ${C_RED}✗${C_RST} $line"
  done
  echo
  echo "See security-tests/security-test-plan.md for the severity table."
  exit 1
fi
exit 0
