"""
config.py — Edit this file to match your setup, then upload it to the Pico.
All other files import from here; you should not need to change them.
"""
# ── DS1302 RTC Pins ───────────────────────────────────────────────────────────
DS1302_CLK = 20    # Change to whichever GPIO pins you used
DS1302_DAT = 21
DS1302_RST  = 22
# ── WiFi ──────────────────────────────────────────────────────────────────────
WIFI_SSID     = "StarOfAfrica_2.4GHz"
WIFI_PASSWORD = "Z8Ie64kcy2qm_TM"
WIFI_TIMEOUT  = 15         # seconds to wait for initial connection

# ── IWMS Server ───────────────────────────────────────────────────────────────
# ⚠  Use your computer's LAN IP address, NOT "localhost" or "127.0.0.1".
#    The Pico is on a different device, so "localhost" means the Pico itself.
#
#    To find your computer's LAN IP:
#      Windows:  run  ipconfig  → look for IPv4 Address
#      macOS:    run  ipconfig getifaddr en0
#      Linux:    run  hostname -I
#
#    Also ensure your IWMS dev server is bound to 0.0.0.0, not just localhost:
#      Next.js:  next dev -H 0.0.0.0
#      Node:     node server.js --host 0.0.0.0

SERVER_URL     = "http://192.168.2.50:3001"
PUNCH_ENDPOINT = "/api/attendance/hardware-punch"
# The endpoint the Pico POSTs punch events to.
# Adjust this to match the actual API route in your IWMS codebase.
# Expected payload shape (JSON):
#   {
#     "device_id":  "pico-gate-01",
#     "uid":        "136-4-13-10",
#     "name":       "Godfred Sam",
#     "event_type": "clock_in",       // or "clock_out"
#     "timestamp":  "2026-06-08T09:15:30",
#     "flags":      [],               // e.g. ["LATE"]
#     "terminal_event_id": "pico-gate-01-13641310-clock_in-20260608091530",
#     "firmware":   "pico2w-rfid-0.2.0"
#   }

# Must match the device you register in IWMS Settings → Biometric Hardware
DEVICE_ID        = "pico-gate-01"
DEVICE_NAME      = "Main Gate"
FIRMWARE_VERSION = "pico2w-rfid-0.2.0"

# Hardware API key provisioned from IWMS Settings → Biometric Hardware → Provision.
# Leave as None if no key has been provisioned yet (local dev / first boot).
# Once provisioned in the UI, paste the full key here and re-upload config.py to the Pico.
DEVICE_KEY = "iwms_live_a27ae337be5a631dadcead95c3d5a33e66873807df494923"  # e.g. "iwms_live_abc123..."

# ── Attendance Rules ──────────────────────────────────────────────────────────
LATE_HOUR         = 9     # Clock-ins strictly after 09:00 are flagged LATE
EARLY_LEAVE_HOUR  = 16    # Clock-outs strictly before 16:00 are flagged EARLY LEAVE

# ── Local Storage ─────────────────────────────────────────────────────────────
DB_FILE       = "user_db.json"
LOG_FILE      = "attendance_logs.json"
QUEUE_FILE    = "offline_queue.json"   # Events buffered while WiFi is offline
MAX_LOG_DAYS  = 30
MAX_QUEUE_SIZE = 500                   # Maximum number of offline events to queue to prevent flash exhaustion

# ── Retry Timing (milliseconds) ───────────────────────────────────────────────
WIFI_RETRY_MS    = 30_000   # How often to attempt WiFi reconnect when offline
SYNC_RETRY_MS    = 60_000   # How often to flush the offline queue
CLEANUP_INTERVAL = 3_600_000  # Run log cleanup once per hour (not every loop tick)
