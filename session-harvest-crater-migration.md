# Session Continuation

Session: harvest-crater-migration
Created: 2026-04-05

## What's Ready to Go

### Harvest API (Connected)
- Token: 9626.pt.3nIKMokUmKfhiNJqeEXiOtvpsy787RvfLGpHZPVYbI4W3ptgbhB5JFeMVc_imjgwn3Obg3ZCe9srFUfYG0a0KQ
- Account ID: 155800
- Data backed up in /data/workspace/harvest-backup/

### To Do
1. Clean GitHub secrets: `git filter-repo --path .secrets --path .tokens --path .crater-api-token --path .crater-api-token-capco --invert-paths --force && git push -f origin main`
2. Create Crater backup before import
3. Import Harvest data to Crater
