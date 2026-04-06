#!/bin/bash
BASE="http://localhost:3000/api/v1"
PASS=0
FAIL=0

echo "======================================"
echo "  PRODUCT RULES VALIDATION"
echo "======================================"
echo ""

# Helper: extract JSON field using node
jval() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const v=JSON.parse(d)['$1'];console.log(v===undefined||v===null?'MISSING':v)}catch(e){console.log('PARSE_ERROR: '+e.message)}})"
}
jlist() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log((o['$1']||[]).join('|'))}catch{console.log('PARSE_ERROR')}})"
}
jlen() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);const v=o['$1'];console.log(Array.isArray(v)?v.length:0)}catch{console.log(0)}})"
}

# ═══════════════════════════════════════
# RULE 1: DECISION ENGINE
# ═══════════════════════════════════════
echo "=== RULE 1: DECISION ENGINE ==="

echo "--- 1a: Response has 3+ checks, 2+ actions, 1 mistake, 1 escalation ---"
TRIAGE=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","location":"Nairobi","season":"Rainy","issueType":"Yellow leaves","symptomSeverity":"Moderate","problemDetails":"Leaves turning yellow from bottom"}')
CHECKS=$(echo "$TRIAGE" | jlen whatToCheck)
ACTIONS=$(echo "$TRIAGE" | jlen nextAction)
MISTAKE=$(echo "$TRIAGE" | jval avoidThisMistake)
ESCALATE=$(echo "$TRIAGE" | jval escalateIf)

echo "  whatToCheck: $CHECKS items"
echo "  nextAction: $ACTIONS items"
echo "  avoidThisMistake: ${#MISTAKE} chars"
echo "  escalateIf: ${#ESCALATE} chars"

if [ "$CHECKS" -ge 3 ] && [ "$ACTIONS" -ge 2 ] && [ "${#MISTAKE}" -gt 10 ] && [ "${#ESCALATE}" -gt 10 ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

# ═══════════════════════════════════════
# RULE 2: EXECUTION LAYER (Checklist with types)
# ═══════════════════════════════════════
echo "=== RULE 2: EXECUTION LAYER ==="

echo "--- 2a: Auto-checklist has typed items ---"
# Save a case with auto-save
SAVED=$(curl -s -X POST "$BASE/field-triage/assess?user_id=test-rules&save=true" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Rice","location":"Mombasa","season":"Dry","issueType":"Weak growth","symptomSeverity":"Moderate","problemDetails":"Plants stunted and slow"}')
CASE_ID=$(echo "$SAVED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(o._meta?.caseId||'MISSING')}catch{console.log('PARSE_ERROR')}})")
echo "  Case ID: $CASE_ID"

if [ "$CASE_ID" != "MISSING" ] && [ "$CASE_ID" != "PARSE_ERROR" ]; then
  # Get enriched case
  ENRICHED=$(curl -s "$BASE/field-triage/cases/$CASE_ID/enriched")

  # Check checklist has types
  TYPES=$(echo "$ENRICHED" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const o=JSON.parse(d);
      const types=new Set((o.checklist||[]).map(i=>i.type));
      console.log([...types].join(','));
    })")
  echo "  Checklist types: $TYPES"

  TOTAL=$(echo "$ENRICHED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.progress?.total||0)})")
  SUMMARY=$(echo "$ENRICHED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.progress?.summary||'')})")
  echo "  Total items: $TOTAL"
  echo "  Summary: $SUMMARY"

  # Verify at least action and check types exist
  if echo "$TYPES" | grep -q "action" && echo "$TYPES" | grep -q "check"; then
    echo "  PASS (typed checklist)"; PASS=$((PASS+1))
  else
    echo "  FAIL (missing action/check types)"; FAIL=$((FAIL+1))
  fi

  echo ""
  echo "--- 2b: Toggle checklist → timeline event + status change ---"
  # Get first item ID
  FIRST_ITEM=$(echo "$ENRICHED" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const o=JSON.parse(d);
      console.log(o.checklist?.[0]?.id||'MISSING');
    })")
  echo "  Toggling item: $FIRST_ITEM"

  curl -s -X PATCH "$BASE/field-triage/cases/$CASE_ID/checklist" \
    -H "Content-Type: application/json" \
    -d "{\"itemId\":\"$FIRST_ITEM\",\"checked\":true}" > /dev/null

  AFTER=$(curl -s "$BASE/field-triage/cases/$CASE_ID/enriched")
  NEW_STATUS=$(echo "$AFTER" | jval status)
  TL_COUNT=$(echo "$AFTER" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log((o.timeline||[]).length)})")
  DONE=$(echo "$AFTER" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.progress?.done||0)})")
  echo "  Status after toggle: $NEW_STATUS"
  echo "  Timeline events: $TL_COUNT"
  echo "  Done: $DONE"

  if [ "$NEW_STATUS" = "in-progress" ] && [ "$TL_COUNT" -ge 3 ] && [ "$DONE" -ge 1 ]; then
    echo "  PASS (toggle → status + timeline)"; PASS=$((PASS+1))
  else
    echo "  FAIL"; FAIL=$((FAIL+1))
  fi
