#!/bin/bash

# Launch 3 parallel processes to complete remaining communes

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_DIR="logs/final-completion-$TIMESTAMP"
mkdir -p "$LOG_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  FINAL COMPLETION - 28 Remaining Communes"
echo "  Flexible Validation Enabled"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Starting at: $(date)"
echo "Log directory: $LOG_DIR"
echo ""
echo "Configuration:"
echo "- Batch 1: 10 communes (andresy to jouy-en-josas)"
echo "- Batch 2: 10 communes (la-verriere to montfort-l'amaury)"
echo "- Batch 3: 8 communes (orsonville to ville-d'avray)"
echo ""
echo "Features:"
echo "✅ Flexible validation (380-550 chars for problem communes)"
echo "✅ Up to 5 retries per commune"
echo "✅ Adaptive temperature on retries"
echo "✅ Progressive length targeting"
echo ""

# Launch Batch 1
echo "Starting Batch 1..."
node scripts/generate-remaining-communes.cjs batch1.txt 7 > "$LOG_DIR/batch1.log" 2>&1 &
PID1=$!

# Stagger starts
sleep 0.8

# Launch Batch 2
echo "Starting Batch 2..."
node scripts/generate-remaining-communes.cjs batch2.txt 8 > "$LOG_DIR/batch2.log" 2>&1 &
PID2=$!

sleep 0.8

# Launch Batch 3
echo "Starting Batch 3..."
node scripts/generate-remaining-communes.cjs batch3.txt 9 > "$LOG_DIR/batch3.log" 2>&1 &
PID3=$!

echo ""
echo "✅ All 3 processes launched!"
echo ""
echo "Process PIDs:"
echo "  Batch 1: $PID1"
echo "  Batch 2: $PID2"
echo "  Batch 3: $PID3"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  MONITORING"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Watch progress:"
echo "  tail -f $LOG_DIR/*.log | grep -E 'Processing:|Generated:|Stored'"
echo ""
echo "Check completion:"
echo "  grep -c 'Stored successfully' $LOG_DIR/*.log"
echo ""
echo "Expected completion: 3-5 minutes"
echo ""

# Wait for all to complete
wait $PID1
EXIT1=$?
wait $PID2
EXIT2=$?
wait $PID3
EXIT3=$?

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  COMPLETION SUMMARY"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Finished at: $(date)"
echo "Exit codes: Batch1=$EXIT1, Batch2=$EXIT2, Batch3=$EXIT3"
echo ""

# Count results
SUCCESS=$(grep -c "Stored successfully" "$LOG_DIR"/*.log 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
FAILED=$(grep -c "Generation failed" "$LOG_DIR"/*.log 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')

echo "Successfully generated: $SUCCESS"
echo "Failed: $FAILED"
echo ""

# Final check
TOTAL_WITH_INTRO=$(find content/*/index.md -exec grep -l "introText:" {} \; 2>/dev/null | wc -l)
echo "Total communes with introText: $TOTAL_WITH_INTRO / 1298"
PERCENT=$(echo "scale=1; $TOTAL_WITH_INTRO*100/1298" | bc)
echo "Final completion: $PERCENT%"

if [ "$PERCENT" = "100.0" ]; then
    echo ""
    echo "✅ SUCCESS! All 1,298 communes now have contextual intro text!"
else
    echo ""
    echo "⚠️ Some communes still missing intro text. Check logs for details."
fi