"""
clear_queue.py — Run this ONCE in Thonny to wipe the offline retry queue.
The queue has old events from unknown UIDs that keep failing with 404.
After running, delete this file from the Pico.
"""
import json

QUEUE_FILE = "offline_queue.json"

try:
    with open(QUEUE_FILE, "r") as f:
        queue = json.load(f)
    print("Found {} queued events:".format(len(queue)))
    for i, ev in enumerate(queue):
        print("  [{}] uid={} event_type={} ts={}".format(
            i, ev.get("uid","?"), ev.get("event_type","?"), ev.get("timestamp","?")))
except Exception as e:
    print("Could not read queue (may already be empty): {}".format(e))
    queue = []

# Wipe it
with open(QUEUE_FILE, "w") as f:
    json.dump([], f)

print()
print("✓ Offline queue cleared ({} events removed).".format(len(queue)))
print("The 404 retry loop will stop on next reboot.")
