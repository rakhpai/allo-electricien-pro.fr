#!/bin/bash

# Parallel Commune Intro Text Generation
# Runs 2 processes to complete generation in ~15 minutes

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_DIR="$SCRIPT_DIR/../logs/intro-parallel-$TIMESTAMP"

mkdir -p "$LOG_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  PARALLEL INTRO TEXT GENERATION"
echo "  Target: Complete remaining communes in ~15 minutes"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Starting at: $(date)"
echo "Log directory: $LOG_DIR"
echo ""

# Check how many have been generated already
EXISTING_COUNT=$(grep -r "introText:" ../content/*/index.md 2>/dev/null | wc -l)
echo "Already generated: ~$EXISTING_COUNT communes"
echo ""

# Configuration for 2 processes
TOTAL_COMMUNES=1298
MID_POINT=650

echo "Configuration:"
echo "- Total communes: $TOTAL_COMMUNES"
echo "- Split point: $MID_POINT"
echo "- Process 1: 0-$MID_POINT (will skip existing)"
echo "- Process 2: $MID_POINT-$TOTAL_COMMUNES"
echo "- Delay per process: 2400ms (2.4 seconds)"
echo "- Combined rate: ~50 requests/minute (API limit)"
echo ""

# Kill any existing generation processes
echo "Checking for existing processes..."
if pgrep -f "generate-commune-intro" > /dev/null; then
    echo "Stopping existing generation processes..."
    pkill -f "generate-commune-intro"
    sleep 2
fi

# Start Process 1 in background
echo "Starting Process 1 (communes 0-$MID_POINT)..."
node "$SCRIPT_DIR/generate-commune-intro-text-parallel.cjs" \
  --all \
  --skip-existing \
  --start=0 \
  --end=$MID_POINT \
  --process-id=1 \
  --delay=2400 \
  > "$LOG_DIR/process-1.log" 2>&1 &
PID1=$!

# Stagger start to avoid simultaneous API calls
sleep 1.2

# Start Process 2 in background
echo "Starting Process 2 (communes $MID_POINT-$TOTAL_COMMUNES)..."
node "$SCRIPT_DIR/generate-commune-intro-text-parallel.cjs" \
  --all \
  --skip-existing \
  --start=$MID_POINT \
  --process-id=2 \
  --delay=2400 \
  > "$LOG_DIR/process-2.log" 2>&1 &
PID2=$!

echo ""
echo "✅ Both processes started successfully!"
echo ""
echo "Process 1 PID: $PID1"
echo "Process 2 PID: $PID2"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  MONITORING COMMANDS"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Watch both logs:"
echo "  tail -f $LOG_DIR/process-*.log"
echo ""
echo "Monitor process 1:"
echo "  tail -f $LOG_DIR/process-1.log | grep -E '^\[|✓|✗'"
echo ""
echo "Monitor process 2:"
echo "  tail -f $LOG_DIR/process-2.log | grep -E '^\[|✓|✗'"
echo ""
echo "Check progress count:"
echo "  grep -c 'Stored successfully' $LOG_DIR/process-*.log"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Function to monitor progress
monitor_progress() {
    while kill -0 $PID1 2>/dev/null || kill -0 $PID2 2>/dev/null; do
        clear
        echo "════════════════════════════════════════════════════════════════════"
        echo "  PROGRESS UPDATE - $(date +%H:%M:%S)"
        echo "════════════════════════════════════════════════════════════════════"
        echo ""

        if kill -0 $PID1 2>/dev/null; then
            P1_PROGRESS=$(tail -1 "$LOG_DIR/process-1.log" 2>/dev/null | grep -oE '\[[0-9]+/' | tr -d '[/')
            echo "Process 1: Running (PID $PID1)"
            echo "  Current: Commune $P1_PROGRESS / $MID_POINT"
        else
            echo "Process 1: Completed ✓"
        fi

        echo ""

        if kill -0 $PID2 2>/dev/null; then
            P2_PROGRESS=$(tail -1 "$LOG_DIR/process-2.log" 2>/dev/null | grep -oE '\[[0-9]+/' | tr -d '[/')
            echo "Process 2: Running (PID $PID2)"
            echo "  Current: Commune $P2_PROGRESS / $TOTAL_COMMUNES"
        else
            echo "Process 2: Completed ✓"
        fi

        echo ""
        TOTAL_SUCCESS=$(grep -c "Stored successfully" "$LOG_DIR"/process-*.log 2>/dev/null || echo "0")
        echo "Total successfully generated: $TOTAL_SUCCESS"
        echo ""
        echo "Press Ctrl+C to stop monitoring (processes will continue)"

        sleep 30
    done
}

# Ask if user wants to monitor
echo "Do you want to monitor progress? (y/n)"
read -t 5 -n 1 MONITOR_CHOICE
echo ""

if [[ "$MONITOR_CHOICE" == "y" ]]; then
    echo "Starting monitor (updates every 30 seconds)..."
    sleep 2
    monitor_progress
else
    echo "Processes running in background."
    echo "To monitor later, check: $LOG_DIR"
    echo ""
    echo "Waiting for completion..."

    # Wait for both processes
    wait $PID1
    EXIT1=$?
    wait $PID2
    EXIT2=$?

    echo ""
    echo "════════════════════════════════════════════════════════════════════"
    echo "  COMPLETION SUMMARY"
    echo "════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Finished at: $(date)"
    echo "Process 1 exit code: $EXIT1"
    echo "Process 2 exit code: $EXIT2"
    echo ""

    # Count results
    TOTAL_SUCCESS=$(grep -c "Stored successfully" "$LOG_DIR"/process-*.log 2>/dev/null || echo "0")
    TOTAL_FAILED=$(grep -c "Generation failed" "$LOG_DIR"/process-*.log 2>/dev/null || echo "0")

    echo "Total successfully generated: $TOTAL_SUCCESS"
    echo "Total failed: $TOTAL_FAILED"
    echo ""

    if [ $EXIT1 -eq 0 ] && [ $EXIT2 -eq 0 ]; then
        echo "✅ SUCCESS: Both processes completed successfully!"
        echo ""
        echo "Results saved to:"
        ls -lh commune-intro-text-*-p1.json commune-intro-text-*-p2.json 2>/dev/null
    else
        echo "⚠️ WARNING: One or more processes had issues"
        echo "Check logs in: $LOG_DIR"
    fi
fi

echo ""
echo "Generation complete. Check results in current directory."