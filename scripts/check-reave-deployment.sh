#!/bin/bash
# Reave Railway Deployment Monitor
# Checks if latest commit deployed successfully, then triggers validation

set -e

cd ~/Astro/reave-1

# Get latest commit on main
LATEST_COMMIT=$(git rev-parse HEAD)
LATEST_MSG=$(git log -1 --pretty=format:"%s")

# Get Railway deployment status
DEPLOY_STATUS=$(railway status --service Astro --json 2>/dev/null || echo '{"services":{"edges":[]}}')

# Extract the latest deployment commit from Railway
DEPLOYED_COMMIT=$(echo "$DEPLOY_STATUS" | jq -r '.services.edges[0].node.serviceInstances.edges[0].node.latestDeployment.meta.commitHash // ""')
DEPLOY_STATE=$(echo "$DEPLOY_STATUS" | jq -r '.services.edges[0].node.serviceInstances.edges[0].node.latestDeployment.status // ""')

# Compare
if [ "$LATEST_COMMIT" != "$DEPLOYED_COMMIT" ]; then
    echo "⚠️ Deployment mismatch detected!"
    echo "Local HEAD: $LATEST_COMMIT ($LATEST_MSG)"
    echo "Deployed: $DEPLOYED_COMMIT"
    echo "Status: $DEPLOY_STATE"
    
    if [ "$DEPLOY_STATE" = "FAILED" ]; then
        # Notify via OpenClaw event
        openclaw system event --text "Railway deployment FAILED for reave-1: $LATEST_MSG" --mode now
    elif [ "$DEPLOY_STATE" = "BUILDING" ] || [ "$DEPLOY_STATE" = "DEPLOYING" ]; then
        echo "Deployment in progress, will check next cycle"
    else
        # Not deployed yet, might be stuck
        COMMIT_AGE=$(git log -1 --format=%ct)
        NOW=$(date +%s)
        AGE_MINUTES=$(( (NOW - COMMIT_AGE) / 60 ))
        
        if [ "$AGE_MINUTES" -gt 10 ]; then
            openclaw system event --text "Railway auto-deploy may be stuck for reave-1. Commit $LATEST_COMMIT pushed ${AGE_MINUTES}min ago but not deployed." --mode now
        fi
    fi
else
    echo "✅ Latest commit deployed successfully"
    echo "Commit: $LATEST_COMMIT ($LATEST_MSG)"
    echo "Status: $DEPLOY_STATE"
    
    # Trigger browser validation via OpenClaw
    # This will be handled by the agent with browser access
    openclaw system event --text "VALIDATE_DEPLOYMENT:reave-1:$LATEST_COMMIT Check reave.app for console errors and verify deployment is working. Key pages: / and /schedule. If errors found, auto-fix and redeploy." --mode now
fi
