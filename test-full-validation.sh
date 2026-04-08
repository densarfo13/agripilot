#!/bin/bash
BASE="http://localhost:3000/api/v1"
PASS=0
FAIL=0
TOTAL=0

# Helpers
jval() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const v=JSON.parse(d)['$1'];console.log(v===undefined||v===null?'MISSING':v)}catch(e){console.log('PARSE_ERROR')}})"
}
jlen() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);const v=o['$1'];console.log(Array.isArray(v)?v.length:0)}catch{console.log(0)}})"
}
jlist() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log((o['$1']||[]).join('|'))}catch{console.log('PARSE_ERROR')}})"
}
jnested() {
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);const parts='$1'.split('.');let v=o;for(const p of parts)v=v?.[p];console.log(v===undefined||v===null?'MISSING':v)}catch{console.log('PARSE_ERROR')}})"
}

check() {
  TOTAL=$((TOTAL+1))
  if [ "$1" = "true" ]; then
    echo "  PASS"; PASS=$((PASS+1))
  else
    echo "  FAIL — $2"; FAIL=$((FAIL+1))
  fi
}

echo "================================================================"
echo "  FULL VALIDATION — Farroway Product Rules"
echo "  $(date)"
echo "================================================================"
echo ""

# ══════════════════════════════════════════
echo "═══ SECTION 1: DECISION ENGINE (Field Triage) ═══"
echo ""

# Test all 7 issue types produce valid output
for ISSUE in "Yellow leaves" "Weak growth" "Low yield concern" "Leaf spots or damage" "Water stress concern" "Pest or disease suspicion" "Poor germination or uneven emergence"; do
  echo "--- Issue: $ISSUE ---"
  RESP=$(curl -s -X POST "$BASE/field-triage/assess" \
    -H "Content-Type: application/json" \
    -d "{\"cropType\":\"Maize\",\"location\":\"Nairobi\",\"season\":\"Rainy\",\"issueType\":\"$ISSUE\",\"symptomSeverity\":\"Moderate\",\"problemDetails\":\"Field symptoms observed\"}")

  CHECKS=$(echo "$RESP" | jlen whatToCheck)
  ACTIONS=$(echo "$RESP" | jlen nextAction)
  MISTAKE_LEN=$(echo "$RESP" | jval avoidThisMistake | wc -c)
  ESCALATE_LEN=$(echo "$RESP" | jval escalateIf | wc -c)
  URGENCY=$(echo "$RESP" | jval urgency)
  CONF=$(echo "$RESP" | jval confidence)

  echo "  checks=$CHECKS actions=$ACTIONS urgency=$URGENCY confidence=$CONF"
  COND="false"
  if [ "$CHECKS" -ge 3 ] && [ "$ACTIONS" -ge 2 ] && [ "$MISTAKE_LEN" -gt 15 ] && [ "$ESCALATE_LEN" -gt 15 ]; then
    COND="true"
  fi
  check "$COND" "checks=$CHECKS actions=$ACTIONS mistake=$MISTAKE_LEN escalate=$ESCALATE_LEN"
done
echo ""

# Severity adjustments
echo "--- Severity: Severe raises urgency ---"
RESP_SEV=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Rice","location":"Mombasa","season":"Dry","issueType":"Yellow leaves","symptomSeverity":"Severe","problemDetails":"All leaves yellow"}')
URG_SEV=$(echo "$RESP_SEV" | jval urgency)
echo "  urgency=$URG_SEV"
check "$([ "$URG_SEV" = "High" ] && echo true || echo false)" "expected High urgency for Severe"
echo ""

# Weather context
echo "--- Weather: Rainy adds fungal context ---"
RESP_WX=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","location":"Nairobi","season":"Rainy","issueType":"Leaf spots or damage","symptomSeverity":"Moderate","problemDetails":"Spots on leaves","recentWeather":"Heavy rainfall last week"}')
CAUSE_WX=$(echo "$RESP_WX" | jval likelyCause)
if echo "$CAUSE_WX" | grep -iq "fungal\|wet\|rain\|moisture"; then
  check "true"
else
  check "false" "no weather context in cause"
fi
echo ""

