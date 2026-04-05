#!/bin/bash
# Helper: Push to git and schedule Railway deployment check

if [ -z "$1" ]; then
    echo "Usage: push-and-monitor.sh <repo-path> [remote] [branch]"
    exit 1
fi

REPO_PATH="$1"
REMOTE="${2:-origin}"
BRANCH="${3:-main}"

cd "$REPO_PATH" || exit 1

# Do the push
echo "Pushing to $REMOTE $BRANCH..."
git push "$REMOTE" "$BRANCH"

if [ $? -eq 0 ]; then
    COMMIT=$(git rev-parse HEAD)
    MSG=$(git log -1 --pretty=format:"%s")
    
    echo "✓ Pushed: $MSG"
    echo "Scheduling deployment check in 5 minutes..."
    
    # Schedule check using 'at' command
    echo "cd $REPO_PATH && ~/.openclaw/workspace/scripts/check-reave-deployment.sh" | at now + 5 minutes 2>/dev/null
    
    # Fallback if 'at' not available
    if [ $? -ne 0 ]; then
        (sleep 300 && ~/.openclaw/workspace/scripts/check-reave-deployment.sh) &
        disown
        echo "✓ Check scheduled (background job)"
    else
        echo "✓ Check scheduled via 'at' command"
    fi
else
    echo "✗ Push failed"
    exit 1
fi
