#!/usr/bin/env bash
# Local Image Converter - Linux & macOS Launcher

cd "$(dirname "$0")"

echo "========================================================"
echo "  Local Image Converter (100% Offline and Private)"
echo "========================================================"
echo ""
echo "Starting application..."
echo ""

if command -v python3 &>/dev/null; then
    python3 server.py
elif command -v python &>/dev/null; then
    python server.py
else
    echo "[!] Python 3 was not found in PATH."
    echo "[!] Opening index.html directly in your default browser..."
    if command -v xdg-open &>/dev/null; then
        xdg-open index.html
    elif command -v open &>/dev/null; then
        open index.html
    fi
fi
