#!/bin/bash

################################################################################
# Monitor Parallel Batch Processing
# Shows real-time status of all 12 batches
################################################################################

LOG_DIR="/tmp/electrician-batches"
SCRIPT_DIR="/home/proalloelectrici/hugosource/scripts"

clear
echo "=========================================="
echo "Batch Processing Status"
echo "=========================================="
echo "Time: $(date '+%H:%M:%S')"
echo ""

# Header
printf "%-8s %-15s %-10s %s\n" "BATCH" "STATUS" "PROGRESS" "LAST COMMUNE"
printf "%-8s %-15s %-10s %s\n" "-----" "------" "--------" "------------"

total_running=0
total_complete=0

# Check each batch (1-12)
for batch in {1..12}; do
    pid_file="$LOG_DIR/batch-$batch.pid"
    log_file="$LOG_DIR/batch-$batch.log"
    checkpoint_file="$SCRIPT_DIR/../checkpoint-batch-$batch.json"

    if [ ! -f "$pid_file" ]; then
        printf "%-8s %-15s %-10s %s\n" "$batch" "NOT STARTED" "-" "-"
        continue
    fi

    pid=$(cat "$pid_file")

    # Check if process is running
    if ps -p $pid > /dev/null 2>&1; then
        status="RUNNING"
        ((total_running++))

        # Try to get progress from checkpoint
        if [ -f "$checkpoint_file" ]; then
            processed=$(grep -o '"successful":[^,]*' "$checkpoint_file" 2>/dev/null | head -1 | cut -d: -f2 || echo "0")
            total=$(grep -o '"total":[^,]*' "$checkpoint_file" 2>/dev/null | head -1 | cut -d: -f2 || echo "?")
            progress="$processed/$total"

            # Get last processed commune
            last_commune=$(grep -o '"lastProcessedCommune":"[^"]*"' "$checkpoint_file" 2>/dev/null | head -1 | cut -d'"' -f4 || echo "-")
        else
            progress="0/?"
            last_commune=$(tail -2 "$log_file" 2>/dev/null | head -1 | grep -o '([a-z-]*-[0-9]*)' | tr -d '()' || echo "starting...")
        fi
    else
        # Process finished
        if [ -f "$checkpoint_file" ]; then
            processed=$(grep -o '"successful":[^,]*' "$checkpoint_file" 2>/dev/null | head -1 | cut -d: -f2 || echo "0")
            total=$(grep -o '"total":[^,]*' "$checkpoint_file" 2>/dev/null | head -1 | cut -d: -f2 || echo "?")

            if [ "$processed" = "$total" ] && [ "$total" != "0" ]; then
                status="COMPLETE"
                progress="$processed/$total"
                last_commune="✓"
                ((total_complete++))
            else
                status="FAILED/STOPPED"
                progress="$processed/$total"
                last_commune="⚠"
            fi
        else
            status="FAILED"
            progress="-"
            last_commune="✗"
        fi
    fi

    printf "%-8s %-15s %-10s %s\n" "$batch" "$status" "$progress" "$last_commune"
done

echo ""
echo "=========================================="
printf "Summary: %d running, %d complete, %d total\n" "$total_running" "$total_complete" "12"
echo "=========================================="
echo ""

if [ $total_complete -eq 12 ]; then
    echo "🎉 All batches complete! Run merge script:"
    echo "   node scripts/merge-batch-outputs.cjs"
elif [ $total_running -gt 0 ]; then
    echo "💡 Batches still running. Refresh: watch -n 5 '$0'"
else
    echo "⚠️  No batches running. Check logs in $LOG_DIR/"
fi
echo ""
