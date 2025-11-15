#!/bin/bash
################################################################################
# Parallel Tier D SEO Enhancement
# Processes ~1,700 remaining pages across 7 departments simultaneously
# Target: Complete in <60 minutes
################################################################################

set -e  # Exit on error

# Configuration
DEPTS=(77 78 91 92 93 94 95)
PIDS=()
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  TIER D PARALLEL ENHANCEMENT${NC}"
echo -e "${GREEN}  Processing ~1,700 pages across ${#DEPTS[@]} departments${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Started at: $(date)${NC}"
echo -e "${BLUE}Departments: ${DEPTS[@]}${NC}"
echo ""

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

# Clean up old checkpoint files
echo -e "${YELLOW}🧹 Cleaning old checkpoints...${NC}"
rm -f "$PROJECT_ROOT"/checkpoint-tier-d-dept-*.json

# Launch parallel processes
echo -e "${GREEN}🚀 Launching parallel processes...${NC}"
echo ""

for DEPT in "${DEPTS[@]}"; do
  LOG_FILE="$LOGS_DIR/tier-d-dept-$DEPT.log"
  CHECKPOINT_FILE="$PROJECT_ROOT/checkpoint-tier-d-dept-$DEPT.json"

  echo -e "${BLUE}📍 Starting Department $DEPT...${NC}"

  # Launch process in background
  cd "$PROJECT_ROOT"
  node scripts/enhance-seo-comprehensive.cjs \
    --tier=tier_d \
    --dept=$DEPT \
    --checkpoint="checkpoint-tier-d-dept-$DEPT.json" \
    > "$LOG_FILE" 2>&1 &

  PID=$!
  PIDS+=($PID)
  echo -e "   ${GREEN}✓${NC} Process launched (PID: $PID, Log: logs/tier-d-dept-$DEPT.log)"

  # Stagger starts to avoid API burst
  sleep 2
done

echo ""
echo -e "${GREEN}✅ All ${#DEPTS[@]} processes launched!${NC}"
echo -e "${BLUE}PIDs: ${PIDS[@]}${NC}"
echo ""
echo -e "${YELLOW}⏳ Monitoring progress (update every 30 seconds)...${NC}"
echo ""

# Monitor all processes
START_TIME=$(date +%s)
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  MINUTES=$((ELAPSED / 60))
  SECONDS=$((ELAPSED % 60))

  RUNNING=0
  COMPLETED=0

  for i in "${!PIDS[@]}"; do
    PID=${PIDS[$i]}
    DEPT=${DEPTS[$i]}

    if ps -p $PID > /dev/null 2>&1; then
      ((RUNNING++))
    else
      ((COMPLETED++))
    fi
  done

  if [ $RUNNING -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All processes completed!${NC}"
    break
  fi

  # Display status
  echo -e "${BLUE}[$(printf '%02d:%02d' $MINUTES $SECONDS)]${NC} Running: $RUNNING/${#DEPTS[@]} | Completed: $COMPLETED/${#DEPTS[@]}"

  # Show progress from each department
  for DEPT in "${DEPTS[@]}"; do
    LOG_FILE="$LOGS_DIR/tier-d-dept-$DEPT.log"
    if [ -f "$LOG_FILE" ]; then
      # Extract current progress
      CURRENT=$(tail -50 "$LOG_FILE" | grep -oP '\[\K\d+(?=/\d+\])' | tail -1)
      TOTAL=$(tail -50 "$LOG_FILE" | grep -oP '\[\d+/\K\d+(?=\])' | tail -1)
      if [ ! -z "$CURRENT" ] && [ ! -z "$TOTAL" ]; then
        PERCENT=$((CURRENT * 100 / TOTAL))
        echo -e "   Dept $DEPT: $CURRENT/$TOTAL (${PERCENT}%)"
      fi
    fi
  done

  echo ""
  sleep 30
done

# Calculate total elapsed time
END_TIME=$(date +%s)
TOTAL_ELAPSED=$((END_TIME - START_TIME))
TOTAL_MINUTES=$((TOTAL_ELAPSED / 60))
TOTAL_SECONDS=$((TOTAL_ELAPSED % 60))

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  COMPLETION SUMMARY${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Finished at: $(date)${NC}"
echo -e "${BLUE}Total time: ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s${NC}"
echo ""

# Aggregate results
echo -e "${YELLOW}📊 RESULTS BY DEPARTMENT:${NC}"
echo ""

TOTAL_PAGES=0
TOTAL_COST=0

for DEPT in "${DEPTS[@]}"; do
  LOG_FILE="$LOGS_DIR/tier-d-dept-$DEPT.log"

  if [ -f "$LOG_FILE" ]; then
    echo -e "${BLUE}Department $DEPT:${NC}"

    # Extract statistics
    PROCESSED=$(grep "Total processed:" "$LOG_FILE" | tail -1 | grep -oP '\d+' | head -1)
    SUCCESSFUL=$(grep "Successful:" "$LOG_FILE" | tail -1 | grep -oP '\d+')
    COST=$(grep "Total cost:" "$LOG_FILE" | tail -1 | grep -oP '\$\K[\d.]+')

    if [ ! -z "$PROCESSED" ]; then
      echo "  Processed: $PROCESSED"
      TOTAL_PAGES=$((TOTAL_PAGES + PROCESSED))
    fi

    if [ ! -z "$SUCCESSFUL" ]; then
      echo "  Successful: $SUCCESSFUL"
    fi

    if [ ! -z "$COST" ]; then
      echo "  Cost: \$$COST"
      TOTAL_COST=$(echo "$TOTAL_COST + $COST" | bc)
    fi

    echo ""
  else
    echo -e "${RED}  ❌ Log file not found${NC}"
    echo ""
  fi
done

echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}GRAND TOTAL:${NC}"
echo -e "  Total pages: $TOTAL_PAGES"
echo -e "  Total cost: \$$TOTAL_COST"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. hugo --gc --minify"
echo "  2. sudo rsync -avz --delete /home/proalloelectrici/hugosource/public/ /home/proalloelectrici/public_html/"
echo "  3. npm run post-deploy"
echo ""
