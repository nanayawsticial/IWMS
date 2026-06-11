"""
cleanup_userdb.py — Run this ONCE in Thonny to remove unknown UIDs from the Pico.
After running, upload the result and delete this file from the Pico.
"""
import json

KEEP_UIDS = {
    "136-4-13-10",   # Pearl Sam
    "156-81-137-24", # Kelvin
    "211-58-49-248", # Samual
    "59-76-78-211",  # Shaibu
    "6-47-166-27",   # Michael Kwesi
}

DB_FILE = "user_db.json"

# Load existing database
try:
    with open(DB_FILE, "r") as f:
        user_db = json.load(f)
    print("Loaded {} entries from {}.".format(len(user_db), DB_FILE))
except Exception as e:
    print("Could not load {}: {}".format(DB_FILE, e))
    raise

# Show what will be removed
removed = []
cleaned = {}
for uid, name in user_db.items():
    if uid in KEEP_UIDS:
        cleaned[uid] = name
        print("  KEEP   {} → {}".format(uid, name))
    else:
        removed.append((uid, name))
        print("  REMOVE {} → {}".format(uid, name))

# Write cleaned database back
with open(DB_FILE, "w") as f:
    json.dump(cleaned, f)

print()
print("Done! Kept {} entries, removed {}.".format(len(cleaned), len(removed)))
print("Restart the Pico (or run main.py) to apply the change.")