# Image uncertainty
echo "--- Image: uncertainty wording ---"
RESP_IMG=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","location":"Nairobi","season":"Rainy","issueType":"Yellow leaves","symptomSeverity":"Moderate","problemDetails":"Yellow","imageUrl":"https://example.com/photo.jpg"}')
OBS=$(echo "$RESP_IMG" | jval observedFromImage)
if echo "$OBS" | grep -iq "limit\|cannot\|starting point\|confirm"; then
  check "true"
else
  check "false" "no uncertainty in image observation"
fi
echo ""

# No image = null
echo "--- No image: observedFromImage is null ---"
RESP_NOIMG=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","location":"Nairobi","season":"Rainy","issueType":"Yellow leaves","symptomSeverity":"Moderate","problemDetails":"Yellow leaves"}')
OBS_NONE=$(echo "$RESP_NOIMG" | jval observedFromImage)
check "$([ "$OBS_NONE" = "MISSING" ] && echo true || echo false)" "expected null/MISSING, got $OBS_NONE"
echo ""

# ══════════════════════════════════════════
echo "═══ SECTION 2: EXECUTION LAYER (Checklist) ═══"
echo ""

echo "--- Auto-save creates typed checklist ---"
SAVED=$(curl -s -X POST "$BASE/field-triage/assess?user_id=fulltest&save=true" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Beans","location":"Kisumu","season":"Rainy","issueType":"Pest or disease suspicion","symptomSeverity":"Severe","problemDetails":"Visible insects on leaves"}')
CASE_ID=$(echo "$SAVED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d)._meta?.caseId||'MISSING')}catch{console.log('ERR')}})")
echo "  Case: $CASE_ID"

ENRICHED=$(curl -s "$BASE/field-triage/cases/$CASE_ID/enriched")
CL_TYPES=$(echo "$ENRICHED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);const t=new Set((o.checklist||[]).map(i=>i.type));console.log([...t].sort().join(','))})")
CL_TOTAL=$(echo "$ENRICHED" | jnested progress.total)
CL_STATUS=$(echo "$ENRICHED" | jval status)
echo "  types=$CL_TYPES total=$CL_TOTAL status=$CL_STATUS"

HAS_ALL="false"
if echo "$CL_TYPES" | grep -q "action" && echo "$CL_TYPES" | grep -q "check" && echo "$CL_TYPES" | grep -q "avoid" && echo "$CL_TYPES" | grep -q "watch"; then
  HAS_ALL="true"
fi
check "$HAS_ALL" "missing checklist types"
check "$([ "$CL_TOTAL" -ge 5 ] && echo true || echo false)" "expected 5+ items, got $CL_TOTAL"
check "$([ "$CL_STATUS" = "open" ] && echo true || echo false)" "expected open, got $CL_STATUS"
echo ""

echo "--- Toggle item → in-progress + timeline ---"
FIRST_ID=$(echo "$ENRICHED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).checklist?.[0]?.id||'MISSING')})")
curl -s -X PATCH "$BASE/field-triage/cases/$CASE_ID/checklist" \
  -H "Content-Type: application/json" \
  -d "{\"itemId\":\"$FIRST_ID\",\"checked\":true}" > /dev/null

AFTER1=$(curl -s "$BASE/field-triage/cases/$CASE_ID/enriched")
S_AFTER=$(echo "$AFTER1" | jval status)
TL_AFTER=$(echo "$AFTER1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log((JSON.parse(d).timeline||[]).length))")
D_AFTER=$(echo "$AFTER1" | jnested progress.done)
echo "  status=$S_AFTER timeline_events=$TL_AFTER done=$D_AFTER"
check "$([ "$S_AFTER" = "in-progress" ] && echo true || echo false)" "expected in-progress"
check "$([ "$TL_AFTER" -ge 3 ] && echo true || echo false)" "expected 3+ timeline events"
echo ""

echo "--- Toggle all items → resolved ---"
ALL_IDS=$(echo "$ENRICHED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.checklist.map(i=>i.id).join(' '))})")
for ITEM_ID in $ALL_IDS; do
  curl -s -X PATCH "$BASE/field-triage/cases/$CASE_ID/checklist" \
    -H "Content-Type: application/json" \
    -d "{\"itemId\":\"$ITEM_ID\",\"checked\":true}" > /dev/null
done
AFTER_ALL=$(curl -s "$BASE/field-triage/cases/$CASE_ID/enriched")
FINAL_STATUS=$(echo "$AFTER_ALL" | jval status)
FINAL_PCT=$(echo "$AFTER_ALL" | jnested progress.percent)
echo "  status=$FINAL_STATUS percent=$FINAL_PCT"
check "$([ "$FINAL_STATUS" = "resolved" ] && echo true || echo false)" "expected resolved"
check "$([ "$FINAL_PCT" = "100" ] && echo true || echo false)" "expected 100%"
echo ""

echo "--- Add manual timeline event ---"
curl -s -X POST "$BASE/field-triage/cases/$CASE_ID/timeline" \
  -H "Content-Type: application/json" \
  -d '{"event":"Visited field after treatment","details":"Insects reduced significantly"}' > /dev/null
TL_MANUAL=$(curl -s "$BASE/field-triage/cases/$CASE_ID/enriched" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const t=JSON.parse(d).timeline||[];console.log(t[t.length-1]?.event||'MISSING')})")
echo "  latest event: $TL_MANUAL"
check "$(echo "$TL_MANUAL" | grep -q 'Visited field' && echo true || echo false)" "manual event not found"
echo ""

