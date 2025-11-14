#!/bin/bash
while true; do
    clear
    echo "════════════════════════════════════════════════════════════════════"
    echo "  COMMUNE INTRO GENERATION MONITOR"
    echo "════════════════════════════════════════════════════════════════════"
    echo ""
    
    # Get counts
    TOTAL=1298
    PROCESSED=$(grep -c "^\[" commune-intro-generation-full.log 2>/dev/null || echo "0")
    SUCCESS=$(grep -c "Stored successfully" commune-intro-generation-full.log 2>/dev/null || echo "0")
    FAILED=$(grep -c "Generation failed" commune-intro-generation-full.log 2>/dev/null || echo "0")
    
    # Calculate progress
    PERCENT=$((PROCESSED * 100 / TOTAL))
    
    echo "Progress: $PROCESSED / $TOTAL ($PERCENT%)"
    echo "Success: $SUCCESS"
    echo "Failed: $FAILED"
    echo ""
    echo "Latest entries:"
    tail -10 commune-intro-generation-full.log | grep "^\["
    echo ""
    echo "Time: $(date +%H:%M:%S)"
    echo "Press Ctrl+C to exit monitor"
    
    sleep 30
done
