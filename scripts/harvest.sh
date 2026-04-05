#!/bin/bash

export HARVEST_ACCESS_TOKEN="9626.pt.3nIKMokUmKfhiNJqeEXiOtvpsy787RvfLGpHZPVYbI4W3ptgbhB5JFeMVc_imjgwn3Obg3ZCe9srFUfYG0a0KQ"
export HARVEST_ACCOUNT_ID="155800"

case "$1" in
  "me")
    # Get current user details
    curl -s -H "Authorization: Bearer $HARVEST_ACCESS_TOKEN" https://api.harvestapp.com/v2/users/me
  ;;
  "clients")
    # List clients
    curl -s -H "Authorization: Bearer $HARVEST_ACCESS_TOKEN" https://api.harvestapp.com/v2/clients
  ;;
  # ... (other commands)
esac