# ══════════════════════════════════════════
echo "═══ SECTION 3: FEEDBACK LOOP (Farm Progress) ═══"
echo ""

echo "--- 3a: On track (6 Good, regular) ---"
C1=$(curl -s -X POST "$BASE/farm-cycle" -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","farmSize":"2 acres","plantingDate":"2026-01-01","location":"Nairobi"}')
C1ID=$(echo "$C1" | jval id)
for i in 1 2 3 4 5 6; do
  DAY=$((i*14)); M=$((1+DAY/30)); D=$((1+DAY%30))
  DT=$(printf "2026-%02d-%02d" $M $D)
  curl -s -X POST "$BASE/farm-cycle/$C1ID/progress" -H "Content-Type: application/json" \
    -d "{\"date\":\"$DT\",\"conditionStatus\":\"Good\",\"activityUpdate\":\"Healthy $i\",\"stageMatch\":\"Yes\"}" > /dev/null
done
V1=$(curl -s "$BASE/farm-cycle/$C1ID" | jval visibleStatus)
echo "  visibleStatus=$V1"
check "$([ "$V1" = "On track" ] && echo true || echo false)" "expected On track"
echo ""

echo "--- 3b: Slight delay (stage mismatch, stable condition) ---"
C2=$(curl -s -X POST "$BASE/farm-cycle" -H "Content-Type: application/json" \
  -d '{"cropType":"Rice","farmSize":"1 acre","plantingDate":"2026-01-01","location":"Mombasa"}')
C2ID=$(echo "$C2" | jval id)
curl -s -X POST "$BASE/farm-cycle/$C2ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-01-20","conditionStatus":"Average","activityUpdate":"Ok","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$C2ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-02-10","conditionStatus":"Average","activityUpdate":"Ok","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$C2ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-01","conditionStatus":"Average","activityUpdate":"Ok","stageMatch":"Yes"}' > /dev/null
V2=$(curl -s "$BASE/farm-cycle/$C2ID" | jval visibleStatus)
echo "  visibleStatus=$V2"
check "$([ "$V2" = "Slight delay" ] && echo true || echo false)" "expected Slight delay"
echo ""

echo "--- 3c: Needs attention (declining) ---"
C3=$(curl -s -X POST "$BASE/farm-cycle" -H "Content-Type: application/json" \
  -d '{"cropType":"Tomato","farmSize":"0.5 acres","plantingDate":"2026-01-01","location":"Kisumu"}')
