#!/bin/bash

################################################################################
# Parallel Electrician Card Generation - 12 Batch Strategy
#
# Splits 1,298 communes into 12 balanced batches for parallel processing
# Expected completion: ~45 minutes (vs 6.5 hours sequential)
################################################################################

SCRIPT_DIR="/home/proalloelectrici/hugosource/scripts"
LOG_DIR="/tmp/electrician-batches"

# Create log directory
mkdir -p "$LOG_DIR"

# Clean old files
rm -f "$LOG_DIR"/*.log "$LOG_DIR"/*.pid
rm -f "$SCRIPT_DIR"/../checkpoint-batch-*.json

echo "=========================================="
echo "Parallel Electrician Card Generation"
echo "=========================================="
echo "Start time: $(date)"
echo "Strategy: 12 parallel batches"
echo "Est. completion: 45 minutes"
echo ""

# Function to run a batch
run_batch() {
    local batch_num=$1
    local desc=$2
    shift 2
    local args="$@"

    local log_file="$LOG_DIR/batch-$batch_num.log"
    local checkpoint="checkpoint-batch-$batch_num.json"

    echo "Batch $batch_num: $desc"

    # Run from project root to pick up .env
    cd "/home/proalloelectrici/hugosource"
    node scripts/enhance-electrician-cards.cjs \
        $args \
        --checkpoint="$checkpoint" \
        --parallel \
        > "$log_file" 2>&1 &

    echo $! > "$LOG_DIR/batch-$batch_num.pid"
}

# Dept 77: 510 communes split into 4 batches (~128 each)
run_batch 1 "Dept 77 (Part 1/4: 0-127)" --dept=77 --offset=0 --limit=128
sleep 2

run_batch 2 "Dept 77 (Part 2/4: 128-255)" --dept=77 --offset=128 --limit=128
sleep 2

run_batch 3 "Dept 77 (Part 3/4: 256-383)" --dept=77 --offset=256 --limit=128
sleep 2

run_batch 4 "Dept 77 (Part 4/4: 384-509)" --dept=77 --offset=384 --limit=126
sleep 2

# Dept 78: 263 communes split into 2 batches (~132 each)
run_batch 5 "Dept 78 (Part 1/2: 0-131)" --dept=78 --offset=0 --limit=132
sleep 2

run_batch 6 "Dept 78 (Part 2/2: 132-262)" --dept=78 --offset=132 --limit=131
sleep 2

# Remaining departments (1 batch each)
run_batch 7 "Dept 91 (Essonne: 197 communes)" --dept=91
sleep 2

run_batch 8 "Dept 95 (Val-d'Oise: 184 communes)" --dept=95
sleep 2

run_batch 9 "Dept 94 (Val-de-Marne: 46 communes)" --dept=94
sleep 2

run_batch 10 "Dept 93 (Seine-Saint-Denis: 41 communes)" --dept=93
sleep 2

run_batch 11 "Dept 92 (Hauts-de-Seine: 36 communes)" --dept=92
sleep 2

run_batch 12 "Dept 75 (Paris: 21 communes)" --dept=75

echo ""
echo "=========================================="
echo "All 12 batches launched!"
echo "=========================================="
echo "Monitor: watch -n 5 '$SCRIPT_DIR/monitor-batches.sh'"
echo "Logs: ls -lh $LOG_DIR/"
echo "Follow: tail -f $LOG_DIR/batch-1.log"
echo ""
echo "This terminal will wait for all batches to complete..."
echo "You can close it and batches will continue in background."
echo ""

# Wait for all background jobs
wait

echo ""
echo "=========================================="
echo "All batches complete!"
echo "=========================================="
echo "End time: $(date)"
echo "Merging outputs..."
echo ""

# Run merge script
cd "$SCRIPT_DIR"
node merge-batch-outputs.cjs

echo ""
echo "✅ DONE! Check data/electrician_commune_context.json"
