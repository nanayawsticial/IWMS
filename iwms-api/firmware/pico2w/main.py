try:
    import network
    import ujson as json
    import urequests as requests
    import utime as time
    import uos as os
except ImportError:
    network = None
    json = None
    requests = None
    time = None
    os = None

import ubinascii

# Load configurations dynamically from a local file config.json.
# This prevents credentials from being hardcoded in code.
def load_config():
    try:
        with open("config.json", "r") as f:
            return json.load(f)
    except Exception:
        return {}

# Simple XOR crypt for basic obfuscation on device flash drive
def xor_crypt(data, key):
    data_bytes = data if isinstance(data, (bytes, bytearray)) else data.encode('utf-8')
    key_bytes = key if isinstance(key, (bytes, bytearray)) else key.encode('utf-8')
    out = bytearray(len(data_bytes))
    for i in range(len(data_bytes)):
        out[i] = data_bytes[i] ^ key_bytes[i % len(key_bytes)]
    return out

def deobfuscate(cipher_text, key):
    if not cipher_text:
        return None
    try:
        encrypted = ubinascii.a2b_base64(cipher_text.encode('utf-8'))
        decrypted = xor_crypt(encrypted, key)
        return decrypted.decode('utf-8')
    except Exception:
        return None

CONFIG = load_config()

WIFI_SSID = CONFIG.get("WIFI_SSID", "YOUR_WIFI_NAME")
WIFI_PASSWORD = CONFIG.get("WIFI_PASSWORD", "YOUR_WIFI_PASSWORD")
API_BASE = CONFIG.get("API_BASE", "https://api.company.com")
DEVICE_SERIAL = CONFIG.get("DEVICE_SERIAL", "pico-gate-01")
DEFAULT_EVENT_TYPE = "clock_in"
FIRMWARE_VERSION = "pico2w-rfid-0.3.0"
QUEUE_FILE = "offline_queue.json"

# Local debounce: ignore the same card swiped twice within DEBOUNCE_SECONDS
DEBOUNCE_SECONDS = 10

# Obfuscated key stored in config.json is decrypted dynamically at runtime
DEVICE_KEY = deobfuscate(CONFIG.get("DEVICE_KEY_OBFUSCATED", ""), DEVICE_SERIAL)

# In-memory debounce table: maps "uid:event_type" → unix timestamp of last accepted scan
_debounce_table = {}


def connect_wifi(timeout_seconds=20):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        start = time.time()
        while not wlan.isconnected():
            if time.time() - start > timeout_seconds:
                raise RuntimeError("WiFi connection timed out")
            time.sleep(0.5)

    return wlan


def api_post(path, payload):
    headers = {"Content-Type": "application/json"}
    # Include hardware API key if one has been provisioned
    if DEVICE_KEY:
        headers["X-Device-Key"] = DEVICE_KEY
    response = requests.post(
        API_BASE + path,
        headers=headers,
        data=json.dumps(payload),
    )
    try:
        status_code = getattr(response, "status_code", 200)
        try:
            body = response.json()
        except Exception:
            body = {}
    finally:
        response.close()
    if not (200 <= status_code < 300):
        err = RuntimeError("HTTP {}".format(status_code))
        err.status_code = status_code
        err.response_body = body
        raise err
    return body


def iso_timestamp():
    year, month, day, hour, minute, second, _, _ = time.gmtime()
    return "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}Z".format(
        year, month, day, hour, minute, second
    )


def terminal_event_id(uid, event_type, timestamp):
    safe_uid = str(uid).replace("-", "")
    safe_time = str(timestamp).replace("-", "").replace(":", "").replace("T", "")
    return "{}-{}-{}-{}".format(DEVICE_SERIAL, safe_uid, event_type, safe_time)


def build_punch_payload(uid, event_type=DEFAULT_EVENT_TYPE, flags=None, name=""):
    timestamp = iso_timestamp()
    return {
        "device_id": DEVICE_SERIAL,
        "uid": uid,
        "name": name,
        "event_type": event_type,
        "timestamp": timestamp,
        "flags": flags or [],
        "terminal_event_id": terminal_event_id(uid, event_type, timestamp),
        "firmware": FIRMWARE_VERSION,
    }


