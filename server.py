#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local Image Converter - Standalone Python Launcher Server
Runs purely on standard library (no pip packages needed).
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import threading
import time

# Ensure safe utf-8 output and line buffering on Windows consoles
if sys.platform.startswith('win'):
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    except Exception:
        pass

PORT_DEFAULT = 8000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.wasm': 'application/wasm',
        '.json': 'application/json; charset=utf-8',
        '.jfif': 'image/jpeg',
        '.heic': 'image/heic',
        '.heif': 'image/heif',
        '.avif': 'image/avif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon'
    })

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), format % args))


def find_free_port(start_port=PORT_DEFAULT):
    import socket
    port = start_port
    while port < start_port + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
        port += 1
    return start_port


def main():
    # Ensure current working directory is the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    port = find_free_port(PORT_DEFAULT)
    url = f"http://localhost:{port}/"

    handler = CustomHTTPRequestHandler
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print("=" * 60)
        print("  LOCAL IMAGE CONVERTER RUNNING")
        print("  100% Offline & Private")
        print(f"  Address: {url}")
        print("  Press Ctrl + C to stop the server")
        print("=" * 60)

        # Open web browser after a brief delay
        def open_browser():
            time.sleep(0.6)
            webbrowser.open(url)

        threading.Thread(target=open_browser, daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)


if __name__ == '__main__':
    main()