else
  echo "  SKIP (no case ID)"; FAIL=$((FAIL+2))
fi
echo ""

# ═══════════════════════════════════════
# RULE 3: FEEDBACK LOOP (Farm progress)
# ═══════════════════════════════════════
echo "=== RULE 3: FEEDBACK LOOP ==="

echo "--- 3a: Healthy crop cycle → On track ---"
CYCLE=$(curl -s -X POST "$BASE/farm-cycle" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","farmSize":"2 acres","plantingDate":"2026-01-01","location":"Nairobi"}')
CID=$(echo "$CYCLE" | jval id)

for i in 1 2 3 4 5 6; do
  DAY=$((i * 14))
  MONTH=$((1 + DAY / 30))
  MDAY=$((1 + DAY % 30))
  DATE=$(printf "2026-%02d-%02d" $MONTH $MDAY)
  curl -s -X POST "$BASE/farm-cycle/$CID/progress" \
    -H "Content-Type: application/json" \
    -d "{\"date\":\"$DATE\",\"conditionStatus\":\"Good\",\"activityUpdate\":\"Healthy week $i\",\"stageMatch\":\"Yes\"}" > /dev/null
done

RESULT=$(curl -s "$BASE/farm-cycle/$CID")
STATUS=$(echo "$RESULT" | jval visibleStatus)
echo "  visibleStatus: $STATUS"
if [ "$STATUS" = "On track" ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- 3b: Declining crop → Needs attention ---"
CYCLE3=$(curl -s -X POST "$BASE/farm-cycle" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Tomato","farmSize":"0.5 acres","plantingDate":"2026-01-01","location":"Kisumu"}')
CID3=$(echo "$CYCLE3" | jval id)

curl -s -X POST "$BASE/farm-cycle/$CID3/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-01-15","conditionStatus":"Good","activityUpdate":"Start ok","stageMatch":"Yes"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$CID3/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-02-01","conditionStatus":"Average","activityUpdate":"Getting worse","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$CID3/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-02-15","conditionStatus":"Poor","activityUpdate":"Bad shape","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$CID3/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-01","conditionStatus":"Poor","activityUpdate":"Still declining","stageMatch":"No"}' > /dev/null

RESULT3=$(curl -s "$BASE/farm-cycle/$CID3")
STATUS3=$(echo "$RESULT3" | jval visibleStatus)
echo "  visibleStatus: $STATUS3"
if [ "$STATUS3" = "Needs attention" ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

# ═══════════════════════════════════════
# RULE 4: STORAGE EDGE
# ═══════════════════════════════════════
echo "=== RULE 4: STORAGE EDGE ==="

echo "--- 4a: Storage output has all required fields ---"
STORAGE=$(curl -s -X POST "$BASE/storage-advisor/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","quantity":"500kg","storageType":"Sack / Bag","storageCondition":"Humid / Damp","duration":"1-3 months","storageGoal":"Home consumption","currentProblems":["Moisture / Dampness"]}')

S_RISKS=$(echo "$STORAGE" | jlen riskFactors)
S_ACTIONS=$(echo "$STORAGE" | jlen immediateActions)
S_METHOD=$(echo "$STORAGE" | jval bestStorageMethod)
S_SHELF=$(echo "$STORAGE" | jval estimatedShelfLife)
S_AVOID=$(echo "$STORAGE" | jval avoidThisMistake)
S_FACILITY=$(echo "$STORAGE" | jval facilitySuggestion)
S_ESCALATE=$(echo "$STORAGE" | jval escalateIf)

echo "  riskFactors: $S_RISKS items"
echo "  immediateActions: $S_ACTIONS items"
echo "  bestStorageMethod: ${#S_METHOD} chars"
echo "  shelfLife: ${#S_SHELF} chars"
echo "  escalateIf: ${#S_ESCALATE} chars"

if [ "$S_RISKS" -ge 3 ] && [ "$S_ACTIONS" -ge 2 ] && [ "${#S_AVOID}" -gt 10 ] && [ "${#S_FACILITY}" -gt 10 ] && [ "${#S_ESCALATE}" -gt 10 ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- 4b: Storage flags moisture risk ---"
RISKS_TEXT=$(echo "$STORAGE" | jlist riskFactors)
if echo "$RISKS_TEXT" | grep -iq "moist\|humid\|damp\|aflatoxin\|mold"; then
  echo "  PASS (moisture risk flagged)"; PASS=$((PASS+1))
else
  echo "  FAIL (no moisture risk)"; FAIL=$((FAIL+1))
fi
echo ""

# ═══════════════════════════════════════
# RULE 5+6: SIMPLICITY + TRUST
# ═══════════════════════════════════════
echo "=== RULE 5+6: SIMPLICITY + TRUST ==="

echo "--- 5a: Image observation has uncertainty wording ---"
IMG_TRIAGE=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","location":"Nairobi","season":"Rainy","issueType":"Yellow leaves","symptomSeverity":"Moderate","problemDetails":"Yellow leaves","imageUrl":"https://example.com/photo.jpg"}')
IMG_OBS=$(echo "$IMG_TRIAGE" | jval observedFromImage)
if echo "$IMG_OBS" | grep -iq "limit\|cannot\|starting point\|confirm"; then
  echo "  PASS (uncertainty language)"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- 5b: No internal scores leaked ---"
CYCLE_RESP=$(curl -s "$BASE/farm-cycle/$CID")
HAS_INTEL=$(echo "$CYCLE_RESP" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    const o=JSON.parse(d);
    const leaked = o._intelligence || o.consistencyScore || o.financeReadiness || o.benchmark || o.risk;
    console.log(leaked ? 'LEAKED' : 'CLEAN');
  })")
echo "  Intelligence fields: $HAS_INTEL"
if [ "$HAS_INTEL" = "CLEAN" ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL (internal data leaked)"; FAIL=$((FAIL+1))
fi
echo ""

# ═══════════════════════════════════════
# RULE 8: HIDDEN INTELLIGENCE
# ═══════════════════════════════════════
echo "=== RULE 8: HIDDEN INTELLIGENCE ==="

echo "--- 8a: Slight delay scenario ---"
CYCLE_SD=$(curl -s -X POST "$BASE/farm-cycle" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Rice","farmSize":"1 acre","plantingDate":"2026-01-01","location":"Mombasa"}')
CID_SD=$(echo "$CYCLE_SD" | jval id)

curl -s -X POST "$BASE/farm-cycle/$CID_SD/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-01-20","conditionStatus":"Average","activityUpdate":"Started ok","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$CID_SD/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-02-10","conditionStatus":"Average","activityUpdate":"Growing slowly","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$CID_SD/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-01","conditionStatus":"Average","activityUpdate":"Still average","stageMatch":"Yes"}' > /dev/null

RESULT_SD=$(curl -s "$BASE/farm-cycle/$CID_SD")
STATUS_SD=$(echo "$RESULT_SD" | jval visibleStatus)
echo "  visibleStatus: $STATUS_SD"
if [ "$STATUS_SD" = "Slight delay" ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL (expected Slight delay)"; FAIL=$((FAIL+1))
fi
echo ""

# ═══════════════════════════════════════
# VALIDATION: Minimal fields + old data
# ═══════════════════════════════════════
echo "=== VALIDATION ==="

echo "--- V1: Minimal required fields → no crash ---"
T_MIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Rice","location":"Mombasa","season":"Dry","issueType":"Weak growth","symptomSeverity":"Mild","problemDetails":"Plants not growing well"}')
S_MIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/storage-advisor/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Beans","quantity":"100kg","storageType":"Sack / Bag","storageCondition":"Dry","duration":"Less than 1 month","storageGoal":"Home consumption"}')
C_MIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/farm-cycle" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Sorghum","farmSize":"3 acres","plantingDate":"2026-03-01","location":"Eldoret"}')
echo "  Triage: $T_MIN | Storage: $S_MIN | Cycle: $C_MIN"
if [ "$T_MIN" = "201" ] && [ "$S_MIN" = "201" ] && [ "$C_MIN" = "201" ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- V2: Old data safe fallback ---"
CASES_LIST=$(curl -s "$BASE/field-triage/workflow?user_id=test-rules")
WF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/field-triage/workflow?user_id=test-rules")
echo "  Workflow GET: HTTP $WF_STATUS"
if [ "$WF_STATUS" = "200" ]; then
  echo "  PASS"; PASS=$((PASS+1))
else
  echo "  FAIL"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "  RESULTS: $PASS passed, $FAIL failed out of 13"
echo "======================================"
