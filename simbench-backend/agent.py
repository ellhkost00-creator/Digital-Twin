"""
Edge-device agent (mock) — simulates a Raspberry Pi sending telemetry.

Install deps:
    pip install requests

Run:
    python agent.py --id pi-01 --name "Substation Pi #1" --backend http://localhost:8000
"""

import argparse
import math
import random
import time
import sys

import requests


INTERVAL = 5
MAX_BACKOFF = 60

_tick = 0


def collect_readings() -> dict:
    global _tick
    _tick += 1
    t = _tick * INTERVAL

    return {
        "voltage_v":   round(230 + 5 * math.sin(t / 30) + random.uniform(-0.5, 0.5), 2),
        "current_a":   round(10  + 3 * math.sin(t / 20) + random.uniform(-0.2, 0.2), 2),
        "power_kw":    round(2.3 + 0.8 * math.sin(t / 25) + random.uniform(-0.05, 0.05), 2),
        "temperature_c": round(45 + 5 * math.sin(t / 60) + random.uniform(-1, 1), 1),
        "cpu_percent": round(random.uniform(20, 80), 1),
    }


def register(session: requests.Session, backend: str, device_id: str, name: str) -> None:
    backoff = 1
    while True:
        try:
            r = session.post(
                f"{backend}/devices/register",
                json={"id": device_id, "name": name},
                timeout=10,
            )
            r.raise_for_status()
            print(f"[agent] Registered as '{name}' ({device_id})")
            return
        except Exception as exc:
            print(f"[agent] Registration failed ({exc}), retrying in {backoff}s…")
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)


def run_loop(session: requests.Session, backend: str, device_id: str) -> None:
    backoff = 1
    while True:
        try:
            readings = collect_readings()
            r = session.post(
                f"{backend}/devices/telemetry",
                json={"device_id": device_id, "readings": readings},
                timeout=10,
            )
            r.raise_for_status()
            backoff = 1
            print(f"[agent] {readings}")
        except Exception as exc:
            print(f"[agent] Error ({exc}), retrying in {backoff}s…")
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)
            continue

        time.sleep(INTERVAL)


def main() -> None:
    parser = argparse.ArgumentParser(description="DT Lab mock edge-device agent")
    parser.add_argument("--id",      required=True, help="Device ID, e.g. pi-01")
    parser.add_argument("--name",    required=True, help="Display name")
    parser.add_argument("--backend", required=True, help="Backend URL, e.g. http://localhost:8000")
    args = parser.parse_args()

    backend = args.backend.rstrip("/")
    session = requests.Session()

    print(f"[agent] Starting mock agent — backend: {backend}  id: {args.id}")
    register(session, backend, args.id, args.name)
    run_loop(session, backend, args.id)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[agent] Stopped.")
        sys.exit(0)
