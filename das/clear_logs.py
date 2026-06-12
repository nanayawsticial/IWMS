"""
clear_logs.py — Run this ONCE in Thonny to wipe the local attendance logs and offline queue on the Pico.
After running, delete this file from the Pico.
"""
import json

LOG_FILE = "attendance_logs.json"
QUEUE_FILE = "offline_queue.json"

# Wipe LOG_FILE
try:
    with open(LOG_FILE, "w") as f:
        json.dump({}, f)
    print("✓ Local attendance logs file wiped.")
except Exception as e:
    print("Could not wipe logs file: {}".format(e))

# Wipe QUEUE_FILE
try:
    with open(QUEUE_FILE, "w") as f:
        json.dump([], f)
    print("✓ Offline retry queue file wiped.")
except Exception as e:
    print("Could not wipe queue file: {}".format(e))

print("\nRestart the Pico (or run main.py) to start with a fresh state.")