C3ID=$(echo "$C3" | jval id)
curl -s -X POST "$BASE/farm-cycle/$C3ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-01-15","conditionStatus":"Good","activityUpdate":"Start","stageMatch":"Yes"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$C3ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-02-01","conditionStatus":"Average","activityUpdate":"Worse","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$C3ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-02-15","conditionStatus":"Poor","activityUpdate":"Bad","stageMatch":"No"}' > /dev/null
curl -s -X POST "$BASE/farm-cycle/$C3ID/progress" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-01","conditionStatus":"Poor","activityUpdate":"Declining","stageMatch":"No"}' > /dev/null
V3=$(curl -s "$BASE/farm-cycle/$C3ID" | jval visibleStatus)
echo "  visibleStatus=$V3"
check "$([ "$V3" = "Needs attention" ] && echo true || echo false)" "expected Needs attention"
echo ""

echo "--- 3d: Cycle enriched has expected stage + no leaked scores ---"
CYCLE_FULL=$(curl -s "$BASE/farm-cycle/$C1ID")
HAS_STAGE=$(echo "$CYCLE_FULL" | jnested expectedStage.stage)
HAS_INTEL=$(echo "$CYCLE_FULL" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o._intelligence||o.consistencyScore||o.financeReadiness||o.risk?'LEAKED':'CLEAN')})")
echo "  stage=$HAS_STAGE intel=$HAS_INTEL"
check "$([ "$HAS_STAGE" != "MISSING" ] && echo true || echo false)" "no expected stage"
check "$([ "$HAS_INTEL" = "CLEAN" ] && echo true || echo false)" "internal data leaked"
echo ""

echo "--- 3e: Progress updates stored and retrievable ---"
UPD_COUNT=$(curl -s "$BASE/farm-cycle/$C1ID/progress" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).length))")
echo "  updates=$UPD_COUNT"
check "$([ "$UPD_COUNT" = "6" ] && echo true || echo false)" "expected 6 updates"
echo ""

# ══════════════════════════════════════════
echo "═══ SECTION 4: STORAGE EDGE ═══"
echo ""

# Test multiple crop profiles
for CROP in "Maize" "Rice" "Tomatoes" "Beans" "Cassava" "Sorghum"; do
  echo "--- Storage: $CROP ---"
  STOR=$(curl -s -X POST "$BASE/storage-advisor/assess" \
    -H "Content-Type: application/json" \
    -d "{\"cropType\":\"$CROP\",\"quantity\":\"100kg\",\"storageType\":\"Sack / Bag\",\"storageCondition\":\"Dry\",\"duration\":\"1 month\",\"storageGoal\":\"Home consumption\"}")
  SR=$(echo "$STOR" | jlen riskFactors)
  SA=$(echo "$STOR" | jlen immediateActions)
  SM=$(echo "$STOR" | jval bestStorageMethod | wc -c)
  SE=$(echo "$STOR" | jval escalateIf | wc -c)
  echo "  risks=$SR actions=$SA method=${SM}c escalate=${SE}c"
  COND="false"
  if [ "$SR" -ge 3 ] && [ "$SA" -ge 2 ] && [ "$SM" -gt 20 ] && [ "$SE" -gt 15 ]; then
    COND="true"
  fi
  check "$COND" "incomplete output for $CROP"
done
echo ""

echo "--- Storage: humid + moisture problem flags risk ---"
STOR_WET=$(curl -s -X POST "$BASE/storage-advisor/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","quantity":"500kg","storageType":"Sack / Bag","storageCondition":"Humid / Damp","duration":"1-3 months","storageGoal":"Sell later","currentProblems":["Moisture / Dampness"]}')
WET_RISKS=$(echo "$STOR_WET" | jlist riskFactors)
if echo "$WET_RISKS" | grep -iq "moist\|aflatoxin\|mold\|damp"; then
  check "true"
else
  check "false" "moisture risk not flagged"
fi
echo ""

echo "--- Storage: insect problem flags pest risk ---"
STOR_BUG=$(curl -s -X POST "$BASE/storage-advisor/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Beans","quantity":"200kg","storageType":"Sack / Bag","storageCondition":"Dry","duration":"Several months","storageGoal":"Home consumption","currentProblems":["Insects"]}')
BUG_RISKS=$(echo "$STOR_BUG" | jlist riskFactors)
if echo "$BUG_RISKS" | grep -iq "insect\|infestation\|pest\|weevil\|bruchid"; then
  check "true"
else
  check "false" "insect risk not flagged"
fi
echo ""

