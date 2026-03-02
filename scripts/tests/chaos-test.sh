#!/bin/bash
# ============================================================
# Chaos Testing Script for Mission Control
# ============================================================
# Tests system resilience under failure conditions.
# Run with: ./scripts/tests/chaos-test.sh
# ============================================================

set -e

BASE_URL="${MC_BASE_URL:-http://localhost:4000}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================================"
echo "Mission Control Chaos Testing"
echo "============================================================"
echo "Base URL: $BASE_URL"
echo "Started: $(date)"
echo "============================================================"
echo ""

# Test 1: Health check baseline
echo -e "${YELLOW}Test 1: Baseline Health Check${NC}"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
echo "Health: $HEALTH_RESPONSE"
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Baseline healthy${NC}"
else
    echo -e "${RED}❌ Baseline unhealthy${NC}"
    exit 1
fi
echo ""

# Test 2: Database connection resilience
echo -e "${YELLOW}Test 2: Database Connection Test${NC}"
DB_RESPONSE=$(curl -s "$BASE_URL/api/health/detailed")
echo "Detailed: $DB_RESPONSE" | head -c 200
echo ""
if echo "$DB_RESPONSE" | grep -q '"database"'; then
    echo -e "${GREEN}✅ Database connected${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
fi
echo ""

# Test 3: Concurrent requests
echo -e "${YELLOW}Test 3: Concurrent Request Test (50 requests)${NC}"
START=$(python3 -c "import time; print(int(time.time() * 1000))")

for i in {1..50}; do
    curl -s "$BASE_URL/api/health" > /dev/null &
done
wait

END=$(python3 -c "import time; print(int(time.time() * 1000))")
DURATION=$((END - START))
echo "50 concurrent requests completed in ${DURATION}ms"
if [ $DURATION -lt 5000 ]; then
    echo -e "${GREEN}✅ Concurrent requests handled (< 5s)${NC}"
else
    echo -e "${RED}❌ Concurrent requests slow (${DURATION}ms)${NC}"
fi
echo ""

# Test 4: Invalid request handling
echo -e "${YELLOW}Test 4: Invalid Request Handling${NC}"
INVALID_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/tasks" -H "Content-Type: application/json" -d '{}')
if [ "$INVALID_RESPONSE" = "400" ] || [ "$INVALID_RESPONSE" = "422" ]; then
    echo -e "${GREEN}✅ Invalid request rejected properly (${INVALID_RESPONSE})${NC}"
else
    echo -e "${RED}❌ Invalid request not handled (${INVALID_RESPONSE})${NC}"
fi
echo ""

# Test 5: Rate limiting (if implemented)
echo -e "${YELLOW}Test 5: Rate Limit Check${NC}"
RATE_LIMITED=0
for i in {1..100}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
    if [ "$RESPONSE" = "429" ]; then
        RATE_LIMITED=1
        break
    fi
done
if [ $RATE_LIMITED -eq 1 ]; then
    echo -e "${GREEN}✅ Rate limiting active${NC}"
else
    echo -e "${YELLOW}⚠️ No rate limiting detected (may not be implemented)${NC}"
fi
echo ""

# Test 6: Large payload handling
echo -e "${YELLOW}Test 6: Large Payload Handling${NC}"
LARGE_PAYLOAD=$(python3 -c "print('x' * 10000)")
LARGE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/tasks" -H "Content-Type: application/json" -d "{\"title\":\"$LARGE_PAYLOAD\"}")
if [ "$LARGE_RESPONSE" = "400" ] || [ "$LARGE_RESPONSE" = "413" ]; then
    echo -e "${GREEN}✅ Large payload rejected (${LARGE_RESPONSE})${NC}"
elif [ "$LARGE_RESPONSE" = "201" ] || [ "$LARGE_RESPONSE" = "200" ]; then
    echo -e "${YELLOW}⚠️ Large payload accepted (${LARGE_RESPONSE})${NC}"
else
    echo -e "${RED}❌ Unexpected response (${LARGE_RESPONSE})${NC}"
fi
echo ""

# Test 7: Error response format
echo -e "${YELLOW}Test 7: Error Response Format${NC}"
ERROR_RESPONSE=$(curl -s "$BASE_URL/api/tasks/nonexistent-id")
if echo "$ERROR_RESPONSE" | grep -q '"error"'; then
    echo -e "${GREEN}✅ Error response has proper format${NC}"
else
    echo -e "${YELLOW}⚠️ Error response may not follow standard format${NC}"
fi
echo ""

# Test 8: Health check after chaos
echo -e "${YELLOW}Test 8: Post-Chaos Health Check${NC}"
POST_HEALTH=$(curl -s "$BASE_URL/api/health")
if echo "$POST_HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ System still healthy after chaos${NC}"
else
    echo -e "${RED}❌ System degraded after chaos${NC}"
fi
echo ""

echo "============================================================"
echo "Chaos Testing Complete"
echo "============================================================"
