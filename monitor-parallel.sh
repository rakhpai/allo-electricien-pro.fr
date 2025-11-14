#!/bin/bash

# Monitor parallel generation progress

LOG_DIR="logs/intro-parallel-2025-11-12_18-15-04"

while true; do
    clear
    echo "════════════════════════════════════════════════════════════════════"
    echo "  PARALLEL GENERATION MONITOR - $(date +%H:%M:%S)"
    echo "════════════════════════════════════════════════════════════════════"
    echo ""

    # Process 1 status
    if ps -p $(pgrep -f "process-id=1" | head -1) > /dev/null 2>&1; then
        P1_CURRENT=$(grep -oE '\[[0-9]+/1298\]' "$LOG_DIR/process-1.log" | tail -1 | tr -d '[]' | cut -d'/' -f1)
        P1_SUCCESS=$(grep -c "Stored successfully" "$LOG_DIR/process-1.log")
        echo "Process 1: ✅ RUNNING"
        echo "  Current: Commune $P1_CURRENT / 650"
        echo "  Successfully stored: $P1_SUCCESS"
    else
        echo "Process 1: ✓ COMPLETED"
    fi

    echo ""

    # Process 2 status
    if ps -p $(pgrep -f "process-id=2" | head -1) > /dev/null 2>&1; then
        P2_CURRENT=$(grep -oE '\[[0-9]+/1298\]' "$LOG_DIR/process-2.log" | tail -1 | tr -d '[]' | cut -d'/' -f1)
        P2_SUCCESS=$(grep -c "Stored successfully" "$LOG_DIR/process-2.log")
        echo "Process 2: ✅ RUNNING"
        echo "  Current: Commune $P2_CURRENT / 1298"
        echo "  Successfully stored: $P2_SUCCESS"
    else
        echo "Process 2: ✓ COMPLETED"
    fi

    echo ""

    # Total progress
    TOTAL_SUCCESS=$(grep -c "Stored successfully" "$LOG_DIR"/process-*.log 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
    TOTAL_WITH_EXISTING=$(grep -r "introText:" content/*/index.md 2>/dev/null | wc -l)

    echo "════════════════════════════════════════════════════════════════════"
    echo "  OVERALL PROGRESS"
    echo "════════════════════════════════════════════════════════════════════"
    echo "  New generations this session: $TOTAL_SUCCESS"
    echo "  Total with introText in frontmatter: $TOTAL_WITH_EXISTING / 1298"
    echo "  Progress: $(echo "scale=1; $TOTAL_WITH_EXISTING*100/1298" | bc)%"
    echo ""
    echo "  Estimated completion: ~15-20 minutes"
    echo ""
    echo "Press Ctrl+C to exit monitor (processes will continue)"

    sleep 30
done