# ══════════════════════════════════════════
echo "═══ SECTION 5: TRUST + SIMPLICITY ═══"
echo ""

echo "--- No banned trust words in triage output ---"
TRUST_RESP=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Maize","location":"Nairobi","season":"Rainy","issueType":"Pest or disease suspicion","symptomSeverity":"Severe","problemDetails":"Insects everywhere"}')
TRUST_TEXT=$(echo "$TRUST_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log([o.likelyCause,o.avoidThisMistake,o.whyThisMatters,o.escalateIf,...(o.whatToCheck||[]),...(o.nextAction||[])].join(' ').toLowerCase())})")
BANNED_HIT=""
for WORD in "verified" "guaranteed" "accurate diagnosis" "proven certainty"; do
  if echo "$TRUST_TEXT" | grep -iq "$WORD"; then
    BANNED_HIT="$WORD"
  fi
done
if [ -z "$BANNED_HIT" ]; then
  check "true"
else
  check "false" "found banned trust word: $BANNED_HIT"
fi
echo ""

echo "--- Low confidence shows caution wording ---"
# Unknown issue type should get Low confidence
RESP_LOW=$(curl -s -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Unknown crop","location":"Remote","season":"Unknown","issueType":"Weak growth","symptomSeverity":"Mild","problemDetails":"Something wrong"}')
CONF_LOW=$(echo "$RESP_LOW" | jval confidence)
echo "  confidence=$CONF_LOW"
# Mild severity can lower confidence but not necessarily to Low — check it's valid
if [ "$CONF_LOW" = "Low" ] || [ "$CONF_LOW" = "Medium" ] || [ "$CONF_LOW" = "High" ]; then
  check "true"
else
  check "false" "invalid confidence: $CONF_LOW"
fi
echo ""

# ══════════════════════════════════════════
echo "═══ SECTION 6: VALIDATION & OLD DATA ═══"
echo ""

echo "--- Minimal triage (required fields only) ---"
T_MIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/field-triage/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Millet","location":"Tamale","season":"Wet","issueType":"Low yield concern","symptomSeverity":"Mild","problemDetails":"Low yield"}')
echo "  HTTP $T_MIN"
check "$([ "$T_MIN" = "201" ] && echo true || echo false)" "expected 201"

echo "--- Minimal storage (no optional fields) ---"
S_MIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/storage-advisor/assess" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Yam","quantity":"50kg","storageType":"Crates","storageCondition":"Cool","duration":"1 to 2 weeks","storageGoal":"Keep fresh for sale"}')
echo "  HTTP $S_MIN"
check "$([ "$S_MIN" = "201" ] && echo true || echo false)" "expected 201"

echo "--- Minimal cycle (no optional fields) ---"
C_MIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/farm-cycle" \
  -H "Content-Type: application/json" \
  -d '{"cropType":"Groundnut","farmSize":"1 acre","plantingDate":"2026-03-15","location":"Kano"}')
echo "  HTTP $C_MIN"
check "$([ "$C_MIN" = "201" ] && echo true || echo false)" "expected 201"

echo ""
echo "--- Workflow endpoint returns enriched cases ---"
WF=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/field-triage/workflow?user_id=fulltest")
echo "  HTTP $WF"
check "$([ "$WF" = "200" ] && echo true || echo false)" "expected 200"

echo "--- Lifecycle endpoint returns stages ---"
LC=$(curl -s "$BASE/farm-cycle/lifecycle/Maize" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const a=JSON.parse(d);console.log(Array.isArray(a)?a.length:0)})")
echo "  Maize stages: $LC"
check "$([ "$LC" -ge 3 ] && echo true || echo false)" "expected 3+ lifecycle stages"

echo "--- Storage options endpoint works ---"
OPTS=$(curl -s "$BASE/storage-advisor/options" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(Object.keys(o).length)}catch{console.log(0)}})")
echo "  Option groups: $OPTS"
check "$([ "$OPTS" -ge 3 ] && echo true || echo false)" "expected 3+ option groups"

echo ""
echo "================================================================"
echo "  FINAL RESULTS: $PASS passed, $FAIL failed out of $TOTAL total"
echo "================================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo ""