def is_debounced(uid, event_type):
    """Return True if this uid+event_type was seen within DEBOUNCE_SECONDS."""
    key = "{}:{}".format(uid, event_type)
    last_seen = _debounce_table.get(key)
    if last_seen is None:
        return False
    return (time.time() - last_seen) < DEBOUNCE_SECONDS


def record_debounce(uid, event_type):
    """Record the current time as the last seen time for this uid+event_type."""
    key = "{}:{}".format(uid, event_type)
    _debounce_table[key] = time.time()


def send_rfid_punch(uid, event_type=DEFAULT_EVENT_TYPE, flags=None, name=""):
    """
    Process a single RFID tap:
      1. Apply 10-second local hardware debounce (ignore rapid double-taps).
      2. Attempt to send to /api/attendance/hardware-punch immediately.
      3. On network failure, enqueue for the next batch flush.
      4. Then flush any previously queued events via batch endpoint.
    """
    # 1. Local debounce — silently ignore taps within DEBOUNCE_SECONDS of the same card
    if is_debounced(uid, event_type):
        print("Debounced tap ignored for UID {} ({})".format(uid, event_type))
        return {"success": False, "debounced": True}

    record_debounce(uid, event_type)

    payload = build_punch_payload(uid, event_type, flags, name)

    try:
        result = api_post("/api/attendance/hardware-punch", payload)
        # Wi-Fi is up — also flush any offline queue while we have connectivity
        flush_queue()
        return result
    except Exception as error:
        status_code = getattr(error, "status_code", None)
        if status_code == 404:
            # Unknown card — report immediately if online
            print("Unknown card scanned (UID: {}). Reporting to admin...".format(uid))
            try:
                unknown_payload = {
                    "uid": uid,
                    "deviceSerial": DEVICE_SERIAL
                }
                api_post("/api/devices/unknown-card", unknown_payload)
                print("Unknown card successfully reported.")
                return {"success": False, "message": "Unknown card. Sent to admin."}
            except Exception as report_error:
                print("Failed to report unknown card:", report_error)
                return {"success": False, "error": "Report failed: {}".format(report_error)}
        else:
            # Network down — queue for later batch upload
            enqueue_payload(payload)
            print("Wi-Fi unavailable. Queued event for later upload (queue size: {}).".format(
                len(load_queue())
            ))
            return {"success": False, "queued": True, "error": str(error)}


def load_queue():
    try:
        with open(QUEUE_FILE, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return []


def save_queue(queue):
    with open(QUEUE_FILE, "w") as f:
        json.dump(queue, f)


def enqueue_payload(payload):
    queue = load_queue()
    max_size = 500
    while len(queue) >= max_size:
        queue.pop(0)  # Drop oldest event if full
    queue.append(payload)
    save_queue(queue)


def flush_queue():
    """
    Upload all queued events to the server in a single batch POST.
    On a 2xx response the queue is cleared.
    On any network/server error the queue is preserved and retried on the next flush.
    """
    queue = load_queue()
    if not queue:
        return 0

    print("Flushing {} queued event(s) via batch endpoint...".format(len(queue)))

    try:
        body = api_post("/api/attendance/hardware-punch/batch", {"events": queue})
        # Server accepted the batch (HTTP 200) — clear the local queue regardless of
        # per-event results (unknown cards etc.) so we don't re-upload indefinitely.
        save_queue([])
        summary = body.get("summary", {})
        print("Batch flush complete: accepted={}, skipped={}, errors={}".format(
            summary.get("accepted", "?"),
            summary.get("skipped", "?"),
            summary.get("errors", "?"),
        ))
        return summary.get("accepted", len(queue))
    except Exception as error:
        # Network down or server error — keep the queue and retry next cycle
        print("Batch flush failed ({}). Will retry next cycle.".format(error))
        return 0


def read_rfid_uid():
    # Replace this with the RFID reader driver and convert the UID bytes to
    # the decimal-dash format stored as Employee Code / RFID UID in IWMS.
    return "136-4-13-10"


def main():
    connect_wifi()

    uid = read_rfid_uid()
    result = send_rfid_punch(uid, DEFAULT_EVENT_TYPE)
    print(result)


main()
