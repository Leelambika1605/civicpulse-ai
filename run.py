"""
Launch Script for CivicPulse AI - Public Infrastructure Triage System
Run with: python run.py
"""

import os
import sys
import webbrowser

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from seed_data import seed_database
from app import run_server

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("[CIVICPULSE AI] SMART INFRASTRUCTURE COMPLAINT ANALYSIS SYSTEM")
    print("Problem Statement #4: Smart Cities Track T1 (TechXcellence)")
    print("=" * 70)

    # 1. Initialize DB and Seed Data
    print("[1/2] Checking database and sample infrastructure complaints...")
    seed_database()

    # 2. Launch Server
    PORT = int(os.environ.get("PORT", 8000))
    print(f"[2/2] Launching Municipal Command Center on port {PORT}")
    print("=" * 70)
    print(f"Open in your browser: http://localhost:{PORT}")
    print("Press Ctrl+C in terminal to stop server.\n")

    # Only open browser on desktop environments (not in cloud headless containers)
    if not os.environ.get("RENDER") and not os.environ.get("PORT"):
        try:
            webbrowser.open(f"http://localhost:{PORT}")
        except Exception:
            pass

    run_server(PORT)

