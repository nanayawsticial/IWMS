"""
wifi_sync.py — WiFi manager + IWMS attendance event sync
Features:
  • Auto-connect and reconnect
  • POST punch events to IWMS REST API
  • Offline queue: buffers failed events to disk, retries when back online
  • Call wifi_sync.tick(now) once per main loop iteration

Upload this to the Pico alongside config.py and main.py.
"""

import network
import time
import json

try:
    import requests
except ImportError:
    import urequests as requests

import config


class WiFiSync:

    def __init__(self):
        self.wlan = network.WLAN(network.STA_IF)
        self.wlan.active(True)
        self._last_retry = 0
        self._last_flush  = 0
        self._queue = self._load_queue()

    # ── Connection ────────────────────────────────────────────────────────────

    def connect(self):
        """
        Attempt to join the configured WiFi network.
        Blocks for up to WIFI_TIMEOUT seconds.
        Returns True on success, False on timeout.
        """
        if self.wlan.isconnected():
            return True

        print("WiFi: connecting to '{}'…".format(config.WIFI_SSID))
        try:
            self.wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
        except Exception as e:
            print("WiFi: connect() error —", e)
            return False

        deadline = time.ticks_add(time.ticks_ms(), config.WIFI_TIMEOUT * 1000)
        while not self.wlan.isconnected():
            if time.ticks_diff(deadline, time.ticks_ms()) <= 0:
                print("WiFi: timed out")
                return False
            time.sleep_ms(250)

        print("WiFi: connected —", self.wlan.ifconfig()[0])
        return True

    def disconnect(self):
        self.wlan.disconnect()

    def is_connected(self):
        return self.wlan.isconnected()

    def ip_address(self):
        """Return current IP string, or None if offline."""
        if self.is_connected():
            return self.wlan.ifconfig()[0]
        return None

    # ── Tick (call from main loop) ────────────────────────────────────────────

    def tick(self, now):
        """
        Housekeeping — call once per main loop iteration with time.ticks_ms().
        Handles reconnection retries and flushing the offline queue.
        """
        if not self.is_connected():
            if time.ticks_diff(now, self._last_retry) >= config.WIFI_RETRY_MS:
                self._last_retry = now
                self.connect()
            return  # No point flushing if offline

        if self._queue:
            if time.ticks_diff(now, self._last_flush) >= config.SYNC_RETRY_MS:
                self._last_flush = now
                self.flush_queue()

    # ── Event posting ─────────────────────────────────────────────────────────

    def post_event(self, uid, name, event_type, timestamp, flags=None):
        """
        Send one attendance punch event to the IWMS server.

        If the server is unreachable the event is written to the offline queue
        on disk and retried the next time WiFi is available.

        Args:
            uid:        UID string from the RFID reader  e.g. "136-4-13-10"
            name:       Employee full name
            event_type: "clock_in"  or  "clock_out"
            timestamp:  ISO-8601 string  e.g. "2026-06-08T09:15:30"
            flags:      list of flag strings, e.g. ["LATE"]

        Returns:
            True  — event was delivered to the server immediately
            False — event was queued (offline or server error)
        """
        event_id = self._terminal_event_id(uid, event_type, timestamp)
        payload = {
            "device_id":         config.DEVICE_ID,
            "uid":               uid,
            "name":              name,
            "event_type":        event_type,
            "timestamp":         timestamp,
            "flags":             flags or [],
            "terminal_event_id": event_id,
            "firmware":          getattr(config, "FIRMWARE_VERSION", "pico2w-rfid"),
        }

        if self.is_connected() and self._try_post(payload):
            print("Sync ✓ {} {} → {}".format(event_type, name, timestamp))
            return True

        print("Sync: offline — queuing event for", name)
        self._enqueue(payload)
        return False

    def flush_queue(self):
        """
        Attempt to deliver all queued offline events.
        Stops on the first failure so we don't spam a slow server.
        """
        if not self._queue:
            return

        sent_indices = []
        for i, payload in enumerate(self._queue):
            if self._try_post(payload):
                sent_indices.append(i)
                print("Sync: flushed queued event for", payload.get("name", "?"))
            else:
                print("Sync: server still unreachable — will retry later")
                break

        if sent_indices:
            # Remove delivered events (iterate in reverse to preserve indices)
            for i in reversed(sent_indices):
                self._queue.pop(i)
            self._save_queue()

    def queue_length(self):
        return len(self._queue)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _terminal_event_id(self, uid, event_type, timestamp):
        safe_uid = str(uid).replace("-", "")
        safe_time = str(timestamp).replace("-", "").replace(":", "").replace("T", "")
        return "{}-{}-{}-{}".format(config.DEVICE_ID, safe_uid, event_type, safe_time)

    def _try_post(self, payload):
        """Execute one HTTP POST. Returns True on 2xx response."""
        url = config.SERVER_URL + config.PUNCH_ENDPOINT
        try:
            body = json.dumps(payload)
            headers = {"Content-Type": "application/json"}
            # Include hardware API key if one has been provisioned
            device_key = getattr(config, "DEVICE_KEY", None)
            if device_key:
                headers["X-Device-Key"] = device_key
            res  = requests.post(
                url,
                data=body,
                headers=headers,
                timeout=10,
            )
            ok = 200 <= res.status_code < 300
            if not ok:
                print("Sync: server returned", res.status_code)
            res.close()
            return ok
        except OSError as e:
            # Common on Pico: EHOSTUNREACH, ETIMEDOUT, etc.
            print("Sync: network error —", e)
            return False
        except Exception as e:
            print("Sync: unexpected error —", e)
            return False

    def _load_queue(self):
        try:
            with open(config.QUEUE_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except:
            pass
        return []

    def _enqueue(self, payload):
        max_size = getattr(config, "MAX_QUEUE_SIZE", 500)
        while len(self._queue) >= max_size:
            dropped = self._queue.pop(0)
            print("Queue: full (max {}), dropping oldest event for {}".format(max_size, dropped.get("name", "?")))
        self._queue.append(payload)
        self._save_queue()

    def _save_queue(self):
        try:
            with open(config.QUEUE_FILE, "w") as f:
                json.dump(self._queue, f)
        except Exception as e:
            print("Queue save error:", e)
