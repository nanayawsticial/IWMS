"""
clear_samuel.py — Run this once in Thonny on the Pico to remove Samuel's old card from user_db.json.
"""
import json

DB_FILE = "user_db.json"
OLD_UID = "211-58-49-248"
NEW_UID = "136-4-16-23"

try:
    with open(DB_FILE, "r") as f:
        user_db = json.load(f)
    print("Before cleanup: {} entries".format(len(user_db)))

    # 1. Remove old UID
    if OLD_UID in user_db:
        name = user_db.pop(OLD_UID)
        print("Removed old UID {} ({})".format(OLD_UID, name))
    else:
        print("Old UID {} was not in user_db.json".format(OLD_UID))

    # 2. Remove any other keys containing Samuel's name if they are not the new card
    keys_to_delete = []
    for uid, name in user_db.items():
        if name in ("Samuel", "Samual") and uid != NEW_UID:
            keys_to_delete.append(uid)

    for uid in keys_to_delete:
        name = user_db.pop(uid)
        print("Removed conflicting entry for {} under UID {}".format(name, uid))

    # 3. Write back
    with open(DB_FILE, "w") as f:
        json.dump(user_db, f)
    print("After cleanup: {} entries. Changes saved successfully.".format(len(user_db)))

except Exception as e:
    print("Error processing database: {}".format(e))
