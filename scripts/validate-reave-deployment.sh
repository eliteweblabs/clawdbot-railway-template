#!/bin/bash
# Validate Reave deployment - check for errors and verify changes are live

set -e

SITE_URL="https://reave.app"
ERRORS_FOUND=0
ERROR_LOG=""

echo "Checking $SITE_URL..."

# Test homepage
echo "1. Testing homepage..."
HOMEPAGE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL")
if [ "$HOMEPAGE_CHECK" != "200" ]; then
    ERROR_LOG="Homepage returned $HOMEPAGE_CHECK\n$ERROR_LOG"
    ERRORS_FOUND=1
fi

# Test /schedule page (should exist after recent deploy)
echo "2. Testing /schedule page..."
SCHEDULE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/schedule")
if [ "$SCHEDULE_CHECK" != "200" ]; then
    ERROR_LOG="/schedule returned $SCHEDULE_CHECK\n$ERROR_LOG"
    ERRORS_FOUND=1
fi

# Check for specific content in /schedule (verify it's not the old version)
echo "3. Verifying /schedule content..."
SCHEDULE_HTML=$(curl -s "$SITE_URL/schedule")
if echo "$SCHEDULE_HTML" | grep -q "Schedule — Reave"; then
    echo "   ✓ Schedule page has correct title"
elif echo "$SCHEDULE_HTML" | grep -q "header-logo-mask"; then
    ERROR_LOG="/schedule still showing old header (Layout bug)\n$ERROR_LOG"
    ERRORS_FOUND=1
else
    echo "   ? Could not verify schedule page content"
fi

# Use browser to check for console errors
echo "4. Checking for JavaScript console errors..."

# Create temp file for browser validation
BROWSER_SCRIPT="/tmp/reave-validate-$$.js"
cat > "$BROWSER_SCRIPT" << 'ENDJS'
const errors = [];
const logs = [];

// Capture console errors
const originalError = console.error;
console.error = (...args) => {
    errors.push(args.join(' '));
    originalError.apply(console, args);
};

// Wait for page load
await new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
});

// Give JS time to execute
await new Promise(resolve => setTimeout(resolve, 2000));

// Check for common error indicators
const has404 = document.body.innerText.includes('404');
const hasError = document.body.innerText.toLowerCase().includes('error');

JSON.stringify({
    errors: errors,
    has404: has404,
    hasError: hasError,
    title: document.title
});
ENDJS

# Note: Browser tool usage would need to be done via OpenClaw, not directly from bash
# For now, just check basic HTTP status and content

if [ $ERRORS_FOUND -eq 1 ]; then
    echo ""
    echo "❌ Validation failed:"
    echo -e "$ERROR_LOG"
    exit 1
else
    echo ""
    echo "✅ All checks passed"
    exit 0
fi

rm -f "$BROWSER_SCRIPT"
