#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
VV_SOURCE="$PROJECT_ROOT/code/src/bin/vv"
VV_TARGET="/usr/local/bin/vv"

echo "Installing VersionVault..."
echo "Project: $PROJECT_ROOT"

if [ ! -f "$VV_SOURCE" ]; then
    echo "Error: VersionVault launcher not found:"
    echo "$VV_SOURCE"
    exit 1
fi

chmod +x "$VV_SOURCE"

echo "Creating VersionVault command..."

sudo ln -sf "$VV_SOURCE" "$VV_TARGET"

echo ""
echo "VersionVault installed successfully!"
echo ""
echo "Run:"
echo "    vv"
echo ""

vv