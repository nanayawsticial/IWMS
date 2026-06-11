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

WIFI_SSID = "YOUR_WIFI_NAME"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

API_BASE = "http://192.168.2.50:3001"
DEVICE_SERIAL = "pico-gate-01"
DEFAULT_EVENT_TYPE = "clock_in"
FIRMWARE_VERSION = "pico2w-rfid-0.2.0"
QUEUE_FILE = "offline_queue.json"

# Hardware API key provisioned from IWMS Settings → Biometric Hardware → Provision.
# Leave as None if no key has been provisioned yet.
# Once provisioned in the UI, paste the full key here and re-upload this file to the Pico.
DEVICE_KEY = None  # e.g. "iwms_live_abc123..."


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
        body = response.json()
    finally:
        response.close()
    if not (200 <= status_code < 300):
        raise RuntimeError("HTTP {}".format(status_code))
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


def send_rfid_punch(uid, event_type=DEFAULT_EVENT_TYPE, flags=None, name=""):
    payload = build_punch_payload(uid, event_type, flags, name)
    try:
        result = api_post("/api/attendance/hardware-punch", payload)
        flush_queue()
        return result
    except Exception as error:
        enqueue_payload(payload)
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
        queue.pop(0)
    queue.append(payload)
    save_queue(queue)


def flush_queue():
    queue = load_queue()
    if not queue:
        return 0

    sent = 0
    remaining = []
    for payload in queue:
        try:
            api_post("/api/attendance/hardware-punch", payload)
            sent += 1
        except Exception:
            remaining.append(payload)
            break

    if sent < len(queue):
        remaining.extend(queue[sent + len(remaining):])
    save_queue(remaining)
    return sent


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
