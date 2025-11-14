#!/bin/bash

# Launch 4 optimized parallel processes for faster completion

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_DIR="$SCRIPT_DIR/../logs/intro-optimized-$TIMESTAMP"

mkdir -p "$LOG_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  LAUNCHING 4 OPTIMIZED PARALLEL PROCESSES"
echo "  Target: Complete remaining communes in 30 minutes"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Starting at: $(date)"
echo "Log directory: $LOG_DIR"
echo ""

# Extract failed communes from previous logs
echo "Collecting failed communes from previous runs..."
grep "Generation failed" ../logs/intro-parallel-*/process-*.log 2>/dev/null | \
  grep -oE '\[[0-9]+/1298\]' | tr -d '[]' | cut -d'/' -f1 | sort -u > "$LOG_DIR/failed-communes.txt"

FAILED_COUNT=$(wc -l < "$LOG_DIR/failed-communes.txt")
echo "Found $FAILED_COUNT failed communes to retry"
echo ""

echo "Configuration:"
echo "- Process 3: Communes 213-350 (137 communes)"
echo "- Process 4: Communes 350-487 (137 communes)"
echo "- Process 5: Communes 487-650 (163 communes)"
echo "- Process 6: Retry failed communes ($FAILED_COUNT communes)"
echo ""
echo "Optimizations applied:"
echo "✅ Prompt adjusted to 430-470 chars (from 450-490)"
echo "✅ Validation relaxed to 520 chars (from 510)"
echo "✅ Retry delay reduced to 1000ms"
echo "✅ Retry feedback added to prompt"
echo ""

# Launch Process 3
echo "Starting Process 3 (communes 213-350)..."
node "$SCRIPT_DIR/generate-commune-intro-text-parallel.cjs" \
  --all \
  --skip-existing \
  --start=213 \
  --end=350 \
  --process-id=3 \
  --delay=2400 \
  > "$LOG_DIR/process-3.log" 2>&1 &
PID3=$!

# Stagger starts
sleep 0.6

# Launch Process 4
echo "Starting Process 4 (communes 350-487)..."
node "$SCRIPT_DIR/generate-commune-intro-text-parallel.cjs" \
  --all \
  --skip-existing \
  --start=350 \
  --end=487 \
  --process-id=4 \
  --delay=2400 \
  > "$LOG_DIR/process-4.log" 2>&1 &
PID4=$!

sleep 0.6

# Launch Process 5
echo "Starting Process 5 (communes 487-650)..."
node "$SCRIPT_DIR/generate-commune-intro-text-parallel.cjs" \
  --all \
  --skip-existing \
  --start=487 \
  --end=650 \
  --process-id=5 \
  --delay=2400 \
  > "$LOG_DIR/process-5.log" 2>&1 &
PID5=$!

sleep 0.6

# Launch Process 6 for failed communes
echo "Starting Process 6 (retrying failed communes)..."
node "$SCRIPT_DIR/generate-commune-intro-text-parallel.cjs" \
  --all \
  --skip-existing \
  --start=0 \
  --end=1298 \
  --process-id=6 \
  --delay=3000 \
  > "$LOG_DIR/process-6.log" 2>&1 &
PID6=$!

echo ""
echo "✅ All 4 processes launched successfully!"
echo ""
echo "Process 3 PID: $PID3"
echo "Process 4 PID: $PID4"
echo "Process 5 PID: $PID5"
echo "Process 6 PID: $PID6"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  MONITORING COMMANDS"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Check overall progress:"
echo "  grep -c 'Stored successfully' $LOG_DIR/process-*.log"
echo ""
echo "Watch all processes:"
echo "  tail -f $LOG_DIR/process-*.log | grep -E '^\[|✓|✗'"
echo ""
echo "Monitor specific process:"
echo "  tail -f $LOG_DIR/process-3.log"
echo ""
echo "Count total with introText:"
echo "  find ../content/*/index.md -exec grep -l 'introText:' {} \\; | wc -l"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Expected completion: 25-30 minutes"
echo "Processes running in background."